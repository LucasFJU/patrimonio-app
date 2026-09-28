'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun,Plus,Calculator} from 'lucide-react';
import {CATEGORIES,COLORS,dateISO,rebalance,simulateSmartContribution} from '../lib/portfolio.mjs';

export function ThemeSwitch(){
 const [dark,setDark]=useState(true);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: light)');let saved;try{saved=localStorage.getItem('patrimonio-theme')}catch{}const apply=value=>{setDark(value);document.documentElement.dataset.theme=value?'dark':'light'};apply(saved?saved==='dark':true);const change=e=>{let preference;try{preference=localStorage.getItem('patrimonio-theme')}catch{}if(!preference)apply(!e.matches)};media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[]);
 return <button className="icon-button" aria-label={dark?'Ativar tema claro':'Ativar tema escuro'} onClick={()=>{const value=!dark;setDark(value);document.documentElement.dataset.theme=value?'dark':'light';try{localStorage.setItem('patrimonio-theme',value?'dark':'light')}catch{}}}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>;
}

export function AuthPanel({client,recovery,onRecovered}){
 const [mode,setMode]=useState('login'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const current=recovery?'password':mode;
 async function submit(e){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setMessage('');try{let result;
  if(current==='password'){if(f.get('password')!==f.get('confirm'))throw new Error('As senhas precisam ser iguais.');result=await client.auth.updateUser({password:f.get('password')});}
  else if(current==='reset')result=await client.auth.resetPasswordForEmail(f.get('email'),{redirectTo:location.origin});
  else result=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});
  if(result.error)throw result.error;
  if(current==='password')onRecovered();else if(current==='reset')setMessage('Se o e-mail estiver cadastrado, você receberá um link para definir sua senha.');
 }catch(error){setMessage(error.message)}finally{setBusy(false)}}
 return <div className="auth-overlay"><form className="auth-card" onSubmit={submit}><h1>{current==='password'?'Defina sua senha':current==='reset'?'Recuperar acesso':'Patrimônio familiar'}</h1><p>Uma conta para vocês. A mesma carteira em todos os aparelhos.</p>{current!=='password'&&<label>Seu e-mail<input name="email" type="email" autoComplete="email" required/></label>}{current!=='reset'&&<label>{current==='password'?'Nova senha':'Senha'}<input name="password" type="password" autoComplete={current==='password'?'new-password':'current-password'} minLength={current==='password'?8:undefined} required/></label>}{current==='password'&&<label>Confirme a nova senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required/></label>}{message&&<p role="status" className="notice">{message}</p>}<button className="primary full" disabled={busy}>{busy?'Aguarde…':current==='password'?'Salvar senha':current==='reset'?'Enviar link':'Entrar'}</button>{current!=='password'&&<button type="button" className="secondary full spaced" disabled={busy} onClick={()=>{setMode(mode==='login'?'reset':'login');setMessage('')}}>{mode==='login'?'Esqueci ou ainda não defini minha senha':'Voltar para o login'}</button>}<small>Acesso exclusivo para a conta já cadastrada.</small></form></div>;
}

export function PositionFields({asset}){return <><div className="form-grid"><label>Quantidade atual (opcional)<input name="quantity" type="number" min="0" step="any" defaultValue={asset?.quantity??''}/></label><label>Preço médio em reais (opcional)<input name="averagePrice" type="number" min="0" step="any" defaultValue={asset?.averagePrice??''}/></label><label>Data da compra (opcional)<input name="purchaseDate" type="date" max={dateISO()} defaultValue={asset?.purchaseDate||''}/></label><label>Instituição da posição<input name="institution" maxLength={80} placeholder="Ex.: Santander, corretora ou Tesouro Direto" defaultValue={asset?.institution||''}/></label></div><p className="muted small">A instituição organiza a alocação por local de custódia. Quantidade × preço médio informa o custo da posição; saldos e aportes continuam nos lançamentos.</p></>}
export function readPosition(f){return {quantity:f.get('quantity')===''?null:Number(f.get('quantity')),averagePrice:f.get('averagePrice')===''?null:Number(f.get('averagePrice')),purchaseDate:f.get('purchaseDate')||'',institution:String(f.get('institution')||'').trim(),owner:''}}

