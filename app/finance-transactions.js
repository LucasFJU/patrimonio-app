'use client';
import {useMemo,useState} from 'react';
import {Check,FolderSync,Pencil,Search,SlidersHorizontal,Trash2,X} from 'lucide-react';

const fmtDate=d=>new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR');
const out=type=>['expense','card_purchase','card_payment','investment'].includes(type);
const SCHEDULE_LABELS={scheduled:'Previsto',confirmed:'Confirmado',skipped:'Não realizado'};

const QUICK_FILTERS=[
 {id:'all',label:'Todos',apply:onFilter=>onFilter('reset')},
 {id:'expense',label:'Despesas',apply:onFilter=>{onFilter('type','expense');onFilter('status','all');onFilter('financial','all');}},
 {id:'card_purchase',label:'Cartão',apply:onFilter=>{onFilter('type','card_purchase');onFilter('status','all');onFilter('financial','all');}},
 {id:'income',label:'Receitas',apply:onFilter=>{onFilter('type','income');onFilter('status','all');onFilter('financial','all');}},
 {id:'scheduled',label:'A pagar / Previstos',apply:onFilter=>{onFilter('type','all');onFilter('financial','scheduled');onFilter('status','all');}},
 {id:'pending',label:'Revisão pendente',apply:onFilter=>{onFilter('type','all');onFilter('status','pending');onFilter('financial','all');}},
 {id:'outros',label:'Categoria: Outros',apply:onFilter=>{onFilter('type','all');onFilter('category','Outros');onFilter('status','all');onFilter('financial','all');}}
];

