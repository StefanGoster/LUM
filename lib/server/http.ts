import { LumError } from './validation';
export function apiError(error:unknown){
  if(error instanceof LumError)return Response.json({error:error.message,code:error.code,...(error.currentRevision!==undefined?{currentRevision:error.currentRevision}:{})},{status:error.status});
  console.error('LUM request failed',error instanceof Error?error.message:'Unknown error');
  return Response.json({error:'LUM could not complete this request. Please try again.',code:'server_error'},{status:500});
}
export async function readJson(request:Request,maxBytes=11_000_000):Promise<any>{
  const contentLength=Number(request.headers.get('content-length')||0);
  if(contentLength>maxBytes)throw new LumError('Request is too large.',413,'request_too_large');
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
  if(reader){try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new LumError('Request is too large.',413,'request_too_large');chunks.push(value);}}catch(e){await reader.cancel();throw e;}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const text=new TextDecoder().decode(bytes);
  try{return JSON.parse(text);}catch{throw new LumError('Request body must be valid JSON.');}
}
export function verifyBrowserOrigin(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)throw new LumError('Cross-origin writes are not allowed.',403,'invalid_origin');
}
