import { env } from 'cloudflare:workers';
import type { LumDocument,ProjectSummary } from '../types';
import { LumError,parseDocument,assertLockedLayers,assertRevision,blankDocument,validateAsset,artworkImageContent } from './validation';

function db(){if(!env.DB)throw new LumError('Project storage is unavailable.',503,'storage_unavailable');return env.DB;}
export async function listProjects():Promise<ProjectSummary[]>{
  const result=await db().prepare('SELECT id,name,revision,updated_at AS updatedAt FROM lum_projects ORDER BY updated_at DESC LIMIT 100').all<ProjectSummary>();return result.results;
}
export async function getProject(id:string):Promise<LumDocument>{
  const row=await db().prepare('SELECT document FROM lum_projects WHERE id = ?').bind(id).first<{document:string}>();
  if(!row)throw new LumError('Project was not found.',404,'project_not_found');return JSON.parse(row.document);
}
export async function createProject(input?:unknown,name?:string):Promise<LumDocument>{
  let document=parseDocument(input??blankDocument(name));
  document={...document,id:crypto.randomUUID(),revision:1,updatedAt:new Date().toISOString()};
  await db().prepare('INSERT INTO lum_projects (id,name,document,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(document.id,document.name,JSON.stringify(document),document.revision,document.updatedAt,document.updatedAt).run();
  return document;
}
export async function saveProject(id:string,input:unknown,expectedRevision:number,unlockLayerIds:string[]=[]):Promise<LumDocument>{
  if(!Number.isInteger(expectedRevision)||expectedRevision<1)throw new LumError('expectedRevision must be the saved project revision.');
  const next=parseDocument(input);
  if(next.id!==id)throw new LumError('Document ID does not match the requested project.');
  const current=await getProject(id);assertRevision(current,expectedRevision);assertLockedLayers(current,next,unlockLayerIds);
  const document={...next,revision:expectedRevision+1,updatedAt:new Date().toISOString()};
  const result=await db().prepare('UPDATE lum_projects SET name=?,document=?,revision=?,updated_at=? WHERE id=? AND revision=?').bind(document.name,JSON.stringify(document),document.revision,document.updatedAt,id,expectedRevision).run();
  if(result.meta.changes!==1){const latest=await getProject(id);throw new LumError('The project changed while this edit was saving. Reload before retrying.',409,'revision_conflict',latest.revision);}
  return document;
}
export async function uploadAsset(bytes:ArrayBuffer,mime:string,name='Artwork',contentAddressed=false){
  mime=validateAsset(bytes,mime);
  if(!env.BUCKET)throw new LumError('Asset storage is unavailable.',503,'storage_unavailable');
  const id=contentAddressed?'sha256-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''):crypto.randomUUID();await env.BUCKET.put(`assets/${id}`,bytes,{httpMetadata:{contentType:mime},customMetadata:{name:name.slice(0,200)}});
  return {id,src:`/api/assets/${id}`};
}
export async function getAsset(id:string){
  if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new LumError('Invalid asset ID.');
  if(!env.BUCKET)throw new LumError('Asset storage is unavailable.',503,'storage_unavailable');
  const asset=await env.BUCKET.get(`assets/${id}`);if(!asset)throw new LumError('Artwork was not found.',404,'asset_not_found');
  const headers=new Headers({'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"});asset.writeHttpMetadata(headers);headers.set('ETag',asset.httpEtag);return new Response(asset.body,{headers});
}

/** Read only an uploaded asset already referenced by a layer in this studio. */
export async function readArtworkForModel(src:string){
  const match=/^\/api\/assets\/([a-zA-Z0-9_-]+)$/.exec(src);
  if(!match)throw new LumError('Inspection requires an uploaded LUM artwork asset. Reimport this image using Upload or Paste first.',400,'inspection_requires_upload');
  if(!env.BUCKET)throw new LumError('Asset storage is unavailable.',503,'storage_unavailable');
  const asset=await env.BUCKET.get(`assets/${match[1]}`);
  if(!asset)throw new LumError('Artwork was not found.',404,'asset_not_found');
  if(asset.size>8_000_000)throw new LumError('This artwork is too large to inspect in chat. Import a raster preview smaller than 8 MB.',413,'inspection_too_large');
  return artworkImageContent(await asset.arrayBuffer(),asset.httpMetadata?.contentType??'application/octet-stream');
}
