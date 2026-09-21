import {adminClient,requireUser,updateMarket,apiError} from '../../../lib/market-server.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request){try{const db=adminClient();await requireUser(request,db);return Response.json(await updateMarket(db,{manual:true}),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
