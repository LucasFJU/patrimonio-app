'use client';

import {useState} from 'react';
import {Plus,Target,Trash2} from 'lucide-react';

const currency=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function AdditionalGoals({state,onSave}){
 const [busy,setBusy]=useState(false),goals=state.settings.goals||[];
 async function submit(event){event.preventDefault();const form=event.currentTarget,data=new FormData(form),targetAmount=Number(data.get('targetAmount')),name=String(data.get('name')||'').trim();if(!name||!Number.isFinite(targetAmount)||targetAmount<=0)return;setBusy(true);try{const ok=await onSave({...state,settings:{...state.settings,goals:[...goals,{id:crypto.randomUUID(),name,targetAmount,currentAmount:0,targetDate:String(data.get('targetDate')||'')}] }},'Meta criada.');if(ok)form.reset();}finally{setBusy(false)}}
 async function update(goal,patch){setBusy(true);try{await onSave({...state,settings:{...state.settings,goals:goals.map(item=>item.id===goal.id?{...item,...patch}:item)}},'Meta atualizada.');}finally{setBusy(false)}}
 async function remove(goal){setBusy(true);try{await onSave({...state,settings:{...state.settings,goals:goals.filter(item=>item.id!==goal.id)}},'Meta removida.');}finally{setBusy(false)}}
 return <section className="panel additional-goals">
  <div className="panel-heading"><div><h2>Outras metas da família</h2><p>Registre objetivos e acompanhe valores informados por vocês.</p></div><Target size={20}/></div>
  {goals.length?<div className="additional-goal-list">{goals.map(goal=>{const pct=Math.min(100,goal.currentAmount/goal.targetAmount*100);return <article className="additional-goal" key={goal.id}><div className="additional-goal-head"><div><strong>{goal.name}</strong><small>{goal.targetDate?`Prazo: ${new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString('pt-BR')}`:'Sem prazo definido'}</small></div><button className="icon-button" type="button" aria-label={`Excluir meta ${goal.name}`} disabled={busy} onClick={()=>remove(goal)}><Trash2 size={17}/></button></div><div className="additional-goal-progress"><progress max="100" value={pct}/><strong>{pct.toLocaleString('pt-BR',{maximumFractionDigits:0})}%</strong></div><div className="additional-goal-values"><span>{currency(goal.currentAmount)} de {currency(goal.targetAmount)}</span><label>Atualizar progresso<input aria-label={`Valor atual da meta ${goal.name}`} type="number" min="0" max="1000000000000" step="0.01" defaultValue={goal.currentAmount} onBlur={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>=0&&value!==goal.currentAmount)update(goal,{currentAmount:value});}}/></label></div></article>})}</div>:<p className="additional-goal-empty">Ainda não há metas adicionais. Crie uma para acompanhar um objetivo específico.</p>}
  {goals.length<20&&<form className="additional-goal-form" onSubmit={submit}><label>Nome da meta<input name="name" maxLength="60" placeholder="Ex.: Viagem em família" required/></label><label>Valor desejado<input name="targetAmount" type="number" min="0.01" max="1000000000000" step="0.01" required/></label><label>Prazo (opcional)<input name="targetDate" type="date" min={today()}/></label><button className="primary" disabled={busy}><Plus size={16}/>Adicionar meta</button></form>}
  <small className="muted">Os valores são informativos e não alteram o patrimônio nem os saldos das contas.</small>
 </section>;
}