export function WealthGoal({state,calc,portfolioCalc=calc,display}){const target=state.settings.wealthGoal||1000000;return <section className="panel goal-panel spaced"><div><span className="eyebrow">META DE PATRIMÔNIO FAMILIAR</span><h2>{display(calc.total)} <span className="muted small">de {display(target)}</span></h2><p className="muted small">Capital familiar acumulado: {display(calc.netInvested)} · Aportes na carteira: {display(portfolioCalc.deposits)}</p></div><div><strong>{Math.min(100,calc.total/target*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</strong><progress aria-label="Progresso da meta patrimonial" max={target} value={Math.max(0,calc.total)}/></div></section>}

export function Rebalance({state,display,onContribute}){
 const month=dateISO().slice(0,7);
 const investedThisMonth=state.events.filter(e=>e.kind==='aporte'&&e.date.startsWith(month)).reduce((n,e)=>n+e.amount,0);
 const remainingMonthly=Math.max(0,(state.settings.monthly||0)-investedThisMonth);
 const defaultAmount=remainingMonthly>0?remainingMonthly:(state.settings.monthly||1000);
 const [amountInput,setAmountInput]=useState(String(defaultAmount));
 const sim=simulateSmartContribution(state,Number(amountInput)||0);
 const gaps=rebalance(state);
 return <article className="panel table-wrap spaced smart-rebalance">
  <div className="panel-heading">
   <div>
    <h2>Simulador de aporte inteligente por meta</h2>
    <p className="muted small">Distribui seu novo aporte comprando apenas as classes abaixo da meta percentual, sem sugerir vendas.</p>
   </div>
   <Calculator size={20}/>
  </div>
  <div className="smart-contribution-controls">
   <label>Valor do novo aporte (R$)
    <input aria-label="Valor do novo aporte" type="number" min="0" step="10" value={amountInput} onChange={e=>setAmountInput(e.target.value)}/>
   </label>
   <div className="smart-contribution-presets">
    <button type="button" className="secondary" onClick={()=>setAmountInput(String(state.settings.monthly||1000))}>Meta mensal ({display(state.settings.monthly||0)})</button>
    {remainingMonthly>0&&remainingMonthly!==state.settings.monthly&&<button type="button" className="secondary" onClick={()=>setAmountInput(String(remainingMonthly))}>Restante do mês ({display(remainingMonthly)})</button>}
   </div>
  </div>
  <table>
   <thead>
    <tr>
     <th>Classe</th>
     <th>Atual</th>
     <th>Meta</th>
     <th>Desvio atual</th>
     <th>Aporte sugerido</th>
     <th>Pós-aporte</th>
     {onContribute&&<th>Ação</th>}
    </tr>
   </thead>
   <tbody>
    {sim.rows.map((r,idx)=>{
     const gap=gaps[idx]?.gap??r.gapBefore;
     const targetAsset=state.assets.find(a=>a.category===r.key&&a.id!=='cash');
     return <tr key={r.key}>
      <td><span className="smart-class-cell"><i style={{background:COLORS[r.key]}}/>{CATEGORIES[r.key]}</span></td>
      <td>{r.current.toFixed(1)}% <small className="muted">({display(r.currentAmount)})</small></td>
      <td>{r.target}%</td>
      <td>{gap>0?'Faltam ':gap<0?'Acima em ':''}{display(Math.abs(gap))}</td>
      <td><strong className={r.suggestedContribution>0?'smart-buy-highlight':''}>{r.suggestedContribution>0?display(r.suggestedContribution):'—'}</strong></td>
      <td>{r.postContributionPct.toFixed(1)}%</td>
      {onContribute&&<td>{r.suggestedContribution>0&&<button type="button" className="secondary smart-contribute-btn" onClick={()=>onContribute(r.key,r.suggestedContribution,targetAsset?.id)}><Plus size={14}/>Aportar</button>}</td>}
     </tr>;
    })}
   </tbody>
  </table>
 </article>;
}

