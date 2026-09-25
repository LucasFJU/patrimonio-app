// Shared by browser, imports and daily jobs. Projections never write transactions.
export const financeToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const validMonth=v=>typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(v);
export function scheduleMonth(month,offset){const d=new Date(`${month}-15T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);}
export function scheduleDate(first,index){const month=scheduleMonth(first.slice(0,7),index),last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();return `${month}-${String(Math.min(Number(first.slice(8)),last)).padStart(2,'0')}`;}
export function validateSchedules(finance){
 const schedules=finance.schedules||[];
 if(!Array.isArray(schedules)||schedules.length>500)throw new Error('Limite de 500 programações.');
 const ids=new Set();
 for(const s of schedules){
  const account=finance.accounts.find(a=>a.id===s?.accountId);
  if(!s||typeof s.id!=='string'||!s.id||s.id.length>100||ids.has(s.id)||!['income','expense'].includes(s.type)||!['once','monthly','installments'].includes(s.mode)||!account||!validDate(s.firstDate)||s.firstDate<account.openingDate||s.firstDate>'2099-12-31'||!validMonth(s.competenceMonth)||typeof s.description!=='string'||!s.description.trim()||s.description.length>160||typeof s.category!=='string'||s.category.length>60||!Number.isFinite(s.amount)||s.amount<=0||s.amount>1e12||Math.abs(s.amount*100-Math.round(s.amount*100))>.001||!(s.count===null&&s.mode==='monthly'||Number.isInteger(s.count)&&s.count>=1&&s.count<=1200)||s.mode==='once'&&s.count!==1||s.mode==='installments'&&Math.round(s.amount*100)<s.count)throw new Error('Programação inválida. Confira conta, valor, início e quantidade.');
  ids.add(s.id);
  if(s.cancelFrom!=null&&(!Number.isInteger(s.cancelFrom)||s.cancelFrom<1))throw new Error('Cancelamento de programação inválido.');
  if(s.revisions!=null&&(!Array.isArray(s.revisions)||s.revisions.length>1200))throw new Error('Revisões inválidas.');
  const changes=[...(s.revisions||[]),...Object.entries(s.exceptions||{}).map(([sequence,v])=>({...v,sequence:Number(sequence)}))];
  if(s.exceptions!=null&&(typeof s.exceptions!=='object'||Array.isArray(s.exceptions)||Object.keys(s.exceptions).length>1200))throw new Error('Exceções inválidas.');
  for(const c of changes){if(Object.keys(c).some(k=>!['sequence','amount','description','category','dueDate','competenceMonth','status'].includes(k))||c.status!=null&&!['scheduled','held','cancelled'].includes(c.status))throw new Error('Campos de exceção inválidos.');if(!c||!Number.isInteger(c.sequence)||c.sequence<1||c.sequence>(s.count||1200)||c.amount!=null&&(!Number.isFinite(c.amount)||c.amount<=0||c.amount>1e12)||c.dueDate!=null&&(!validDate(c.dueDate)||c.dueDate<account.openingDate)||c.competenceMonth!=null&&!validMonth(c.competenceMonth)||c.description!=null&&(typeof c.description!=='string'||!c.description.trim()||c.description.length>160)||c.category!=null&&(typeof c.category!=='string'||c.category.length>60))throw new Error('Alteração de ocorrência inválida.');}
 }
 for(const t of finance.transactions){if(t.competenceMonth!=null&&!validMonth(t.competenceMonth))throw new Error('Competência inválida.');if(t.scheduleId!=null&&(!ids.has(t.scheduleId)||!Number.isInteger(t.sequence)||t.sequence<1||t.id!==`scheduled:${t.scheduleId}:${t.sequence}`))throw new Error('Vínculo da programação inválido.');}
 return true;
}
export function occurrenceAt(schedule,sequence){
 const s=schedule,i=sequence-1,cents=Math.round(s.amount*100),count=s.count||1200;
 if(sequence<1||sequence>count)return null;
 let row={id:`scheduled:${s.id}:${sequence}`,scheduleId:s.id,sequence,count:s.count,type:s.type,accountId:s.accountId,description:s.description,category:s.category,amount:s.mode==='installments'?(Math.floor(cents/count)+(sequence<=cents%count?1:0))/100:s.amount,dueDate:scheduleDate(s.firstDate,i),competenceMonth:scheduleMonth(s.competenceMonth,i),status:s.cancelFrom&&sequence>=s.cancelFrom?'cancelled':'scheduled'};
 for(const revision of [...(s.revisions||[])].sort((a,b)=>a.sequence-b.sequence)){if(revision.sequence<=sequence){const {sequence:from,dueDate,competenceMonth,...patch}=revision;row={...row,...patch};if(dueDate)row.dueDate=scheduleDate(dueDate,sequence-from);if(competenceMonth)row.competenceMonth=scheduleMonth(competenceMonth,sequence-from);}}
 row={...row,...s.exceptions?.[String(sequence)]};row.date=row.dueDate;
 return row;
}
export function scheduleOccurrences(finance,from,to,{includeCancelled=false}={}){
 const result=[],transactions=new Map(finance.transactions.map(t=>[t.id,t]));
 for(const s of finance.schedules||[])for(let sequence=1;sequence<=(s.count||1200);sequence++){
  const row=occurrenceAt(s,sequence),tx=transactions.get(row.id);
  if(tx&&!tx.excludedFromBalances){row.status='realized';row.transaction=tx;row.amount=tx.amount;row.description=tx.description;row.category=tx.category;row.date=tx.date;row.dueDate=tx.dueDate||row.dueDate;}
  if(row.dueDate>=from&&row.dueDate<=to&&(includeCancelled||row.status!=='cancelled'))result.push(row);
 }
 return result.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
}
export const isCandidate=(row,t)=>!t.excludedFromBalances&&!t.supersededByPluggyTransactionId&&row.type===t.type&&row.accountId===t.accountId&&Math.round(row.amount*100)===Math.round(t.amount*100)&&Math.abs(Date.parse(row.dueDate||row.date)-Date.parse(t.date))<=3*86400000;
export function markScheduleCandidates(finance){
 for(const t of finance.transactions.filter(t=>t.pluggyTransactionId||t.importFingerprint)){
  if(t.reviewDecision||t.reconciled||t.excludedFromBalances)continue;
  const candidates=finance.transactions.filter(m=>m.scheduleId&&!m.excludedFromBalances&&!m.supersededByPluggyTransactionId&&isCandidate(m,t));
  if(candidates.length){t.matchingManualTransactionIds=candidates.map(m=>m.id);t.matchingManualTransactionId=candidates[0].id;t.possibleDuplicate=true;t.scheduleCandidate=true;t.needsReview=true;}
 }
 return finance;
}
export function materializeSchedules(finance,asOf=financeToday()){
 const next=structuredClone(finance);let added=0;
 for(const row of scheduleOccurrences(next,'2000-01-01',asOf)){
  if(row.status!=='scheduled'||next.transactions.some(t=>t.id===row.id))continue;
  if(next.transactions.length>=20000)throw new Error('Limite de lançamentos atingido. Faça backup antes de continuar.');
  const {status,count,transaction,...fields}=row;
  next.transactions.push({...fields,date:row.dueDate,automatic:true,recordedAt:asOf,categoryManuallySet:true});added++;
 }
 markScheduleCandidates(next);
 return {finance:next,added,changed:JSON.stringify(next)!==JSON.stringify(finance)};
}
export function createSchedule(finance,draft,asOf=financeToday()){
 const next=structuredClone(finance),s={...draft,id:draft.id||crypto.randomUUID(),exceptions:{},revisions:[]};
 next.schedules=[...(next.schedules||[]),s];
 validateSchedules(next);
 return materializeSchedules(next,asOf).finance;
}
export function changeOccurrence(finance,scheduleId,sequence,action,patch={},scope='one',asOf=financeToday()){
 const next=structuredClone(finance),s=next.schedules?.find(s=>s.id===scheduleId),row=s&&occurrenceAt(s,sequence);
 if(!row)throw new Error('Ocorrência não encontrada.');
 const tx=next.transactions.find(t=>t.id===row.id);
 if(tx?.supersededByPluggyTransactionId||tx?.reconciled)throw new Error('Esta ocorrência foi conciliada. Corrija o lançamento bancário em Lançamentos.');
 s.exceptions||={};s.revisions||=[];
 if(action==='cancel'){
  if(scope==='future'){s.cancelFrom=sequence;for(const [key,value] of Object.entries(s.exceptions))if(Number(key)>=sequence&&!next.transactions.some(t=>t.id===`scheduled:${s.id}:${key}`))s.exceptions[key]={...value,status:'cancelled'};}
  else {if(tx)throw new Error('Use Não realizado para reverter uma ocorrência registrada.');s.exceptions[sequence]={...s.exceptions[sequence],status:'cancelled'};}
 }else if(action==='undo'){
  next.transactions=next.transactions.filter(t=>t.id!==row.id);
  s.exceptions[sequence]={...s.exceptions[sequence],status:'held'};
 }else if(action==='realize'){
  const date=patch.dueDate||asOf;if(!validDate(date)||date>asOf)throw new Error('A realização não pode ser futura.');
  if(tx)throw new Error('Esta ocorrência já foi realizada.');
  s.exceptions[sequence]={...s.exceptions[sequence],dueDate:date,status:'scheduled'};
 }else if(action==='edit'){
  const allowed=Object.fromEntries(['amount','description','category','dueDate','competenceMonth'].filter(k=>patch[k]!=null).map(k=>[k,patch[k]]));
  if(tx&&scope==='one'){if(allowed.dueDate>asOf)throw new Error('Use Não realizado antes de adiar para uma data futura.');Object.assign(tx,allowed,{date:allowed.dueDate||tx.date,categoryManuallySet:true});}
  if(scope==='future'){s.revisions.push({sequence,...allowed});}
  else s.exceptions[sequence]={...s.exceptions[sequence],...allowed,status:'scheduled'};
 }else throw new Error('Ação inválida.');
 validateSchedules(next);
 return materializeSchedules(next,asOf).finance;
}
