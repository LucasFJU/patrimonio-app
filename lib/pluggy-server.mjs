const api='https://api.pluggy.ai';

async function request(path,{key,method='GET',body}={}){
 const response=await fetch(`${api}${path}`,{method,headers:{'Content-Type':'application/json',...(key?{'X-API-KEY':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(response.status===401?'As credenciais Pluggy da Vercel não foram aceitas. Confira o Client ID e o Client Secret.':response.status===404?'O Item ID não foi encontrado na aplicação demo. Confira se o item foi associado no Dashboard.':`Pluggy respondeu com erro (${response.status}).`);error.status=response.status===401?503:502;throw error;}
 return data;
}

async function apiKey(){
 const clientId=process.env.PLUGGY_CLIENT_ID,clientSecret=process.env.PLUGGY_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw Object.assign(new Error('Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente da Vercel.'),{status:503});
 const result=await request('/auth',{method:'POST',body:{clientId,clientSecret}});
 if(!result.apiKey)throw Object.assign(new Error('A Pluggy não retornou uma chave de API válida.'),{status:502});
 return result.apiKey;
}

export async function fetchPluggyItem(itemId,startDate){
 if(typeof itemId!=='string'||!/^[-\w]{20,64}$/.test(itemId))throw Object.assign(new Error('Item ID inválido.'),{status:400});
 const key=await apiKey(),item=await request(`/items/${encodeURIComponent(itemId)}`,{key});
 const connector=String(item.connector?.name||item.connectorName||'').toLocaleLowerCase('pt-BR');
 if(!connector.includes('meupluggy'))throw Object.assign(new Error('Este item não é uma conexão proxy do Meu Pluggy. Associe a conexão pessoal à aplicação demo.'),{status:400});
 const [listed,resourcesResult]=await Promise.all([request(`/accounts?itemId=${encodeURIComponent(itemId)}`,{key}),request(`/items/${encodeURIComponent(itemId)}/resources`,{key}).catch(()=>({results:[]}))]),accounts=Array.isArray(listed)?listed:(listed.results||[]),resources=Array.isArray(resourcesResult)?resourcesResult:(resourcesResult.results||[]),resourceTypes=new Set(resources.map(r=>String(r.type||r.resource||'').toUpperCase()));
 const current=new Date(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(current),oldest=new Date(current);oldest.setUTCDate(oldest.getUTCDate()-365);const availableFrom=oldest.toISOString().slice(0,10),safeDate=/^\d{4}-\d{2}-\d{2}$/.test(startDate)?(startDate>availableFrom?startDate:availableFrom):availableFrom;
 const results=[];
 for(const account of accounts){
  const rows=[];let path=`/v2/transactions?${new URLSearchParams({accountId:account.id,dateFrom:safeDate})}`;let pages=0;
  while(path&&pages++<20){const page=await request(path,{key});rows.push(...(page.results||[]));path=page.next?`/v2/transactions${page.next}`:null;}
  results.push({id:account.id,name:account.name||'Conta bancária',mask:account.number||null,type:account.subtype||account.type||'BANK',balance:typeof account.balance==='number'&&Number.isFinite(account.balance)?account.balance:null,currency:account.currencyCode||'BRL',transactions:rows.filter(t=>t.currencyCode==null||t.currencyCode==='BRL').map(t=>({id:t.providerId||t.id,date:String(t.date||'').slice(0,10),description:String(t.description||'Movimentação bancária').slice(0,160),amount:Number(t.amount),category:typeof t.category==='string'?t.category:null,status:t.status||'POSTED',type:t.type||null,installmentNumber:t.installmentNumber||t.creditCardMetadata?.installmentNumber||null,totalInstallments:t.totalInstallments||t.creditCardMetadata?.totalInstallments||null}))});
 }
 const products={accounts:resourceTypes.has('ACCOUNT')||results.some(a=>!/CREDIT|CARD|INVEST|BROKER/i.test(a.type)),transactions:resourceTypes.has('TRANSACTION'),creditCards:resourceTypes.has('CREDIT_CARD_ACCOUNT')||results.some(a=>/CREDIT|CARD/i.test(a.type)),bills:resourceTypes.has('BILL'),investments:resourceTypes.has('INVESTMENT')||resourceTypes.has('FUND')};
 const cards=results.filter(a=>/CREDIT|CARD/i.test(a.type));
 const investments=[];if(products.investments){try{const response=await request(`/investments?itemId=${encodeURIComponent(itemId)}`,{key}),items=Array.isArray(response)?response:(response.results||[]);investments.push(...items.map(i=>({id:i.id,name:String(i.name||i.code||'Investimento').slice(0,100),code:i.code||null,type:i.type||null,subtype:i.subtype||null,balance:Number(i.balance),amountOriginal:Number(i.amountOriginal),quantity:Number(i.quantity),date:String(i.date||'').slice(0,10),status:i.status||null})).filter(i=>Number.isFinite(i.balance)&&i.balance>=0));}catch{products.investments=false;}}
 const bills=[];if(products.bills){for(const card of cards){try{const response=await request(`/bills?accountId=${encodeURIComponent(card.id)}`,{key}),items=Array.isArray(response)?response:(response.results||[]);bills.push(...items.map(b=>({id:b.id,accountId:card.id,dueDate:String(b.dueDate||'').slice(0,10),totalAmount:Number(b.totalAmount),payments:b.payments||[]})).filter(b=>Number.isFinite(b.totalAmount)));}catch{products.bills=false;break;}}}
 return {itemId,accounts:results,investmentAccounts:results.filter(a=>/INVEST|BROKER/i.test(a.type)),cards,bills,investments,products,resources:resources.map(r=>({type:r.type||r.resource||'UNKNOWN',id:r.id||null,status:r.status||null,updatedAt:r.updatedAt||r.lastUpdatedAt||null})),coverageStart:safeDate,updatedAt:new Date().toISOString()};
}
