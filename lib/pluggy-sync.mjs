import {installmentSchedule} from './finance.mjs';

const categories=[
 [/housing|rent|mortgage|moradia|aluguel|condom[ií]nio|eevir\s*dev/i,'Moradia'],[/electric|energia|energy|luz|eletropaulo|enel/i,'Energia'],[/internet|banda larga|vivo fibra|claro net/i,'Internet'],[/accounting|contabilidade|contador/i,'Contabilidade'],[/church|igreja|iurd|d[ií]zimo|oferta religiosa/i,'Dízimo/Oferta'],[/uber|transporte|gas|fuel|combustível|combustivel|99app/i,'Transporte'],[/food|restaurant|grocer|aliment|restaurante|mercado/i,'Alimentação'],[/health|pharmacy|saúde|saude|farmácia|farmacia/i,'Saúde'],[/education|educação|educacao|school/i,'Educação'],[/leisure|entertainment|lazer|streaming/i,'Lazer'],[/salary|payroll|salário|salario/i,'Salário'],[/interest|yield|income|rendimento|juros/i,'Rendimentos'],[/transfer|pix|ted|doc|fatura|card|cartão|cartao/i,'Outros']
];
const categoryFor=value=>categories.find(([pattern])=>pattern.test(value||''))?.[1]||null;
const classifyPluggyRow=row=>{
 const description=String(row.description||''),rawCategory=String(row.category||''),text=`${description} ${rawCategory}`,direction=String(row.type||'').toUpperCase();
 const investment=/aplica[cç][aã]o.*\b(?:cdb|rdb)\b|\b(?:cdb|rdb)\b.*aplica[cç][aã]o|aporte.*\b(?:cdb|rdb)\b/i.test(description),debit=direction==='DEBIT'||(!direction&&Number(row.amount)<0);
 let category;if(/igreja universal|universal do reino|\biurd\b|d[ií]zimo|oferta religiosa/i.test(text))category='Dízimo/Oferta';else if(/\beevir\s*dev\b/i.test(description))category='Moradia';else if(/\buber\b|\b99app\b/i.test(description))category='Transporte';else if(investment&&debit)category='Investimento';else category=categoryFor(description)||categoryFor(rawCategory)||null;
 return {category,investment:investment&&debit};
};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const historyStart='2026-08-01';
const userCategory=(finance,row)=>{const text=String(row.description||'').toLocaleLowerCase('pt-BR'),rule=(finance.pluggy?.rules||[]).filter(r=>r.active!==false&&text.includes(String(r.contains||'').toLocaleLowerCase('pt-BR'))).sort((a,b)=>b.contains.length-a.contains.length)[0];return rule?.category||null;};

