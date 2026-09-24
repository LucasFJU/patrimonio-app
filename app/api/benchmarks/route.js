import {NextResponse} from 'next/server';
import {formatSgsDate,parseSgsDate,seriesReturn} from '../../../lib/benchmarks.mjs';

export const revalidate=86400;
const api='https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const monthShift=(date,months)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+months);return d.toISOString().slice(0,10)};
async function series(code,from,to){const url=`${api}.${code}/dados?formato=json&dataInicial=${formatSgsDate(from)}&dataFinal=${formatSgsDate(to)}`;const response=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Banco Central respondeu ${response.status}.`);const data=await response.json();return data.map(row=>({date:parseSgsDate(row.data),valor:row.valor}));}
async function ibovespa(from,to){
 const years=Array.from({length:Number(to.slice(0,4))-Number(from.slice(0,4))+1},(_,i)=>Number(from.slice(0,4))+i);
 const groups=await Promise.all(years.map(async year=>{const payload=Buffer.from(JSON.stringify({language:'pt-br',index:'IBOV',year:String(year)})).toString('base64');const response=await fetch(`https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/${payload}`,{next:{revalidate:86400},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`B3 respondeu ${response.status}.`);return {year,data:await response.json()};}));
 return groups.flatMap(({year,data})=>(data.results||[]).flatMap(row=>Array.from({length:12},(_,i)=>{const month=String(i+1).padStart(2,'0'),value=String(row[`rateValue${i+1}`]??'').replaceAll('.','').replace(',','.');if(!value||value==='null'||!Number.isFinite(Number(value)))return null;const date=`${year}-${month}-${String(row.day).padStart(2,'0')}`;return date<=to?{date,valor:value}:null;}).filter(Boolean))).filter(r=>r.date>=from).sort((a,b)=>a.date.localeCompare(b.date));
}
export async function GET(request){
 const {searchParams}=new URL(request.url);const requested=searchParams.get('startDate')||monthShift(new Date().toISOString().slice(0,10),-12);const period=searchParams.get('period')||'12';const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(requested)||requested>today||!['1','12','all'].includes(period))return NextResponse.json({error:'Período inválido.'},{status:400});
 const start=requested;const boundedStart=start<monthShift(today,-120)?monthShift(today,-120):start;const baseline=boundedStart===monthShift(today,-120)?boundedStart:monthShift(boundedStart,-2);
 const definitions=[['cdi','CDI',12,'daily'],['ipca','IPCA',433,'monthly']];
 const results=await Promise.all([...definitions.map(async([id,label,code,type])=>{try{const rows=await series(code,baseline,today);const usable=rows.filter(r=>type==='monthly'?r.date.slice(0,7)>=boundedStart.slice(0,7):r.date>=boundedStart);return {id,label,return:seriesReturn(usable,type),updatedAt:rows.at(-1)?.date||null,source:'Banco Central do Brasil (SGS)',coverageStart:usable[0]?.date||null};}catch(error){return {id,label,return:null,error:`Dados temporariamente indisponíveis: ${error.message}`,source:'Banco Central do Brasil (SGS)'};}}), (async()=>{try{const rows=await ibovespa(baseline,today),base=rows.filter(r=>r.date<boundedStart).at(-1),usable=rows.filter(r=>r.date>=boundedStart),selected=base?[base,...usable]:usable;return{id:'ibovespa',label:'Ibovespa',return:seriesReturn(selected,'index'),updatedAt:rows.at(-1)?.date||null,source:'B3',coverageStart:selected[0]?.date||null};}catch(error){return{id:'ibovespa',label:'Ibovespa',return:null,error:`Dados temporariamente indisponíveis: ${error.message}`,source:'B3'};}})()]);
 return NextResponse.json({startDate:boundedStart,endDate:today,requestedStart:requested,results},{headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=3600'}});
}
