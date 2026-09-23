// Regras determinísticas. Nenhum número ausente é convertido em zero.
export const UNIVERSE = [
 ['ITUB4','Itaú Unibanco','Bancos',true,'https://www.itau.com.br/relacoes-com-investidores/'],
 ['BBDC4','Bradesco','Bancos',true,'https://www.bradescori.com.br/'],
 ['BBAS3','Banco do Brasil','Bancos',true,'https://ri.bb.com.br/'],
 ['BBSE3','BB Seguridade','Seguros',true,'https://www.bbseguridaderi.com.br/'],
 ['PSSA3','Porto','Seguros',true,'https://ri.portoseguro.com.br/'],
 ['TAEE11','Taesa','Energia elétrica',false,'https://ri.taesa.com.br/'],
 ['EGIE3','Engie Brasil','Energia elétrica',false,'https://www.engie.com.br/investidores/'],
 ['CPFE3','CPFL Energia','Energia elétrica',false,'https://ri.cpfl.com.br/'],
 ['CMIG4','Cemig','Energia elétrica',false,'https://ri.cemig.com.br/'],
 ['CPLE6','Copel','Energia elétrica',false,'https://ri.copel.com/'],
 ['VIVT3','Telefônica Brasil','Telecomunicações',false,'https://ri.telefonica.com.br/'],
 ['TIMS3','TIM','Telecomunicações',false,'https://ri.tim.com.br/'],
 ['ABEV3','Ambev','Bebidas',false,'https://ri.ambev.com.br/'],
 ['WEGE3','WEG','Indústria',false,'https://ri.weg.net/'],
 ['PETR4','Petrobras','Petróleo',false,'https://www.investidorpetrobras.com.br/']
].map(([ticker,name,sector,financial,ri])=>({ticker,name,sector,financial,ri}));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const age=(value,now)=>{const d=typeof value==='number'?new Date(value*(value<1e12?1000:1)):new Date(value);return value==null||!Number.isFinite(d.getTime())?Infinity:(now-d)/86400000;};
export function normalizeStock(company,raw,now=new Date()){
 const f=raw.fundamentals||{},s=raw.stats||{};
 const price=num(s.close??f.close_price),volume=num(s.avg_volume_52w);
 const percent=v=>num(v)==null?null:num(v)/100;
 const rawDy=f.dividend_yield_ttm??f.dividend_yield??f.dy;
 return {...company,ticker:f.queried_ticker||s.ticker||company.ticker,price,quoteDate:s.trade_date,pe:num(f.pl),eps:num(f.lpa),dy:percent(rawDy),roe:percent(f.roe),equity:num(f.equity),fundamentalsDate:f.reference_date,earningsCagr:percent(f.cagr_earnings_5y),avgVolume:price!==null&&volume!==null?price*volume:null,volumeDate:s.trade_date,netDebtEbitda:num(f.net_debt_ebitda),source:'https://api.usebolsai.com/docs',dataIssues:raw.errors||[]};
}
export function assessStock(p,now=new Date()){
 const failures=[];
 if(!(p.price>0)||age(p.quoteDate,now)<0||age(p.quoteDate,now)>7)failures.push('Cotação ausente, futura ou há mais de 7 dias');
 if(!(p.equity>0)||age(p.fundamentalsDate,now)<0||age(p.fundamentalsDate,now)>180)failures.push('Balanço ausente, patrimônio não positivo ou balanço fora da janela de 180 dias');
 if(!(p.avgVolume>=5e6)||age(p.volumeDate,now)>7)failures.push('Liquidez financeira média insuficiente ou estatística desatualizada');
 if(!(p.eps>0)||!(p.pe>0)||!(p.roe>0)||p.roe>1)failures.push('P/L, LPA ou ROE ausente/inconsistente');
 if(!p.financial&&(p.netDebtEbitda===null||p.netDebtEbitda>4))failures.push('Dívida e EBITDA ausentes ou dívida líquida/EBITDA acima de 4x');
 if(failures.length)return {eligible:false,reason:failures.join('; ')+(p.dataIssues.length?'. Fonte: '+p.dataIssues.join(', '):'')};
 const cagr=p.earningsCagr;
 const debtPoints=p.financial?5:10*clamp(1-Math.max(0,p.netDebtEbitda)/4);
 const components={quality:20*clamp(p.roe/.25)+debtPoints,price:25*clamp((25-p.pe)/20),dividends:p.dy===null?0:20*clamp(p.dy/.08)*(p.dy>.12?.5:1),growth:cagr===null?0:15*clamp((cagr+.05)/.25),liquidity:10*clamp(Math.log10(p.avgVolume/5e6)/2)};
 const score=Math.round(Object.values(components).reduce((a,b)=>a+b,0));
 const risks=['Dividendos passados podem cair; valide se houve pagamentos extraordinários.','Preço e indicadores são referências, sujeitos a atraso e revisão.'];
 if(p.financial)risks.push('Capital regulatório, inadimplência e solvência não são medidos nesta nota; revise os relatórios de RI.');
 if(!p.financial&&p.netDebtEbitda>3)risks.push('Alavancagem acima de 3x exige atenção aos juros e vencimentos.');
 if(p.dy===null)risks.push('DY não disponível no retrato atual; nenhum ponto de dividendos foi atribuído.');
 if(p.dy>.12)risks.push('DY acima de 12% recebeu desconto na nota; pode refletir evento não recorrente ou queda da ação.');
 if(cagr===null)risks.push('CAGR de lucro não disponível no retrato atual; nenhum ponto de crescimento foi atribuído.');
 if(cagr!==null&&cagr<0)risks.push('O lucro caiu no CAGR dos últimos cinco anos.');
 if(['Energia elétrica','Petróleo','Bancos'].includes(p.sector))risks.push('Avalie exposição à regulação, ciclo econômico e decisões do controlador.');
 return {eligible:true,stock:{...p,score,components,cagr,reasons:[`ROE de ${(p.roe*100).toFixed(1)}%`,`P/L de ${p.pe.toFixed(1)} vezes`,cagr===null?'CAGR de lucro não informado':'CAGR de lucro em cinco anos'],risks}};
}
export function rankStocks(stocks,now=new Date()){
 const eligible=[],excluded=[];for(const p of stocks){const a=assessStock(p,now);if(a.eligible)eligible.push(a.stock);else excluded.push({ticker:p.ticker,reason:a.reason});}
 eligible.sort((a,b)=>b.score-a.score||a.ticker.localeCompare(b.ticker));const sectors={},picks=[],issuers=new Set();
 for(const p of eligible){if(picks.length<5&&(sectors[p.sector]||0)<2&&!issuers.has(p.ticker)){picks.push(p);sectors[p.sector]=(sectors[p.sector]||0)+1;issuers.add(p.ticker);}else excluded.push({ticker:p.ticker,reason:'Elegível, mas fora das cinco vagas pela nota ou pelo limite de duas empresas por setor.'});}
 return {month:now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}),generatedAt:now.toISOString(),methodologyVersion:'1.0',picks,excluded,coverage:{total:stocks.length,eligible:eligible.length},limitations:['Universo limitado a 15 empresas; não são as melhores de toda a Bolsa.','Volume financeiro estimado por fechamento × quantidade negociada; não é o volume financeiro exato da B3.','Triagem quantitativa, sem leitura automática de notícias, auditoria ou adequação individual.']};
}
