import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,dateISO,validateState} from '../lib/portfolio.mjs';
import {DEFAULT_FINANCE,monthEnd} from '../lib/finance.mjs';
import {editFinanceTransaction} from '../lib/finance-edit.mjs';

const base=()=>{const state=initialState(),today=dateISO();state.finance=DEFAULT_FINANCE();state.finance.accounts=[{id:'bank',name:'Santander',type:'checking',openingBalance:1000,openingDate:today}];return state;};

test('edição de lançamento atualiza data, descrição, valor e categoria sem sobrescrever a prioridade manual',()=>{
 const state=base();state.finance.transactions=[{id:'expense',type:'expense',accountId:'bank',amount:50,date:dateISO(),description:'Compra',category:'Outros',pluggyTransactionId:'remote'}];
 const updated=editFinanceTransaction(state,'expense',{date:dateISO(),amount:75,description:'Compra revisada',category:'Transporte'});
 assert.equal(updated.finance.transactions[0].description,'Compra revisada');assert.equal(updated.finance.transactions[0].amount,75);assert.equal(updated.finance.transactions[0].categoryManuallySet,true);assert.equal(validateState(updated),updated);
});

test('edição de compra parcelada recalcula parcelas e competência da fatura',()=>{
 const state=base(),card={id:'visa',name:'Visa',accountId:'bank',closeDay:10,dueDay:20};state.finance.cards=[card];state.finance.transactions=[{id:'purchase',type:'card_purchase',cardId:'visa',amount:300,date:dateISO(),description:'Compra',category:'Compras',installments:3,closeDay:10,dueDay:20,invoiceMonth:dateISO().slice(0,7),installmentParts:[1,2,3].map(i=>({invoiceMonth:dateISO().slice(0,7),amount:100,dueDate:`${dateISO().slice(0,7)}-20`,installment:i}))}];
 const updated=editFinanceTransaction(state,'purchase',{date:dateISO(),amount:900,description:'Compra revisada',category:'Casa',installments:3}),purchase=updated.finance.transactions[0];
 assert.deepEqual(purchase.installmentParts.map(part=>part.amount),[300,300,300]);assert.equal(purchase.installmentParts.reduce((sum,part)=>sum+part.amount,0),900);assert.equal(purchase.invoiceMonth,purchase.installmentParts[0].invoiceMonth);assert.equal(validateState(updated),updated);assert.ok(monthEnd(purchase.invoiceMonth)>=purchase.date);
});

test('edição de aporte bancário manual também corrige o evento da carteira e rejeita inconsistências',()=>{
 const state=base(),event={id:'portfolio-event',date:dateISO(),kind:'aporte',assetId:'cdb-santander',amount:100};state.events.push(event);state.finance.transactions=[{id:'investment',type:'investment',accountId:'bank',assetId:'cdb-santander',portfolioEventId:event.id,amount:100,date:dateISO(),description:'Aporte',category:'Investimento'}];
 const updated=editFinanceTransaction(state,'investment',{date:dateISO(),amount:250,description:'Aporte atualizado',category:'Investimento'});assert.equal(updated.events[0].amount,250);assert.equal(updated.finance.transactions[0].amount,250);assert.equal(validateState(updated),updated);
 assert.throws(()=>editFinanceTransaction(state,'missing',{date:dateISO(),amount:1,description:'x'}),/não encontrado/i);
 assert.throws(()=>editFinanceTransaction(state,'investment',{date:'2099-01-01',amount:1,description:'x'}),/válidos/i);
});
