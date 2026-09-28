import {DEFAULT_FINANCE,FINANCE_TYPES,installmentSchedule,invoiceSummaries} from './finance.mjs';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export function editFinanceTransaction(state,transactionId,{date,amount,description,category,installments}={}){
 const next=structuredClone(state),finance=next.finance||DEFAULT_FINANCE(),transaction=finance.transactions.find(item=>item.id===transactionId);
 if(!transaction)throw new Error('Lançamento não encontrado.');
 if(!validDate(date)||date>today()||!Number.isFinite(amount)||amount<=0||amount>1e12||typeof description!=='string'||!description.trim()||description.length>160)throw new Error('Informe data, descrição e valor válidos.');
 const account=finance.accounts.find(item=>item.id===transaction.accountId);
 if(account&&date<account.openingDate)throw new Error('A data não pode ser anterior ao saldo inicial da conta.');
 transaction.date=date;transaction.amount=amount;transaction.description=description.trim();
 if(category!=null){if(typeof category!=='string'||category.length>60)throw new Error('Categoria inválida.');transaction.category=category;if(transaction.pluggyTransactionId)transaction.categoryManuallySet=true;delete transaction.userCategoryRuleId;}
 if(transaction.type==='card_purchase'){
  if(!Number.isInteger(installments)||installments<1||installments>48)throw new Error('Informe de 1 a 48 parcelas.');
  const card=finance.cards.find(item=>item.id===transaction.cardId);if(!card)throw new Error('O cartão vinculado não foi encontrado.');
  transaction.installments=installments;transaction.closeDay=card.closeDay;transaction.dueDay=card.dueDay;
  transaction.installmentParts=installmentSchedule({date,amount,installments,closeDay:card.closeDay,dueDay:card.dueDay});
  transaction.invoiceMonth=transaction.installmentParts[0].invoiceMonth;transaction.dueDate=transaction.installmentParts[0].dueDate;
 }
 if(transaction.type==='investment'&&!transaction.bankInvestment&&transaction.portfolioEventId){
  const event=next.events.find(item=>item.id===transaction.portfolioEventId);if(!event)throw new Error('O aporte vinculado não foi encontrado.');event.date=date;event.amount=amount;
 }
 return next;
}

export function editFinanceAccount(state,accountId,{name,type,openingBalance,openingDate}={}){
 const next=structuredClone(state),finance=next.finance||DEFAULT_FINANCE(),account=finance.accounts.find(item=>item.id===accountId);
 if(!account)throw new Error('Conta não encontrada.');
 const cleanName=typeof name==='string'?name.trim():'';
 const balance=Number(openingBalance);
 if(!cleanName||cleanName.length>80||!FINANCE_TYPES.includes(type)||!Number.isFinite(balance)||Math.abs(balance)>1e12||!validDate(openingDate)||openingDate<'2000-01-01'||openingDate>today())throw new Error('Informe nome, tipo, saldo e data inicial válidos.');
 const earliestTx=finance.transactions.filter(t=>t.accountId===accountId||t.toAccountId===accountId).map(t=>t.date).sort()[0];
 if(earliestTx&&openingDate>earliestTx)throw new Error('A data do saldo inicial não pode ser posterior a um lançamento já registrado nesta conta.');
 account.name=cleanName;account.type=type;account.openingBalance=balance;account.openingDate=openingDate;
 return next;
}

export function editFinanceCard(state,cardId,{name,accountId,closeDay,dueDay}={}){
 const next=structuredClone(state),finance=next.finance||DEFAULT_FINANCE(),card=finance.cards.find(item=>item.id===cardId);
 if(!card)throw new Error('Cartão não encontrado.');
 const cleanName=typeof name==='string'?name.trim():'';
 const close=Number(closeDay),due=Number(dueDay);
 const targetAccount=finance.accounts.find(item=>item.id===accountId);
 if(!cleanName||cleanName.length>80||!targetAccount||!Number.isInteger(close)||close<1||close>28||!Number.isInteger(due)||due<1||due>28)throw new Error('Informe nome, conta de pagamento e dias de fechamento e vencimento válidos (1 a 28).');
 const cardPayments=finance.transactions.filter(t=>t.type==='card_payment'&&t.cardId===cardId);
 if(cardPayments.some(t=>t.date<targetAccount.openingDate))throw new Error('A conta selecionada possui saldo inicial posterior a um pagamento de fatura deste cartão.');
 for(const payment of cardPayments)payment.accountId=accountId;
 const paidInvoices=new Set(cardPayments.map(t=>t.invoiceMonth));
 card.name=cleanName;card.accountId=accountId;card.closeDay=close;card.dueDay=due;
 for(const tx of finance.transactions.filter(t=>t.type==='card_purchase'&&t.cardId===cardId)){
  const currentMonths=Array.isArray(tx.installmentParts)?tx.installmentParts.map(p=>p.invoiceMonth):[tx.invoiceMonth];
  if(currentMonths.some(m=>paidInvoices.has(m)))continue;
  const parts=installmentSchedule({date:tx.date,amount:tx.amount,installments:tx.installments||1,closeDay:close,dueDay:due});
  tx.closeDay=close;tx.dueDay=due;tx.installmentParts=parts;tx.invoiceMonth=parts[0].invoiceMonth;tx.dueDate=parts[0].dueDate;
 }
 return next;
}

export function payFinanceInvoice(state,{cardId,invoiceMonth,amount,date=today(),description}={}){
 const next=structuredClone(state),finance=next.finance||DEFAULT_FINANCE(),card=finance.cards.find(item=>item.id===cardId);
 if(!card)throw new Error('Cartão não encontrado.');
 const account=finance.accounts.find(item=>item.id===card.accountId);
 if(!account)throw new Error('Conta vinculada ao cartão não encontrada.');
 const invoice=invoiceSummaries(finance,'2099-12-31').find(item=>item.cardId===cardId&&item.invoiceMonth===invoiceMonth);
 if(!invoice||invoice.open<=0)throw new Error('Esta fatura já está quitada ou não possui saldo em aberto.');
 const payAmount=amount!=null?Math.round(Number(amount)*100)/100:Math.round(invoice.open*100)/100;
 if(!Number.isFinite(payAmount)||payAmount<=0||payAmount>invoice.open+0.02)throw new Error('Valor de pagamento inválido para esta fatura.');
 const paymentDate=validDate(date)&&date<=today()?date:today();
 if(paymentDate<account.openingDate)throw new Error('A data do pagamento não pode ser anterior ao saldo inicial da conta vinculada.');
 finance.transactions.push({
  id:crypto.randomUUID(),
  type:'card_payment',
  cardId:card.id,
  accountId:card.accountId,
  invoiceMonth,
  amount:Math.min(payAmount,Math.round(invoice.open*100)/100),
  date:paymentDate,
  description:String(description||`Pagamento fatura ${card.name} (${invoiceMonth})`).trim().slice(0,160),
  category:'Contas'
 });
 return next;
}

