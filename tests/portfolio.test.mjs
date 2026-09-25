import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateState,calculate,dateISO,monthlyHistory,suggestedPlan,projection,ASSET_PRESETS,CATEGORIES} from '../lib/portfolio.mjs';
const state=()=>initialState();
function add(s,kind,amount,assetId='cdb-santander',more={}){s.events.push({id:String(s.events.length+1),date:dateISO(),createdAt:String(s.events.length).padStart(3,'0'),kind,amount,assetId,...more});return s;}
test('aporte não é lucro; provento e reinvestimento não duplicam capital',()=>{const s=state();add(s,'aporte',800);assert.equal(calculate(s).gain,0);add(s,'dividendo',100);assert.equal(calculate(s).gain,100);add(s,'reinvestimento',100);const c=calculate(validateState(s));assert.equal(c.total,6600);assert.equal(c.deposits,800);assert.equal(c.reinvested,100);assert.equal(c.values.cash,0);assert.equal(c.gain,100);});
test('retirada e transferência interna preservam resultado',()=>{const s=state();add(s,'transferencia',100,'cdb-santander',{toAssetId:'cash'});add(s,'resgate',100,'cash');const c=calculate(validateState(s));assert.equal(c.total,5600);assert.equal(c.gain,0);assert.equal(c.netInvested,5600);});
test('saldo total incorpora valorização descontando aporte',()=>{const s=state();add(s,'aporte',800);add(s,'saldo',6570);assert.equal(calculate(s).gain,70);assert.equal(monthlyHistory(s)[0].gain,70);assert.equal(monthlyHistory(s)[0].closed,true);});
test('sem lançamentos, apenas ponto inicial real',()=>{const h=monthlyHistory(state());assert.equal(h.length,1);assert.equal(h[0].gain,0);assert.equal(h[0].closed,false);});
test('histórico mensal otimizado preserva resultados e eventos até o fechamento',()=>{
 const s=state(),today=dateISO(),month=(offset)=>{const d=new Date(`${today.slice(0,7)}-15T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7)};
 const first=month(-2),second=month(-1);s.startDate=`${first}-01`;
 s.events=[
  {id:'a',date:`${first}-05`,kind:'aporte',assetId:'cdb-santander',amount:400},
  {id:'b',date:`${first}-10`,kind:'dividendo',assetId:'cdb-santander',amount:12},
  {id:'c',date:`${second}-03`,kind:'reinvestimento',assetId:'cdb-santander',amount:7},
  {id:'d',date:`${second}-11`,kind:'resgate',assetId:'cdb-santander',amount:50},
  {id:'e',date:`${today.slice(0,7)}-01`,kind:'transferencia',assetId:'cdb-santander',toAssetId:'cash',amount:20},
  {id:'f',date:today,kind:'saldo',assetId:'cdb-santander',amount:500}
 ];
 const expected=[];let d=new Date(s.startDate+'T12:00:00Z');d.setUTCDate(1);
 for(let i=0;i<600&&d.toISOString().slice(0,7)<=today.slice(0,7);i++){
  const m=d.toISOString().slice(0,7),next=new Date(d);next.setUTCMonth(next.getUTCMonth()+1);const end=new Date(next.getTime()-86400000).toISOString().slice(0,10),until=end>today?today:end,endCalc=calculate(s,until),before=new Date(d.getTime()-86400000).toISOString().slice(0,10),start=m===s.startDate.slice(0,7)?endCalc.opening:calculate(s,before).total,events=s.events.filter(e=>e.date.slice(0,7)===m),deposits=events.filter(e=>e.kind==='aporte').reduce((n,e)=>n+e.amount,0),withdrawals=events.filter(e=>e.kind==='resgate').reduce((n,e)=>n+e.amount,0),dividends=events.filter(e=>e.kind==='dividendo').reduce((n,e)=>n+e.amount,0),active=s.assets.filter(a=>a.id!=='cash'&&endCalc.values[a.id]>0),closed=active.length>0&&active.every(a=>events.some(e=>e.kind==='saldo'&&e.assetId===a.id&&e.date===until));
  expected.push({month:m,total:endCalc.total,invested:endCalc.netInvested,deposits,withdrawals,dividends,gain:endCalc.total-start-deposits+withdrawals,closed});d=next;
 }
 assert.deepEqual(monthlyHistory(s),expected);
});
test('não permite reinvestir caixa inexistente ou sacar mais que o saldo',()=>{assert.throws(()=>validateState(add(state(),'reinvestimento',1)));assert.throws(()=>validateState(add(state(),'resgate',5701)));});
test('validação recusa datas impossíveis, futuros, NaN, campos hostis e IDs duplicados',()=>{for(const patch of [{amount:NaN},{date:'2026-02-30'},{date:'2099-01-01'},{assetId:'ausente'},{note:{}},{createdAt:10}])assert.throws(()=>validateState(add(state(),'aporte',10,undefined,patch)));const s=state();s.assets.push({...s.assets[0]});assert.throws(()=>validateState(s));const a=state();a.settings.allocation={evil:25,tesouro:25,acoes:25,internacional:25};assert.throws(()=>validateState(a));});
test('planos destinam exatamente o aporte e respeitam perfil/prazo',()=>{for(const initial of [5700,10000,50000])for(const risk of ['conservador','moderado','arrojado'])for(const monthly of [800,1000]){const s=state();s.assets[0].initial=initial;s.assets[0].reserve=true;s.settings.risk=risk;s.settings.monthly=monthly;const p=suggestedPlan(s);assert.equal(Object.values(p.values).reduce((a,b)=>a+b),monthly);if(risk==='conservador')assert.equal(p.values.acoes,0);}const s=state();s.assets[0].initial=50000;s.assets[0].reserve=true;s.settings.horizon=2;assert.equal(suggestedPlan(s).values.acoes,0);});
test('projeção sem juros e com perdas',()=>{assert.equal(projection(5700,800,10,0),101700);assert.ok(projection(5700,800,10,-5)<101700);});
test('atalhos para novos investimentos usam classes existentes sem criar posições artificiais',()=>{assert.ok(ASSET_PRESETS.some(p=>p.name==='Tesouro Selic'&&p.category==='tesouro'));assert.ok(ASSET_PRESETS.some(p=>p.name==='LCI'&&p.category==='cdb'));assert.ok(ASSET_PRESETS.some(p=>p.name==='Fundo imobiliário (FII)'&&p.category==='fiis'));assert.ok(ASSET_PRESETS.every(p=>Object.hasOwn(CATEGORIES,p.category)));assert.equal(initialState().assets.length,2);});
