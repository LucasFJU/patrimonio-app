import {createClient} from '@supabase/supabase-js';
import {timingSafeEqual} from 'node:crypto';
import {fetchMarket} from './market-provider.mjs';
export function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url)throw Object.assign(new Error('Configure NEXT_PUBLIC_SUPABASE_URL nas variáveis de ambiente da Vercel.'),{status:503});if(!key)throw Object.assign(new Error('Configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente da Vercel para salvar os relatórios.'),{status:503});return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export function validCron(request){const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)return false;const actual=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from(`Bearer ${secret}`);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export async function requireUser(request,db){const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)throw Object.assign(new Error('Entre na sua conta.'),{status:401});const {data,error}=await db.auth.getUser(token);if(error||!data.user)throw Object.assign(new Error('Sessão inválida. Entre novamente.'),{status:401});if(process.env.OWNER_USER_ID&&data.user.id!==process.env.OWNER_USER_ID)throw Object.assign(new Error('Atualização disponível apenas para o proprietário.'),{status:403});return data.user;}
export async function updateMarket(db,{manual=false,now=new Date()}={}){
 const day=now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),month=day.slice(0,7);
 const {data:existing,error:readError}=await db.from('market_reports').select('data').eq('month',month).maybeSingle();if(readError)throw Object.assign(new Error('Não foi possível consultar as análises. Confira a configuração do banco.'),{status:503});
 if(!manual&&existing?.data?.methodologyVersion==='1.1'&&existing?.data?.coverage?.total===15&&existing?.data?.topPicks?.length===5)return existing.data;
 if(!process.env.BOLSAI_API_KEY)throw Object.assign(new Error('Configure BOLSAI_API_KEY nas variáveis de ambiente da Vercel.'),{status:503});
 const {error:lockError}=await db.from('market_jobs').insert({day,status:'running'});
 if(lockError){
  if(lockError.code==='23505'){
   if(existing?.data&&(!manual||existing.data.methodologyVersion==='1.1'))return existing.data;
   if(manual){
    const {data:job,error:jobReadError}=await db.from('market_jobs').select('status').eq('day',day).maybeSingle();
    if(jobReadError)throw Object.assign(new Error('Não foi possível verificar a atualização de hoje.'),{status:503});
    if(job?.status==='running')throw Object.assign(new Error('A análise de hoje já está em andamento.'),{status:429});
    const {data:claimed,error:claimError}=await db.from('market_jobs').update({status:'running',finished_at:null}).eq('day',day).neq('status','running').select('day').maybeSingle();
    if(claimError)throw Object.assign(new Error('Não foi possível retomar a atualização de hoje.'),{status:503});
    if(!claimed)throw Object.assign(new Error('A análise de hoje já está em andamento.'),{status:429});
   }else if(existing?.data)return existing.data;
   else throw Object.assign(new Error('A consulta de hoje já foi iniciada. Uma nova tentativa estará disponível amanhã.'),{status:429});
  }else throw Object.assign(new Error('Não foi possível iniciar a atualização.'),{status:503});
 }
 try{
  const report=await fetchMarket({token:process.env.BOLSAI_API_KEY,now});
  // Mantém a edição com maior cobertura do mês quando a fonte entrega menos dados.
  const existingEligible=existing?.data?.methodologyVersion==='1.1'?existing.data.coverage.eligible:existing?.data?.picks?.length||0;
  const keep=existing?.data&&existingEligible>report.coverage.eligible;
  if(!keep){const {error}=await db.from('market_reports').upsert({month,data:report,generated_at:report.generatedAt});if(error)throw new Error('Falha ao salvar a análise.');}
  const {error:jobError}=await db.from('market_jobs').update({status:report.topPicks.length===5?'completed':'partial',finished_at:new Date().toISOString()}).eq('day',day);if(jobError)console.error('market_job_status_failed');
  return keep?existing.data:report;
 }catch(e){await db.from('market_jobs').update({status:'failed',finished_at:new Date().toISOString()}).eq('day',day);throw Object.assign(new Error(e.message||'A análise não pôde ser concluída. A edição anterior foi preservada; tente novamente amanhã.'),{status:e.status||503});}
}
export function apiError(e){return Response.json({error:e.status?e.message:'Serviço temporariamente indisponível.'},{status:e.status||500,headers:{'Cache-Control':'no-store'}});}
