export const CATEGORIES = { cdb:'CDB', tesouro:'Tesouro Direto', acoes:'Ações brasileiras', internacional:'ETFs / Exterior / BDRs', fiis:'Fundos Imobiliários', outros:'Outros', caixa:'Caixa de dividendos' };
export const COLORS = {cdb:'#345f50',tesouro:'#8eb393',acoes:'#b9d866',internacional:'#8498c7',caixa:'#d4b16a',fiis:'#bd91da',outros:'#73b9bf'};
export const ALLOCATION_KEYS=['cdb','tesouro','acoes','fiis','internacional','outros'];
export const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
export const dateISO = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
export function initialState(){const date=dateISO();return {schema:1,settings:{name:'Investidor',monthly:800,expenses:8000,reserveMonths:6,horizon:10,risk:'moderado',allocation:{cdb:25,tesouro:25,acoes:25,internacional:25}},startDate:date,assets:[{id:'cdb-santander',name:'CDB Santander',ticker:'',category:'cdb',reserve:false,initial:5700},{id:'cash',name:'Dividendos disponíveis',category:'caixa',reserve:false,initial:0}],events:[]};}
export function validateState(s){
 if(!s||s.schema!==1||!s.settings||!Array.isArray(s.assets)||!Array.isArray(s.events)||s.assets.length>300||s.events.length>20000)throw new Error('Arquivo de backup inválido.');
 if(!validDate(s.startDate)||s.startDate<'2000-01-01'||s.startDate>dateISO())throw new Error('Data inicial inválida.');
 const ids=new Set(); for(const a of s.assets){if(typeof a.id!=='string'||!a.id||['__proto__','constructor','prototype'].includes(a.id)||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>100||typeof a.reserve!=='boolean'||(a.ticker!=null&&typeof a.ticker!=='string')||!Object.hasOwn(CATEGORIES,a.category)||!Number.isFinite(a.initial)||a.initial<0)throw new Error('Ativo inválido.'); ids.add(a.id);}
 if(!ids.has('cash')||s.assets.find(a=>a.id==='cash').category!=='caixa')throw new Error('Conta de dividendos ausente.');
 for(const key of ['monthly','expenses','reserveMonths','horizon'])if(!Number.isFinite(s.settings[key])||s.settings[key]<=0||s.settings[key]>10000000)throw new Error('Meta inválida.');
 if(typeof s.settings.name!=='string'||!s.settings.name.trim()||s.settings.name.length>40||!['conservador','moderado','arrojado'].includes(s.settings.risk)||s.settings.reserveMonths>24||s.settings.horizon>60)throw new Error('Perfil inválido.');
 const keys=Object.keys(s.settings.allocation||{});if(!['cdb','tesouro','acoes','internacional'].every(k=>keys.includes(k))||keys.some(k=>!ALLOCATION_KEYS.includes(k)))throw new Error('Classes da distribuição inválidas.');
 const weights=Object.values(s.settings.allocation||{});if(weights.some(v=>!Number.isFinite(v)||v<0)||Math.abs(weights.reduce((a,b)=>a+b,0)-100)>.01)throw new Error('A distribuição deve somar 100%.');
 const evIds=new Set();for(const e of s.events){if(typeof e.id!=='string'||!e.id||evIds.has(e.id)||!ids.has(e.assetId)||!['aporte','resgate','dividendo','reinvestimento','transferencia','saldo'].includes(e.kind)||!Number.isFinite(e.amount)||e.amount<0||!validDate(e.date)||(e.createdAt!=null&&typeof e.createdAt!=='string')||(e.note!=null&&(typeof e.note!=='string'||e.note.length>200))||e.date<s.startDate||e.date>dateISO())throw new Error('Lançamento inválido.');if(e.kind==='transferencia'&&(!ids.has(e.toAssetId)||e.toAssetId===e.assetId))throw new Error('Destino da transferência inválido.');if(e.kind==='reinvestimento'&&e.assetId==='cash')throw new Error('Selecione o destino do reinvestimento.');evIds.add(e.id);}
 validateExtras(s);calculate(s,undefined,true);return s;
}
export function sortedEvents(s){return [...s.events].sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||''));}
export function calculate(s,until=dateISO(),strict=false){
 const values=Object.fromEntries(s.assets.map(a=>[a.id,a.initial]));let deposits=0,withdrawals=0,dividends=0,reinvested=0;
 const opening=s.assets.reduce((n,a)=>n+a.initial,0);
 for(const e of sortedEvents(s).filter(e=>e.date<=until)){
  if(e.kind==='aporte'){values[e.assetId]+=e.amount;deposits+=e.amount;}
  if(e.kind==='resgate'){values[e.assetId]-=e.amount;withdrawals+=e.amount;}
  if(e.kind==='dividendo'){values.cash+=e.amount;dividends+=e.amount;}
  if(e.kind==='reinvestimento'){values.cash-=e.amount;values[e.assetId]+=e.amount;reinvested+=e.amount;}
  if(e.kind==='transferencia'){values[e.assetId]-=e.amount;values[e.toAssetId]+=e.amount;}
  if(e.kind==='saldo')values[e.assetId]=e.amount;
  if(strict&&Object.values(values).some(v=>v<-.005))throw new Error('O lançamento deixaria uma posição negativa. Confira o saldo e a ordem das datas.');
 }
 const total=Object.values(values).reduce((a,b)=>a+b,0);const byCategory=Object.fromEntries(Object.keys(CATEGORIES).map(c=>[c,0]));
 let reserve=0;for(const a of s.assets){byCategory[a.category]+=values[a.id];if(a.reserve&&['cdb','tesouro'].includes(a.category))reserve+=values[a.id];}
 return {values,total,opening,deposits,withdrawals,netInvested:opening+deposits-withdrawals,gain:total-opening-deposits+withdrawals,dividends,reinvested,reserve,byCategory};
}
export function monthlyHistory(s){
 const months=[];let d=new Date(s.startDate+'T12:00:00Z');d.setUTCDate(1);const today=dateISO();
 for(let i=0;i<600&&d.toISOString().slice(0,7)<=today.slice(0,7);i++){
 const month=d.toISOString().slice(0,7);const next=new Date(d);next.setUTCMonth(next.getUTCMonth()+1);const end=new Date(next.getTime()-86400000).toISOString().slice(0,10);const until=end>today?today:end;
 const endCalc=calculate(s,until);const beforeDate=new Date(d.getTime()-86400000).toISOString().slice(0,10);const startValue=month===s.startDate.slice(0,7)?endCalc.opening:calculate(s,beforeDate).total;
 const events=s.events.filter(e=>e.date.slice(0,7)===month);const deposits=events.filter(e=>e.kind==='aporte').reduce((n,e)=>n+e.amount,0);const withdrawals=events.filter(e=>e.kind==='resgate').reduce((n,e)=>n+e.amount,0);
 const dividends=events.filter(e=>e.kind==='dividendo').reduce((n,e)=>n+e.amount,0);const gain=endCalc.total-startValue-deposits+withdrawals;
 const active=s.assets.filter(a=>a.id!=='cash'&&endCalc.values[a.id]>0);const closed=active.length>0&&active.every(a=>events.some(e=>e.kind==='saldo'&&e.assetId===a.id&&e.date===until));
 months.push({month,total:endCalc.total,invested:endCalc.netInvested,deposits,withdrawals,dividends,gain,closed});d=next;
 }return months;
}
export function suggestedPlan(s){
 const {reserve}=calculate(s),{monthly,expenses,reserveMonths,risk,horizon}=s.settings;
 if(reserve<expenses)return {phase:'Primeiro mês de segurança',description:'Priorize completar um mês de despesas antes de ampliar o risco.',values:{cdb:monthly,tesouro:0,acoes:0,fiis:0,internacional:0,outros:0}};
 if(reserve<expenses*reserveMonths){const tesouro=Math.min(200,monthly*.25),acoes=risk==='conservador'||horizon<5?0:Math.min(100,monthly*.125);return {phase:'Construção da reserva',description:'A maior parte do aporte protege sua reserva. Só conte títulos com liquidez e risco adequados.',values:{cdb:monthly-tesouro-acoes,tesouro,acoes,fiis:0,internacional:0,outros:0}};}
 const values=Object.fromEntries(Object.entries(s.settings.allocation).map(([k,v])=>[k,monthly*v/100]));
 if(risk==='conservador'||horizon<5){values.cdb+=values.acoes+values.internacional+(values.fiis||0)+(values.outros||0);values.acoes=0;values.internacional=0;values.fiis=0;values.outros=0;}
 return {phase:'Acumulação de longo prazo',description:risk==='conservador'||horizon<5?'O plano direciona a parcela variável para CDB pelo perfil conservador ou prazo inferior a cinco anos.':'Reserva formada. Distribuição baseada nos percentuais escolhidos por você.',values};
}
export function projection(initial,monthly,years,annual){const i=(1+annual/100)**(1/12)-1,n=years*12;return i===0?initial+monthly*n:initial*(1+i)**n+monthly*((1+i)**n-1)/i;}

