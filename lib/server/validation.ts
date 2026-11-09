import { z } from 'zod';
import type { LumDocument, LumLayer } from '../types';

export class LumError extends Error {
  status: number;
  code: string;
  currentRevision?: number;
  constructor(message: string, status = 400, code = 'invalid_request', currentRevision?: number) {
    super(message); this.name='LumError'; this.status=status; this.code=code; this.currentRevision=currentRevision;
  }
}
const finite = z.number().finite();
const bounded = (min: number,max: number) => finite.min(min).max(max);
const color = z.string().max(60).refine(v=> /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|black|white|none)$/.test(v),'Use a hex, rgb, hsl, or transparent color.');
const id = z.string().min(1).max(100).regex(/^[\w-]+$/);
export const roleSchema = z.enum(['structure','style','palette','subject','source']);
export const recipeSchema = z.enum(['original','archive','noir','signal','sand']);
export const sourceSchema = z.string().max(8_000_000).refine(v=> /^\/api\/assets\/[a-zA-Z0-9_-]+$/.test(v)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(v)||/^\/samples\/[a-zA-Z0-9_.-]+\.(svg|png|jpg|webp)$/.test(v), 'Use an uploaded LUM asset or a PNG/JPEG/WebP data URI. External image URLs must be uploaded first.');
export const layerSchema = z.object({
  id, name:z.string().min(1).max(160), kind:z.enum(['rect','ellipse','text','image','path']),
  x:bounded(-100000,100000),y:bounded(-100000,100000),width:bounded(.01,20000),height:bounded(.01,20000),
  rotation:bounded(-36000,36000),opacity:bounded(0,1),visible:z.boolean(),locked:z.boolean(),fill:color,
  stroke:color.optional(),strokeWidth:bounded(0,1000).optional(),text:z.string().max(10000).optional(),
  fontSize:bounded(1,5000).optional(),fontFamily:z.string().max(100).optional(),fontWeight:bounded(100,900).optional(),src:sourceSchema.optional(),
  path:z.string().max(300000).regex(/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+eE-]*$/).optional(),
  mask:z.object({kind:z.enum(['ellipse','rect']),inset:bounded(0,.49),inverted:z.boolean().optional()}).nullable().optional(),
  role:roleSchema.optional(),structureStrength:bounded(0,1).optional(),sourceNote:z.string().max(10000).optional(),
}).strict();
export const referenceSchema = z.object({id,name:z.string().min(1).max(160),src:sourceSchema,role:roleSchema,note:z.string().max(10000).optional(),strength:bounded(0,1)}).strict();
export const documentSchema = z.object({
  version:z.literal(1),id,name:z.string().min(1).max(160),width:bounded(64,10000),height:bounded(64,10000),background:color,transparent:z.boolean(),
  layers:z.array(layerSchema).max(200),references:z.array(referenceSchema).max(50),recipe:recipeSchema,notes:z.string().max(30000),
  revision:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),updatedAt:z.string().max(100),
}).strict().superRefine((doc,ctx)=>{
  if(new Set(doc.layers.map(l=>l.id)).size!==doc.layers.length)ctx.addIssue({code:'custom',message:'Layer IDs must be unique.',path:['layers']});
  if(new Set(doc.references.map(l=>l.id)).size!==doc.references.length)ctx.addIssue({code:'custom',message:'Reference IDs must be unique.',path:['references']});
  for(const [index,layer] of doc.layers.entries()){
    if(layer.kind==='image'&&!layer.src)ctx.addIssue({code:'custom',message:'Image layers need an asset.',path:['layers',index,'src']});
    if(layer.kind==='path'&&!layer.path)ctx.addIssue({code:'custom',message:'Path layers need SVG path data.',path:['layers',index,'path']});
  }
});
export function parseDocument(value:unknown):LumDocument {
  const parsed=documentSchema.safeParse(value);
  if(!parsed.success)throw new LumError(parsed.error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('; '));
  if(JSON.stringify(parsed.data).length>10_000_000)throw new LumError('Project exceeds the 10 MB document limit. Upload images as assets.',413,'document_too_large');
  return parsed.data as LumDocument;
}
const stable = (value: unknown):string => {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
  return JSON.stringify(value);
};
export function assertLockedLayers(current:LumDocument,next:LumDocument,explicitUnlockIds:string[]=[]){
  for(const layer of current.layers.filter(l=>l.locked)){
    const proposed=next.layers.find(l=>l.id===layer.id);
    if(explicitUnlockIds.includes(layer.id))continue;
    if(!proposed)throw new LumError(`Unlock “${layer.name}” before deleting it.`,409,'layer_locked');
    // Unlock is a discrete intent; modifying content while unlocking requires explicit authorization.
    const comparable={...proposed,locked:true};
    if(stable(layer)!==stable(comparable))throw new LumError(`“${layer.name}” is locked. Unlock it before editing.`,409,'layer_locked');
  }
}
export function applyLayerPatches(current:LumDocument,patches:Array<{id:string;changes:Partial<LumLayer>}>,unlockLayerIds:string[]=[]):LumDocument {
  const ids=new Set<string>();
  const layers=current.layers.map(l=>({...l}));
  for(const patch of patches){
    if(ids.has(patch.id))throw new LumError('Each layer may be patched only once per operation.');
    ids.add(patch.id);
    const index=layers.findIndex(l=>l.id===patch.id);
    if(index<0)throw new LumError(`Layer ${patch.id} was not found.`,404,'layer_not_found');
    if('id' in patch.changes && patch.changes.id!==patch.id)throw new LumError('A layer ID cannot be changed.');
    const parsed=layerSchema.safeParse({...layers[index],...patch.changes,id:patch.id});
    if(!parsed.success)throw new LumError(parsed.error.message);
    layers[index]=parsed.data as LumLayer;
  }
  const next={...current,layers}; assertLockedLayers(current,next,unlockLayerIds);return next;
}
export function assertRevision(current:LumDocument,expected:number){
  if(current.revision!==expected)throw new LumError('The project changed in another window or ChatGPT. Reload the latest revision before applying edits.',409,'revision_conflict',current.revision);
}
export function blankDocument(name='Untitled study'):LumDocument {
  return {version:1,id:crypto.randomUUID(),name,width:1200,height:1500,background:'#e8e3d6',transparent:false,layers:[],references:[],recipe:'original',notes:'',revision:0,updatedAt:new Date().toISOString()};
}

