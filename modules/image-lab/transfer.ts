/** Server-only transport; signed URLs are never echoed or persisted. */
export const MAX_ASSET_BYTES=12_000_000;
export function allowedFileUrl(value:string):URL {
  let u:URL;try{u=new URL(value);}catch{throw new Error('Invalid file URL.');}
  const h=u.hostname.toLowerCase();
  const allowed=/^sdmntpr[a-z0-9-]*\.oaiusercontent\.com$/.test(h)
    || /^oaisd(?:mnt|sor)pr[a-z0-9-]*\.blob\.core\.windows\.net$/.test(h)
    || /^oaisdmntpr[a-z0-9-]*\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(h)
    || h==='files.oaiusercontent.com';
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!allowed)throw new Error('Use a ChatGPT-provided file download URL. For other files, use LUM file upload.');
  return u;
}
export async function downloadArtwork(url:string,fetcher:typeof fetch=fetch){
  const u=allowedFileUrl(url);
  let response:Response;try{response=await fetcher(u,{redirect:'manual',signal:AbortSignal.timeout(20000)});}catch{throw new Error('File download failed. Obtain a fresh authorized reference or use file upload.');}
  if(!response.ok){await response.body?.cancel();throw new Error('File download failed or expired. Obtain a fresh file reference; do not retry the same URL.');}
  const mime=(response.headers.get('content-type')??'').split(';')[0].trim();
  if(!['image/png','image/jpeg','image/webp'].includes(mime)){await response.body?.cancel();throw new Error('Only PNG, JPEG and WebP file imports are supported.');}
  if(Number(response.headers.get('content-length')??0)>MAX_ASSET_BYTES){await response.body?.cancel();throw new Error('Image exceeds the 12 MB import limit.');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty download.');
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_ASSET_BYTES)throw new Error('Image exceeds the 12 MB import limit.');chunks.push(value);}}catch(e){await reader.cancel();throw e;}
  if(!total)throw new Error('Empty download.');
  const data=new Uint8Array(total);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  return {bytes:data.buffer,mime,byteLength:total};
}
