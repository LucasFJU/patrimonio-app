import {fetchPluggyItem} from './pluggy-server.mjs';
import {mergePluggyData} from './pluggy-sync.mjs';

export async function syncPluggyPortfolios(db){
 if(!process.env.PLUGGY_CLIENT_ID||!process.env.PLUGGY_CLIENT_SECRET)return {status:'not_configured',synced:0,conflicts:0,failed:0};
 const {data:rows,error}=await db.from('portfolios').select('user_id,data,version');
 if(error)throw Object.assign(new Error('Não foi possível localizar carteiras conectadas ao Meu Pluggy.'),{status:503});
 let synced=0,conflicts=0,failed=0;
 for(const row of rows||[]){
  const state=row.data,itemId=state?.finance?.pluggy?.itemId;
  if(!itemId)continue;
  try{
   const result=await fetchPluggyItem(itemId,'2026-08-01'),merged=mergePluggyData(state,result),next={...state,finance:merged.finance};
   const {data,error:updateError}=await db.from('portfolios').update({data:next,version:row.version+1,updated_at:new Date().toISOString()}).eq('user_id',row.user_id).eq('version',row.version).select('version').maybeSingle();
   if(updateError)throw updateError;
   if(data)synced++;else conflicts++;
  }catch{failed++;}
 }
 return {status:'completed',synced,conflicts,failed};
}
