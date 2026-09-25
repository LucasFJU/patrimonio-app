import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/portfolio.mjs';
import {mergePluggyData} from '../lib/pluggy-sync.mjs';

test('sincronização registra produtos, recursos e início de cobertura por Item e preserva a última cobertura conhecida',()=>{
 const state=initialState(),first=mergePluggyData(state,{itemId:'item',updatedAt:'2026-09-25T12:00:00.000Z',coverageStart:'2026-08-01',products:{accounts:true,transactions:true,creditCards:false,bills:false,investments:false},resources:[{type:'TRANSACTION',status:'UPDATED',updatedAt:'2026-09-25T11:00:00.000Z'}],accounts:[],cards:[],bills:[],investments:[]});
 assert.equal(first.finance.pluggy.coverageStart,'2026-08-01');assert.equal(first.finance.pluggy.products.transactions,true);assert.equal(first.finance.pluggy.products.creditCards,false);assert.equal(first.finance.pluggy.resources[0].status,'UPDATED');
 const second=mergePluggyData({...state,finance:first.finance},{itemId:'item',updatedAt:'2026-09-26T12:00:00.000Z',accounts:[],cards:[],bills:[],investments:[]});
 assert.equal(second.finance.pluggy.lastSyncAt,'2026-09-26T12:00:00.000Z');assert.deepEqual(second.finance.pluggy.products,first.finance.pluggy.products);assert.deepEqual(second.finance.pluggy.resources,first.finance.pluggy.resources);
});
