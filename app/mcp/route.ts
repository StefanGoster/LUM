import { imageLabHtml,MENU_URI } from '@/modules/image-lab/widget';
import { mcpTools,callMcpTool,isRichToolResult } from '@/lib/server/mcp-tools';
import { readJson } from '@/lib/server/http';
import { LumError } from '@/lib/server/validation';
export const dynamic='force-dynamic';
const serverInfo={name:'lum',version:'2.0.0',title:'LUM · Image Lab and private studio'};
const instructions=[
 'LUM Image Lab is chat-first: recognition, Dissect, HD/Remaster, Clean Noise and Reimagine use native image tools in the current chat. LUM is optional storage. A bare dissect request defaults to chat outputs, not a new LUM project. Never interpret a screenshot of a bug as an artwork editing request.',
 'Inspect submitted artwork and use lum_image_menu for a short useful menu only when intent is unspecified. Skip redundant questions when an action is clear. lum_image_brief prepares directions, not images. Do not claim automatic observation of unsent uploads or unrelated chats.',
 'Dissect prepares named transparent candidates one at a time. Preserve the original, show each result immediately, checkpoint completed references, and continue pending objects only. Generative isolation can alter pixels and reconstruct hidden areas; it is not exact extraction. HD and noise cleanup must preserve intentional textures and lettering; do not claim DLSS or unverified resolution. Reimagine only the selected target as a separate candidate.',
 'Never read, print, stringify, or manually relay base64 image payloads through the conversation. Keep byte operations outside model-visible output. Use lum_import_chat_file with actual authorized file references only when the user selected LUM saving. Never invent download URLs. A failed transfer must not restart generation; retain chat results and offer normal file upload if no supported reference exists. Do not loop retries.',
 'For LUM saves, preserve source as a locked hidden layer, import each completed object independently with lum_import_layer_bundle, read latest revisions, respect locks and verify saved layers before claiming completion. On uncertain writes, read first and skip existing layer IDs. Use metadata checkpoints for resume; a checkpoint does not store the image itself. Never persist signed URLs in notes.',
 'The private studio is https://lum-studio.ghoster555.chatgpt.site. Preserve original assets, project geometry and source provenance. No separate paid inference service is active. Prompt/menu tools never generate an image themselves.',
].join('\n\n');
function result(id:unknown,value:unknown){return Response.json({jsonrpc:'2.0',id,result:value});}
function error(id:unknown,code:number,message:string){return Response.json({jsonrpc:'2.0',id,error:{code,message}});}
export async function POST(request:Request){
  let body:any;try{body=await readJson(request,262144);}catch{return error(null,-32700,'Invalid JSON request.');}
  if(!body||Array.isArray(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string')return error(body?.id??null,-32600,'A single JSON-RPC 2.0 request is required.');
  if(!('id' in body))return new Response(null,{status:202});
  const id=body.id;
  switch(body.method){
    case 'server/discover':return result(id,{serverInfo,supportedVersions:['2026-07-28','2025-06-18','2025-03-26'],capabilities:{tools:{},resources:{}},instructions});
    case 'initialize':return result(id,{protocolVersion:['2026-07-28','2025-06-18','2025-03-26'].includes(body.params?.protocolVersion)?body.params.protocolVersion:'2025-06-18',capabilities:{tools:{},resources:{}},serverInfo,instructions});
    case 'ping':return result(id,{});
    case 'tools/list':return result(id,{tools:mcpTools});
    case 'tools/call':try{const data=await callMcpTool(body.params?.name,body.params?.arguments??{});if(isRichToolResult(data))return result(id,{content:data.content,structuredContent:data.structuredContent,isError:false});if(JSON.stringify(data).length>131072)throw new LumError('Result is too large for chat. Open the studio for this document; do not request encoded image data.',413,'result_too_large');return result(id,{content:[{type:'text',text:'LUM operation completed. See structured result.'}],structuredContent:data,isError:false});}catch(e){const known=e instanceof LumError;return result(id,{content:[{type:'text',text:known?e.message:'LUM could not complete this request. Try again.'}],isError:true,structuredContent:{error:known?e.message:'Server error',code:known?e.code:'server_error',...(known&&e.currentRevision!==undefined?{currentRevision:e.currentRevision}:{})}});}
    case 'resources/list':return result(id,{resources:[{uri:MENU_URI,name:'LUM Image Lab',mimeType:'text/html;profile=mcp-app'}]});
    case 'resources/read':return body.params?.uri===MENU_URI?result(id,{contents:[{uri:MENU_URI,mimeType:'text/html;profile=mcp-app',text:imageLabHtml,_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}}}}]}):error(id,-32602,'Unknown resource.');
    case 'prompts/list':return result(id,{prompts:[]});
    default:return error(id,-32601,'Method not found.');
  }
}
export async function GET(){return Response.json({name:'LUM',transport:'MCP JSON-RPC POST',studio:'https://lum-studio.ghoster555.chatgpt.site'},{headers:{Allow:'POST, GET'}});}
