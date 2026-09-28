import {materializeSchedules,markScheduleCandidates} from './schedules.mjs';
import {installmentSchedule,accountBalances} from './finance.mjs';

const categories=[
 [/housing|\brent\b|mortgage|moradia|aluguel|condom[ií]nio|\biptu\b|quinto\s*andar|imobili[aá]ria|sabesp|sanepar|copasa|cedae|corsan|comg[aá]s|naturgy|ultragaz|consigaz|leroy\s*merlin|telhanorte|sodimac|eevir\s*dev/i,'Moradia'],
 [/electric|energia|energy|\bluz\b|eletropaulo|\benel\b|\bcpfl\b|cemig|\blight\b|coelba|celpe|copel|celesc|equatorial|energisa|neoenergia|\brge\b|elektro/i,'Energia'],
 [/internet|banda\s*larga|vivo\s*fibra|claro\s*net|claro\s*fibra|oi\s*fibra|tim\s*live|tim\s*fibra|algar|brisanet|starlink|telefonia|telecom|celular|\bvivo\b|\bclaro\b|\btim\b/i,'Internet'],
 [/accounting|contabilidade|contador|cont[aá]bil|simples\s*nacional|\bdas\b|\binss\b|\bgps\b/i,'Contabilidade'],
 [/church|igreja|\biurd\b|universal\s*do\s*reino|d[ií]zimo|oferta\s*religiosa|par[oó]quia|catedral|templo|donation|charity/i,'Dízimo/Oferta'],
 [/uber\s*eats|ifood|ifd\*|rappi|z[eé]\s*delivery|aiqfome|\bfood\b|restaurant|grocer|supermarket|bakery|eating\s*out|aliment|restaurante|mercado|supermercado|hipermercado|atacad[aã]o|assa[ií]|carrefour|p[aã]o\s*de\s*a[cç][uú]car|minuto\s*p[aã]o|\boxxo\b|padaria|panificadora|confeitaria|a[cç]ougue|hortifruti|sacol[aã]o|\bfeira\b|lanchonete|caf[eé]|cafeteria|starbucks|mcdonald|burger\s*king|outback|madero|habib|subway|pizzaria|sushi|churrascaria/i,'Alimentação'],
 [/\buber\b|99app|99\s*pop|99\*|cabify|indriver|transporte|\bgas\b|\bfuel\b|combust[ií]vel|gasolina|etanol|\bposto\b|ipiranga|\bshell\b|petrobras|abastece\s*a[ií]|sem\s*parar|conectcar|veloe|taggy|ped[aá]gio|estacionamento|estapar|indigo|metr[oô]|\bcptm\b|sptrans|bilhete\s*[uú]nico|[oô]nibus|azul\s*linhas|gol\s*linhas|\blatam\b|localiza|movida|unidas|turbi|parking|tolls|automotive|public\s*transit|\btaxi\b/i,'Transporte'],
 [/health|pharmacy|medical|healthcare|wellness|\bgym\b|sa[uú]de|farm[aá]cia|drogaria|droga\s*raia|drogasil|pague\s*menos|panvel|ultrafarma|pacheco|araujo|nissei|hospital|cl[ií]nica|laborat[oó]rio|fleury|\bdasa\b|delboni|lavoisier|sabin|hermes\s*pardini|unimed|bradesco\s*sa[uú]de|sulam[eé]rica|\bamil\b|notredame|hapvida|prevent\s*senior|consulta|m[eé]dico|dentista|odonto|psic[oó]log|fisioterapia|academia|smart\s*fit|smartfit|bluefit|bodytech|totalpass|gympass|wellhub/i,'Saúde'],
 [/education|educa[cç][aã]o|school|tuition|bookstore|escola|col[eé]gio|faculdade|universidade|\bcurso\b|mensalidade\s*escolar|\bpuc\b|mackenzie|\bfgv\b|insper|est[aá]cio|anhanguera|\bunip\b|alura|udemy|coursera|rocketseat|duolingo|kumon|cultura\s*inglesa|wizard|\bccaa\b|livraria/i,'Educação'],
 [/leisure|entertainment|lazer|streaming|movies|music|games|travel|lodging|netflix|spotify|disney|prime\s*video|amazon\s*prime|\bhbo\b|globoplay|youtube|apple\.com\/bill|google\s*play|steam|playstation|xbox|nintendo|cinema|cinemark|kinoplex|ingresso|sympla|eventim|teatro|hotel|airbnb|booking|decolar|hospedagem|viagem/i,'Lazer'],
 [/shopping|electronics|clothing|department\s*store|general\s*merchandise|\bpets\b|compras|mercado\s*livre|mercadolivre|\bmeli\b|amazon|shopee|magalu|magazine\s*luiza|casas\s*bahia|ponto\s*frio|fast\s*shop|kabum|aliexpress|shein|renner|riachuelo|c&a|\bzara\b|hering|centauro|decathlon|netshoes|\bnike\b|adidas|botic[aá]rio|natura|sephora|\bpetz\b|cobasi|petlove/i,'Compras'],
 [/bank\s*fee|taxes|insurance|service\s*fee|utilities|tarifa\s*banc[aá]ria|pacote\s*de\s*servi[cç]os|anuidade|\biof\b|imposto|\bipva\b|licenciamento|detran|cart[oó]rio|seguro|porto\s*seguro|azul\s*seguros|tokio\s*marine|allianz|mapfre|suhai/i,'Contas'],
 [/salary|payroll|sal[aá]rio|folha|pr[oó][-\s]*labore|remunera[cç][aã]o|d[eé]cimo\s*terceiro|f[eé]rias/i,'Salário'],
 [/interest|yield|income|dividend|rendimento|juros|dividendo|\bjcp\b|provento/i,'Rendimentos'],
 [/transfer|\bpix\b|\bted\b|\bdoc\b|fatura|\bcard\b|cart[aã]o/i,'Outros']
];

