import { getProject,saveProject } from '@/lib/server/store';
import { apiError,readJson,verifyBrowserOrigin } from '@/lib/server/http';
import { LumError } from '@/lib/server/validation';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){try{return Response.json({document:await getProject((await context.params).id)});}catch(e){return apiError(e);}}
export async function PUT(request:Request,context:Context){try{verifyBrowserOrigin(request);const body=await readJson(request);if(body.unlockLayerIds!==undefined&&(!Array.isArray(body.unlockLayerIds)||body.unlockLayerIds.some((v:unknown)=>typeof v!=='string')))throw new LumError('unlockLayerIds must be an array of layer IDs.');return Response.json({document:await saveProject((await context.params).id,body.document,body.expectedRevision,body.unlockLayerIds)});}catch(e){return apiError(e);}}
