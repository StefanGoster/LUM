import { uploadAsset } from '@/lib/server/store';
import { apiError,verifyBrowserOrigin } from '@/lib/server/http';
import { LumError } from '@/lib/server/validation';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{verifyBrowserOrigin(request);if(Number(request.headers.get('content-length')||0)>12_000_000)throw new LumError('Artwork must be smaller than 12 MB.',413,'asset_too_large');return Response.json(await uploadAsset(await request.arrayBuffer(),request.headers.get('content-type')||'',request.headers.get('x-file-name')||'Artwork'),{status:201});}catch(e){return apiError(e);}}