const allowedTypes=new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
export function validateAsset(bytes:ArrayBuffer,inputMime:string){
  const mime=inputMime.split(';')[0].trim().toLowerCase();
  if(!allowedTypes.has(mime))throw new LumError('Use PNG, JPEG, WebP, or SVG artwork.',415,'unsupported_asset');
  if(bytes.byteLength===0||bytes.byteLength>12_000_000)throw new LumError('Artwork must be between 1 byte and 12 MB.',413,'asset_too_large');
  const prefix=new Uint8Array(bytes.slice(0,12));
  if(mime==='image/png'&&!(prefix[0]===137&&prefix[1]===80&&prefix[2]===78&&prefix[3]===71))throw new LumError('The file is not a valid PNG.');
  if(mime==='image/jpeg'&&!(prefix[0]===255&&prefix[1]===216&&prefix[2]===255))throw new LumError('The file is not a valid JPEG.');
  if(mime==='image/webp'&&!(new TextDecoder().decode(prefix.slice(0,4))==='RIFF'&&new TextDecoder().decode(prefix.slice(8,12))==='WEBP'))throw new LumError('The file is not a valid WebP.');
  if(mime==='image/svg+xml'){
    const svg=new TextDecoder().decode(bytes);
    // Standard XML namespace URIs identify vocabularies; they are not remote fetches.
    const content=svg.replace(/\sxmlns(?::[\w-]+)?\s*=\s*(["'])http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)\1/gi,'');
    if(!/<svg[\s>]/i.test(svg)||/<\s*(script|style|foreignObject|iframe|object|embed|image|use|audio|video|animate|set)\b/i.test(content)||/\bon[a-z]+\s*=/i.test(content)||/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|url\s*\(|@import|javascript:|data:|https?:|\b(?:href|src)\s*=/i.test(content))throw new LumError('This SVG contains external links or active content. Export a plain, self-contained SVG or PNG.',400,'unsafe_svg');
  }
  return mime;
}

/** Validate a whole proposed bundle before producing any changed document. */
export function appendLayerBundle(current:LumDocument,input:unknown,expectedRevision:number,sourceNote?:string):LumDocument {
  assertRevision(current,expectedRevision);
  const parsed=z.array(layerSchema).min(1).max(50).safeParse(input);
  if(!parsed.success)throw new LumError(parsed.error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('; '));
  if(sourceNote!==undefined&&(typeof sourceNote!=='string'||sourceNote.length>10000))throw new LumError('Source note must be at most 10,000 characters.');
  const ids=new Set(current.layers.map(layer=>layer.id));
  const layers=parsed.data.map(layer=>{
    if(ids.has(layer.id))throw new LumError(`Layer ID ${layer.id} already exists in the project or bundle.`,409,'duplicate_layer');
    ids.add(layer.id);
    return {...layer,...(sourceNote&&!layer.sourceNote?{sourceNote}:{} )};
  });
  const next=parseDocument({...current,layers:[...current.layers,...layers]});
  assertLockedLayers(current,next);
  return next;
}

export function artworkImageContent(bytes:ArrayBuffer,inputMime:string){
  if(bytes.byteLength>8_000_000)throw new LumError('This artwork is too large to inspect in chat. Import a PNG, JPEG or WebP preview smaller than 8 MB.',413,'inspection_too_large');
  const mimeType=validateAsset(bytes,inputMime);
  if(mimeType==='image/svg+xml')throw new LumError('SVG inspection is not supported by chat image content. Export or import a PNG preview of this layer.',415,'inspection_requires_raster');
  const view=new Uint8Array(bytes);let binary='';
  for(let offset=0;offset<view.length;offset+=32768)binary+=String.fromCharCode(...view.subarray(offset,offset+32768));
  return {type:'image' as const,mimeType,data:btoa(binary)};
}
