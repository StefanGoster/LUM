import { listProjects,createProject } from '@/lib/server/store';
import { apiError,readJson,verifyBrowserOrigin } from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({projects:await listProjects()});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{verifyBrowserOrigin(request);const body=await readJson(request);return Response.json({document:await createProject(body.document,typeof body.name==='string'?body.name:undefined)},{status:201});}catch(e){return apiError(e);}}
