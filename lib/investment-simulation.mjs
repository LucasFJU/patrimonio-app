import {ALLOCATION_KEYS,calculate,dateISO} from './portfolio.mjs';

export function simulateContribution(state,amount,asOf=dateISO()){
 const contribution=Number(amount);
 if(!Number.isFinite(contribution)||contribution<0||contribution>1e12)throw new Error('Informe um valor entre zero e um trilhão de reais.');
 const cents=Math.round(contribution*100),calc=calculate(state,asOf),base=calc.total-calc.byCategory.caixa,newBase=base+cents/100;
 const rows=ALLOCATION_KEYS.map(key=>{const value=calc.byCategory[key]||0,target=state.settings.allocation[key]||0;return {key,value,target,current:base?value/base*100:0,gap:base*target/100-value,need:Math.max(0,newBase*target/100-value)};});
 const totalNeed=rows.reduce((sum,row)=>sum+row.need,0);
 const shares=rows.map((row,index)=>{const exact=totalNeed?cents*row.need/totalNeed:0;return {index,cents:Math.floor(exact),fraction:exact-Math.floor(exact)};});
 let remaining=cents-shares.reduce((sum,row)=>sum+row.cents,0);
 const priority=[...shares].sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
 for(let index=0;remaining>0&&priority.length;index++,remaining--)priority[index%priority.length].cents++;
 return rows.map((row,index)=>({...row,suggested:shares[index].cents/100,after:newBase?(row.value+shares[index].cents/100)/newBase*100:0}));
}

export function monthContributionProgress(state,asOf=dateISO()){
 const month=asOf.slice(0,7),deposited=state.events.filter(event=>event.kind==='aporte'&&event.date.slice(0,7)===month&&event.date<=asOf).reduce((sum,event)=>sum+event.amount,0);
 const goal=state.settings.monthly;
 return {month,deposited,goal,remaining:Math.max(0,Math.round((goal-deposited)*100)/100)};
}
