'use client';

import {useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Coins,Percent,Plus,Wallet} from 'lucide-react';
import {COLORS} from '../lib/portfolio.mjs';
import {dividendOverview} from '../lib/dividends.mjs';

const monthName=month=>new Date(`${month}-15T12:00:00Z`).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
const fullMonth=month=>new Date(`${month}-15T12:00:00Z`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const percent=value=>`${value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;

export function Dividends({state,calc,display,onRegister,onReinvest}){
 const data=dividendOverview(state),[chosenMonth,setChosenMonth]=useState(null);
 const selected=data.months.find(row=>row.month===chosenMonth)||data.months.at(-1),peak=Math.max(1,...data.months.map(row=>row.total));
 const metrics=[
  {label:'Recebido neste mês',value:display(data.current),detail:fullMonth(data.months.at(-1).month),icon:ArrowDownLeft,tone:'income'},
  {label:'Proventos · 12 meses',value:display(data.total),detail:data.partial?'Histórico parcial, desde o início da carteira':'Valores líquidos registrados',icon:Coins,tone:'dividend'},
  {label:'Disponível para reinvestir',value:display(calc.values.cash),detail:`Já reinvestido: ${display(calc.reinvested)}`,icon:Wallet,tone:'investment'},
  {label:'Yield on Cost · 12 meses',value:data.yoc===null?'Sem base de custo':percent(data.yoc),detail:`${data.coveredCount} de ${data.rows.length} posições com custo informado`,icon:Percent,tone:'yield'}
 ];
 return <div className="dividends-page">
  <section className="dividend-metrics" aria-label="Indicadores de proventos">{metrics.map(({label,value,detail,icon:Icon,tone})=><article className={`panel dividend-metric dividend-metric--${tone}`} key={label}><div><span>{label}</span><Icon size={19} aria-hidden="true"/></div><strong>{value}</strong><small>{detail}</small></article>)}</section>
  <section className="panel dividend-chart-panel"><div className="panel-heading"><div><span className="eyebrow">RENDA DA CARTEIRA</span><h2>Proventos ao longo do tempo</h2><p>Selecione um mês para conferir os recebimentos.</p></div><button className="primary" onClick={()=>onRegister()}><Plus size={16}/>Registrar provento</button></div>
   <div className="dividend-chart-summary" aria-live="polite"><span>{fullMonth(selected.month)}</span><strong>{selected.available?display(selected.total):'Antes do início da carteira'}</strong><small>{selected.available?`${selected.count} recebimento${selected.count===1?'':'s'} registrado${selected.count===1?'':'s'}`:'Sem histórico neste período'}</small></div>
   <div className="dividend-bars" aria-label="Recebimentos por mês">{data.months.map(row=><button key={row.month} type="button" aria-pressed={selected.month===row.month} aria-label={`${fullMonth(row.month)}: ${row.available?display(row.total):'sem histórico'}`} className={selected.month===row.month?'selected':''} onClick={()=>setChosenMonth(row.month)}><span className="dividend-bar-space"><svg viewBox="0 0 36 140" preserveAspectRatio="none" aria-hidden="true"><rect x="4" y={140-Math.max(row.total>0?4:0,row.total/peak*140)} width="28" height={Math.max(row.total>0?4:0,row.total/peak*140)} rx="5"/></svg>{row.total===0&&<i/>}</span><span>{monthName(row.month)}</span><small>{row.month.slice(2,4)}</small></button>)}</div>
   <div className="dividend-chart-legend"><i/><span>Proventos recebidos em reais</span><small>{data.partial?'Meses anteriores ao início da carteira não têm histórico.':'Últimos 12 meses, incluindo o mês atual.'}</small></div>
   <details className="dividend-text-data"><summary>Ver valores em tabela</summary><div className="table-wrap"><table><caption className="sr-only">Recebimentos mensais em reais</caption><thead><tr><th>Mês</th><th>Recebimentos</th><th>Valor líquido</th></tr></thead><tbody>{data.months.map(row=><tr key={row.month}><td>{fullMonth(row.month)}</td><td>{row.available?row.count:'Sem histórico'}</td><td>{row.available?display(row.total):'—'}</td></tr>)}</tbody></table></div></details>
  </section>
  <section className="panel dividend-assets"><div className="panel-heading"><div><h2>Renda por investimento</h2><p>Proventos e retorno sobre o custo informado, no mesmo período de 12 meses.</p></div><button className="secondary" onClick={onReinvest} disabled={calc.values.cash<=0}><ArrowUpRight size={16}/>Reinvestir</button></div>
   {data.rows.length?<div className="table-wrap"><table><thead><tr><th>Investimento</th><th>Custo informado</th><th>Proventos · 12 meses</th><th>YoC</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{data.rows.map(row=><tr key={row.asset.id}><td><span className="dividend-asset-name"><i style={{background:COLORS[row.asset.category]}}/><span><strong>{row.asset.ticker||row.asset.name}</strong>{row.asset.ticker&&<small>{row.asset.name}</small>}</span></span></td><td>{row.cost===null?<span className="muted">Não informado</span>:display(row.cost)}</td><td>{display(row.received)}</td><td>{row.yoc===null?'—':percent(row.yoc)}</td><td><button className="text-button" aria-label={`Registrar provento de ${row.asset.name}`} onClick={()=>onRegister(row.asset.id)}><Plus size={15}/>Registrar</button></td></tr>)}</tbody></table></div>:<div className="empty-compact"><Coins size={26} aria-hidden="true"/><h3>Seus proventos começam aqui</h3><p>Adicione um investimento à carteira para acompanhar a renda por ativo.</p></div>}
   {data.unattributed>0&&<p className="small muted">{display(data.unattributed)} registrado no caixa sem identificar o ativo pagador. Esse valor está no gráfico, mas não entra no YoC.</p>}
   <p className="dividend-method">YoC indicativo = proventos registrados no período ÷ (quantidade atual × preço médio informado). O cálculo usa apenas posições com custo preenchido; compras e vendas no período podem limitar a comparação. {data.partial?'O histórico está incompleto e não foi anualizado. ':''}O saldo de mercado não é usado como custo.</p>
  </section>
 </div>;
}
