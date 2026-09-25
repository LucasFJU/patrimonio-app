import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateState} from '../lib/portfolio.mjs';
import {investmentPositions,allocationByInstitution} from '../lib/investment-view.mjs';
import {financeReport,reportTransactions} from '../lib/reports.mjs';
import {DEFAULT_FINANCE} from '../lib/finance.mjs';

test('relatório soma aporte manual à carteira sem inventar saída de caixa',()=>{
 const finance=DEFAULT_FINANCE();finance.accounts=[{id:'bank',name:'Conta',type:'checking',openingDate:'2026-01-01',openingBalance:500}];finance.transactions=[{id:'income',type:'income',accountId:'bank',amount:500,date:'2026-09-01',description:'Salário',category:'Salário'}];const events=[{id:'outside',kind:'aporte',assetId:'fund',amount:150,date:'2026-09-05',note:'Aporte fora do app'}];
 const report=financeReport(finance,{period:'month',anchor:'2026-09',events});assert.equal(report.investments,150);assert.equal(report.cashInvestments,0);assert.equal(report.cashResult,500);assert.equal(report.rows[0].hasData,true);assert.equal(reportTransactions(finance,'2026-09',{kind:'investments',events})[0].portfolioOnly,true);
});

test('posição mostra a origem e a data do saldo sem confundir instituição com responsável',()=>{
 const state=initialState();state.startDate='2026-01-01';state.assets[0].institution='Santander';state.assets.push({id:'fund',name:'Tesouro Selic',category:'tesouro',reserve:true,initial:1000,institution:'Corretora'});
 state.events.push({id:'balance',assetId:'fund',kind:'saldo',amount:1100,date:'2026-08-31',pluggyInvestmentId:'remote',createdAt:'2026-09-01T10:00:00Z'});
 state.finance=DEFAULT_FINANCE();state.finance.pluggy={inventory:[{id:'remote',date:'2026-08-31'}],positionLinks:{remote:{assetId:'fund'}}};
 assert.equal(validateState(state),state);
 const positions=investmentPositions(state,'2026-09-01');
 assert.deepEqual(positions.find(p=>p.asset.id==='fund'),{asset:state.assets[2],value:1100,institution:'Corretora',balanceDate:'2026-08-31',source:'Meu Pluggy',linked:true,remoteDate:'2026-08-31'});
 assert.equal(allocationByInstitution(positions).find(row=>row.institution==='Santander').value,5700);
 assert.throws(()=>validateState({...state,assets:state.assets.map(a=>a.id==='fund'?{...a,institution:'x'.repeat(81)}:a)}),/posição inválidos/i);
});

test('relatório separa competência de caixa, evita duplicar fatura e permite abrir os registros',()=>{
 const finance=DEFAULT_FINANCE();finance.accounts=[{id:'bank',name:'Conta',type:'checking',openingDate:'2026-01-01',openingBalance:1000}];finance.cards=[{id:'card',name:'Visa',accountId:'bank',closeDay:10,dueDay:20}];
 finance.transactions=[
  {id:'income',type:'income',accountId:'bank',amount:500,date:'2026-01-03',description:'Salário',category:'Salário'},
  {id:'purchase',type:'card_purchase',cardId:'card',amount:200,date:'2026-01-05',description:'Mercado',category:'Alimentação',installments:1,closeDay:10,dueDay:20,invoiceMonth:'2026-01'},
  {id:'direct',type:'expense',accountId:'bank',amount:50,date:'2026-01-06',description:'Uber',category:'Transporte'},
  {id:'pending',type:'expense',accountId:'bank',amount:80,date:'2026-01-07',description:'Revisar',needsReview:true},
  {id:'payment',type:'card_payment',accountId:'bank',cardId:'card',amount:200,date:'2026-02-20',description:'Fatura',invoiceMonth:'2026-01'}
 ];
 const jan=financeReport(finance,{period:'month',anchor:'2026-01'});
 assert.equal(jan.accrualExpenses,250);assert.equal(jan.cashExpenses,50);assert.equal(jan.pending,1);
 assert.deepEqual(reportTransactions(finance,'2026-01',{view:'accrual',kind:'expenses',category:'Alimentação'}).map(t=>t.id),['purchase']);
 assert.equal(reportTransactions(finance,'2026-01',{view:'cash',kind:'expenses'}).some(t=>t.id==='purchase'),false);
 const feb=financeReport(finance,{period:'month',anchor:'2026-02'});
 assert.equal(feb.accrualExpenses,0);assert.equal(feb.cashExpenses,200);
 assert.deepEqual(reportTransactions(finance,'2026-02',{view:'cash',kind:'expenses'}).map(t=>t.id),['payment']);
 const annual=financeReport(finance,{period:'year',anchor:'2026-01'});
 assert.equal(annual.accrualExpenses,250);assert.equal(annual.cashExpenses,250);
 assert.equal(annual.rows.find(row=>row.month==='2026-03').income,0);
});

test('relatório não cria histórico para meses anteriores à primeira conta',()=>{
 const finance=DEFAULT_FINANCE();finance.accounts=[{id:'bank',name:'Conta',type:'checking',openingDate:'2026-08-01',openingBalance:0}];
 const report=financeReport(finance,{period:'year',anchor:'2026-01'});
 assert.equal(report.rows.find(row=>row.month==='2026-01').hasData,false);
 assert.equal(report.rows.find(row=>row.month==='2026-08').hasData,true);
});
