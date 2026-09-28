import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateState} from '../lib/portfolio.mjs';
import {investmentPositions,allocationByInstitution} from '../lib/investment-view.mjs';
import {financeReport,reportTransactions} from '../lib/reports.mjs';
import {DEFAULT_FINANCE} from '../lib/finance.mjs';
import {buildMonthlySummaryData,generateSummaryPdf} from '../lib/pdf-summary.mjs';

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

test('exportação de resumo em PDF consolida patrimônio total e despesas do mês atual',()=>{
 const state=initialState();
 state.finance=DEFAULT_FINANCE();
 state.finance.accounts=[{id:'bank',name:'Conta Corrente',type:'checking',openingDate:'2026-09-01',openingBalance:2300}];
 state.finance.transactions=[
  {id:'inc1',type:'income',accountId:'bank',amount:8500,date:'2026-09-05',description:'Salário',category:'Salário'},
  {id:'exp1',type:'expense',accountId:'bank',amount:1250,date:'2026-09-10',description:'Supermercado',category:'Alimentação'},
  {id:'exp2',type:'expense',accountId:'bank',amount:450,date:'2026-09-12',description:'Combustível',category:'Transporte'}
 ];
 const summary=buildMonthlySummaryData(state,'2026-09-27');
 assert.equal(summary.investedTotal,5700);
 assert.equal(summary.cashAccountsTotal,9100);
 assert.equal(summary.netWorthTotal,14800);
 assert.equal(summary.monthExpenses,1700);
 assert.equal(summary.expenseTransactionsCount,2);
 assert.equal(summary.categoryRows[0].name,'Alimentação');
 assert.equal(summary.categoryRows[0].count,1);
 const pdf=generateSummaryPdf(state,{referenceDate:'2026-09-27'});
 assert.ok(pdf.startsWith('%PDF-1.4'));
 assert.ok(pdf.includes('Resumo Financeiro e Patrimonial'));
 assert.ok(pdf.includes('DATA DE REFERENCIA'));
 assert.ok(pdf.includes('27/09/2026'));
 assert.ok(pdf.includes('PATRIMONIO TOTAL CONSOLIDADO'));
 assert.ok(pdf.includes('Tabela de Despesas por Categoria'));
 assert.ok(pdf.includes('CATEGORIA DE DESPESA'));
 assert.ok(pdf.includes('TOTAL DE DESPESAS DO MES'));
 assert.ok(pdf.includes('14.800,00'));
 assert.ok(pdf.includes('1.700,00'));
 assert.ok(pdf.trimEnd().endsWith('%%EOF'));
});


