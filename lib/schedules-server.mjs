import {materializeSchedules} from './schedules.mjs';
import {validateState} from './portfolio.mjs';

export async function processScheduledPortfolio(db,userId){
 for(let attempt=0;attempt<3;attempt++){
  const {data:row,error}=await db.from('portfolios').select('data,version').eq('user_id',userId).maybeSingle();
  if(error)throw new Error('Falha ao consultar programações.');
  if(!row?.data?.finance)return {added:0};
  const result=materializeSchedules(row.data.finance);
  if(!result.changed)return {added:0};
  const next=validateState({...row.data,finance:result.finance});
  const {data,error:writeError}=await db.from('portfolios').update({data:next,version:row.version+1,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('version',row.version).select('version').maybeSingle();
  if(writeError)throw new Error('Falha ao registrar vencimentos.');
  if(data)return {added:result.added};
 }
 throw Object.assign(new Error('Conflito ao registrar vencimentos; será tentado no próximo ciclo.'),{status:409});
}
export async function processScheduledPortfolios(db){
 const {data:rows,error}=await db.from('portfolios').select('user_id');
 if(error)throw new Error('Falha ao consultar carteiras.');
 let added=0,failed=0;
 for(const row of rows||[]){try{added+=(await processScheduledPortfolio(db,row.user_id)).added;}catch{failed++;}}
 return {status:failed?'partial':'completed',added,failed};
}