export const categoryFor=value=>categories.find(([pattern])=>pattern.test(value||''))?.[1]||null;

const normalizeMerchant=text=>String(text||'')
 .toLocaleLowerCase('pt-BR')
 .replace(/\b(compra\s*cart[aã]o|compra\s*no\s*d[eé]bito|pagto|pagamento|pag\*|mp\s*\*|pg\s*\*|ebn\s*\*|ifd\s*\*|dl\s*\*|d\s*local\s*\*)\b/gi,' ')
 .replace(/\b\d{1,2}\/\d{1,2}\b/g,' ')
 .replace(/[^\p{L}\p{N}\s]/gu,' ')
 .replace(/\s+/g,' ')
 .trim();

export const classifyPluggyRow=row=>{
 const description=String(row.description||''),rawCategory=String(row.category||''),text=`${description} ${rawCategory}`,direction=String(row.type||'').toUpperCase();
 const investment=/aplica[cç][aã]o.*\b(?:cdb|rdb|lci|lca|tesouro|fundo)\b|\b(?:cdb|rdb|lci|lca|tesouro)\b.*aplica[cç][aã]o|aporte.*\b(?:cdb|rdb|lci|lca|tesouro|fii|a[cç][oõ]es)\b/i.test(description),debit=direction==='DEBIT'||(!direction&&Number(row.amount)<0);
 let category;
 if(/igreja universal|universal do reino|\biurd\b|d[ií]zimo|oferta religiosa/i.test(text))category='Dízimo/Oferta';
 else if(/\beevir\s*dev\b/i.test(description))category='Moradia';
 else if(/uber\s*eats|ifood|ifd\*|rappi|z[eé]\s*delivery/i.test(description))category='Alimentação';
 else if(/\buber\b|\b99app\b|\b99\s*pop\b/i.test(description))category='Transporte';
 else if(investment&&debit)category='Investimento';
 else category=categoryFor(description)||categoryFor(rawCategory)||null;
 return {category,investment:investment&&debit};
};

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const historyStart='2026-08-01';

const matchingRule=(finance,row)=>{
 const text=String(row.description||'').toLocaleLowerCase('pt-BR');
 return (finance?.pluggy?.rules||[])
  .filter(r=>r.active!==false&&r.contains&&text.includes(String(r.contains).toLocaleLowerCase('pt-BR')))
  .sort((a,b)=>b.contains.length-a.contains.length)[0]||null;
};

