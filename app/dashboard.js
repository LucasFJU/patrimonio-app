'use client';
import {useMemo} from 'react';
import {AlertTriangle,ArrowRight,ArrowUpRight,CalendarDays,Coins,CreditCard,Landmark,ReceiptText,ShieldCheck,Sparkles,Target,TrendingUp,Wallet} from 'lucide-react';
import {ALLOCATION_KEYS,CATEGORIES,COLORS,dateISO,dividendAnalytics,periodStartDate,moneyWeightedReturn} from '../lib/portfolio.mjs';
import {DEFAULT_FINANCE,summarizeFinance,upcomingFinanceObligations} from '../lib/finance.mjs';
import {confirmedFinanceInsights} from '../lib/insights.mjs';

const fmtDate=d=>new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR');
const fmtMonth=m=>{const v=new Date(`${m}-15T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});return v.charAt(0).toLocaleUpperCase('pt-BR')+v.slice(1);};

export function DashboardHome({state,calc,history,settings,personalReturn,period,onPeriod,display,hidden,Evolution,onNavigate,onClose}){
 const today=dateISO(),month=today.slice(0,7);
 const finance=state.finance||DEFAULT_FINANCE();
 const finSummary=useMemo(()=>summarizeFinance(finance,month,today),[finance,month,today]);
 const upcoming=useMemo(()=>upcomingFinanceObligations(finance,today,30),[finance,today]);
 const insights=useMemo(()=>confirmedFinanceInsights(finance,today),[finance,today]);
 const divStats=useMemo(()=>dividendAnalytics(state,today),[state,today]);

 const periodReturn=useMemo(()=>{
  const start=periodStartDate(state,period,today);
  return moneyWeightedReturn(state,start,today)||personalReturn;
 },[state,period,today,personalReturn]);

 const visibleHistory=useMemo(()=>{
  if(period==='all')return history;
  const count=Math.max(2,Number(period)||12);
  return history.slice(-count);
 },[history,period]);

 const reserveGoal=(settings?.expenses||0)*(settings?.reserveMonths||6);
 const reservePct=reserveGoal>0?Math.min(100,(calc.reserve/reserveGoal)*100):0;
 const wealthGoal=settings?.wealthGoal||1000000;
 const wealthPct=wealthGoal>0?Math.min(100,(calc.total/wealthGoal)*100):0;

 const investedBase=Math.max(0,calc.total-(calc.byCategory.caixa||0));
 const openInvoices=finSummary.invoices.filter(i=>i.invoiceMonth===month||i.dueDate.slice(0,7)===month);
 const openInvoicesTotal=openInvoices.reduce((s,i)=>s+i.open,0);

 const activeAllocations=ALLOCATION_KEYS.map(k=>{
  const val=calc.byCategory[k]||0;
  const pct=investedBase>0?(val/investedBase)*100:0;
  return {key:k,label:CATEGORIES[k],color:COLORS[k],value:val,pct};
 }).filter(item=>item.pct>0);

 let cumulativePct=0;
 const donutSegments=activeAllocations.map(item=>{
  const start=cumulativePct;
  cumulativePct+=item.pct;
  return {...item,dasharray:`${Math.max(0,item.pct-0.8)} ${100-Math.max(0,item.pct-0.8)}`,dashoffset:25-start};
 });

 const topClass=activeAllocations.slice().sort((a,b)=>b.pct-a.pct)[0];

 return <div className="dashboard-home">
  {/* 1. HERO BALANCE BAR (LouBank / C6 Carbon / Nubank Top Balance) */}
  <section className="panel lou-hero-balance">
   <div className="lou-balance-main">
    <span className="eyebrow">PATRIMÔNIO & LIQUIDEZ CONSOLIDADA · {fmtMonth(month).toUpperCase()}</span>
    <div className="lou-balance-amount-row">
     <h2 className="hero-amount">{display(calc.total)}</h2>
     <span className={`hero-delta-pill ${calc.gain>=0?'is-up':'is-down'}`}>
      <TrendingUp size={13}/>
      {calc.gain>=0?'+':''}{display(calc.gain)}
     </span>
    </div>
    <p className="hero-subtitle">
     Capital aportado: <b>{display(calc.netInvested)}</b> · Saldo em conta corrente: <b>{display(finSummary.cash)}</b>
    </p>
   </div>
   <div className="lou-balance-actions">
    <button type="button" className="secondary compact-btn" onClick={onClose}>Conferir saldos</button>
    <button type="button" className="primary compact-btn" onClick={()=>onNavigate('portfolio')}>Investir / Carteira <ArrowUpRight size={15}/></button>
   </div>
  </section>

  {/* 2. PASTEL WALLET CARDS CAROUSEL (LouBank Mint, Yellow, Lilac & Carbon Cards) */}
  <section className="lou-wallet-carousel" aria-label="Cartões de resumo de conta e investimentos">
   <button type="button" className="lou-wallet-card is-mint" onClick={()=>onNavigate('finance')}>
    <div className="lou-wallet-top">
     <span className="lou-wallet-brand">CONTA DIGITAL</span>
     <Wallet size={18}/>
    </div>
    <div className="lou-wallet-mid">
     <small>Saldo disponível</small>
     <strong>{display(finSummary.cash)}</strong>
    </div>
    <div className="lou-wallet-foot">
     <span>Projetado: {display(finSummary.projectedCash)}</span>
     <b>•• {String(finance.accounts.length||1).padStart(2,'0')}</b>
    </div>
   </button>

   <button type="button" className="lou-wallet-card is-yellow" onClick={()=>onNavigate('portfolio')}>
    <div className="lou-wallet-top">
     <span className="lou-wallet-brand">CORRETORA</span>
     <TrendingUp size={18}/>
    </div>
    <div className="lou-wallet-mid">
     <small>Carteira investida</small>
     <strong>{display(investedBase)}</strong>
    </div>
    <div className="lou-wallet-foot">
     <span>Lucro: {calc.gain>=0?'+':''}{display(calc.gain)}</span>
     <b>{donutSegments.length} {donutSegments.length===1?'classe':'classes'}</b>
    </div>
   </button>

   <button type="button" className="lou-wallet-card is-lilac" onClick={()=>onNavigate('finance')}>
    <div className="lou-wallet-top">
     <span className="lou-wallet-brand">CARTÕES</span>
     <CreditCard size={18}/>
    </div>
    <div className="lou-wallet-mid">
     <small>Faturas em aberto</small>
     <strong>{display(openInvoicesTotal)}</strong>
    </div>
    <div className="lou-wallet-foot">
     <span>Gastos mês: {display(finSummary.expenses)}</span>
     <b>{openInvoices.length} {openInvoices.length===1?'cartão':'cartões'}</b>
    </div>
   </button>

   <button type="button" className="lou-wallet-card is-carbon" onClick={()=>onNavigate('dividends')}>
    <div className="lou-wallet-top">
     <span className="lou-wallet-brand">PROVENTOS 12M</span>
     <Coins size={18}/>
    </div>
    <div className="lou-wallet-mid">
     <small>Renda passiva acumulada</small>
     <strong>{display(divStats.last12MonthsTotal)}</strong>
    </div>
    <div className="lou-wallet-foot">
     <span>Média: {display(divStats.monthlyAverage12m)}/mês</span>
     <b>YoC {divStats.portfolioYoC.toFixed(1)}%</b>
    </div>
   </button>
  </section>

  {/* 3. SUPER-APP QUICK ACTION TILES (LouBank FINANCE + C6 / Inter / Nubank Hub) */}
  <section className="lou-quick-hub" aria-label="Atalhos rápidos do banco e corretora">
   <button type="button" className="lou-action-tile" onClick={()=>onNavigate('finance')}>
    <span className="lou-tile-badge is-yellow"><ReceiptText size={17}/></span>
    <strong>Extrato & Conta</strong>
    <small>Pix, débitos e entradas</small>
   </button>
   <button type="button" className="lou-action-tile" onClick={()=>onNavigate('portfolio')}>
    <span className="lou-tile-badge is-mint"><Landmark size={17}/></span>
    <strong>Custódia & Ativos</strong>
    <small>Renda fixa, ações e FIIs</small>
   </button>
   <button type="button" className="lou-action-tile" onClick={()=>onNavigate('finance')}>
    <span className="lou-tile-badge is-lilac"><CreditCard size={17}/></span>
    <strong>Meus Cartões</strong>
    <small>Faturas e limites</small>
   </button>
   <button type="button" className="lou-action-tile" onClick={()=>onNavigate('dividends')}>
    <span className="lou-tile-badge is-yellow"><Coins size={17}/></span>
    <strong>Meus Proventos</strong>
    <small>Dividendos e JCP</small>
   </button>
   <button type="button" className="lou-action-tile" onClick={()=>onNavigate('plan')}>
    <span className="lou-tile-badge is-mint"><Target size={17}/></span>
    <strong>Meu Orçamento</strong>
    <small>Metas e reserva</small>
   </button>
   <button type="button" className="lou-action-tile" onClick={()=>onNavigate('reports')}>
    <span className="lou-tile-badge is-lilac"><ShieldCheck size={17}/></span>
    <strong>Análise Financeira</strong>
    <small>Caixa vs. competência</small>
   </button>
  </section>

  {/* 4. SPARK METRICS + IMAGE 5 BENTO ROW (KPI Sparklines + Circular Gauge + Thick Pill Goal) */}
  <section className="spark-bento-row">
   {/* Bento A: KPI 3-Column Sparklines (SPARK METRICS Image 6) */}
   <article className="panel spark-kpi-card">
    <div className="panel-heading">
     <div>
      <span className="eyebrow">INDICADORES DE PERFORMANCE</span>
      <h2>KPIs do Mês & Carteira</h2>
     </div>
    </div>
    <div className="spark-kpi-columns">
     <div className="spark-kpi-col">
      <svg className="spark-wave" viewBox="0 0 80 30" aria-hidden="true">
       <path d="M4 24 Q 18 8, 32 18 T 60 10 T 76 6" fill="none" stroke="#eef880" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
      <strong className={!periodReturn||periodReturn.total>=0?'positive-text':'negative'}>
       {periodReturn?`${(periodReturn.total*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`:'0,0%'}
      </strong>
      <span>Retorno pessoal (TIR)</span>
      <small>{periodReturn?`${(periodReturn.annual*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% a.a.`:'Em formação'}</small>
     </div>

     <div className="spark-kpi-col">
      <svg className="spark-wave" viewBox="0 0 80 30" aria-hidden="true">
       <path d="M4 22 Q 22 20, 36 12 T 62 14 T 76 7" fill="none" stroke="#b2d1ce" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
      <strong>{display(finSummary.received)}</strong>
      <span>Receitas no mês</span>
      <small>Balanço: {display(finSummary.netCashFlow)}</small>
     </div>

     <div className="spark-kpi-col">
      <svg className="spark-wave" viewBox="0 0 80 30" aria-hidden="true">
       <path d="M4 20 Q 20 10, 40 16 T 64 8 T 76 11" fill="none" stroke="#c4b5d6" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
      <strong>{display(calc.reserve)}</strong>
      <span>Reserva de liquidez</span>
      <small>{Math.round(reservePct)}% de {settings.reserveMonths} meses</small>
     </div>
    </div>
   </article>

   {/* Bento B: Sources of Income / Allocation Circular Gauge (SPARK METRICS Image 6) */}
   <article className="panel spark-sources-card">
    <div className="panel-heading">
     <div>
      <span className="eyebrow">FONTES DE PATRIMÔNIO</span>
      <h2>Distribuição da custódia</h2>
     </div>
     <button type="button" className="text-button" onClick={()=>onNavigate('plan')}>Rebalancear →</button>
    </div>

    <div className="spark-sources-body">
     <div className="spark-sources-list">
      {activeAllocations.length>0?activeAllocations.slice(0,4).map(item=><div className="spark-source-item" key={item.key}>
       <span className="spark-source-dot" style={{background:item.color}}/>
       <span className="spark-source-name">{item.label}</span>
       <strong>{item.pct.toFixed(0)}%</strong>
      </div>):<p className="muted small">Adicione ativos para ver a distribuição.</p>}
     </div>

     <div className="spark-gauge-wrap" aria-label="Distribuição da carteira">
      <svg viewBox="0 0 42 42">
       <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--soft)" strokeWidth="3.2"/>
       <circle cx="21" cy="21" r="13.2" fill="transparent" stroke="var(--line)" strokeWidth="0.7" strokeDasharray="1 2.5"/>
       {donutSegments.map(seg=><circle key={seg.key} cx="21" cy="21" r="15.9155" fill="transparent" stroke={seg.color} strokeWidth="3.4" strokeDasharray={seg.dasharray} strokeDashoffset={seg.dashoffset} strokeLinecap="round"/>)}
      </svg>
      <div className="spark-gauge-center">
       <strong>{topClass?`${topClass.pct.toFixed(0)}%`:'0%'}</strong>
       <small>{topClass?topClass.label:'Vazio'}</small>
      </div>
     </div>
    </div>
   </article>

   {/* Bento C: Thick Neon-Yellow Progress Bar Card (Image 5 Monthly Savings + LouBank Mint Banner) */}
   <article className="panel spark-goal-card">
    <div className="panel-heading">
     <div>
      <span className="eyebrow">PROGRESSO PATRIMONIAL</span>
      <h2>Meta de independência</h2>
     </div>
     <Target size={18}/>
    </div>

    <div className="thick-goal-numbers">
     <strong>{display(calc.total)}</strong>
     <span>{wealthPct.toFixed(0)}%</span>
    </div>

    <div className="thick-pill-progress" role="progressbar" aria-valuenow={Math.round(wealthPct)} aria-valuemin={0} aria-valuemax={100}>
     <i style={{width:`${Math.max(8,wealthPct)}%`}}/>
    </div>

    <div className="row-between muted small">
     <span>Reserva: {Math.round(reservePct)}% concluída</span>
     <span>Alvo: <b>{display(wealthGoal)}</b></span>
    </div>

    <button type="button" className="lou-promo-banner" onClick={()=>onNavigate('plan')}>
     <span className="lou-promo-icon"><Sparkles size={16}/></span>
     <span>
      <strong>Simulador de aporte inteligente!</strong>
      <small>Descubra onde alocar seu próximo aporte mensal</small>
     </span>
     <ArrowRight size={16}/>
    </button>
   </article>
  </section>

  {/* 5. EVOLUÇÃO PATRIMONIAL + MOVIMENTAÇÕES E ALERTAS (SPARK METRICS Operational Metrics) */}
  <section className="two-cols">
   <article className="panel">
    <div className="panel-heading">
     <div>
      <span className="eyebrow">HISTÓRICO CONSOLIDADO</span>
      <h2>Evolução do patrimônio × aportado</h2>
     </div>
     <div className="segmented" role="group" aria-label="Período do gráfico">
      {[['6','6M'],['12','12M'],['all','Tudo']].map(([id,label])=><button key={id} type="button" className={period===id?'selected':''} onClick={()=>onPeriod(id)}>{label}</button>)}
     </div>
    </div>
    <div className="chart-legend">
     <span><i style={{background:'#eef880'}}/>Patrimônio total</span>
     <span><i style={{background:'#b2d1ce'}}/>Capital líquido aportado</span>
    </div>
    {Evolution&&<Evolution data={visibleHistory} hidden={hidden}/>}
   </article>

   <article className="panel spark-operations-panel">
    <div className="panel-heading">
     <div>
      <span className="eyebrow">AGENDA & MOVIMENTAÇÕES · 30 DIAS</span>
      <h2>Próximos vencimentos e alertas</h2>
     </div>
     <CalendarDays size={18}/>
    </div>

    {insights.length>0&&<div className="dashboard-insights-list">
     {insights.slice(0,2).map(item=><div className={`dashboard-alert-row is-${item.severity}`} key={item.id}>
      <AlertTriangle size={16}/>
      <div>
       <strong>{item.title}</strong>
       <small>{item.detail}</small>
      </div>
      <button type="button" className="text-button" onClick={()=>onNavigate('finance')}>Revisar →</button>
     </div>)}
    </div>}

    {upcoming.length>0?<div className="spark-ops-list">
     {upcoming.slice(0,4).map((item,idx)=><div className="spark-ops-row" key={item.id}>
      <span className={`lou-circle-badge ${idx%3===0?'is-yellow':idx%3===1?'is-mint':'is-lilac'}`}>
       {item.kind==='invoice'?<CreditCard size={15}/>:<ReceiptText size={15}/>}
      </span>
      <span className="spark-ops-copy">
       <strong>{item.label}</strong>
       <small>Vence {fmtDate(item.date)} · {item.kind==='invoice'?'Fatura de cartão':'Programado'}</small>
      </span>
      <strong className="spark-ops-amount">{display(item.amount)}</strong>
     </div>)}
    </div>:<p className="muted">Nenhum vencimento pendente para os próximos 30 dias.</p>}

    <div className="button-row spaced">
     <button type="button" className="secondary compact-btn" onClick={()=>onNavigate('finance')}>Abrir extrato e contas</button>
     <button type="button" className="text-button" onClick={()=>onNavigate('dividends')}>Proventos em caixa: {display(divStats.cashBalance)} →</button>
    </div>
   </article>
  </section>
 </div>;
}

export {DashboardHome as Dashboard};
