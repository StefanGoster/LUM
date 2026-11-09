import { getAsset } from '@/lib/server/store';
import { apiError } from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{return await getAsset((await context.params).id);}catch(e){return apiError(e);}}
