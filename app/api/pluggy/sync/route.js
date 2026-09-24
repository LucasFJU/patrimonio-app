import {adminClient,requireUser,apiError} from '../../../../lib/market-server.mjs';
import {applyPluggySync} from '../../../../lib/pluggy-cron.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request){try{const db=adminClient(),user=await requireUser(request,db);if(!process.env.OWNER_USER_ID)throw Object.assign(new Error('Configure OWNER_USER_ID na Vercel para restringir a sincronização ao proprietário.'),{status:503});if(user.id!==process.env.OWNER_USER_ID)throw Object.assign(new Error('A sincronização está disponível apenas para o proprietário.'),{status:403});const body=await request.json();if(typeof body.itemId!=='string')throw Object.assign(new Error('Item ID inválido.'),{status:400});return Response.json(await applyPluggySync(db,{userId:user.id,itemId:body.itemId}),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
