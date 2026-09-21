import {UNIVERSE,normalizeStock,rankStocks} from './ranking.mjs';
const ENDPOINTS={quote:['quote',{}],statistics:['statistics',{mode:'current'}],financial:['financial-data',{mode:'current'}],balance:['balance-sheet',{period:'quarterly'}],income:['income-statement',{period:'annual'}],historical:['historical',{range:'3mo',interval:'1d'}]};
export async function fetchMarket({token,companies=UNIVERSE,fetcher=fetch,now=new Date()}={}){
 const records=Object.fromEntries(companies.map(c=>[c.ticker,{errors:[]}]));
 // 3 grupos × 6 endpoints, sem repetição automática que possa multiplicar a cobrança.
 const jobs=[];for(let i=0;i<companies.length;i+=5){const group=companies.slice(i,i+5);for(const [key,[endpoint,params]]of Object.entries(ENDPOINTS))jobs.push({group,key,endpoint,params});}
 const deadline=AbortSignal.timeout(45000);let throttled=false;
 async function runJob({group,key,endpoint,params}){
  if(throttled||deadline.aborted){for(const c of group)records[c.ticker].errors.push(`${endpoint}: limite da fonte ou tempo total atingido`);return;}
  try{const url=new URL('https://brapi.dev/api/v2/stocks/'+endpoint);url.search=new URLSearchParams({...params,symbols:group.map(c=>c.ticker).join(',')}).toString();const response=await fetcher(url,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store',signal:AbortSignal.any([deadline,AbortSignal.timeout(15000)])});if(response.status===429)throttled=true;if(!response.ok)throw new Error(`HTTP ${response.status}`);const body=await response.json();if(!Array.isArray(body.results))throw new Error('resposta incompatível');
   for(const c of group){const item=body.results.find(r=>(r.requestedSymbol||r.symbol)===c.ticker);if(!item?.data||item.error){records[c.ticker].errors.push(`${endpoint}: sem cobertura`);continue;}records[c.ticker][key]=item.data;if(item.symbol&&/^[A-Z0-9]{4,12}$/.test(item.symbol))records[c.ticker].resolvedSymbol=item.symbol;}
  }catch(e){const reason=e.name==='TimeoutError'?'tempo limite':/^HTTP \d+$/.test(e.message)?e.message:'fonte indisponível';for(const c of group)records[c.ticker].errors.push(`${endpoint}: ${reason}`);}
 }
 let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];await runJob(job);}}));
 return rankStocks(companies.map(c=>normalizeStock(c,records[c.ticker],now)),now);
}