export function FinanceTransactionList({transactions,categories,accounts,cards,types,filters,onFilter,display,onCategory,onDelete,onEdit,onInlineSave,onAutoCategorize,onCreateRuleFromTx,pendingCount=0}){
 const [editingId,setEditingId]=useState(null);
 const [draft,setDraft]=useState({description:'',amount:'',date:'',category:'Outros'});
 const [savingId,setSavingId]=useState(null);
 const [filtersOpen,setFiltersOpen]=useState(false);

 const activeFilterCount=[
  filters.type!=='all',
  filters.category!=='all',
  filters.source!=='all',
  (filters.financial||'all')!=='all',
  filters.status!=='all'
 ].filter(Boolean).length;

 const sourceName=tx=>{
  if(tx.type==='transfer')return `${accounts.find(a=>a.id===tx.accountId)?.name||'Conta'} → ${accounts.find(a=>a.id===tx.toAccountId)?.name||'Conta'}`;
  return cards.find(c=>c.id===tx.cardId)?.name||accounts.find(a=>a.id===tx.accountId)?.name||'Conta';
 };

 const activeChip=
  filters.status==='pending'?'pending':
  filters.category==='Outros'?'outros':
  filters.financial==='scheduled'?'scheduled':
  filters.type!=='all'&&filters.status==='all'&&filters.financial==='all'?filters.type:
  (filters.type==='all'&&filters.category==='all'&&filters.source==='all'&&filters.status==='all'&&filters.financial==='all'&&!filters.search?'all':'custom');

 const startInlineEdit=tx=>{
  if(tx.scheduleId){
   onEdit(tx);
   return;
  }
  setEditingId(tx.id);
  setDraft({
   description:tx.description||'',
   amount:String(tx.amount??''),
   date:tx.date||'',
   category:tx.category||'Outros'
  });
 };

 const cancelInlineEdit=()=>{
  setEditingId(null);
 };

 const saveInlineEdit=async tx=>{
  if(!onInlineSave)return;
  setSavingId(tx.id);
  try{
   const ok=await onInlineSave(tx,{
    description:draft.description.trim(),
    amount:Number(draft.amount),
    date:draft.date,
    category:['income','expense','card_purchase','investment'].includes(tx.type)?draft.category:undefined
   });
   if(ok)setEditingId(null);
  }finally{
   setSavingId(null);
  }
 };

 const summaryTotals=transactions.reduce((acc,tx)=>{
  if(tx.type==='income')acc.in+=tx.amount;
  else if(['expense','card_purchase','card_payment'].includes(tx.type))acc.out+=tx.amount;
  return acc;
 },{in:0,out:0});

 const categoryBreakdown=useMemo(()=>{
  const map=new Map();
  let totalOut=0;
  let othersCount=0;
  for(const tx of transactions){
   if(!['expense','card_purchase'].includes(tx.type))continue;
   const cat=tx.category||'Outros';
   if(cat==='Outros')othersCount++;
   totalOut+=tx.amount;
   const prev=map.get(cat)||{category:cat,amount:0,count:0};
   prev.amount+=tx.amount;
   prev.count+=1;
   map.set(cat,prev);
  }
  const rows=[...map.values()]
   .map(item=>({...item,share:totalOut>0?(item.amount/totalOut)*100:0}))
   .sort((a,b)=>b.amount-a.amount);
  return {rows,totalOut,othersCount};
 },[transactions]);

 return <section className="panel finance-statement-panel">
  <div className="statement-header-row">
   <div>
    <h2>Extrato do mês</h2>
    <p>Busca rápida, filtros inteligentes e edição direta em cada lançamento.</p>
   </div>
   <div className="statement-mini-totals">
    <span>Entradas: <b className="positive-text">{display(summaryTotals.in)}</b></span>
    <span>Saídas: <b className="negative">{display(summaryTotals.out)}</b></span>
    <span>Registros: <b>{transactions.length}</b></span>
   </div>
  </div>

  {/* Barra de busca + Botão Filtrar recolhível + Chips rápidos */}
  <div className="statement-quick-bar">
   <div className="statement-search-row">
    <label className="statement-search-box" aria-label="Buscar no extrato">
     <Search size={16}/>
     <input
      aria-label="Buscar descrição"
      value={filters.search}
      onChange={e=>onFilter('search',e.target.value)}
      placeholder="Buscar por estabelecimento, categoria ou valor…"
     />
     {filters.search&&<button type="button" className="icon-button" aria-label="Limpar busca" onClick={()=>onFilter('search','')}><X size={14}/></button>}
    </label>
    <button
     type="button"
     className={`secondary filter-toggle-btn ${(filtersOpen||activeFilterCount>0)?'is-active':''}`}
     aria-expanded={filtersOpen}
     onClick={()=>setFiltersOpen(!filtersOpen)}
    >
     <SlidersHorizontal size={15}/>
     <span>Filtrar</span>
     {activeFilterCount>0&&<span className="filter-count-badge">{activeFilterCount}</span>}
    </button>
   </div>

   <div className="quick-filter-chips" role="group" aria-label="Filtros rápidos do extrato">
    {QUICK_FILTERS.map(chip=>{
     if(chip.id==='pending'&&pendingCount===0&&filters.status!=='pending')return null;
     if(chip.id==='outros'&&categoryBreakdown.othersCount===0&&filters.category!=='Outros')return null;
     return <button
      key={chip.id}
      type="button"
      className={`quick-chip ${activeChip===chip.id?'active':''}`}
      onClick={()=>chip.apply(onFilter)}
     >
      {chip.label}
      {chip.id==='pending'&&pendingCount>0?` (${pendingCount})`:''}
      {chip.id==='outros'&&categoryBreakdown.othersCount>0?` (${categoryBreakdown.othersCount})`:''}
     </button>;
    })}
    {onAutoCategorize&&categoryBreakdown.othersCount>0&&<button
     type="button"
     className="quick-chip action-chip"
     onClick={onAutoCategorize}
     title="Distribuir lançamentos em Outros automaticamente pelas regras e dicionário"
    >
     <FolderSync size={13}/>Reclassificar “Outros” ({categoryBreakdown.othersCount})
    </button>}
   </div>
  </div>

  {/* Painel de Filtros Avançados e Categorias (Recolhível) */}
  {filtersOpen&&<div className="statement-advanced-filters">
   {categoryBreakdown.rows.length>0&&<div className="statement-category-strip" aria-label="Distribuição por categoria no extrato">
    {categoryBreakdown.rows.map(item=>{
     const isSelected=filters.category===item.category;
     return <button
      key={item.category}
      type="button"
      className={`statement-cat-pill ${isSelected?'active':''} ${item.category==='Outros'?'is-others':''}`}
      onClick={()=>onFilter('category',isSelected?'all':item.category)}
      title={`Filtrar por ${item.category} (${item.count} lançamento(s))`}
     >
      <span className="statement-cat-name">{item.category}</span>
      <strong>{display(item.amount)}</strong>
      <small>{Math.round(item.share)}%</small>
     </button>;
    })}
   </div>}

   <div className="finance-filters compact-filters">
    <label>Tipo
     <select aria-label="Filtrar tipo" value={filters.type} onChange={e=>onFilter('type',e.target.value)}>
      <option value="all">Todos os tipos</option>
      <option value="paid">Saídas pagas</option>
      {Object.entries(types).map(([k,label])=><option key={k} value={k}>{label}</option>)}
     </select>
    </label>
    <label>Categoria
     <select aria-label="Filtrar categoria" value={filters.category} onChange={e=>onFilter('category',e.target.value)}>
      <option value="all">Todas as categorias</option>
      {categories.map(c=><option key={c} value={c}>{c}</option>)}
     </select>
    </label>
    <label>Conta ou cartão
     <select aria-label="Filtrar conta ou cartão" value={filters.source} onChange={e=>onFilter('source',e.target.value)}>
      <option value="all">Todas as origens</option>
      {accounts.map(a=><option key={a.id} value={`account:${a.id}`}>Conta: {a.name}</option>)}
      {cards.map(c=><option key={c.id} value={`card:${c.id}`}>Cartão: {c.name}</option>)}
     </select>
    </label>
    <label>Situação
     <select aria-label="Filtrar situação financeira" value={filters.financial||'all'} onChange={e=>onFilter('financial',e.target.value)}>
      <option value="all">Realizados + previstos</option>
      <option value="realized">Confirmados / realizados</option>
      <option value="scheduled">Previstos / programados</option>
      <option value="skipped">Não realizados</option>
     </select>
    </label>
    <button className="secondary compact-btn" type="button" onClick={()=>onFilter('reset')}>Limpar filtros</button>
   </div>
  </div>}

  {transactions.length?<div className="finance-transactions">
   {transactions.map(tx=>{
    const isEditing=editingId===tx.id;
    const isSaving=savingId===tx.id;
    const canCategorize=['income','expense','card_purchase','investment'].includes(tx.type);

    if(isEditing){
     return <article className="finance-tx is-editing" key={tx.id}>
      <div className="finance-tx-inline-editor">
       <label>
        <span>Data</span>
        <input
         aria-label={`Data de ${tx.description}`}
         type="date"
         value={draft.date}
         onChange={e=>setDraft({...draft,date:e.target.value})}
        />
       </label>
       <label className="inline-desc-field">
        <span>Descrição</span>
        <input
         aria-label={`Descrição de ${tx.description}`}
         value={draft.description}
         maxLength={160}
         onChange={e=>setDraft({...draft,description:e.target.value})}
        />
       </label>
       <label>
        <span>Valor (R$)</span>
        <input
         aria-label={`Valor de ${tx.description}`}
         type="number"
         min="0.01"
         step="0.01"
         value={draft.amount}
         onChange={e=>setDraft({...draft,amount:e.target.value})}
        />
       </label>
       {canCategorize&&<label>
        <span>Categoria</span>
        <select
         aria-label={`Categoria de ${tx.description}`}
         value={draft.category}
         onChange={e=>setDraft({...draft,category:e.target.value})}
        >
         {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
       </label>}
       <div className="inline-editor-actions">
        <button type="button" className="primary compact-action" disabled={isSaving} onClick={()=>saveInlineEdit(tx)}>
         <Check size={14}/>Salvar
        </button>
        <button type="button" className="secondary compact-action" disabled={isSaving} onClick={cancelInlineEdit}>
         <X size={14}/>Cancelar
        </button>
       </div>
      </div>
     </article>;
    }

    return <article className={`finance-tx${tx.needsReview?' is-pending':''}`} key={tx.id}>
     <div className="finance-tx-main">
      <div className="finance-tx-title-line">
       <strong>{tx.description}</strong>
       {(tx.pluggyTransactionId||tx.scheduleStatus||tx.needsReview||tx.installments>1)&&<div className="finance-tx-badges">
        {tx.pluggyTransactionId&&<span className="tx-badge">Sincronizado</span>}
        {tx.scheduleStatus&&<span className="tx-badge">{SCHEDULE_LABELS[tx.scheduleStatus]||tx.scheduleStatus}</span>}
        {tx.needsReview&&<span className="tx-badge warning">Revisar</span>}
        {tx.installments>1&&<span className="tx-badge">{tx.installments}x</span>}
       </div>}
      </div>
      <small>
       {fmtDate(tx.date)} · {types[tx.type]} · {sourceName(tx)}
       {tx.invoiceMonth?` · Fatura ${tx.invoiceMonth}`:''}
      </small>
     </div>

     <div className="finance-tx-controls">
      {canCategorize?<div className="tx-category-cell">
       <select
        className={`tx-category-select ${(tx.category||'Outros')==='Outros'?'is-unclassified':''}`}
        aria-label={`Categoria de ${tx.description}`}
        value={tx.category||'Outros'}
        onChange={e=>onCategory(tx,e.target.value)}
       >
        {categories.map(c=><option key={c} value={c}>{c}</option>)}
       </select>
       {onCreateRuleFromTx&&tx.description&&<button
        type="button"
        className="tx-rule-shortcut"
        title="Criar regra permanente para lançamentos similares"
        onClick={()=>onCreateRuleFromTx(tx)}
       >
        Criar regra
       </button>}
      </div>:<span className="muted small tx-static-category">{tx.category||'Transferência'}</span>}

      <div className="finance-tx-value-row">
       <strong className={`tx-amount ${out(tx.type)?'negative':'positive-text'}`}>
        {out(tx.type)?'-':'+'}{display(tx.amount)}
       </strong>

       <div className="finance-tx-actions">
        <button
         className="icon-button"
         type="button"
         title={tx.scheduleId?'Gerenciar em Programados':'Editar na linha'}
         aria-label={`Editar ${tx.description}`}
         onClick={()=>startInlineEdit(tx)}
        >
         <Pencil size={15}/>
        </button>
        {!tx.pluggyTransactionId&&<button
         className="icon-button"
         type="button"
         title="Excluir lançamento"
         aria-label={`Excluir ${tx.description}`}
         onClick={()=>onDelete(tx)}
        >
         <Trash2 size={15}/>
        </button>}
       </div>
      </div>
     </div>
    </article>;
   })}
  </div>:<p className="muted" style={{marginTop:14}}>Nenhum lançamento encontrado para os filtros aplicados neste mês.</p>}
 </section>;
}
