import {DEFAULT_FINANCE,installmentSchedule} from './finance.mjs';

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