const userCategory=(finance,row)=>matchingRule(finance,row)?.category||null;

const learnedCategory=(finance,row)=>{
 const key=normalizeMerchant(row.description);
 if(!key||key.length<3)return null;
 const match=[...(finance?.transactions||[])]
  .reverse()
  .find(t=>t.categoryManuallySet&&t.category&&t.category!=='Outros'&&normalizeMerchant(t.description)===key);
 return match?.category||null;
};

export function inferTransactionCategory(description,rawCategory='',direction='DEBIT',finance=null){
 const row={description,category:rawCategory,type:direction};
 const byRule=finance?userCategory(finance,row):null;
 if(byRule)return byRule;
 const byHistory=finance?learnedCategory(finance,row):null;
 if(byHistory)return byHistory;
 const {category}=classifyPluggyRow(row);
 if(category)return category;
 return direction==='CREDIT'?'Rendimentos':'Outros';
}

export function mergePluggyData(state,payload){
 const finance=materializeSchedules(state.finance||{accounts:[],cards:[],transactions:[],recurring:[],budgets:{},categories:[]}).finance;
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
   const {category:autoCategory,investment}=classifyPluggyRow(row);
   const activeRule=matchingRule(finance,row);
   const historyCat=learnedCategory(finance,row);
   const category=activeRule?.category||historyCat||autoCategory;
   const direction=String(row.type||'').toUpperCase(),positive=direction==='CREDIT'||(!direction&&row.amount>0),amount=Math.abs(row.amount),transactionType=investment?'investment':positive?'income':card?'card_purchase':'expense';
   if(card&&!finance.pluggy.cardLinks?.[source.id]){skipped++;continue;}
   if(card){const linked=finance.cards.find(c=>c.id===finance.pluggy.cardLinks[source.id]?.cardId);if(!linked){skipped++;continue;}card=linked;account=finance.accounts.find(a=>a.id===linked.accountId)||account;}
   if(card&&transactionType==='card_purchase'&&row.installmentNumber&&row.totalInstallments){const remoteParts=installmentSchedule({date:row.date,amount,installments:Number(row.totalInstallments),closeDay:card.closeDay,dueDay:card.dueDay});const part=remoteParts.find(p=>p.installment===Number(row.installmentNumber));if(!part)continue;}
   if(known.has(row.id)){const existing=finance.transactions.find(t=>t.pluggyTransactionId===row.id);if(existing){if(!existing.categoryManuallySet){existing.category=category||'Outros';existing.userCategoryRuleId=activeRule?activeRule.id:null;}existing.type=transactionType;if(investment)existing.bankInvestment=true;else delete existing.bankInvestment;existing.needsReview=existing.reviewDecision||existing.reconciled?false:Boolean(existing.possibleTransfer||existing.possibleDuplicate||investment||!category);}continue;}
   const possibleTransfer=/transfer|pix|ted|doc|pagamento.*fatura|fatura.*cart[aã]o/i.test(`${row.category||''} ${row.description}`),normalizedDescription=String(row.description||'').trim().toLocaleLowerCase('pt-BR');
   const manualMatch=finance.transactions.find(t=>!t.pluggyTransactionId&&!t.supersededByPluggyTransactionId&&t.type===transactionType&&t.accountId===(card?.accountId||account.id)&&(!card||t.cardId===card.id)&&t.date===row.date&&Math.abs(t.amount-amount)<.01&&t.description.trim().toLocaleLowerCase('pt-BR')===normalizedDescription);
   const possibleDuplicate=Boolean(manualMatch)||finance.transactions.some(t=>!t.pluggyTransactionId&&t.date===row.date&&Math.abs(t.amount-amount)<.01&&t.description.trim().toLocaleLowerCase('pt-BR')===normalizedDescription);
   const matchingManualTransactionId=investment?finance.transactions.find(t=>!t.pluggyTransactionId&&!t.supersededByPluggyTransactionId&&t.type==='investment'&&t.date===row.date&&Math.abs(t.amount-amount)<.01)?.id:manualMatch?.id;
   const suggestedPortfolioEventId=investment?events.find(e=>e.kind==='aporte'&&!e.pluggyTransactionId&&e.date===row.date&&Math.abs(e.amount-amount)<.01)?.id:undefined;
   if(finance.transactions.length>=20000)throw new Error('O limite de lançamentos foi atingido. Exporte e arquive dados antigos antes de sincronizar.');
   const installmentParts=card&&transactionType==='card_purchase'&&row.installmentNumber&&row.totalInstallments?installmentSchedule({date:row.date,amount,installments:Number(row.totalInstallments),closeDay:card.closeDay,dueDay:card.dueDay}):undefined;const installment=installmentParts?.find(p=>p.installment===Number(row.installmentNumber));
   finance.transactions.push({id:crypto.randomUUID(),type:transactionType,accountId:card?.accountId||account.id,cardId:card?.id||undefined,amount:installment?installment.amount:amount,date:row.date,description:row.description||'Movimentação importada',category:category||'Outros',userCategoryRuleId:activeRule?activeRule.id:undefined,pluggyTransactionId:row.id,pluggyCategory:row.category||null,bankInvestment:investment||undefined,needsReview:!category||possibleTransfer||possibleDuplicate||investment||transactionType==='card_purchase',possibleTransfer,possibleDuplicate:possibleDuplicate||undefined,matchingManualTransactionId,suggestedPortfolioEventId,providerType:row.type||null,installmentNumber:row.installmentNumber||undefined,totalInstallments:row.totalInstallments||undefined,installments:installment?Number(row.totalInstallments):undefined,closeDay:installment?card.closeDay:undefined,dueDay:installment?card.dueDay:undefined,invoiceMonth:installment?.invoiceMonth,dueDate:installment?.dueDate});
   known.add(row.id);imported.push(row.id);
  }
  if(!card&&Number.isFinite(source.balance)){
   markScheduleCandidates(finance);
   account.openingBalance=0;
   account.openingDate=(source.transactions||[]).map(t=>t.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=historyStart).sort()[0]||historyStart;
   const movements=accountBalances({...finance,transactions:finance.transactions.filter(t=>t.pluggyTransactionId||t.reconciled||t.supersededByPluggyTransactionId||t.scheduleId)},today())[account.id]||0;
   account.openingBalance=Math.round((source.balance-movements)*100)/100;
  }
 }
 // Keep provider bills as reference data; future due dates must not become posted transactions.
 finance.pluggy.cardLinks=finance.pluggy.cardLinks||{};
 for(const remote of payload.cards||[]){const link=finance.pluggy.cardLinks[remote.id];if(!link)continue;const card=finance.cards.find(c=>c.id===link.cardId);if(card){card.pluggyAccountId=remote.id;card.needsMapping=false;}}
 for(const remote of payload.investments||[]){const link=finance.pluggy.positionLinks?.[remote.id];if(!link)continue;const assetId=link.assetId;if(!state.assets.some(a=>a.id===assetId)||!Number.isFinite(remote.balance)||!remote.date||remote.date<state.startDate||remote.date>today())continue;const manual=[...events].reverse().find(e=>e.assetId===assetId&&e.kind==='saldo'&&!e.pluggyInvestmentId);if(manual&&manual.date>remote.date&&manual.amount!==remote.balance){const id=`position:${remote.id}:${remote.date}`;finance.pluggy.review=(finance.pluggy.review||[]).filter(r=>r.id!==id).concat({id,type:'position_conflict',providerId:remote.id,assetId,remoteBalance:remote.balance,remoteDate:remote.date,manualDate:manual.date,needsReview:true});continue;}if(!events.some(e=>e.pluggyInvestmentId===remote.id&&e.date===remote.date))events.push({id:crypto.randomUUID(),date:remote.date.slice(0,10),kind:'saldo',assetId,amount:remote.balance,note:`Saldo Meu Pluggy · ${remote.name}`.slice(0,200),createdAt:payload.updatedAt,pluggyInvestmentId:remote.id});}
 markScheduleCandidates(finance);
 return {finance,events,imported:imported.length,skippedAccounts:skipped,updatedAt:payload.updatedAt};
}

