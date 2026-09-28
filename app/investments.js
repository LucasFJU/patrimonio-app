'use client';

import {useState} from 'react';
import {ArrowRight,Info,Landmark,Plus,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {CATEGORIES,COLORS,money,moneyWeightedReturn} from '../lib/portfolio.mjs';
import {allocationByInstitution,investmentPositions} from '../lib/investment-view.mjs';

const fmtDate=value=>new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
const INST_COLORS=['#eef880','#b2d1ce','#c4b5d6','#7dd3fc','#4ade80','#f472b6'];

export function Investments({state,calc,display,onAdd,onClose,onEdit}){
 const [search,setSearch]=useState(''),[institution,setInstitution]=useState('all'),[categoryFilter,setCategoryFilter]=useState('all');
 const positions=investmentPositions(state),allocation=allocationByInstitution(positions),total=positions.reduce((sum,p)=>sum+p.value,0),returnData=moneyWeightedReturn(state);
 const visible=positions.filter(p=>(institution==='all'||p.institution===institution)&&(categoryFilter==='all'||p.asset.category===categoryFilter)&&`${p.asset.name} ${p.asset.ticker||''} ${p.institution} ${CATEGORIES[p.asset.category]}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 return <div className="investments-page">
  <section className="panel investment-summary">
   <div className="investment-summary-main">
    <span className="eyebrow">CARTEIRA CONJUNTA · CUSTÓDIA CONSOLIDADA</span>
    <h2>Patrimônio investido</h2>
    <strong>{display(calc.total)}</strong>
    <p>Saldo consolidado das posições e do caixa de dividendos. Contas correntes bancárias ficam separadas no Controle financeiro.</p>
    <div className="investment-summary-actions">
     <button className="primary" onClick={onAdd}><Plus size={16}/>Adicionar ativo</button>
     <button className="secondary" onClick={onClose}><RefreshCw size={15}/>Atualizar saldos</button>
    </div>
   </div>
   <div className="investment-summary-numbers">
    <div><span>Capital líquido aportado</span><b>{display(calc.netInvested)}</b></div>
    <div><span>Resultado acumulado</span><b className={calc.gain<0?'negative':'positive-text'}>{calc.gain>0?'+':''}{display(calc.gain)}</b></div>
    <div><span>Retorno pessoal (TIR)</span><b className={returnData&&returnData.total<0?'negative':'positive-text'}>{returnData?`${(returnData.total*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:'Histórico insuficiente'}</b></div>
    <div><span>Reserva de liquidez</span><b>{display(calc.reserve)}</b></div>
   </div>
  </section>

  <section className="panel investment-institutions">
   <div className="panel-heading">
    <div>
     <h2>Alocação por instituição de custódia</h2>
     <p>Toque em uma instituição para filtrar suas posições abaixo. Caixa de dividendos separado.</p>
    </div>
    <Landmark size={18}/>
   </div>
   {allocation.length?<>
    <div className="investment-allocation-track" role="img" aria-label="Distribuição por instituição">
     {allocation.map((row,index)=><i key={row.institution} style={{width:`${total?row.value/total*100:0}%`,background:INST_COLORS[index%INST_COLORS.length]}} title={`${row.institution}: ${display(row.value)}`}/>)}
    </div>
    <div className="investment-institution-list">
     {allocation.map((row,index)=><button key={row.institution} className={institution===row.institution?'selected':''} onClick={()=>setInstitution(institution===row.institution?'all':row.institution)}>
      <i style={{background:INST_COLORS[index%INST_COLORS.length]}}/>
      <span>{row.institution}</span>
      <strong>{display(row.value)}</strong>
      <small>{total?(row.value/total*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):'0'}% da carteira</small>
     </button>)}
    </div>
   </>:<p className="muted">Adicione posições para ver a distribuição por corretora ou banco.</p>}
   {calc.values.cash>0&&<p className="muted small" style={{marginTop:12}}>Caixa de dividendos disponível para reinvestir: <b>{display(calc.values.cash)}</b></p>}
  </section>

  <section className="panel investment-position-panel">
   <div className="panel-heading">
    <div>
     <h2>Posições da carteira</h2>
     <p>Confira participação percentual, custo médio e data da última conferência de cada ativo.</p>
    </div>
    <span className="tag neutral">{visible.length} de {positions.length} posições</span>
   </div>
   <div className="investment-toolbar">
    <div className="search">
     <Search size={17}/>
     <input aria-label="Buscar investimento" placeholder="Buscar por nome, ticker, classe ou instituição…" value={search} onChange={event=>setSearch(event.target.value)}/>
    </div>
    <select aria-label="Filtrar classe" value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}>
     <option value="all">Todas as classes</option>
     {Object.entries(CATEGORIES).filter(([k])=>k!=='caixa').map(([k,label])=><option key={k} value={k}>{label}</option>)}
    </select>
    <select aria-label="Filtrar instituição" value={institution} onChange={event=>setInstitution(event.target.value)}>
     <option value="all">Todas as instituições</option>
     {allocation.map(row=><option key={row.institution}>{row.institution}</option>)}
    </select>
   </div>
   {visible.length?<div className="investment-position-grid">
    {visible.map(position=>{
     const asset=position.asset;
     const sharePct=calc.total>0?(position.value/calc.total*100):0;
     const classColor=COLORS[asset.category]||'#10b981';
     return <article className="investment-position" key={asset.id} style={{'--asset-accent':classColor}}>
      <div className="investment-position-top">
       <span className="investment-position-icon" style={{background:`color-mix(in srgb, ${classColor} 14%, var(--panel))`,color:classColor}}><Landmark size={18}/></span>
       <div>
        <h3>{asset.name}</h3>
        <span>{CATEGORIES[asset.category]}{asset.ticker?` · ${asset.ticker}`:''}</span>
       </div>
       <button className="text-button" aria-label={`Editar ${asset.name}`} onClick={()=>onEdit(asset)}>Editar <ArrowRight size={14}/></button>
      </div>
      <div className="investment-position-value-row">
       <strong className="investment-position-value">{display(position.value)}</strong>
       <span className="position-share-badge">{sharePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}% da carteira</span>
      </div>
      <div className="custom-progress-track" style={{marginBottom:14}}><i style={{width:`${Math.min(100,sharePct)}%`,background:classColor}}/></div>
      <div className="investment-position-meta">
       <span>Instituição</span><b>{position.institution}</b>
       {asset.quantity!=null&&asset.averagePrice!=null&&<><span>Posição & PM</span><b>{asset.quantity} cotas · PM {money(asset.averagePrice)}</b></>}
       <span>Origem do saldo</span><b>{position.source}</b>
       <span>Última conferência</span><b>{position.balanceDate?fmtDate(position.balanceDate):'Sem conferência registrada'}</b>
       {position.linked&&<><span>Conexão Open Finance</span><b>{position.remoteDate?`Meu Pluggy · ${fmtDate(position.remoteDate)}`:'Meu Pluggy · sem data'}</b></>}
      </div>
      {asset.reserve&&<span className="tag green"><ShieldCheck size={13}/> Reserva de emergência</span>}
     </article>;
    })}
   </div>:<p className="muted">Nenhuma posição corresponde à busca ou ao filtro selecionado.</p>}
  </section>

  <details className="panel investment-return-note">
   <summary>Como o resultado e a rentabilidade são calculados</summary>
   <p>Resultado acumulado = patrimônio atual − saldo inicial − aportes + retiradas. Os dividendos que continuam na carteira já fazem parte do patrimônio e não são somados outra vez. Transferências internas e reinvestimentos não são novos aportes.</p>
   <p>O retorno pessoal considera as datas dos aportes e retiradas. Ele depende de saldos informados ou sincronizados: uma posição sem conferência recente pode mostrar patrimônio e retorno desatualizados. Preço médio e quantidade são informativos; não substituem o saldo registrado.</p>
  </details>
 </div>;
}