// Optional fields preserve existing schema-1 portfolios and the database constraint.
function validateExtras(s){
 const text=(v,max)=>v==null||(typeof v==='string'&&v.length<=max);
 const number=v=>v==null||(Number.isFinite(v)&&v>=0&&v<=1e12);
 if(s.settings.wealthGoal!=null&&(!number(s.settings.wealthGoal)||s.settings.wealthGoal===0))throw new Error('Meta patrimonial inválida.');
 for(const a of s.assets){
  if(!text(a.owner,60)||!number(a.quantity)||!number(a.averagePrice)||(a.quantity!=null&&a.averagePrice!=null&&!number(a.quantity*a.averagePrice))|| (a.purchaseDate&&!validDate(a.purchaseDate)) || (a.purchaseDate&&a.purchaseDate>dateISO()))throw new Error('Dados da posição inválidos.');
  if(a.quantity==null&&a.averagePrice==null){}else if(a.quantity==null||a.averagePrice==null)throw new Error('Informe quantidade e preço médio juntos.');
  if(a.research){const r=a.research;if(typeof r!=='object'||Array.isArray(r)||!['tijolo','papel','hibrido','outros'].includes(r.type)||!text(r.manager,100)||!text(r.source,500)||!r.source?.trim()||!text(r.notes,2000)||!validDate(r.date)||r.date>dateISO()||!['dy','pvp','vacancy','fee'].every(k=>number(r[k]))||(r.vacancy!=null&&r.vacancy>100))throw new Error('Indicadores do fundo inválidos.');}
 }
 if(s.journal!=null){if(!Array.isArray(s.journal)||s.journal.length>2000)throw new Error('Diário inválido.');const ids=new Set();for(const e of s.journal){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||!validDate(e.date)||e.date>dateISO()||!text(e.ticker,12)||!text(e.reason,2000)||!e.reason?.trim()||!text(e.expectation,2000)||!text(e.notes,2000)||!number(e.amount))throw new Error('Entrada do diário inválida.');ids.add(e.id);}}
}
export function rebalance(s){const c=calculate(s),base=c.total-c.byCategory.caixa;return ALLOCATION_KEYS.map(key=>({key,current:base?c.byCategory[key]/base*100:0,target:s.settings.allocation[key]||0,gap:base*(s.settings.allocation[key]||0)/100-c.byCategory[key]}));}
