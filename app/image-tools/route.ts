import { imageLabHtml } from '@/modules/image-lab/widget';
export async function GET(){return new Response(imageLabHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
