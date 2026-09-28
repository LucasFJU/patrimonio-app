import {validateFinance} from './finance.mjs';

export const CATEGORIES = { cdb:'Renda fixa', tesouro:'Tesouro Direto', acoes:'Ações brasileiras', internacional:'ETFs / Exterior / BDRs', fiis:'Fundos Imobiliários', outros:'Outros', caixa:'Caixa de dividendos' };
export const ASSET_PRESETS=[
 {name:'CDB — liquidez diária',category:'cdb'},
 {name:'CDB — vencimento definido',category:'cdb'},
 {name:'LCI',category:'cdb'},
 {name:'LCA',category:'cdb'},
 {name:'Tesouro Selic',category:'tesouro'},
 {name:'Tesouro IPCA+',category:'tesouro'},
 {name:'Tesouro Prefixado',category:'tesouro'},
 {name:'Ação brasileira',category:'acoes'},
 {name:'Fundo imobiliário (FII)',category:'fiis'},
 {name:'ETF brasileiro',category:'internacional'},
 {name:'ETF internacional',category:'internacional'},
 {name:'BDR',category:'internacional'},
 {name:'Previdência privada',category:'outros'},
 {name:'Criptoativo',category:'outros'}
];
export const COLORS = {cdb:'#eef880',tesouro:'#b2d1ce',acoes:'#c4b5d6',internacional:'#7dd3fc',caixa:'#d9f99d',fiis:'#4ade80',outros:'#f472b6'};
export const ALLOCATION_KEYS=['cdb','tesouro','acoes','fiis','internacional','outros'];
export const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
export const dateISO = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
export function initialState(){const date=dateISO();return {schema:1,settings:{name:'Investidor',monthly:800,expenses:8000,reserveMonths:6,horizon:10,risk:'moderado',allocation:{cdb:25,tesouro:25,acoes:25,internacional:25}},startDate:date,assets:[{id:'cdb-santander',name:'CDB Santander',ticker:'',category:'cdb',reserve:false,initial:5700},{id:'cash',name:'Dividendos disponíveis',category:'caixa',reserve:false,initial:0}],events:[]};}
export function validateState(s){
 if(!s||s.schema!==1||!s.settings||!Array.isArray(s.assets)||!Array.isArray(s.events)||s.assets.length>300||s.events.length>20000)throw new Error('Arquivo de backup inválido.');
 if(new TextEncoder().encode(JSON.stringify(s)).length>4750000)throw new Error('A carteira está próxima do limite de armazenamento. Exporte um backup e remova lançamentos antigos.');
 if(!validDate(s.startDate)||s.startDate<'2000-01-01'||s.startDate>dateISO())throw new Error('Data inicial inválida.');
 const ids=new Set(); for(const a of s.assets){if(typeof a.id!=='string'||!a.id||['__proto__','constructor','prototype'].includes(a.id)||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>100||typeof a.reserve!=='boolean'||(a.ticker!=null&&typeof a.ticker!=='string')||!Object.hasOwn(CATEGORIES,a.category)||!Number.isFinite(a.initial)||a.initial<0)throw new Error('Ativo inválido.'); ids.add(a.id);}
 if(!ids.has('cash')||s.assets.find(a=>a.id==='cash').category!=='caixa')throw new Error('Conta de dividendos ausente.');
 for(const key of ['monthly','expenses','reserveMonths','horizon'])if(!Number.isFinite(s.settings[key])||s.settings[key]<=0||s.settings[key]>10000000)throw new Error('Meta inválida.');
 if(typeof s.settings.name!=='string'||!s.settings.name.trim()||s.settings.name.length>40||!['conservador','moderado','arrojado'].includes(s.settings.risk)||s.settings.reserveMonths>24||s.settings.horizon>60)throw new Error('Perfil inválido.');
 if(s.settings.goals!=null){if(!Array.isArray(s.settings.goals)||s.settings.goals.length>20)throw new Error('Limite de metas adicionais excedido.');const goalIds=new Set();for(const goal of s.settings.goals){if(!goal||typeof goal.id!=='string'||!goal.id||goalIds.has(goal.id)||typeof goal.name!=='string'||!goal.name.trim()||goal.name.length>60||!Number.isFinite(goal.targetAmount)||goal.targetAmount<=0||goal.targetAmount>1e12||!Number.isFinite(goal.currentAmount)||goal.currentAmount<0||goal.currentAmount>1e12||(goal.targetDate!==''&&goal.targetDate!=null&&!validDate(goal.targetDate)))throw new Error('Meta adicional inválida.');goalIds.add(goal.id);}}
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
 const events=sortedEvents(s),values=Object.fromEntries(s.assets.map(a=>[a.id,a.initial]));
 const opening=s.assets.reduce((n,a)=>n+a.initial,0);let depositsTotal=0,withdrawalsTotal=0,eventIndex=0,previousTotal=opening;
 for(let i=0;i<600&&d.toISOString().slice(0,7)<=today.slice(0,7);i++){
  const month=d.toISOString().slice(0,7),next=new Date(d);next.setUTCMonth(next.getUTCMonth()+1);
  const end=new Date(next.getTime()-86400000).toISOString().slice(0,10),until=end>today?today:end;
  const startValue=month===s.startDate.slice(0,7)?opening:previousTotal;
  let deposits=0,withdrawals=0,dividends=0;const monthEvents=[];
  while(eventIndex<events.length&&events[eventIndex].date<=until){const e=events[eventIndex++];monthEvents.push(e);
   if(e.kind==='aporte'){values[e.assetId]+=e.amount;deposits+=e.amount;depositsTotal+=e.amount;}
   else if(e.kind==='resgate'){values[e.assetId]-=e.amount;withdrawals+=e.amount;withdrawalsTotal+=e.amount;}
   else if(e.kind==='dividendo'){values.cash+=e.amount;dividends+=e.amount;}
   else if(e.kind==='reinvestimento'){values.cash-=e.amount;values[e.assetId]+=e.amount;}
   else if(e.kind==='transferencia'){values[e.assetId]-=e.amount;values[e.toAssetId]+=e.amount;}
   else if(e.kind==='saldo')values[e.assetId]=e.amount;
  }
  const total=Object.values(values).reduce((a,b)=>a+b,0),gain=total-startValue-deposits+withdrawals;
  const active=s.assets.filter(a=>a.id!=='cash'&&values[a.id]>0);
  const closed=active.length>0&&active.every(a=>monthEvents.some(e=>e.kind==='saldo'&&e.assetId===a.id&&e.date===until));
  months.push({month,total,invested:opening+depositsTotal-withdrawalsTotal,deposits,withdrawals,dividends,gain,closed});
  previousTotal=total;d=next;
 }return months;
}
export function householdMonthlyHistory(s){
 return monthlyHistory(s).map(({month,total,invested})=>({month,total,invested}));
}
export function moneyWeightedReturn(s,startDate=s.startDate,endDate=dateISO()){
 if(!validDate(startDate)||!validDate(endDate)||startDate>=endDate)return null;
 const before=new Date(startDate+'T12:00:00Z');before.setUTCDate(before.getUTCDate()-1);const beforeDate=before.toISOString().slice(0,10);
 const beginning=startDate<=s.startDate?calculate(s,startDate).opening:calculate(s,beforeDate).total;
 if(beginning<0)return null;
 const flows=[];if(beginning>0)flows.push({date:startDate,amount:-beginning});
 for(const e of sortedEvents(s))if(e.date>=startDate&&e.date<=endDate){if(e.kind==='aporte')flows.push({date:e.date,amount:-e.amount});if(e.kind==='resgate')flows.push({date:e.date,amount:e.amount});}
 const ending=calculate(s,endDate).total;if(ending<=0)return null;flows.push({date:endDate,amount:ending});
 if(!flows.some(x=>x.amount<0)||!flows.some(x=>x.amount>0))return null;
 const origin=Date.parse(startDate+'T00:00:00Z'),years=(Date.parse(endDate+'T00:00:00Z')-origin)/86400000/365;const npv=rate=>flows.reduce((sum,x)=>sum+x.amount/(1+rate)**((Date.parse(x.date+'T00:00:00Z')-origin)/86400000/365),0);
 let rate=.1;for(let i=0;i<100;i++){const f=npv(rate);if(!Number.isFinite(f))break;if(Math.abs(f)<.005)return {annual:rate,total:(1+rate)**years-1};const derivative=flows.reduce((sum,x)=>{const years=(Date.parse(x.date+'T00:00:00Z')-origin)/86400000/365;return sum-years*x.amount/(1+rate)**(years+1)},0);if(!Number.isFinite(derivative)||Math.abs(derivative)<1e-12)break;const next=rate-f/derivative;if(!Number.isFinite(next)||next<=-.999999||next>1e6)break;rate=next;}
 let low=-.999999,high=1e6,fl=npv(low),fh=npv(high);if(!Number.isFinite(fl)||!Number.isFinite(fh)||fl*fh>0)return null;
 for(let i=0;i<160;i++){const mid=(low+high)/2,fm=npv(mid);if(Math.abs(fm)<.005){rate=mid;break;}if(Math.sign(fm)===Math.sign(fl)){low=mid;fl=fm}else{high=mid;fh=fm}rate=mid;}
 if(!Number.isFinite(rate)||rate<=-1)return null;return {annual:rate,total:(1+rate)**years-1};
}
export function periodStartDate(s,months,endDate=dateISO()){
 if(months==='all')return s.startDate;const d=new Date(endDate+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-Number(months));return d.toISOString().slice(0,10)<s.startDate?s.startDate:d.toISOString().slice(0,10);
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

function validateExtras(s){
 const text=(v,max)=>v==null||(typeof v==='string'&&v.length<=max);
 const number=v=>v==null||(Number.isFinite(v)&&v>=0&&v<=1e12);
 if(s.settings.wealthGoal!=null&&(!number(s.settings.wealthGoal)||s.settings.wealthGoal===0))throw new Error('Meta patrimonial inválida.');
 for(const a of s.assets){
  if(!text(a.owner,60)||!text(a.institution,80)||!number(a.quantity)||!number(a.averagePrice)||(a.quantity!=null&&a.averagePrice!=null&&!number(a.quantity*a.averagePrice))|| (a.purchaseDate&&!validDate(a.purchaseDate)) || (a.purchaseDate&&a.purchaseDate>dateISO()))throw new Error('Dados da posição inválidos.');
  if(a.quantity==null&&a.averagePrice==null){}else if(a.quantity==null||a.averagePrice==null)throw new Error('Informe quantidade e preço médio juntos.');
  if(a.research){const r=a.research;if(typeof r!=='object'||Array.isArray(r)||!['tijolo','papel','hibrido','outros'].includes(r.type)||!text(r.manager,100)||!text(r.source,500)||!r.source?.trim()||!text(r.notes,2000)||!validDate(r.date)||r.date>dateISO()||!['dy','pvp','vacancy','fee'].every(k=>number(r[k]))||(r.vacancy!=null&&r.vacancy>100))throw new Error('Indicadores do fundo inválidos.');}
 }
 if(s.journal!=null){if(!Array.isArray(s.journal)||s.journal.length>2000)throw new Error('Diário inválido.');const ids=new Set();for(const e of s.journal){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||!validDate(e.date)||e.date>dateISO()||!text(e.ticker,12)||!text(e.reason,2000)||!e.reason?.trim()||!text(e.expectation,2000)||!text(e.notes,2000)||number(e.amount)===false)throw new Error('Entrada do diário inválida.');ids.add(e.id);}}
 validateFinance(s.finance,s.assets,s.events,s.startDate);
}
export function rebalance(s){const c=calculate(s),base=c.total-c.byCategory.caixa;return ALLOCATION_KEYS.map(key=>({key,current:base?c.byCategory[key]/base*100:0,target:s.settings.allocation[key]||0,gap:base*(s.settings.allocation[key]||0)/100-c.byCategory[key]}));}

