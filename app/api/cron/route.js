import {processScheduledPortfolios} from '../../../lib/schedules-server.mjs';
import {adminClient,validCron,updateMarket,apiError} from '../../../lib/market-server.mjs';
import {syncPluggyPortfolios} from '../../../lib/pluggy-cron.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request){if(!validCron(request))return Response.json({error:'Não autorizado.'},{status:401});try{const db=adminClient(),scheduled=await processScheduledPortfolios(db),results=await Promise.allSettled([updateMarket(db),syncPluggyPortfolios(db)]);return Response.json({scheduled,market:results[0].status==='fulfilled'?'ok':'failed',pluggy:results[1].status==='fulfilled'?results[1].value:{status:'failed'}},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
