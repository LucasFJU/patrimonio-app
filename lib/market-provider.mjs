import {UNIVERSE,normalizeStock,rankStocks} from './ranking.mjs';

const API='https://api.usebolsai.com/api/v1';

async function read(path,{token,fetcher,signal}){
 const response=await fetcher(`${API}${path}`,{headers:{'X-API-Key':token,Accept:'application/json'},cache:'no-store',signal});
 if(!response.ok){
  const status=response.status;
  const message=status===401||status===403?'A chave BolsAI não foi aceita. Confira BOLSAI_API_KEY na Vercel.':status===429?'A cota diária da BolsAI foi atingida. Tente novamente depois da próxima renovação.':`A BolsAI respondeu com HTTP ${status}.`;
  throw Object.assign(new Error(message),{status:status===429?429:status===401||status===403?503:502,providerStatus:status});
 }
 return response.json();
}

export async function fetchMarket({token,companies=UNIVERSE,fetcher=fetch,now=new Date()}={}){
 if(!token)throw Object.assign(new Error('Configure BOLSAI_API_KEY nas variáveis de ambiente da Vercel.'),{status:503});
 const records=Object.fromEntries(companies.map(c=>[c.ticker,{errors:[]}]));
 const jobs=companies.flatMap(company=>[
  {company,key:'fundamentals',path:`/fundamentals/${encodeURIComponent(company.ticker)}`},
  {company,key:'stats',path:`/stocks/${encodeURIComponent(company.ticker)}/stats`}
 ]);
 const deadline=AbortSignal.timeout(50000);let cursor=0,providerFailure=null;
 async function worker(){
  while(cursor<jobs.length&&!providerFailure){
   const job=jobs[cursor++];
   try{
    const data=await read(job.path,{token,fetcher,signal:AbortSignal.any([deadline,AbortSignal.timeout(12000)])});
    records[job.company.ticker][job.key]=data;
   }catch(error){
    if(error.providerStatus===401||error.providerStatus===403||error.providerStatus===429||error.providerStatus>=500)providerFailure??=error;
    records[job.company.ticker].errors.push(`${job.key}: ${error.message}`);
   }
  }
 }
 await Promise.all(Array.from({length:3},worker));
 if(providerFailure)throw providerFailure;
 const stocks=companies.map(company=>normalizeStock(company,records[company.ticker],now));
 return rankStocks(stocks,now);
}
