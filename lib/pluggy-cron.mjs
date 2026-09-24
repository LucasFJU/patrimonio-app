import {fetchPluggyItem} from './pluggy-server.mjs';
import {mergePluggyData} from './pluggy-sync.mjs';
import {validateState} from './portfolio.mjs';

export async function applyPluggySync(db,{userId,itemId}){
 const {data:row,error}=await db.from('portfolios').select('data,version').eq('user_id',userId).maybeSingle();
 if(error)throw Object.assign(new Error('Não foi possível carregar a carteira para sincronizar.'),{status:503});
 if(!row?.data?.finance?.pluggy?.itemId||row.data.finance.pluggy.itemId!==itemId)throw Object.assign(new Error('O Item ID não corresponde à conexão salva nesta carteira.'),{status:403});
 const payload=await fetchPluggyItem(itemId,'2026-08-01'),merged=mergePluggyData(row.data,payload),next=validateState({...row.data,events:merged.events,finance:merged.finance});
 const {data,error:updateError}=await db.from('portfolios').update({data:next,version:row.version+1,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('version',row.version).select('version').maybeSingle();
 if(updateError)throw Object.assign(new Error('Não foi possível salvar a sincronização.'),{status:503});
 if(!data)throw Object.assign(new Error('A carteira mudou em outro dispositivo durante a sincronização. Atualize a página e tente novamente.'),{status:409});
 return {state:next,version:data.version,imported:merged.imported,skippedAccounts:merged.skippedAccounts,updatedAt:merged.updatedAt,products:merged.finance.pluggy.products};
}

export async function syncPluggyPortfolios(db){
 if(!process.env.PLUGGY_CLIENT_ID||!process.env.PLUGGY_CLIENT_SECRET)return {status:'not_configured',synced:0,conflicts:0,failed:0};
 const {data:rows,error}=await db.from('portfolios').select('user_id,data,version');
 if(error)throw Object.assign(new Error('Não foi possível localizar carteiras conectadas ao Meu Pluggy.'),{status:503});
 let synced=0,conflicts=0,failed=0;
 for(const row of rows||[]){
  const state=row.data,itemId=state?.finance?.pluggy?.itemId;
  if(!itemId)continue;
  try{
   const result=await applyPluggySync(db,{userId:row.user_id,itemId});
   if(result.version)synced++;
  }catch(error){if(error.status===409)conflicts++;else failed++;}
 }
 return {status:'completed',synced,conflicts,failed};
}
