import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/portfolio.mjs';
import {mergePluggyData,inferTransactionCategory,recategorizeTransactions,suggestCategoryRules} from '../lib/pluggy-sync.mjs';

test('sincronização registra produtos, recursos e início de cobertura por Item e preserva a última cobertura conhecida',()=>{
 const state=initialState(),first=mergePluggyData(state,{itemId:'item',updatedAt:'2026-09-25T12:00:00.000Z',coverageStart:'2026-08-01',products:{accounts:true,transactions:true,creditCards:false,bills:false,investments:false},resources:[{type:'TRANSACTION',status:'UPDATED',updatedAt:'2026-09-25T11:00:00.000Z'}],accounts:[],cards:[],bills:[],investments:[]});
 assert.equal(first.finance.pluggy.coverageStart,'2026-08-01');assert.equal(first.finance.pluggy.products.transactions,true);assert.equal(first.finance.pluggy.products.creditCards,false);assert.equal(first.finance.pluggy.resources[0].status,'UPDATED');
 const second=mergePluggyData({...state,finance:first.finance},{itemId:'item',updatedAt:'2026-09-26T12:00:00.000Z',accounts:[],cards:[],bills:[],investments:[]});
 assert.equal(second.finance.pluggy.lastSyncAt,'2026-09-26T12:00:00.000Z');assert.deepEqual(second.finance.pluggy.products,first.finance.pluggy.products);assert.deepEqual(second.finance.pluggy.resources,first.finance.pluggy.resources);
});

test('categorização inteligente distribui despesas sincronizadas do Pluggy e aprende com histórico e regras',()=>{
 const state={...initialState(),finance:{accounts:[],cards:[],transactions:[],recurring:[],budgets:{},categories:[],pluggy:{rules:[{id:'r-custom',contains:'PADARIA ESTRELA',category:'Alimentação',active:true}]}}};
 const synced=mergePluggyData(state,{
  itemId:'item-cat',
  updatedAt:'2026-09-26T12:00:00.000Z',
  accounts:[{
   id:'acc-1',
   name:'Conta Corrente',
   type:'BANK',
   subtype:'CHECKING_ACCOUNT',
   balance:5000,
   transactions:[
    {id:'tx-1',description:'IFOOD *RESTAURANTE',amount:-84.90,date:'2026-09-10',type:'DEBIT'},
    {id:'tx-2',description:'UBER *TRIP HELP.UBER',amount:-32.50,date:'2026-09-11',type:'DEBIT'},
    {id:'tx-3',description:'DROGASIL 1042',amount:-119.00,date:'2026-09-12',type:'DEBIT'},
    {id:'tx-4',description:'PADARIA ESTRELA LTDA',amount:-28.00,date:'2026-09-13',type:'DEBIT'},
    {id:'tx-5',description:'ENEL DISTRIBUICAO SP',amount:-210.40,date:'2026-09-14',type:'DEBIT'},
    {id:'tx-6',description:'CONDOMINIO EDIFICIO SOLAR',amount:-950.00,date:'2026-09-15',type:'DEBIT'}
   ]
  }],
  cards:[],
  bills:[],
  investments:[]
 });
 const byDesc=Object.fromEntries(synced.finance.transactions.map(t=>[t.description,t.category]));
 assert.equal(byDesc['IFOOD *RESTAURANTE'],'Alimentação');
 assert.equal(byDesc['UBER *TRIP HELP.UBER'],'Transporte');
 assert.equal(byDesc['DROGASIL 1042'],'Saúde');
 assert.equal(byDesc['PADARIA ESTRELA LTDA'],'Alimentação');
 assert.equal(byDesc['ENEL DISTRIBUICAO SP'],'Energia');
 assert.equal(byDesc['CONDOMINIO EDIFICIO SOLAR'],'Moradia');
 assert.equal(synced.imported,6);
});

test('recategorizeTransactions reclassifica lançamentos em Outros e suggestCategoryRules sugere padrões',()=>{
 const state={...initialState(),finance:{accounts:[],cards:[],transactions:[
  {id:'1',type:'expense',description:'SPOTIFY BRASIL',category:'Outros',amount:34.90},
  {id:'2',type:'expense',description:'SUPERMERCADO ZONA SUL',category:'Outros',amount:420.00},
  {id:'3',type:'expense',description:'CLINICA VIDA',category:'Saúde',categoryManuallySet:true,amount:300.00}
 ],pluggy:{rules:[]}}};
 const res=recategorizeTransactions(state,{onlyOthers:true});
 assert.equal(res.updatedCount,2);
 assert.equal(res.state.finance.transactions.find(t=>t.id==='1').category,'Lazer');
 assert.equal(res.state.finance.transactions.find(t=>t.id==='2').category,'Alimentação');
 const suggestions=suggestCategoryRules(state.finance);
 assert.ok(suggestions.some(s=>s.suggestedCategory==='Lazer'||s.suggestedCategory==='Alimentação'));
 assert.equal(inferTransactionCategory('CLINICA VIDA','HEALTH','DEBIT',res.state.finance),'Saúde');
});

