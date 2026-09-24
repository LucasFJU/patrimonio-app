import test from 'node:test';
import assert from 'node:assert/strict';
import {compoundDailyPercent,compoundMonthlyPercent,formatSgsDate,parseSgsDate,pointReturn,seriesReturn} from '../lib/benchmarks.mjs';

test('CDI e IPCA são compostos, não somados',()=>{const rows=[{valor:'1'},{valor:'2'}];assert.equal(compoundDailyPercent(rows),1.01*1.02-1);assert.equal(compoundMonthlyPercent(rows),1.01*1.02-1);});
test('a variação mensal mais recente continua disponível mesmo sem o mês seguinte publicado',()=>{assert.ok(Math.abs(seriesReturn([{valor:'0.45'}],'monthly')-.0045)<1e-12);});
test('Ibovespa é comparado por níveis de fechamento',()=>{assert.ok(Math.abs(pointReturn([{valor:'100'},{valor:'110'}])-.1)<1e-12);assert.ok(Math.abs(seriesReturn([{valor:'100'},{valor:'110'}],'index')-.1)<1e-12);assert.equal(pointReturn([{valor:'0'},{valor:'10'}]),null);});
test('datas SGS convertem para e a partir do formato brasileiro',()=>{assert.equal(parseSgsDate('05/09/2026'),'2026-09-05');assert.equal(formatSgsDate('2026-09-05'),'05/09/2026');});