export function simulateSmartContribution(s,contributionAmount=s?.settings?.monthly||0){
 const c=calculate(s),base=Math.max(0,c.total-(c.byCategory.caixa||0));
 const amount=Number.isFinite(Number(contributionAmount))&&Number(contributionAmount)>0?Math.round(Number(contributionAmount)*100)/100:0;
 const nextTotal=base+amount;
 const rawRows=ALLOCATION_KEYS.map(key=>{
  const target=Number(s.settings?.allocation?.[key]||0),currentAmount=c.byCategory[key]||0,current=base>0?currentAmount/base*100:0;
  const targetBefore=base*target/100,gapBefore=targetBefore-currentAmount;
  const targetPost=nextTotal*target/100,deficit=Math.max(0,targetPost-currentAmount);
  return {key,current,target,currentAmount,gapBefore,deficit};
 });
 const totalDeficit=rawRows.reduce((sum,r)=>sum+r.deficit,0);
 const totalTarget=rawRows.reduce((sum,r)=>sum+r.target,0)||100;
 const suggestions=rawRows.map(r=>amount===0?0:totalDeficit>0?Math.round((amount*(r.deficit/totalDeficit))*100)/100:Math.round((amount*(r.target/totalTarget))*100)/100);
 if(amount>0){
  const diff=Math.round((amount-suggestions.reduce((sum,v)=>sum+v,0))*100)/100;
  if(Math.abs(diff)>=0.01){
   let bestIndex=0;
   for(let i=1;i<rawRows.length;i++)if(rawRows[i].deficit>rawRows[bestIndex].deficit||(rawRows[i].deficit===rawRows[bestIndex].deficit&&rawRows[i].target>rawRows[bestIndex].target))bestIndex=i;
   suggestions[bestIndex]=Math.max(0,Math.round((suggestions[bestIndex]+diff)*100)/100);
  }
 }
 const rows=rawRows.map((r,index)=>{
  const suggestedContribution=suggestions[index],postContributionAmount=r.currentAmount+suggestedContribution,postContributionPct=nextTotal>0?postContributionAmount/nextTotal*100:0;
  const gapAfter=(nextTotal*r.target/100)-postContributionAmount;
  return {...r,suggestedContribution,postContributionAmount,postContributionPct,gapAfter};
 });
 return {amount,base,nextTotal,rows};
}

