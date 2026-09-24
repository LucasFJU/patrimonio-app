const categories=[
 [/housing|rent|mortgage|moradia|aluguel|condom[ií]nio|eevir\s*dev/i,'Moradia'],[/electric|energia|energy|luz|eletropaulo|enel/i,'Energia'],[/internet|banda larga|vivo fibra|claro net/i,'Internet'],[/accounting|contabilidade|contador/i,'Contabilidade'],[/church|igreja|iurd|d[ií]zimo|oferta religiosa/i,'Dízimo/Oferta'],[/uber|transporte|gas|fuel|combustível|combustivel|99app/i,'Transporte'],[/food|restaurant|grocer|aliment|restaurante|mercado/i,'Alimentação'],[/health|pharmacy|saúde|saude|farmácia|farmacia/i,'Saúde'],[/education|educação|educacao|school/i,'Educação'],[/leisure|entertainment|lazer|streaming/i,'Lazer'],[/salary|payroll|salário|salario/i,'Salário'],[/interest|yield|income|rendimento|juros/i,'Rendimentos'],[/transfer|pix|ted|doc|fatura|card|cartão|cartao/i,'Outros']
];
const categoryFor=value=>categories.find(([pattern])=>pattern.test(value||''))?.[1]||null;
const classifyPluggyRow=row=>{
 const description=String(row.description||''),rawCategory=String(row.category||''),text=`${description} ${rawCategory}`,direction=String(row.type||'').toUpperCase();
 const investment=/aplica[cç][aã]o.*\b(?:cdb|rdb)\b|\b(?:cdb|rdb)\b.*aplica[cç][aã]o|aporte.*\b(?:cdb|rdb)\b/i.test(description);
 const debit=direction==='DEBIT'||(!direction&&Number(row.amount)<0);
 let category;
 if(/igreja universal|universal do reino|\biurd\b|d[ií]zimo|oferta religiosa/i.test(text))category='Dízimo/Oferta';
 else if(/\beevir\s*dev\b/i.test(description))category='Moradia';
 else if(/\buber\b|\b99app\b/i.test(description))category='Transporte';
 else if(investment&&debit)category='Investimento';
 else category=categoryFor(description)||categoryFor(rawCategory)||null;
 return {category,investment:investment&&debit};
};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const historyStart='2026-08-01';

export function mergePluggyData(state,payload){
 const finance=structuredClone(state.finance||{accounts:[],cards:[],transactions:[],recurring:[],budgets:{},categories:[]});
 finance.pluggy={...(finance.pluggy||{}),itemId:payload.itemId,lastSyncAt:payload.updatedAt,coverageStart:payload.coverageStart||state.startDate};
 const imported=[],known=new Set(finance.transactions.filter(t=>t.pluggyTransactionId).map(t=>t.pluggyTransactionId));let skipped=0;
 for(const source of payload.accounts||[]){
  const accountType=String(source.type||'').toUpperCase();
  if(/CREDIT|CARD|INVEST|BROKER/.test(accountType)){skipped++;continue;}
  let account=finance.accounts.find(a=>a.pluggyAccountId===source.id);
  const firstDate=(source.transactions||[]).map(t=>t.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=historyStart).sort()[0]||historyStart;
  if(!account){
   const suffix=source.mask?` · ${String(source.mask).slice(-4)}`:'';
   account={id:crypto.randomUUID(),name:`${source.name}${suffix}`.slice(0,80),type:/SAVING|POUPAN/i.test(accountType)?'savings':'checking',openingBalance:0,openingDate:firstDate,pluggyAccountId:source.id};
   finance.accounts.push(account);
  }else if(firstDate<account.openingDate)account.openingDate=firstDate;
  for(const row of source.transactions||[]){
   if(!row.id||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.date<historyStart||row.date>today()||!Number.isFinite(row.amount)||row.amount===0||row.status==='PENDING')continue;
   const {category,investment}=classifyPluggyRow(row),direction=String(row.type||'').toUpperCase(),positive=direction==='CREDIT'||(!direction&&row.amount>0),amount=Math.abs(row.amount),transactionType=investment?'investment':positive?'income':'expense';
   if(known.has(row.id)){
    const existing=finance.transactions.find(t=>t.pluggyTransactionId===row.id);
    if(existing&&!existing.categoryManuallySet){existing.category=category||'Outros';existing.type=transactionType;if(investment)existing.bankInvestment=true;else delete existing.bankInvestment;}
    continue;
   }
   const possibleTransfer=/transfer|pix|ted|doc|pagamento.*fatura|fatura.*cart[aã]o/i.test(`${row.category||''} ${row.description}`);
   if(finance.transactions.length>=20000)throw new Error('O limite de lançamentos foi atingido. Exporte e arquive dados antigos antes de sincronizar.');
   finance.transactions.push({id:crypto.randomUUID(),type:transactionType,accountId:account.id,amount,date:row.date,description:row.description||'Movimentação importada',category:category||'Outros',pluggyTransactionId:row.id,pluggyCategory:row.category||null,bankInvestment:investment||undefined,needsReview:!category||possibleTransfer,possibleTransfer});
   known.add(row.id);imported.push(row.id);
  }
  if(Number.isFinite(source.balance)){
   const movements=finance.transactions.reduce((sum,t)=>sum+(t.accountId===account.id?(t.type==='income'?t.amount:['expense','transfer','investment','card_payment'].includes(t.type)?-t.amount:0):0)+(t.type==='transfer'&&t.toAccountId===account.id?t.amount:0),0);
   account.openingBalance=Math.round((source.balance-movements)*100)/100;
  }
 }
 return {finance,imported:imported.length,skippedAccounts:skipped,updatedAt:payload.updatedAt};
}
