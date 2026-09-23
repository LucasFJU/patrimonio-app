import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMarket} from '../lib/market-provider.mjs';
import {UNIVERSE} from '../lib/ranking.mjs';
test('limite da BolsAI interrompe as consultas pendentes com mensagem clara',async()=>{let calls=0;await assert.rejects(fetchMarket({token:'fake-key',companies:UNIVERSE,fetcher:async()=>{calls++;return new Response('{}',{status:429});}}),/cota diária da BolsAI/);assert.ok(calls<=3);});
test('resposta sem indicadores não inventa dados nem candidatas',async()=>{const r=await fetchMarket({token:'fake-key',companies:UNIVERSE.slice(0,1),fetcher:async()=>new Response('{}')});assert.equal(r.coverage.eligible,0);assert.equal(r.picks.length,0);assert.match(r.excluded[0].reason,/Cotação ausente/);});