export function previewRule(state,contains,category){
 const needle=String(contains||'').trim().toLocaleLowerCase('pt-BR');
 if(needle.length<2||needle.length>80)throw new Error('Informe ao menos 2 caracteres para a regra.');
 return (state.finance?.transactions||[]).filter(t=>!t.categoryManuallySet&&String(t.description||'').toLocaleLowerCase('pt-BR').includes(needle)).map(t=>({id:t.id,date:t.date,description:t.description,previous:t.category||'Outros',next:category}));
}

export function applyRule(state,rule,transactionIds){
 const next=structuredClone(state),finance=next.finance,rules=finance.pluggy?.rules||[],ids=new Set(transactionIds);
 if(!finance.pluggy)finance.pluggy={};
 finance.pluggy.rules=[...rules.filter(r=>r.id!==rule.id),{...rule}];
 for(const t of finance.transactions)if(ids.has(t.id)&&!t.categoryManuallySet){t.category=rule.category;t.userCategoryRuleId=rule.id;if(!t.possibleDuplicate&&!t.bankInvestment&&!t.possibleTransfer)t.needsReview=false;}
 return next;
}

export function recategorizeTransactions(state,{onlyOthers=false}={}){
 const next=structuredClone(state),finance=next.finance;
 if(!finance?.transactions?.length)return {state:next,updatedCount:0,byCategory:{}};
 let updatedCount=0;
 const byCategory={};
 for(const tx of finance.transactions){
  if(tx.categoryManuallySet||!['expense','card_purchase','income'].includes(tx.type))continue;
  if(onlyOthers&&tx.category&&tx.category!=='Outros')continue;
  const row={description:tx.description,category:tx.pluggyCategory||'',type:tx.type==='income'?'CREDIT':'DEBIT',amount:tx.type==='income'?tx.amount:-tx.amount};
  const activeRule=matchingRule(finance,row);
  const historyCat=learnedCategory(finance,row);
  const {category:autoCategory}=classifyPluggyRow(row);
  const resolved=activeRule?.category||historyCat||(autoCategory&&autoCategory!=='Outros'?autoCategory:null);
  if(resolved&&resolved!==tx.category){
   tx.category=resolved;
   if(activeRule)tx.userCategoryRuleId=activeRule.id;
   if(tx.needsReview&&!tx.possibleDuplicate&&!tx.possibleTransfer&&!tx.bankInvestment&&tx.type!=='card_purchase')tx.needsReview=false;
   updatedCount++;
   byCategory[resolved]=(byCategory[resolved]||0)+1;
  }
 }
 return {state:next,updatedCount,byCategory};
}

