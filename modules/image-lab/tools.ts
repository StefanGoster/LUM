import { checkpoint } from './checkpoint';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { actions,buildBrief } from './core';
import { MENU_URI } from './widget';
import { downloadArtwork } from './transfer';
import { uploadAsset } from '../../lib/server/store';
import { LumError } from '../../lib/server/validation';
const short={type:'string',maxLength:1000};const actionSchema={type:'string',enum:actions.map(a=>a.id)};
const fileSchema={type:'object',properties:{download_url:{type:'string',maxLength:8192},file_id:{type:'string',maxLength:200},mime_type:{type:'string',maxLength:100},file_name:{type:'string',maxLength:200}},required:['download_url','file_id'],additionalProperties:false};
const checkpointItem={type:'object',properties:{name:{type:'string',maxLength:160},status:{type:'string',enum:['planned','generated','saved','blocked']},output_ref:{type:'string',maxLength:300},asset_src:{type:'string',maxLength:200},layer_id:{type:'string',maxLength:100},note:{type:'string',maxLength:300}},required:['name','status'],additionalProperties:false};
function tool(name:string,title:string,description:string,properties:Record<string,unknown>,required:string[],readOnly:boolean,meta?:Record<string,unknown>){return {name,title,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:false},...(meta?{_meta:meta}:{})};}
export const imageLabTools=[
 tool('lum_image_menu','Choose image actions','Show a compact checkbox menu for submitted creative artwork: Dissect, HD/Remaster, Clean Noise and Reimagine. First inspect the image in chat and supply a brief observation and useful recommendations. Does not upload, generate, or change a project. Skip this menu if the user already gave a clear action.',{observation:{type:'string',maxLength:600},recommended:{type:'array',maxItems:4,items:actionSchema}},[],true,{ui:{resourceUri:MENU_URI},'openai/outputTemplate':MENU_URI}),
 tool('lum_image_brief','Prepare image action','Compile independent image directions; this does not run an image model. Execute with the chat native image tool. Results default to chat; LUM saving is a separate optional step.',{actions:{type:'array',minItems:1,maxItems:4,items:actionSchema},target:{type:'string',maxLength:160},direction:short,destination:{type:'string',enum:['chat','lum']},fidelity:{type:'string',enum:['preserve','creative']}},['actions'],true),
 tool('lum_import_chat_file','Save a ChatGPT image to LUM','Optional file-reference bridge. Downloads an authorized PNG/JPEG/WebP server-side, max 12 MB, and returns a small asset reference. Use only when LUM saving is requested. Never send base64 or re-generate an image after a transfer failure. Does not create layers.',{file:fileSchema,name:{type:'string',maxLength:200}},['file'],false,{'openai/fileParams':['file']}),
 tool('lum_save_image_checkpoint','Save image progress','Save small resumable metadata, not image bytes. Retain actual output references; generated means output exists, saved means verified LUM layer exists. For updates use returned ID and revision; conflicts require readback. Never store signed URLs.',{checkpoint_id:{type:'string',maxLength:100},expected_revision:{type:'integer',minimum:0},source_ref:{type:'string',maxLength:300},project_id:{type:'string',maxLength:100},actions:{type:'array',minItems:1,maxItems:4,items:actionSchema},items:{type:'array',maxItems:20,items:checkpointItem}},['source_ref','actions','items'],false),
 tool('lum_get_image_checkpoint','Read image progress','Read the saved metadata checkpoint before resuming. Skip completed objects, report expired/missing output files honestly; a checkpoint is not image storage.',{checkpoint_id:{type:'string',maxLength:100}},['checkpoint_id'],true),
];
const action=z.enum(['dissect','hd','denoise','reimagine']);
export async function callImageLabTool(name:string,raw:unknown):Promise<unknown>{
 try{
 if(name==='lum_image_menu'){const a=z.object({observation:z.string().max(600).optional(),recommended:z.array(action).max(4).optional()}).strict().parse(raw);return {status:'awaiting_choice',observation:a.observation??'Choose what to do with your submitted artwork.',recommended:a.recommended??[],actions,destination:'chat',generationPerformed:false,menuUrl:'https://lum-studio.ghoster555.chatgpt.site/image-tools'};}
 if(name==='lum_image_brief'){return buildBrief(z.object({actions:z.array(action).min(1).max(4),target:z.string().max(160).optional(),direction:z.string().max(1000).optional(),destination:z.enum(['chat','lum']).optional(),fidelity:z.enum(['preserve','creative']).optional()}).strict().parse(raw));}
 if(name==='lum_import_chat_file'){const a=z.object({file:z.object({download_url:z.string().max(8192),file_id:z.string().min(1).max(200),mime_type:z.string().max(100).optional(),file_name:z.string().max(200).optional()}).strict(),name:z.string().max(200).optional()}).strict().parse(raw);const d=await downloadArtwork(a.file.download_url);const asset=await uploadAsset(d.bytes,d.mime,a.name??a.file.file_name??'Chat image',true);return {...asset,byteLength:d.byteLength,mimeType:d.mime,status:'asset_saved',layerCreated:false};}
 if(name==='lum_save_image_checkpoint'){
   const a=checkpoint.parse(raw);if(!env.BUCKET)throw new Error('Progress storage unavailable.');
   const id=a.checkpoint_id??crypto.randomUUID(),key=`image-lab/checkpoints/${id}.json`;
   const previous=await env.BUCKET.get(key);const prior=previous?await previous.json<{revision:number}>():null;
   if(a.checkpoint_id&&!prior)throw new LumError('Checkpoint not found.',404,'checkpoint_not_found');
   if(prior&&a.expected_revision!==prior.revision)throw new LumError('Checkpoint changed. Read it before updating.',409,'revision_conflict',prior.revision);
   const saved={...a,checkpoint_id:id,revision:(prior?.revision??0)+1,updatedAt:new Date().toISOString()};delete saved.expected_revision;
   const put=await env.BUCKET.put(key,JSON.stringify(saved),{onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
   if(!put)throw new LumError('Checkpoint changed while saving. Read it before retrying.',409,'revision_conflict');
   return {checkpoint_id:id,revision:saved.revision,status:'checkpoint_saved',counts:Object.fromEntries(['planned','generated','saved','blocked'].map(s=>[s,a.items.filter(i=>i.status===s).length]))};
 }
 if(name==='lum_get_image_checkpoint'){const a=z.object({checkpoint_id:z.string().regex(/^[\w-]{1,100}$/)}).strict().parse(raw);const object=await env.BUCKET?.get(`image-lab/checkpoints/${a.checkpoint_id}.json`);if(!object)throw new LumError('Checkpoint not found.',404,'checkpoint_not_found');return await object.json();}
 throw new LumError('Unknown Image Lab action.');
 }catch(e){if(e instanceof LumError)throw e;throw new LumError(e instanceof z.ZodError?'Invalid Image Lab input. Use short metadata and valid file references.':e instanceof Error?e.message:'Image Lab could not complete this action.',400,'image_lab_error');}
}
