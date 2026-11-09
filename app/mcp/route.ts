import { mcpTools,callMcpTool,isRichToolResult } from '@/lib/server/mcp-tools';
import { readJson } from '@/lib/server/http';
import { LumError } from '@/lib/server/validation';
export const dynamic='force-dynamic';
const serverInfo={name:'lum',version:'1.1.1',title:'LUM · Private design studio'};
const instructions=[
  'LUM is a private, persistent layered design editor. ChatGPT orchestrates the work through these tools. Read the current project before editing and supply its revision. Preserve locks, original assets, reference provenance and source geometry. The private visual editor is https://lum-studio.ghoster555.chatgpt.site.',
  'CHAT COMMAND: When the user attaches an image and asks to "dissect" or "dissect into LUM", treat this as a request to prepare named transparent objects and import them into LUM. This is a conversational workflow, not an automatic segmentation endpoint. Use the attached image, or inspect the explicitly selected LUM source. If the source is ambiguous, resolve it before generating. Create a new project unless the user selected a destination; never overwrite an existing project.',
  'Plan the semantic objects, overlap order and placement. Upload and retain the original as a locked, hidden source layer. Prefer the image tools already available in the conversation for one transparent object per output, referencing the same original for every object. A separately hosted engine or API key is not required for this chat-guided generative workflow. Do not silently activate a paid provider or invent unavailable image tools.',
  'Explain that native generative isolation can alter details and reconstruct occluded areas; it is not guaranteed pixel extraction or recovery of original Photoshop layers. If the user requires exact extraction, use an available suitable masking/segmentation capability or explain the limitation rather than substituting regeneration. Keep exact lettering from supplied vector/source artwork where available. Never invent historically authentic details. Record reconstructed or uncertain content in each layer sourceNote.',
  'Inspect each output for real alpha, complete object boundaries and consistent placement. Use shared artboard coordinates or explicitly placed cropped objects; never stretch outputs blindly. Upload the actual assets with lum_upload_asset, then add the prepared objects through lum_import_layer_bundle using the current revision. Re-read the saved project, verify the imported objects and report the project link plus any unresolved quality limitations. Do not claim completion before the assets and layers are saved.',
  'For "reimagine" with a selected layer, prepare only that replacement as a separate candidate and preserve all other objects through composition. For new designs requested as layers, plan and generate separate objects from the outset. Never claim lum_prepare_render generated an image: it prepares a brief only. Image generation is performed separately by available conversation tools.',
].join('\n\n');
function result(id:unknown,value:unknown){return Response.json({jsonrpc:'2.0',id,result:value});}
function error(id:unknown,code:number,message:string){return Response.json({jsonrpc:'2.0',id,error:{code,message}});}
export async function POST(request:Request){
  let body:any;try{body=await readJson(request,18_000_000);}catch{return error(null,-32700,'Invalid JSON request.');}
  if(!body||Array.isArray(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string')return error(body?.id??null,-32600,'A single JSON-RPC 2.0 request is required.');
  if(!('id' in body))return new Response(null,{status:202});
  const id=body.id;
  switch(body.method){
    case 'server/discover':return result(id,{serverInfo,supportedVersions:['2026-07-28','2025-06-18','2025-03-26'],capabilities:{tools:{}},instructions});
    case 'initialize':return result(id,{protocolVersion:['2026-07-28','2025-06-18','2025-03-26'].includes(body.params?.protocolVersion)?body.params.protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo,instructions});
    case 'ping':return result(id,{});
    case 'tools/list':return result(id,{tools:mcpTools});
    case 'tools/call':try{const data=await callMcpTool(body.params?.name,body.params?.arguments??{});if(isRichToolResult(data))return result(id,{content:data.content,structuredContent:data.structuredContent,isError:false});return result(id,{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false});}catch(e){const known=e instanceof LumError;return result(id,{content:[{type:'text',text:known?e.message:'LUM could not complete this request. Try again.'}],isError:true,structuredContent:{error:known?e.message:'Server error',code:known?e.code:'server_error',...(known&&e.currentRevision!==undefined?{currentRevision:e.currentRevision}:{})}});}
    case 'resources/list':return result(id,{resources:[]});
    case 'prompts/list':return result(id,{prompts:[]});
    default:return error(id,-32601,'Method not found.');
  }
}
export async function GET(){return Response.json({name:'LUM',transport:'MCP JSON-RPC POST',studio:'https://lum-studio.ghoster555.chatgpt.site'},{headers:{Allow:'POST, GET'}});}
