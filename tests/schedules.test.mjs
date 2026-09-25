import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateState,calculate,dateISO} from '../lib/portfolio.mjs';
import {DEFAULT_FINANCE,summarizeFinance,accountBalances,financeForecast,reconcileFinanceDuplicate,filterFinanceTransactions} from '../lib/finance.mjs';
import {createSchedule,materializeSchedules,changeOccurrence,scheduleOccurrences,occurrenceAt,scheduleDate,validateSchedules} from '../lib/schedules.mjs';
import {mergePluggyData} from '../lib/pluggy-sync.mjs';
import {financeReportMonth} from '../lib/reports.mjs';
import {processScheduledPortfolio} from '../lib/schedules-server.mjs';

const base=()=>({...DEFAULT_FINANCE(),accounts:[{id:'bank',name:'Conta',type:'checking',openingBalance:1000,openingDate:'2024-01-01',pluggyAccountId:'remote'}]});
const draft=(changes={})=>({id:'series',type:'expense',accountId:'bank',description:'Curso',category:'Educação',mode:'monthly',amount:300,firstDate:'2026-01-31',competenceMonth:'2026-01',count:6,...changes});
const rows=f=>scheduleOccurrences(f,'2026-01-01','2026-12-31',{includeCancelled:true});

test('seis mensalidades aparecem e terminam sem alterar saldo futuro',()=>{
 const f=createSchedule(base(),draft(),'2026-01-01');assert.equal(f.transactions.length,0);assert.equal(accountBalances(f)['bank'],1000);
 assert.deepEqual(rows(f).map(r=>r.dueDate),['2026-01-31','2026-02-28','2026-03-31','2026-04-30','2026-05-31','2026-06-30']);
 assert.equal(rows(f).reduce((n,r)=>n+r.amount,0),1800);assert.equal(rows(f).length,6);
 assert.equal(summarizeFinance(f,'2026-02').payable,300);
});
test('parcelamento divide centavos sem alterar o total e aceita parcela única',()=>{
 const f=createSchedule(base(),draft({mode:'installments',amount:100,count:3}),'2026-01-01');assert.deepEqual(rows(f).map(r=>r.amount),[33.34,33.33,33.33]);assert.equal(rows(f).reduce((n,r)=>n+Math.round(r.amount*100),0),10000);
 assert.equal(occurrenceAt(draft({mode:'installments',count:1,amount:15.01}),1).amount,15.01);
});
test('fim do mês, ano bissexto, virada do ano e repetição aberta mantêm dia original',()=>{
 assert.equal(scheduleDate('2024-01-31',1),'2024-02-29');assert.equal(scheduleDate('2026-12-31',2),'2027-02-28');assert.equal(scheduleDate('2026-12-31',3),'2027-03-31');
 const f=createSchedule(base(),draft({count:null}),'2026-01-01');assert.equal(scheduleOccurrences(f,'2030-01-01','2030-12-31').length,12);
});
test('catch-up e execução repetida geram cada vencimento uma única vez',()=>{
 let f=createSchedule(base(),draft(),'2026-01-01');const result=materializeSchedules(f,'2026-04-30');assert.equal(result.added,4);f=result.finance;assert.equal(materializeSchedules(f,'2026-04-30').added,0);assert.equal(materializeSchedules(f,'2026-04-30').changed,false);assert.equal(f.transactions.length,4);
});
test('receita registrada automaticamente altera caixa e não patrimônio',()=>{
 const state=initialState(),before=calculate(state).total;state.finance=createSchedule(base(),draft({type:'income',firstDate:'2026-01-01'}),'2026-01-01');assert.equal(accountBalances(state.finance,'2026-01-01').bank,1300);assert.equal(calculate(state).total,before);assert.equal(state.finance.transactions[0].automatic,true);
});
test('cancelamento pontual e futuro não reaparecem no processamento diário',()=>{
 let f=createSchedule(base(),draft(),'2026-01-01');f=changeOccurrence(f,'series',2,'cancel',{},'one','2026-01-01');f=changeOccurrence(f,'series',4,'cancel',{},'future','2026-01-01');f=materializeSchedules(f,'2026-12-31').finance;assert.deepEqual(f.transactions.map(t=>t.sequence),[1,3]);assert.equal(materializeSchedules(f,'2026-12-31').added,0);
});
test('edição futura preserva realizados e exceção pontual não altera demais',()=>{
 let f=createSchedule(base(),draft(),'2026-02-28');const original=JSON.stringify(f.transactions);f=changeOccurrence(f,'series',1,'edit',{amount:350},'future','2026-02-28');assert.equal(JSON.stringify(f.transactions),original);assert.equal(rows(f).find(r=>r.sequence===3).amount,350);
 f=changeOccurrence(f,'series',4,'edit',{amount:125,dueDate:'2026-05-02'},'one','2026-02-28');assert.equal(rows(f).find(r=>r.sequence===4).amount,125);assert.equal(rows(f).find(r=>r.sequence===5).amount,350);
});
test('não realizado reverte efeito e exige reagendamento antes de nova realização',()=>{
 let f=createSchedule(base(),draft(),'2026-01-31');f=changeOccurrence(f,'series',1,'undo',{},'one','2026-01-31');assert.equal(accountBalances(f,'2026-01-31').bank,1000);assert.equal(materializeSchedules(f,'2026-02-01').added,0);assert.equal(rows(f)[0].status,'held');
 f=changeOccurrence(f,'series',1,'edit',{dueDate:'2026-02-05'},'one','2026-02-01');assert.equal(f.transactions.length,0);assert.equal(materializeSchedules(f,'2026-02-05').added,1);
});
test('antecipação e reagendamento são visíveis no mês de destino',()=>{
 let f=createSchedule(base(),draft(),'2026-01-01');f=changeOccurrence(f,'series',1,'realize',{dueDate:'2026-01-10'},'one','2026-01-10');assert.equal(f.transactions[0].date,'2026-01-10');assert.equal(f.transactions[0].automatic,true);
 assert.throws(()=>changeOccurrence(f,'series',2,'realize',{dueDate:'2026-03-01'},'one','2026-02-01'));
});
test('backups preservam programações, exceções e rejeitam metadados adulterados',()=>{
 const state=initialState();state.finance=createSchedule(base(),draft(),'2026-01-01');state.finance=changeOccurrence(state.finance,'series',2,'cancel',{},'one','2026-01-01');const copy=JSON.parse(JSON.stringify(state));assert.doesNotThrow(()=>validateState(copy));assert.deepEqual(rows(copy.finance),rows(state.finance));
 copy.finance.schedules[0].exceptions['2'].id='hostile';assert.throws(()=>validateState(copy));assert.doesNotThrow(()=>validateSchedules(base()));
});
test('recorrências antigas não são materializadas retroativamente',()=>{
 const f=base();f.recurring=[{id:'legacy',type:'expense',accountId:'bank',amount:10,day:5,description:'Antiga',category:'Outros'}];assert.equal(materializeSchedules(f,'2026-09-25').added,0);
});
test('competência difere de caixa mesmo após realização em mês posterior',()=>{
 const f=createSchedule(base(),draft({firstDate:'2026-02-05',competenceMonth:'2026-01',mode:'once',count:1}),'2026-02-05');
 const jan=financeReportMonth(f,'2026-01'),feb=financeReportMonth(f,'2026-02');assert.equal(feb.cashExpenses,300);assert.equal(feb.accrualExpenses,0);
 assert.equal(jan.cashExpenses,0);assert.equal(jan.accrualExpenses,300);assert.equal(summarizeFinance(f,'2026-01').expenses,300);
});
test('saldo projetado acumula vencimentos dos meses até a competência selecionada',()=>{
 const today=dateISO(),firstMonth=today.slice(0,7),nextMonth=scheduleDate(`${firstMonth}-01`,1).slice(0,7);
 const firstDate=scheduleDate(`${firstMonth}-01`,1),f=createSchedule(base(),draft({firstDate,competenceMonth:nextMonth,count:2}),today);
 assert.equal(summarizeFinance(f,nextMonth).projectedCash,700);
 const following=scheduleDate(`${firstMonth}-01`,2).slice(0,7);
 assert.equal(summarizeFinance(f,following).projectedCash,400);
 assert.equal(accountBalances(f,`${following}-28`).bank,1000);
});
test('filtro separa projeções financeiras da revisão de lançamentos realizados',()=>{
 const f=createSchedule(base(),draft({firstDate:'2026-10-10',competenceMonth:'2026-10',count:2}),'2026-09-25');
 assert.equal(filterFinanceTransactions(f,'2026-10',{financial:'scheduled'}).length,1);
 assert.equal(filterFinanceTransactions(f,'2026-10',{financial:'realized'}).length,0);
 assert.equal(filterFinanceTransactions(f,'2026-10',{status:'confirmed'}).length,0);
 assert.equal(filterFinanceTransactions(f,'2026-10',{financial:'scheduled',type:'income'}).length,0);
});
test('importação antes ou depois do automático produz candidato e concilia só uma vez',()=>{
 const today=dateISO(),state=initialState();state.finance=createSchedule(base(),draft({firstDate:today,competenceMonth:today.slice(0,7),mode:'once',count:1}),'2026-01-01');
 const payload={itemId:'item',updatedAt:new Date().toISOString(),accounts:[{id:'remote',type:'CHECKING_ACCOUNT',balance:700,transactions:[{id:'bank-tx',date:today,amount:-300,type:'DEBIT',description:'Curso diferente',category:'Education',status:'POSTED'}]}]};
 const merged=mergePluggyData(state,payload),remote=merged.finance.transactions.find(t=>t.pluggyTransactionId);assert.equal(remote.scheduleCandidate,true);assert.equal(remote.needsReview,true);assert.equal(accountBalances(merged.finance).bank,700);assert.equal(summarizeFinance(merged.finance).expenses,300);
 const linked=reconcileFinanceDuplicate(merged.finance,remote.id);assert.equal(summarizeFinance(linked).expenses,300);assert.equal(accountBalances(linked).bank,700);assert.equal(materializeSchedules(linked).added,0);assert.throws(()=>changeOccurrence(linked,'series',1,'undo'));
 const again=mergePluggyData({...state,finance:linked},payload);assert.equal(again.finance.transactions.find(t=>t.pluggyTransactionId).needsReview,false);assert.equal(accountBalances(again.finance).bank,700);
});
test('previsão remove valores já realizados e respeita término',()=>{
 const today=dateISO(),month=today.slice(0,7);const f=createSchedule(base(),draft({firstDate:today,competenceMonth:month,count:1}),today);assert.equal(financeForecast(f,month,6).months.every(r=>r.recurringExpenses===0),true);
});
test('gravação concorrente refaz cálculo sobre a versão atual em vez de sobrescrever',async()=>{
 const state=initialState();state.finance=createSchedule(base(),draft({firstDate:dateISO(),competenceMonth:dateISO().slice(0,7),count:1}),'2026-01-01');let reads=0,writes=0;
 const db={from(){let next=null;return {select(){return this;},eq(){return this;},update(value){next=value;return this;},async maybeSingle(){
  if(!next){reads++;return {data:{data:state,version:reads}};}
  writes++;
  if(writes===1){state.finance.transactions.push({id:'other-device',type:'income',date:dateISO(),accountId:'bank',amount:20,description:'Outro dispositivo',category:'Salário'});return {data:null};}
  assert.ok(next.data.finance.transactions.some(t=>t.id==='other-device'));return {data:{version:3}};
 }}}};
 assert.equal((await processScheduledPortfolio(db,'user')).added,1);assert.equal(reads,2);assert.equal(writes,2);
});
