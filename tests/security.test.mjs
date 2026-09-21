import test from 'node:test';
import assert from 'node:assert/strict';
import {validCron,requireUser} from '../lib/market-server.mjs';
import {GET} from '../app/api/cron/route.js';
test('cron não configurado ou sem segredo correto recusa acesso',async()=>{delete process.env.CRON_SECRET;assert.equal(validCron(new Request('http://localhost')),false);assert.equal((await GET(new Request('http://localhost'))).status,401);process.env.CRON_SECRET='x'.repeat(32);assert.equal(validCron(new Request('http://localhost',{headers:{authorization:'Bearer bad'}})),false);assert.equal(validCron(new Request('http://localhost',{headers:{authorization:'Bearer '+'x'.repeat(32)}})),true);delete process.env.CRON_SECRET;});
test('atualização manual exige sessão válida e respeita proprietário',async()=>{const db={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})}};await assert.rejects(()=>requireUser(new Request('http://localhost'),db),{status:401});process.env.OWNER_USER_ID='user-b';await assert.rejects(()=>requireUser(new Request('http://localhost',{headers:{authorization:'Bearer sample'}}),db),{status:403});delete process.env.OWNER_USER_ID;});
