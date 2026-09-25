import {performance} from 'node:perf_hooks';
import {calculate,dateISO,initialState,monthlyHistory} from '../lib/portfolio.mjs';

const state=initialState(),today=dateISO(),start=new Date(`${today.slice(0,4)-6}-01-01T12:00:00Z`);
state.startDate=start.toISOString().slice(0,10);state.events=Array.from({length:5000},(_,i)=>{
 const date=new Date(start.getTime()+Math.floor(i*(((Date.parse(`${today}T12:00:00Z`)-start.getTime())/5000))));
 return {id:`bench-${i}`,date:date.toISOString().slice(0,10),kind:'aporte',assetId:'cdb-santander',amount:.1};
});

function referenceHistory(s){
 const months=[];let d=new Date(s.startDate+'T12:00:00Z');d.setUTCDate(1);
 for(let i=0;i<600&&d.toISOString().slice(0,7)<=today.slice(0,7);i++){
  const month=d.toISOString().slice(0,7),next=new Date(d);next.setUTCMonth(next.getUTCMonth()+1);const end=new Date(next.getTime()-86400000).toISOString().slice(0,10),until=end>today?today:end,endCalc=calculate(s,until),before=new Date(d.getTime()-86400000).toISOString().slice(0,10),startValue=month===s.startDate.slice(0,7)?endCalc.opening:calculate(s,before).total,events=s.events.filter(e=>e.date.slice(0,7)===month),deposits=events.filter(e=>e.kind==='aporte').reduce((n,e)=>n+e.amount,0),withdrawals=events.filter(e=>e.kind==='resgate').reduce((n,e)=>n+e.amount,0),dividends=events.filter(e=>e.kind==='dividendo').reduce((n,e)=>n+e.amount,0),active=s.assets.filter(a=>a.id!=='cash'&&endCalc.values[a.id]>0),closed=active.length>0&&active.every(a=>events.some(e=>e.kind==='saldo'&&e.assetId===a.id&&e.date===until));
  months.push({month,total:endCalc.total,invested:endCalc.netInvested,deposits,withdrawals,dividends,gain:endCalc.total-startValue-deposits+withdrawals,closed});d=next;
 }
 return months;
}
const before=performance.now(),old=referenceHistory(state),oldMs=performance.now()-before;
const after=performance.now(),optimized=monthlyHistory(state),optimizedMs=performance.now()-after;
if(JSON.stringify(old)!==JSON.stringify(optimized))throw new Error('A saída do histórico antigo e otimizado diverge.');
console.log(JSON.stringify({months:optimized.length,events:state.events.length,referenceMs:+oldMs.toFixed(1),optimizedMs:+optimizedMs.toFixed(1),speedup:+(oldMs/optimizedMs).toFixed(1)},null,2));
