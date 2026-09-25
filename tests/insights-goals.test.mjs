import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,dateISO,validateState} from '../lib/portfolio.mjs';
import {DEFAULT_FINANCE} from '../lib/finance.mjs';
import {confirmedFinanceInsights} from '../lib/insights.mjs';

const currentMonth=dateISO().slice(0,7),previousMonth=(()=>{const d=new Date(`${currentMonth}-15T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)})();
function tx(id,type,month,amount,extra={}){return {id,type,amount,date:`${month}-01`,description:id,accountId:'account',...extra}}

test('backups sem metas adicionais continuam válidos e metas bem formadas são opcionais',()=>{
 const state=initialState();assert.equal(validateState(state),state);state.settings.goals=[{id:'travel',name:'Viagem',targetAmount:12000,currentAmount:3000,targetDate:''}];assert.equal(validateState(state),state);
 for(const goals of [[{id:'x',name:'A',targetAmount:1,currentAmount:0},{id:'x',name:'B',targetAmount:1,currentAmount:0}],[{id:'x',name:'',targetAmount:1,currentAmount:0}],Array.from({length:21},(_,i)=>({id:String(i),name:'Meta',targetAmount:1,currentAmount:0}))]){const invalid=structuredClone(state);invalid.settings.goals=goals;assert.throws(()=>validateState(invalid));}
});

test('alertas respeitam os orçamentos e ignoram lançamentos pendentes ou excluídos',()=>{
 const finance=DEFAULT_FINANCE();finance.budgets[currentMonth]={Moradia:1000};finance.transactions=[tx('confirmed','expense',currentMonth,850,{category:'Moradia'}),tx('pending','expense',currentMonth,1000,{category:'Moradia',needsReview:true}),tx('excluded','expense',currentMonth,1000,{category:'Moradia',excludedFromBalances:true})];
 const alerts=confirmedFinanceInsights(finance);assert.equal(alerts.length,1);assert.equal(alerts[0].id,'budget:Moradia');assert.equal(alerts[0].spent,850);assert.equal(alerts[0].percent,85);
});

test('comparação mensal exige aumento mínimo, dados confirmados e mesmo dia de competência',()=>{
 const finance=DEFAULT_FINANCE();finance.transactions=[tx('old','expense',previousMonth,500,{category:'Moradia'}),tx('new','expense',currentMonth,650,{category:'Moradia'}),tx('pending','expense',currentMonth,5000,{category:'Moradia',needsReview:true})];
 assert.ok(confirmedFinanceInsights(finance).some(x=>x.id==='spending-change'));
 finance.transactions[1].amount=580;assert.ok(!confirmedFinanceInsights(finance).some(x=>x.id==='spending-change'));
 finance.transactions=finance.transactions.filter(t=>t.date.startsWith(currentMonth));assert.ok(!confirmedFinanceInsights(finance).some(x=>x.id==='spending-change'));
});