export function mergePluggyData(state,payload){
 const finance=structuredClone(state.finance||{accounts:[],cards:[],transactions:[],recurring:[],budgets:{},categories:[]});
 const events=structuredClone(state.events||[]);
 finance.pluggy={...(finance.pluggy||{}),itemId:payload.itemId,lastSyncAt:payload.updatedAt,coverageStart:payload.coverageStart||state.startDate,products:payload.products||finance.pluggy?.products||{},resources:payload.resources||finance.pluggy?.resources||[],inventory:payload.investments||finance.pluggy?.inventory||[],remoteCards:payload.cards||finance.pluggy?.remoteCards||[],bills:payload.bills||finance.pluggy?.bills||[]};
 const imported=[],known=new Set(finance.transactions.filter(t=>t.pluggyTransactionId).map(t=>t.pluggyTransactionId));let skipped=0;
 for(const source of payload.accounts||[]){
  const accountType=String(source.type||'').toUpperCase();if(/INVEST|BROKER/.test(accountType)){skipped++;continue;}
  let account=finance.accounts.find(a=>a.pluggyAccountId===source.id),card=null;
  const firstDate=(source.transactions||[]).map(t=>t.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=historyStart).sort()[0]||historyStart;
  if(/CREDIT|CARD/.test(accountType)){
   card=finance.cards.find(c=>c.id===finance.pluggy?.cardLinks?.[source.id]?.cardId);
   if(!card){skipped++;continue;}
   account={...card,financeCard:true};
  }else if(!account){const suffix=source.mask?` · ${String(source.mask).slice(-4)}`:'';account={id:crypto.randomUUID(),name:`${source.name||'Conta Santander'}${suffix}`.slice(0,80),type:/SAVING|POUPAN/i.test(accountType)?'savings':'checking',openingBalance:0,openingDate:firstDate,pluggyAccountId:source.id};finance.accounts.push(account);}
  else if(firstDate<account.openingDate)account.openingDate=firstDate;
  for(const row of source.transactions||[]){
   if(!row.id||typeof row.id!=='string'||row.id.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.date<historyStart||row.date>today()||!Number.isFinite(row.amount)||row.amount===0||row.status==='PENDING')continue;
   const {category:autoCategory,investment}=classifyPluggyRow(row),category=userCategory(finance,row)||autoCategory,direction=String(row.type||'').toUpperCase(),positive=direction==='CREDIT'||(!direction&&row.amount>0),amount=Math.abs(row.amount),transactionType=investment?'investment':positive?'income':card?'card_purchase':'expense';
   if(card&&!finance.pluggy.cardLinks?.[source.id]){skipped++;continue;}
   if(card){const linked=finance.cards.find(c=>c.id===finance.pluggy.cardLinks[source.id]?.cardId);if(!linked){skipped++;continue;}card=linked;account=finance.accounts.find(a=>a.id===linked.accountId)||account;}
   if(card&&transactionType==='card_purchase'&&row.installmentNumber&&row.totalInstallments){const remoteParts=installmentSchedule({date:row.date,amount,installments:Number(row.totalInstallments),closeDay:card.closeDay,dueDay:card.dueDay});const part=remoteParts.find(p=>p.installment===Number(row.installmentNumber));if(!part)continue;}
   if(known.has(row.id)){const existing=finance.transactions.find(t=>t.pluggyTransactionId===row.id);if(existing){if(!existing.categoryManuallySet){existing.category=category||'Outros';existing.userCategoryRuleId=userCategory(finance,row)?finance.pluggy.rules.find(r=>r.active!==false&&String(row.description||'').toLocaleLowerCase('pt-BR').includes(r.contains.toLocaleLowerCase('pt-BR')))?.id:null;}existing.type=transactionType;if(investment)existing.bankInvestment=true;else delete existing.bankInvestment;existing.needsReview=existing.reviewDecision||existing.reconciled?false:Boolean(existing.possibleTransfer||existing.possibleDuplicate||investment||!category);}continue;}
   const possibleTransfer=/transfer|pix|ted|doc|pagamento.*fatura|fatura.*cart[aã]o/i.test(`${row.category||''} ${row.description}`),possibleDuplicate=finance.transactions.some(t=>!t.pluggyTransactionId&&t.date===row.date&&Math.abs(t.amount-amount)<.01&&t.description.toLocaleLowerCase('pt-BR')===String(row.description||'').toLocaleLowerCase('pt-BR'));
   const matchingManualTransactionId=investment?finance.transactions.find(t=>!t.pluggyTransactionId&&!t.supersededByPluggyTransactionId&&t.type==='investment'&&t.date===row.date&&Math.abs(t.amount-amount)<.01)?.id:undefined;
   const suggestedPortfolioEventId=investment?events.find(e=>e.kind==='aporte'&&!e.pluggyTransactionId&&e.date===row.date&&Math.abs(e.amount-amount)<.01)?.id:undefined;
   if(finance.transactions.length>=20000)throw new Error('O limite de lançamentos foi atingido. Exporte e arquive dados antigos antes de sincronizar.');
   const installmentParts=card&&transactionType==='card_purchase'&&row.installmentNumber&&row.totalInstallments?installmentSchedule({date:row.date,amount,installments:Number(row.totalInstallments),closeDay:card.closeDay,dueDay:card.dueDay}):undefined;const installment=installmentParts?.find(p=>p.installment===Number(row.installmentNumber));
   finance.transactions.push({id:crypto.randomUUID(),type:transactionType,accountId:card?.accountId||account.id,cardId:card?.id||undefined,amount:installment?installment.amount:amount,date:row.date,description:row.description||'Movimentação importada',category:category||'Outros',pluggyTransactionId:row.id,pluggyCategory:row.category||null,bankInvestment:investment||undefined,needsReview:!category||possibleTransfer||possibleDuplicate||investment||transactionType==='card_purchase',possibleTransfer,possibleDuplicate:possibleDuplicate||undefined,matchingManualTransactionId,suggestedPortfolioEventId,providerType:row.type||null,installmentNumber:row.installmentNumber||undefined,totalInstallments:row.totalInstallments||undefined,installments:installment?Number(row.totalInstallments):undefined,closeDay:installment?card.closeDay:undefined,dueDay:installment?card.dueDay:undefined,invoiceMonth:installment?.invoiceMonth,dueDate:installment?.dueDate});
   known.add(row.id);imported.push(row.id);
  }
  if(!card&&Number.isFinite(source.balance)){
   const movements=finance.transactions.filter(t=>t.accountId===account.id&&(t.pluggyTransactionId||t.reconciled||t.supersededByPluggyTransactionId)).reduce((sum,t)=>sum+(t.type==='income'?t.amount:['expense','transfer','investment','card_payment'].includes(t.type)?-t.amount:0),0);
   account.openingBalance=Math.round((source.balance-movements)*100)/100;account.openingDate=(source.transactions||[]).map(t=>t.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=historyStart).sort()[0]||historyStart;
  }
 }
 // Keep provider bills as reference data; future due dates must not become posted transactions.
 finance.pluggy.cardLinks=finance.pluggy.cardLinks||{};
 for(const remote of payload.cards||[]){const link=finance.pluggy.cardLinks[remote.id];if(!link)continue;const card=finance.cards.find(c=>c.id===link.cardId);if(card){card.pluggyAccountId=remote.id;card.needsMapping=false;}}
 for(const remote of payload.investments||[]){const link=finance.pluggy.positionLinks?.[remote.id];if(!link)continue;const assetId=link.assetId;if(!state.assets.some(a=>a.id===assetId)||!Number.isFinite(remote.balance)||!remote.date||remote.date<state.startDate||remote.date>today())continue;const manual=[...events].reverse().find(e=>e.assetId===assetId&&e.kind==='saldo'&&!e.pluggyInvestmentId);if(manual&&manual.date>remote.date&&manual.amount!==remote.balance){const id=`position:${remote.id}:${remote.date}`;finance.pluggy.review=(finance.pluggy.review||[]).filter(r=>r.id!==id).concat({id,type:'position_conflict',providerId:remote.id,assetId,remoteBalance:remote.balance,remoteDate:remote.date,manualDate:manual.date,needsReview:true});continue;}if(!events.some(e=>e.pluggyInvestmentId===remote.id&&e.date===remote.date))events.push({id:crypto.randomUUID(),date:remote.date.slice(0,10),kind:'saldo',assetId,amount:remote.balance,note:`Saldo Meu Pluggy · ${remote.name}`.slice(0,200),createdAt:payload.updatedAt,pluggyInvestmentId:remote.id});}
 return {finance,events,imported:imported.length,skippedAccounts:skipped,updatedAt:payload.updatedAt};
}
export function previewRule(state,contains,category){const needle=String(contains||'').trim().toLocaleLowerCase('pt-BR');if(needle.length<2||needle.length>80)throw new Error('Informe ao menos 2 caracteres para a regra.');return (state.finance?.transactions||[]).filter(t=>!t.categoryManuallySet&&String(t.description||'').toLocaleLowerCase('pt-BR').includes(needle)).map(t=>({id:t.id,date:t.date,description:t.description,previous:t.category||'Outros',next:category}));}
export function applyRule(state,rule,transactionIds){const next=structuredClone(state),finance=next.finance,rules=finance.pluggy?.rules||[],ids=new Set(transactionIds);if(!finance.pluggy)finance.pluggy={};finance.pluggy.rules=[...rules.filter(r=>r.id!==rule.id),{...rule}];for(const t of finance.transactions)if(ids.has(t.id)&&!t.categoryManuallySet){t.category=rule.category;t.userCategoryRuleId=rule.id;}return next;}
