import {adminClient,validCron,updateMarket,apiError} from '../../../lib/market-server.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request){if(!validCron(request))return Response.json({error:'Não autorizado.'},{status:401});try{return Response.json(await updateMarket(adminClient()),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