export function dividendAnalytics(s,asOf=dateISO()){
 const c=calculate(s,asOf),endMonth=asOf.slice(0,7);
 const months=[];
 for(let offset=11;offset>=0;offset--){
  const d=new Date(`${endMonth}-15T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()-offset);
  months.push(d.toISOString().slice(0,7));
 }
 const cutoffDate=`${months[0]}-01`;
 const divEvents=sortedEvents(s).filter(e=>e.kind==='dividendo'&&e.date<=asOf);
 const monthlyMap=Object.fromEntries(months.map(m=>[m,0]));
 let last12MonthsTotal=0;
 for(const e of divEvents){
  const m=e.date.slice(0,7);
  if(m in monthlyMap)monthlyMap[m]+=e.amount;
  if(e.date>=cutoffDate)last12MonthsTotal+=e.amount;
 }
 const monthlySeries=months.map(month=>({month,amount:monthlyMap[month]||0}));
 const monthlyAverage12m=last12MonthsTotal/12;
 const portfolioYoC=c.netInvested>0?(last12MonthsTotal/c.netInvested)*100:0;
 const investedByAsset=Object.fromEntries(s.assets.map(a=>[a.id,a.initial||0]));
 for(const e of sortedEvents(s).filter(ev=>ev.date<=asOf)){
  if(e.kind==='aporte'||e.kind==='reinvestimento')investedByAsset[e.assetId]=(investedByAsset[e.assetId]||0)+e.amount;
  else if(e.kind==='resgate')investedByAsset[e.assetId]=Math.max(0,(investedByAsset[e.assetId]||0)-e.amount);
  else if(e.kind==='transferencia'){
   investedByAsset[e.assetId]=Math.max(0,(investedByAsset[e.assetId]||0)-e.amount);
   investedByAsset[e.toAssetId]=(investedByAsset[e.toAssetId]||0)+e.amount;
  }
 }
 const byAsset=s.assets.filter(a=>a.id!=='cash').map(asset=>{
  const assetDividends=divEvents.filter(e=>e.assetId===asset.id);
  const totalAllTime=assetDividends.reduce((sum,e)=>sum+e.amount,0);
  const dividends12m=assetDividends.filter(e=>e.date>=cutoffDate).reduce((sum,e)=>sum+e.amount,0);
  const currentValue=c.values[asset.id]||0;
  const informedCost=asset.quantity!=null&&asset.averagePrice!=null&&asset.quantity*asset.averagePrice>0?asset.quantity*asset.averagePrice:0;
  const costBasis=informedCost>0?informedCost:investedByAsset[asset.id]>0?investedByAsset[asset.id]:currentValue;
  const yoc12m=costBasis>0?(dividends12m/costBasis)*100:0;
  const yieldOnValue12m=currentValue>0?(dividends12m/currentValue)*100:0;
  return {assetId:asset.id,name:asset.name,ticker:asset.ticker||'',category:asset.category,totalAllTime,dividends12m,costBasis,currentValue,yoc12m,yieldOnValue12m,count:assetDividends.length};
 }).filter(row=>row.totalAllTime>0||row.currentValue>0).sort((a,b)=>b.dividends12m-a.dividends12m||b.totalAllTime-a.totalAllTime||b.currentValue-a.currentValue);
 return {totalAllTime:c.dividends,reinvested:c.reinvested,cashBalance:c.values.cash||0,last12MonthsTotal,monthlyAverage12m,portfolioYoC,monthlySeries,byAsset};
}

export function demoState(){
 const today=dateISO(),month=today.slice(0,7);
 const shiftM=(offset)=>{const d=new Date(`${month}-15T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);};
 const m5=shiftM(-5),m4=shiftM(-4),m3=shiftM(-3),m2=shiftM(-2),m1=shiftM(-1),m0=month;
 const startDate=`${m5}-01`;
 return validateState({
  schema:1,
  startDate,
  settings:{
   name:'Família Tavares',
   monthly:4500,
   expenses:8500,
   reserveMonths:6,
   horizon:15,
   risk:'moderado',
   wealthGoal:1000000,
   allocation:{cdb:25,tesouro:25,acoes:20,fiis:15,internacional:15,outros:0},
   goals:[
    {id:'goal-reserva-estudos',name:'Fundo Educacional & Intercâmbio',targetAmount:80000,currentAmount:34500,targetDate:'2029-12-15'},
    {id:'goal-viagem-europa',name:'Viagem Anual em Família',targetAmount:28000,currentAmount:19600,targetDate:`${Number(today.slice(0,4))+1}-07-10`}
   ]
  },
  assets:[
   {id:'cdb-santander',name:'CDB Santander Liquidez Diária 102% CDI',ticker:'',category:'cdb',reserve:true,initial:32000,institution:'Santander Select',owner:'Família'},
   {id:'tesouro-selic',name:'Tesouro Selic 2029',ticker:'LFT',category:'tesouro',reserve:true,initial:24000,institution:'Tesouro Direto',owner:'Lucas'},
   {id:'itub4',name:'Itaú Unibanco PN',ticker:'ITUB4',category:'acoes',reserve:false,initial:18500,quantity:600,averagePrice:31.20,institution:'Ágora Corretora',owner:'Lucas'},
   {id:'wege3',name:'WEG S.A. ON',ticker:'WEGE3',category:'acoes',reserve:false,initial:12800,quantity:300,averagePrice:42.50,institution:'Ágora Corretora',owner:'Conjunta'},
   {id:'hglg11',name:'CSHG Logística FII',ticker:'HGLG11',category:'fiis',reserve:false,initial:19200,quantity:120,averagePrice:159.50,institution:'Santander Corretora',owner:'Família'},
   {id:'ivvb11',name:'iShares S&P 500 ETF',ticker:'IVVB11',category:'internacional',reserve:false,initial:16500,quantity:55,averagePrice:305.00,institution:'Santander Corretora',owner:'Lucas'},
   {id:'cash',name:'Dividendos disponíveis',ticker:'',category:'caixa',reserve:false,initial:0}
  ],
  events:[
   {id:'ev-1',date:`${m5}-10`,kind:'aporte',assetId:'cdb-santander',amount:2500,note:'Aporte mensal na reserva',createdAt:'2026-04-10T10:00:00Z'},
   {id:'ev-2',date:`${m5}-15`,kind:'dividendo',assetId:'hglg11',amount:198,note:'Rendimento mensal HGLG11',createdAt:'2026-04-15T10:00:00Z'},
   {id:'ev-3',date:`${m4}-08`,kind:'aporte',assetId:'tesouro-selic',amount:3000,note:'Reforço Tesouro Selic',createdAt:'2026-05-08T10:00:00Z'},
   {id:'ev-4',date:`${m4}-15`,kind:'dividendo',assetId:'itub4',amount:310,note:'JCP trimestral ITUB4',createdAt:'2026-05-15T10:00:00Z'},
   {id:'ev-5',date:`${m4}-16`,kind:'dividendo',assetId:'hglg11',amount:204,note:'Rendimento mensal HGLG11',createdAt:'2026-05-16T10:00:00Z'},
   {id:'ev-6',date:`${m3}-06`,kind:'aporte',assetId:'itub4',amount:2800,note:'Compra de ações ITUB4',createdAt:'2026-06-06T10:00:00Z'},
   {id:'ev-7',date:`${m3}-15`,kind:'dividendo',assetId:'hglg11',amount:210,note:'Rendimento mensal HGLG11',createdAt:'2026-06-15T10:00:00Z'},
   {id:'ev-8',date:`${m3}-18`,kind:'reinvestimento',assetId:'hglg11',amount:500,note:'Reinvestimento de proventos acumulados',createdAt:'2026-06-18T10:00:00Z'},
   {id:'ev-9',date:`${m2}-07`,kind:'aporte',assetId:'ivvb11',amount:3500,note:'Aporte dolarizado S&P 500',createdAt:'2026-07-07T10:00:00Z'},
   {id:'ev-10',date:`${m2}-15`,kind:'dividendo',assetId:'wege3',amount:185,note:'Dividendos intermediários WEGE3',createdAt:'2026-07-15T10:00:00Z'},
   {id:'ev-11',date:`${m2}-16`,kind:'dividendo',assetId:'hglg11',amount:216,note:'Rendimento mensal HGLG11',createdAt:'2026-07-16T10:00:00Z'},
   {id:'ev-12',date:`${m1}-05`,kind:'aporte',assetId:'hglg11',amount:4200,note:'Aporte mensal FIIs',createdAt:'2026-08-05T10:00:00Z'},
   {id:'ev-13',date:`${m1}-15`,kind:'dividendo',assetId:'itub4',amount:365,note:'Dividendos ITUB4',createdAt:'2026-08-15T10:00:00Z'},
   {id:'ev-14',date:`${m1}-16`,kind:'dividendo',assetId:'hglg11',amount:228,note:'Rendimento mensal HGLG11',createdAt:'2026-08-16T10:00:00Z'},
   {id:'ev-15',date:`${m0}-05`,kind:'aporte',assetId:'cdb-santander',amount:2500,note:'Primeira parcela do aporte do mês',createdAt:`${m0}-05T10:00:00Z`},
   {id:'ev-16',date:`${m0}-12`,kind:'dividendo',assetId:'hglg11',amount:234,note:'Rendimento mensal HGLG11',createdAt:`${m0}-12T10:00:00Z`},
   {id:'ev-17',date:`${m0}-14`,kind:'dividendo',assetId:'itub4',amount:290,note:'JCP mensal/complementar ITUB4',createdAt:`${m0}-14T10:00:00Z`},
   {id:'ev-18',date:today,kind:'saldo',assetId:'cdb-santander',amount:38450,note:'Saldo conferido no extrato',createdAt:`${today}T11:00:00Z`},
   {id:'ev-19',date:today,kind:'saldo',assetId:'tesouro-selic',amount:28120,note:'Saldo conferido no Tesouro Direto',createdAt:`${today}T11:01:00Z`},
   {id:'ev-20',date:today,kind:'saldo',assetId:'itub4',amount:23180,note:'Cotação atualizada B3',createdAt:`${today}T11:02:00Z`},
   {id:'ev-21',date:today,kind:'saldo',assetId:'wege3',amount:15640,note:'Cotação atualizada B3',createdAt:`${today}T11:03:00Z`},
   {id:'ev-22',date:today,kind:'saldo',assetId:'hglg11',amount:24890,note:'Cotação atualizada B3',createdAt:`${today}T11:04:00Z`},
   {id:'ev-23',date:today,kind:'saldo',assetId:'ivvb11',amount:21750,note:'Cotação atualizada B3',createdAt:`${today}T11:05:00Z`}
  ],
  finance:{
   accounts:[
    {id:'acc-santander',name:'Santander Select Conjunta',type:'checking',openingBalance:14200,openingDate:`${m1}-01`},
    {id:'acc-itau',name:'Itaú Personnalité Reserva',type:'savings',openingBalance:8500,openingDate:`${m1}-01`}
   ],
   cards:[
    {id:'card-unique',name:'Santander Unique Visa Infinite',accountId:'acc-santander',closeDay:10,dueDay:20},
    {id:'card-itau',name:'Itaú Personnalité Black',accountId:'acc-itau',closeDay:5,dueDay:15}
   ],
   transactions:[
    {id:'tx-1',type:'income',accountId:'acc-santander',amount:16800,date:`${m1}-05`,description:'Salário & Pró-labore Familiar',category:'Salário'},
    {id:'tx-2',type:'expense',accountId:'acc-santander',amount:3150,date:`${m1}-08`,description:'Condomínio e Moradia',category:'Moradia'},
    {id:'tx-3',type:'expense',accountId:'acc-santander',amount:1940,date:`${m1}-12`,description:'Supermercado e Feira',category:'Alimentação'},
    {id:'tx-4',type:'investment',accountId:'acc-santander',assetId:'hglg11',portfolioEventId:'ev-12',amount:4200,date:`${m1}-05`,description:'Aporte HGLG11',category:'Investimento'},
    {id:'tx-5',type:'income',accountId:'acc-santander',amount:17200,date:`${m0}-05`,description:'Salário & Pró-labore Familiar',category:'Salário'},
    {id:'tx-6',type:'expense',accountId:'acc-santander',amount:3180,date:`${m0}-07`,description:'Condomínio Residencial e Água',category:'Moradia'},
    {id:'tx-7',type:'expense',accountId:'acc-santander',amount:1620,date:`${m0}-10`,description:'Supermercado Pão de Açúcar',category:'Alimentação'},
    {id:'tx-8',type:'expense',accountId:'acc-santander',amount:890,date:`${m0}-11`,description:'Drogasil e Plano de Saúde',category:'Saúde'},
    {id:'tx-9',type:'card_purchase',cardId:'card-unique',accountId:'acc-santander',amount:1480,date:`${m0}-04`,invoiceMonth:m0,dueDate:`${m0}-20`,closeDay:10,dueDay:20,description:'Hotel & Passagens Fim de Semana',category:'Lazer',installments:1},
    {id:'tx-10',type:'card_purchase',cardId:'card-unique',accountId:'acc-santander',amount:640,date:`${m0}-06`,invoiceMonth:m0,dueDate:`${m0}-20`,closeDay:10,dueDay:20,description:'IFD*Restaurantes e Padaria',category:'Alimentação',installments:1},
    {id:'tx-11',type:'card_purchase',cardId:'card-itau',accountId:'acc-itau',amount:780,date:`${m0}-03`,invoiceMonth:m0,dueDate:`${m0}-15`,closeDay:5,dueDay:15,description:'UBER *Combustível e Sem Parar',category:'Transporte',installments:1},
    {id:'tx-12',type:'investment',accountId:'acc-santander',assetId:'cdb-santander',portfolioEventId:'ev-15',amount:2500,date:`${m0}-05`,description:'Aporte CDB Santander',category:'Investimento'},
    {id:'tx-13',type:'expense',accountId:'acc-santander',amount:340,date:`${m0}-08`,description:'ENEL DISTRIBUICAO SP',category:'Energia',pluggyTransactionId:'pluggy-demo-1'},
    {id:'tx-14',type:'expense',accountId:'acc-santander',amount:169.90,date:`${m0}-09`,description:'VIVO FIBRA BANDA LARGA',category:'Internet',pluggyTransactionId:'pluggy-demo-2'},
    {id:'tx-15',type:'card_purchase',cardId:'card-unique',accountId:'acc-santander',amount:245.50,date:`${m0}-09`,invoiceMonth:m0,dueDate:`${m0}-20`,closeDay:10,dueDay:20,description:'MERCADOLIVRE*COMPRAS CASA',category:'Outros',needsReview:true,pluggyTransactionId:'pluggy-demo-3',installments:1}
   ],
   recurring:[
    {id:'rec-1',type:'expense',accountId:'acc-santander',amount:3180,day:7,description:'Condomínio e Contas Fixas',category:'Moradia'},
    {id:'rec-2',type:'expense',accountId:'acc-santander',amount:890,day:12,description:'Plano de Saúde Familiar',category:'Saúde'}
   ],
   schedules:[],
   budgets:{
    [m0]:{Moradia:3500,Alimentação:2600,Saúde:1200,Lazer:1800,Transporte:1000,Energia:420,Internet:200}
   },
   categories:['Salário','Moradia','Energia','Internet','Alimentação','Transporte','Saúde','Educação','Lazer','Compras','Contas','Investimento','Outros'],
   closings:{},
   pluggy:{
    itemId:'',
    lastSyncAt:`${today}T10:30:00Z`,
    rules:[
     {id:'rule-1',contains:'PAO DE ACUCAR',category:'Alimentação',active:true,createdAt:`${m1}-02T10:00:00Z`},
     {id:'rule-2',contains:'ENEL',category:'Energia',active:true,createdAt:`${m1}-02T10:00:00Z`}
    ],
    review:[],
    inventory:[],
    remoteCards:[],
    cardLinks:{},
    positionLinks:{}
   }
  }
 });
}
