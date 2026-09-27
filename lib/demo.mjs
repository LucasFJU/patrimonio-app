import {DEFAULT_FINANCE,installmentSchedule,invoiceSummaries,monthEnd,shiftMonth} from './finance.mjs';
import {dateISO,initialState,validateState} from './portfolio.mjs';
import {materializeSchedules} from './schedules.mjs';

const cents=value=>Math.round(value*100)/100;
const dayIn=(month,day)=>`${month}-${String(Math.min(day,Number(monthEnd(month).slice(8)))).padStart(2,'0')}`;
const boundedDate=(month,day,today)=>{const date=dayIn(month,day);return date>today?today:date;};
function checkedDate(today){
 if(typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today)||!Number.isFinite(Date.parse(today))||new Date(today).toISOString().slice(0,10)!==today||today<'2000-12-01'||today>dateISO())throw new Error('Informe uma data de referência válida, até hoje.');
 return today;
}

/** Synthetic, deterministic data for local previews only. No remote identifiers. */
export function createDemoState(today=dateISO()){
 checkedDate(today);
 const currentMonth=today.slice(0,7),firstMonth=shiftMonth(currentMonth,-11),startDate=`${firstMonth}-01`;
 const state={schema:1,demo:{kind:'synthetic',referenceDate:today},startDate,settings:{name:'Família de exemplo',monthly:1800,expenses:4800,reserveMonths:6,horizon:15,risk:'moderado',allocation:{cdb:30,tesouro:25,acoes:20,fiis:10,internacional:15},wealthGoal:150000,goals:[{id:'demo-goal-trip',name:'Viagem em família',targetAmount:12000,currentAmount:4800,targetDate:`${shiftMonth(currentMonth,10)}-01`},{id:'demo-goal-home',name:'Entrada do apartamento',targetAmount:80000,currentAmount:24000,targetDate:`${shiftMonth(currentMonth,36)}-01`}]},assets:[
  {id:'demo-cdb',name:'CDB liquidez diária',ticker:'',category:'cdb',reserve:true,initial:0,institution:'Banco de exemplo'},
  {id:'demo-tesouro',name:'Tesouro IPCA+ 2035',ticker:'',category:'tesouro',reserve:false,initial:0,institution:'Corretora de exemplo'},
  {id:'demo-petr',name:'Petrobras',ticker:'PETR4',category:'acoes',reserve:false,initial:0,institution:'Corretora de exemplo'},
  {id:'demo-itub',name:'Itaú Unibanco',ticker:'ITUB4',category:'acoes',reserve:false,initial:0,institution:'Corretora de exemplo'},
  {id:'demo-fii',name:'CSHG Logística',ticker:'HGLG11',category:'fiis',reserve:false,initial:0,institution:'Corretora de exemplo'},
  {id:'demo-exterior',name:'ETF S&P 500',ticker:'IVVB11',category:'internacional',reserve:false,initial:0,institution:'Corretora de exemplo'},
  {id:'cash',name:'Dividendos disponíveis',ticker:'',category:'caixa',reserve:false,initial:0}
 ],events:[],finance:DEFAULT_FINANCE()};
 const finance=state.finance;
 finance.accounts=[{id:'demo-checking',name:'Conta do dia a dia',type:'checking',openingBalance:5200,openingDate:startDate},{id:'demo-savings',name:'Conta de apoio',type:'savings',openingBalance:800,openingDate:startDate}];
 finance.cards=[{id:'demo-card',name:'Cartão da família',accountId:'demo-checking',closeDay:10,dueDay:20}];
 const balances=Object.fromEntries(state.assets.map(asset=>[asset.id,0])),contributions=[600,400,250,150,200,200],growth=[.008,.007,.014,.009,.004,.011];
 let availableDividends=0;
 for(let index=0;index<12;index++){
  const month=shiftMonth(firstMonth,index),first=`${month}-01`,closing=boundedDate(month,31,today),dividendDate=boundedDate(month,15,today);
  for(const [assetIndex,asset] of state.assets.filter(asset=>asset.id!=='cash').entries()){
   const amount=contributions[assetIndex]*(index===0?10:1),eventId=`demo-contribution-${index}-${assetIndex}`;
   state.events.push({id:eventId,kind:'aporte',assetId:asset.id,amount,date:first,createdAt:`${first}T08:00:00.000Z`,note:index===0?'Aplicação anterior ao controle bancário · exemplo':'Aporte mensal · exemplo'});
   balances[asset.id]+=amount;
   if(index>0)finance.transactions.push({id:`demo-investment-${index}-${assetIndex}`,type:'investment',accountId:'demo-checking',assetId:asset.id,portfolioEventId:eventId,date:first,amount,description:`Aporte em ${asset.name}`,category:'Investimento'});
  }
  for(const [assetId,base] of [['demo-petr',22],['demo-itub',8],['demo-fii',34]]){
   const amount=cents(base+index*2.35);availableDividends+=amount;
   state.events.push({id:`demo-dividend-${index}-${assetId}`,kind:'dividendo',assetId,amount,date:dividendDate,createdAt:`${dividendDate}T09:00:00.000Z`,note:'Provento fictício para demonstração'});
  }
  if(index%3===2){
   const amount=cents(availableDividends*.6);availableDividends=cents(availableDividends-amount);balances['demo-fii']+=amount;
   state.events.push({id:`demo-reinvestment-${index}`,kind:'reinvestimento',assetId:'demo-fii',amount,date:closing,createdAt:`${closing}T11:00:00.000Z`,note:'Reinvestimento de proventos · exemplo'});
  }
  for(const [assetIndex,asset] of state.assets.filter(asset=>asset.id!=='cash').entries()){
   const volatility=asset.category==='acoes'&&index%4===1?-.016:growth[assetIndex];
   balances[asset.id]=cents(balances[asset.id]*(1+volatility));
   state.events.push({id:`demo-balance-${index}-${assetIndex}`,kind:'saldo',assetId:asset.id,amount:balances[asset.id],date:closing,createdAt:`${closing}T12:00:00.000Z`,note:'Saldo ilustrativo, sem cotação real'});
  }
  for(const [suffix,description,category,base,day] of [['market','Mercado da semana','Alimentação',720,6],['energy','Conta de energia','Energia',185,14],['transport','Transporte do mês','Transporte',210,19],['leisure','Passeio em família','Lazer',260,22]]){
   const date=dayIn(month,day);if(date>today)continue;
   finance.transactions.push({id:`demo-expense-${index}-${suffix}`,type:'expense',accountId:'demo-checking',date,amount:cents(base+(index%3)*18.5),description,category,categoryManuallySet:true});
  }
  const purchaseDate=boundedDate(month,4,today),amount=cents(430+index*7.25),parts=installmentSchedule({date:purchaseDate,amount,installments:1,closeDay:10,dueDay:20});
  finance.transactions.push({id:`demo-card-purchase-${index}`,type:'card_purchase',cardId:'demo-card',accountId:'demo-checking',date:purchaseDate,amount,description:'Compras para a casa',category:'Compras',installments:1,closeDay:10,dueDay:20,invoiceMonth:parts[0].invoiceMonth,dueDate:parts[0].dueDate,installmentParts:parts});
  finance.budgets[month]={Moradia:1900,Alimentação:1000,Transporte:300,Energia:240,Internet:120,Lazer:350,Compras:600};
 }
 const purchaseDate=`${shiftMonth(currentMonth,-1)}-22`,purchaseAmount=1899.99,parts=installmentSchedule({date:purchaseDate,amount:purchaseAmount,installments:6,closeDay:10,dueDay:20});
 finance.transactions.push({id:'demo-card-installments',type:'card_purchase',cardId:'demo-card',accountId:'demo-checking',date:purchaseDate,amount:purchaseAmount,description:'Notebook em seis parcelas',category:'Compras',installments:6,closeDay:10,dueDay:20,invoiceMonth:parts[0].invoiceMonth,dueDate:parts[0].dueDate,installmentParts:parts});
 for(const invoice of invoiceSummaries(finance,today).filter(invoice=>invoice.invoiceMonth<currentMonth))finance.transactions.push({id:`demo-card-payment-${invoice.invoiceMonth}`,type:'card_payment',accountId:'demo-checking',cardId:'demo-card',date:invoice.dueDate,invoiceMonth:invoice.invoiceMonth,amount:invoice.total,description:'Pagamento da fatura · exemplo',category:'Contas'});
 finance.schedules=[
  {id:'demo-salary',type:'income',accountId:'demo-checking',description:'Salário mensal',category:'Salário',mode:'monthly',amount:8200,firstDate:startDate,competenceMonth:firstMonth,count:null},
  {id:'demo-rent',type:'expense',accountId:'demo-checking',description:'Aluguel e condomínio',category:'Moradia',mode:'monthly',amount:1800,firstDate:`${firstMonth}-08`,competenceMonth:firstMonth,count:null},
  {id:'demo-internet',type:'expense',accountId:'demo-checking',description:'Internet de casa',category:'Internet',mode:'monthly',amount:109.9,firstDate:`${firstMonth}-28`,competenceMonth:firstMonth,count:null},
  {id:'demo-course',type:'expense',accountId:'demo-checking',description:'Curso de seis meses',category:'Educação',mode:'monthly',amount:240,firstDate:`${shiftMonth(currentMonth,-1)}-15`,competenceMonth:shiftMonth(currentMonth,-1),count:6}
 ];
 state.finance=materializeSchedules(finance,today).finance;
 return validateState(state);
}

/** Erase financial content, keeping only profile preferences and the read-only Item ID. */
export function resetFinancialState(existing,today=dateISO()){
 checkedDate(today);
 const defaults=initialState().settings,profile=existing?.settings||{},settings={};
 for(const field of ['name','monthly','expenses','reserveMonths','horizon','risk','allocation'])settings[field]=structuredClone(profile[field]??defaults[field]);
 const finance=DEFAULT_FINANCE(),itemId=existing?.finance?.pluggy?.itemId;
 if(typeof itemId==='string'&&/^[-\w]{20,64}$/.test(itemId))finance.pluggy={itemId};
 const originalStart=existing?.startDate;
 const startDate=typeof originalStart==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(originalStart)&&originalStart>='2000-01-01'&&originalStart<=today?([originalStart,'2026-08-01'].filter(date=>date<=today).sort()[0]||originalStart):today;
 return validateState({schema:1,settings,startDate,assets:[{id:'cash',name:'Dividendos disponíveis',category:'caixa',reserve:false,initial:0}],events:[],finance});
}
