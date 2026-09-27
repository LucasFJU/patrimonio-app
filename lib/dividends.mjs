import {dateISO} from './portfolio.mjs';

// YoC deliberately uses the cost entered by the user, never the market balance.
export function dividendOverview(state,asOf=dateISO()){
 const endMonth=asOf.slice(0,7),cursor=new Date(`${endMonth}-01T12:00:00Z`);
 cursor.setUTCMonth(cursor.getUTCMonth()-11);
 const months=Array.from({length:12},()=>{const month=cursor.toISOString().slice(0,7);cursor.setUTCMonth(cursor.getUTCMonth()+1);return {month,total:0,count:0,available:month>=state.startDate.slice(0,7)};});
 const start=months[0].month+'-01',events=state.events.filter(event=>event.kind==='dividendo'&&event.date>=start&&event.date<=asOf);
 const byAsset=new Map(),byMonth=new Map(months.map(row=>[row.month,row]));
 for(const event of events){const row=byMonth.get(event.date.slice(0,7));if(row){row.total+=event.amount;row.count++;}byAsset.set(event.assetId,(byAsset.get(event.assetId)||0)+event.amount);}
 const rows=state.assets.filter(asset=>asset.id!=='cash').map(asset=>{
  const quantity=asset.quantity,averagePrice=asset.averagePrice;
  const cost=Number.isFinite(quantity)&&Number.isFinite(averagePrice)&&quantity>0&&averagePrice>0?quantity*averagePrice:null;
  const received=byAsset.get(asset.id)||0;
  return {asset,cost,received,yoc:cost?received/cost*100:null};
 }).sort((a,b)=>b.received-a.received||a.asset.name.localeCompare(b.asset.name,'pt-BR'));
 const covered=rows.filter(row=>row.cost!==null),coveredCost=covered.reduce((sum,row)=>sum+row.cost,0),coveredReceived=covered.reduce((sum,row)=>sum+row.received,0);
 return {months,rows,total:events.reduce((sum,event)=>sum+event.amount,0),current:months.at(-1).total,start,end:asOf,partial:state.startDate>start,coveredCount:covered.length,coveredCost,yoc:coveredCost?coveredReceived/coveredCost*100:null,unattributed:byAsset.get('cash')||0};
}
