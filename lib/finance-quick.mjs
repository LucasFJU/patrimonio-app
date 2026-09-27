import {DEFAULT_FINANCE,installmentSchedule,invoiceSummaries,validateFinance} from './finance.mjs';
import {createSchedule,financeToday} from './schedules.mjs';

export function quickAddTransaction(state,draft,today=financeToday()){
 const next=structuredClone(state),finance=next.finance||DEFAULT_FINANCE();next.finance=finance;
 const amount=Number(draft.amount),description=String(draft.description||'').trim(),date=draft.date||today;
 if(!['income','expense','card_purchase'].includes(draft.type))throw new Error('Use o cadastro completo para escolher a origem do aporte.');
 if(!description||description.length>160||!Number.isFinite(amount)||amount<=0||amount>1e12||Math.abs(amount*100-Math.round(amount*100))>.001)throw new Error('Informe uma descrição e um valor válido com até dois centavos.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Informe uma data válida.');
 const account=finance.accounts.find(a=>a.id===draft.accountId),category=String(draft.category||'Outros');
 if(draft.type!=='card_purchase'&&(!account||date<account.openingDate))throw new Error('Selecione uma conta e uma data a partir do seu saldo inicial.');
 if(date>today){
  if(draft.type==='card_purchase')throw new Error('Registre compras no cartão depois que forem realizadas.');
  next.finance=createSchedule(finance,{id:crypto.randomUUID(),type:draft.type,description,amount,category,accountId:account.id,firstDate:date,competenceMonth:date.slice(0,7),mode:'once',count:1},today);
 }else{
  const transaction={id:crypto.randomUUID(),type:draft.type,description,amount,category,date,competenceMonth:date.slice(0,7),accountId:draft.accountId};
  if(draft.type==='card_purchase'){
   const card=finance.cards.find(c=>c.id===draft.cardId);if(!card)throw new Error('Selecione um cartão cadastrado.');
   Object.assign(transaction,{cardId:card.id,accountId:card.accountId,installments:1,closeDay:card.closeDay,dueDay:card.dueDay});
   transaction.installmentParts=installmentSchedule(transaction);transaction.invoiceMonth=transaction.installmentParts[0].invoiceMonth;transaction.dueDate=transaction.installmentParts[0].dueDate;
  }
  finance.transactions.push(transaction);
 }
 validateFinance(next.finance,next.assets,next.events,next.settings?.startDate);return next;
}

// This records a payment in the app. It never calls a bank or payment API.
export function payFinanceInvoice(state,cardId,invoiceMonth,date=financeToday()){
 const next=structuredClone(state),finance=next.finance,card=finance.cards.find(c=>c.id===cardId);
 const invoice=invoiceSummaries(finance,date).find(i=>i.cardId===cardId&&i.invoiceMonth===invoiceMonth);
 if(!card||!invoice||invoice.open<.005)throw new Error('Esta fatura já está paga ou não tem saldo em aberto.');
 const localTotal=invoice.purchases.reduce((sum,p)=>sum+p.amount,0);
 if(invoice.externalBillId&&Math.abs(localTotal-invoice.total)>.02)throw new Error('Importe e revise as compras desta fatura antes de registrar o pagamento.');
 finance.transactions.push({id:crypto.randomUUID(),type:'card_payment',cardId,accountId:card.accountId,invoiceMonth,date,amount:Math.round(invoice.open*100)/100,description:`Pagamento da fatura ${card.name} · ${invoiceMonth}`});
 validateFinance(finance,next.assets,next.events,next.settings?.startDate);return next;
}