export function suggestCategoryRules(finance){
 if(!finance?.transactions?.length)return [];
 const existingRules=new Set((finance.pluggy?.rules||[]).map(r=>String(r.contains||'').toLocaleLowerCase('pt-BR').trim()));
 const groups=new Map();
 for(const tx of finance.transactions){
  if(!['expense','card_purchase','income'].includes(tx.type))continue;
  const norm=normalizeMerchant(tx.description);
  if(!norm||norm.length<3)continue;
  const token=norm.split(' ').filter(w=>w.length>=3)[0]||norm.slice(0,18);
  if(!token||token.length<3||existingRules.has(token))continue;
  const entry=groups.get(token)||{keyword:token.toUpperCase(),sample:tx.description,count:0,total:0,categories:{},unclassifiedCount:0};
  entry.count++;
  entry.total+=tx.amount||0;
  const cat=tx.category||'Outros';
  entry.categories[cat]=(entry.categories[cat]||0)+1;
  if(cat==='Outros'||tx.needsReview)entry.unclassifiedCount++;
  groups.set(token,entry);
 }
 return [...groups.values()]
  .filter(g=>g.count>=2||g.unclassifiedCount>=1)
  .map(g=>{
   const bestManual=Object.entries(g.categories).filter(([c])=>c!=='Outros').sort((a,b)=>b[1]-a[1])[0]?.[0];
   const inferred=bestManual||categoryFor(g.sample)||'Outros';
   return {...g,suggestedCategory:inferred};
  })
  .sort((a,b)=>b.unclassifiedCount-a.unclassifiedCount||b.count-a.count||b.total-a.total)
  .slice(0,8);
}
