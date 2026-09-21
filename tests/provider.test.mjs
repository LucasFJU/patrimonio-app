import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMarket} from '../lib/market-provider.mjs';
import {UNIVERSE} from '../lib/ranking.mjs';
test('limite da fonte encerra consultas pendentes e retorna exclusões, sem inventar notas',async()=>{let calls=0;const r=await fetchMarket({companies:UNIVERSE,fetcher:async()=>{calls++;return new Response('{}',{status:429});}});assert.ok(calls<=3);assert.equal(r.picks.length,0);assert.equal(r.excluded.length,15);assert.match(r.excluded[0].reason,/429|limite/);});
test('fonte incompatível resulta em exclusão transparente',async()=>{const r=await fetchMarket({companies:UNIVERSE.slice(0,1),fetcher:async()=>new Response('{}')});assert.equal(r.coverage.eligible,0);assert.match(r.excluded[0].reason,/fonte indisponível/);});
