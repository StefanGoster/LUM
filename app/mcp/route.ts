import { mcpTools,callMcpTool,isRichToolResult } from '@/lib/server/mcp-tools';
import { readJson } from '@/lib/server/http';
import { LumError } from '@/lib/server/validation';
export const dynamic='force-dynamic';
const serverInfo={name:'lum',version:'1.1.0',title:'LUM · Private design studio'};
const instructions='LUM is a private, persistent layered design editor. ChatGPT provides instructions through its tools. Read the current project before editing and supply its revision. Preserve locks, original assets, reference provenance and source geometry. Never claim a render was generated: lum_prepare_render prepares a brief only. Use available image-generation tools separately, then import results as distinct candidate layers. The private visual editor is https://lum-studio.ghoster555.chatgpt.site.';
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
