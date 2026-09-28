'use client';
import {FinanceEntry,Programmed,FinanceDialog} from './finance-programmed';
import {createSchedule,markScheduleCandidates} from '../lib/schedules.mjs';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,Check,ChevronDown,ChevronUp,CreditCard,Download,FolderSync,LayoutDashboard,Pencil,Plus,ReceiptText,Repeat,SlidersHorizontal,Trash2,Upload,Wallet} from 'lucide-react';
import {DEFAULT_FINANCE,FINANCE_CATEGORIES,accountBalances,closeFinanceMonth,compareFinanceMonths,csvFingerprint,filterFinanceTransactions,financeForecast,financeMonthClosing,importPreviewRows,installmentSchedule,monthEnd,monthOf,parseStatementCsv,reconcileFinanceDuplicate,reopenFinanceMonth,shiftMonth,summarizeFinance,upcomingFinanceObligations} from '../lib/finance.mjs';
import {editFinanceAccount,editFinanceCard,editFinanceTransaction,payFinanceInvoice} from '../lib/finance-edit.mjs';
import {money,dateISO,moneyWeightedReturn,periodStartDate} from '../lib/portfolio.mjs';
import {supabase} from '../lib/supabase';
import {applyRule,inferTransactionCategory,previewRule,recategorizeTransactions,suggestCategoryRules} from '../lib/pluggy-sync.mjs';
import {FinanceTransactionList} from './finance-transactions';

const todayMonth=()=>dateISO().slice(0,7);
const FINANCE_HISTORY_START='2026-08-01';
const fmtDate=d=>new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR');
const fmtMonth=m=>{const value=new Date(`${m}-15T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});return value.charAt(0).toLocaleUpperCase('pt-BR')+value.slice(1);};
const empty=f=>f||DEFAULT_FINANCE();
const TYPES={income:'Receita',expense:'Despesa à vista',transfer:'Transferência',investment:'Aporte em investimento',card_purchase:'Compra no cartão',card_payment:'Pagamento de fatura'};

const CATEGORY_SWATCHES=['#eef880','#b2d1ce','#c4b5d6','#7dd3fc','#4ade80','#fbbf24','#f472b6','#a78bfa','#94a3b8'];

const SECTIONS=[
 ['overview','Visão Mensal',LayoutDashboard],
 ['statement','Extrato & Agenda',ReceiptText],
 ['cards_accounts','Cartões & Contas',CreditCard],
 ['planning','Orçamento',CalendarDays],
 ['import','Categorias & Sync',FolderSync]
];

function Card({title,subtitle,children,icon:Icon=Wallet,action}){
 return <article className="panel finance-card">
  <div className="panel-heading">
   <div>
    <h2>{title}</h2>
    {subtitle&&<p>{subtitle}</p>}
   </div>
   {action||<Icon size={18}/>}
  </div>
  {children}
 </article>;
}

function Stats({summary,display,onOpen}){
 const items=[
  ['Recebido',summary.received,'income','confirmed','Entradas confirmadas'],
  ['Pago',summary.paid,'paid','confirmed','Saídas confirmadas'],
  ['A receber',summary.receivable,'income','scheduled','Previsto no mês'],
  ['A pagar',summary.payable,'expense','scheduled','Faturas e programados'],
  ['Saldo projetado',summary.projectedCash,'all','all','Fim da competência']
 ];
 return <section className="finance-stats decision-stats">
  {items.map(([label,value,type,status,hint])=><button className="panel stat-action" key={label} onClick={()=>onOpen(type,status)}>
   <span>{label}</span>
   <strong className={label==='Pago'||label==='A pagar'||value<0?'negative':label==='Recebido'?'positive-text':''}>{display(value)}</strong>
   <small>{hint} →</small>
  </button>)}
 </section>;
}

export function FinanceDashboard({finance,month,display,onOpen}){
 const f=empty(finance),s=summarizeFinance(f,month);
 return <section className="finance-dashboard panel spaced">
  <div className="panel-heading">
   <div>
    <h2>Seu mês financeiro</h2>
    <p>Entradas, despesas e faturas; o saldo bancário fica fora do patrimônio investido.</p>
   </div>
   <button className="text-button" onClick={onOpen}>Abrir controle financeiro <ArrowUpRight size={16}/></button>
  </div>
  <div className="finance-summary-grid">
   <div><span>Disponível nas contas</span><strong>{display(s.cash)}</strong></div>
   <div><span>Despesas do mês (cartão incluído)</span><strong>{display(s.expenses)}</strong></div>
   <div><span>Faturas a vencer neste mês</span><strong>{display(s.due)}</strong></div>
  </div>
 </section>;
}

export function Finance({state,onSave,onServerSave,display,notify,newEntryRequest=0}){
 const finance=useMemo(()=>empty(state.finance),[state.finance]);
 const [month,setMonth]=useState(todayMonth);
 const [section,setSection]=useState('overview');
 const [statementSubView,setStatementSubView]=useState('list');
 const [entryOpen,setEntryOpen]=useState(false);
 const [entryType,setEntryType]=useState('expense');
 const [entrySeed,setEntrySeed]=useState(null);
 const [legacyEntry,setLegacyEntry]=useState(null);
 const [duplicateLinks,setDuplicateLinks]=useState({});
 const [quickAddOpen,setQuickAddOpen]=useState(false);
 const [showAllCategories,setShowAllCategories]=useState(false);
 const [showAllBudgets,setShowAllBudgets]=useState(false);
 const [showAllUpcoming,setShowAllUpcoming]=useState(false);

 useEffect(()=>{
  if(newEntryRequest){
   setEntrySeed(null);
   setLegacyEntry(null);
   setEntryOpen(true);
  }
 },[newEntryRequest]);

 const categories=useMemo(()=>[...new Set([...FINANCE_CATEGORIES,...(finance.categories||[])])],[finance.categories]);
 const today=todayMonth(),minMonth=FINANCE_HISTORY_START.slice(0,7);
 const defaultQuickDate=month===today?dateISO():`${month}-15`;

 const [quick,setQuick]=useState({
  type:'expense',
  description:'',
  amount:'',
  category:'Alimentação',
  accountId:finance.accounts[0]?.id||'',
  cardId:finance.cards[0]?.id||'',
  assetId:state.assets.find(a=>a.id!=='cash')?.id||'',
  date:defaultQuickDate,
  categoryTouched:false
 });

 useEffect(()=>{
  setQuick(prev=>({
   ...prev,
   accountId:prev.accountId&&finance.accounts.some(a=>a.id===prev.accountId)?prev.accountId:(finance.accounts[0]?.id||''),
   cardId:prev.cardId&&finance.cards.some(c=>c.id===prev.cardId)?prev.cardId:(finance.cards[0]?.id||''),
   assetId:prev.assetId&&state.assets.some(a=>a.id===prev.assetId)?prev.assetId:(state.assets.find(a=>a.id!=='cash')?.id||''),
   date:month===today?dateISO():`${month}-15`
  }));
 },[finance.accounts,finance.cards,state.assets,month,today]);

 const handleQuickDescriptionChange=value=>{
  const direction=quick.type==='income'?'CREDIT':'DEBIT';
  const inferred=value.trim().length>=3?inferTransactionCategory(value,'',direction,finance):null;
  setQuick(prev=>({
   ...prev,
   description:value,
   category:!prev.categoryTouched&&inferred&&inferred!=='Outros'?inferred:prev.category
  }));
 };

 const [csvRows,setCsvRows]=useState(null),[csvAccount,setCsvAccount]=useState(''),[csvCategory,setCsvCategory]=useState('Outros');
 const [budgetValues,setBudgetValues]=useState({}),[showAccount,setShowAccount]=useState(false),[showCard,setShowCard]=useState(false);
 const [busy,setBusy]=useState(false),[period,setPeriod]=useState('12'),[benchmark,setBenchmark]=useState(null),[benchmarkLoading,setBenchmarkLoading]=useState(false);
 const [filterType,setFilterType]=useState('all'),[filterCategory,setFilterCategory]=useState('all'),[filterAccount,setFilterAccount]=useState('all'),[filterStatus,setFilterStatus]=useState('all'),[filterFinancial,setFilterFinancial]=useState('all'),[search,setSearch]=useState('');
 const [pluggyItemId,setPluggyItemId]=useState(finance.pluggy?.itemId||'');
 const [rulePreview,setRulePreview]=useState(null),[selectedRuleRows,setSelectedRuleRows]=useState([]),[ruleDraft,setRuleDraft]=useState({contains:'',category:'Moradia'});
 const [suggestionCatOverrides,setSuggestionCatOverrides]=useState({});
 const [links,setLinks]=useState({}),[positionLinks,setPositionLinks]=useState(finance.pluggy?.positionLinks||{});
 const [editingTransaction,setEditingTransaction]=useState(null),[editingAccount,setEditingAccount]=useState(null),[editingCard,setEditingCard]=useState(null);

 const changeFilter=(key,value)=>{
  if(key==='reset'){
   setFilterType('all');setFilterCategory('all');setFilterAccount('all');setFilterStatus('all');setFilterFinancial('all');setSearch('');
  }else{
   ({type:setFilterType,category:setFilterCategory,source:setFilterAccount,status:setFilterStatus,financial:setFilterFinancial,search:setSearch})[key]?.(value);
  }
 };

 const csvRef=useRef(null);
 const asOf=monthEnd(month),summary=summarizeFinance(finance,month,asOf),balances=accountBalances(finance,asOf),invoices=summary.invoices;
 const projection=financeForecast(finance,today,6),comparisons=compareFinanceMonths(finance,month);
 const pending=finance.transactions.filter(t=>t.needsReview&&monthOf(t.date)===month),positionPending=(finance.pluggy?.review||[]).filter(r=>r.needsReview),pendingCount=pending.length+positionPending.length;
 const ruleSuggestions=useMemo(()=>suggestCategoryRules(finance),[finance]);

 useEffect(()=>setBudgetValues(finance.budgets[month]||{}),[finance.budgets,month]);

 const commit=async(next,message,events=state.events)=>{
  setBusy(true);
  try{return await onSave({...state,events,finance:next},message)!==false;}
  finally{setBusy(false);}
 };

 const handleQuickSubmit=async e=>{
  e.preventDefault();
  const amount=Number(quick.amount);
  const description=quick.description.trim();
  if(!description)return notify('Informe uma descrição para o lançamento.');
  if(!Number.isFinite(amount)||amount<=0)return notify('Informe um valor válido maior que zero.');
  if(quick.type==='card_purchase'&&!finance.cards.length){
   setSection('cards_accounts');
   setShowCard(true);
   return notify('Cadastre um cartão antes de lançar compras no crédito.');
  }
  if(quick.type!=='card_purchase'&&!finance.accounts.length){
   setSection('cards_accounts');
   setShowAccount(true);
   return notify('Cadastre uma conta bancária antes de lançar.');
  }
  setBusy(true);
  try{
   const next=structuredClone(state);
   const entryDate=quick.date||defaultQuickDate;
   const competenceMonth=entryDate.slice(0,7);
   if(quick.type==='income'||quick.type==='expense'){
    next.finance=createSchedule(finance,{
     id:crypto.randomUUID(),
     type:quick.type,
     description,
     category:quick.category||'Outros',
     accountId:quick.accountId||finance.accounts[0]?.id,
     mode:'once',
     amount,
     firstDate:entryDate,
     competenceMonth,
     count:1
    });
   }else if(quick.type==='card_purchase'){
    const card=finance.cards.find(c=>c.id===quick.cardId)||finance.cards[0];
    const tx={
     id:crypto.randomUUID(),
     type:'card_purchase',
     date:entryDate,
     competenceMonth,
     amount,
     description,
     category:quick.category||'Outros',
     cardId:card.id,
     accountId:card.accountId,
     installments:1,
     closeDay:card.closeDay,
     dueDay:card.dueDay
    };
    tx.installmentParts=installmentSchedule({...tx,date:tx.date});
    tx.invoiceMonth=tx.installmentParts[0].invoiceMonth;
    tx.dueDate=tx.installmentParts[0].dueDate;
    next.finance.transactions.push(tx);
   }else if(quick.type==='investment'){
    const assetId=quick.assetId||state.assets.find(a=>a.id!=='cash')?.id;
    if(!assetId)throw new Error('Cadastre um investimento na carteira antes de registrar aporte.');
    const event={
     id:crypto.randomUUID(),
     date:entryDate,
     kind:'aporte',
     assetId,
     amount,
     note:description,
     createdAt:new Date().toISOString()
    };
    const tx={
     id:crypto.randomUUID(),
     type:'investment',
     date:entryDate,
     competenceMonth,
     amount,
     description,
     category:'Investimento',
     accountId:quick.accountId||finance.accounts[0]?.id,
     assetId,
     portfolioEventId:event.id
    };
    next.events.push(event);
    next.finance.transactions.push(tx);
   }
   const ok=await onSave(next,'Lançamento rápido registrado.');
   if(ok!==false){
    setQuick(prev=>({...prev,description:'',amount:'',categoryTouched:false}));
    setQuickAddOpen(false);
   }
  }catch(err){
   notify(err.message);
  }finally{
   setBusy(false);
  }
 };

 const openFullModalWithDraft=(modeOverride='installments')=>{
  setLegacyEntry(null);
  setEntryType(quick.type);
  setEntrySeed({
   ...quick,
   mode:quick.type==='card_purchase'?'once':modeOverride,
   installments:quick.type==='card_purchase'?'3':'1'
  });
  setEntryOpen(true);
 };

 const toggleMonthClosing=async()=>{
  try{
   const next=closing.closed?reopenFinanceMonth(finance,month):closeFinanceMonth(finance,month);
   await commit(next,closing.closed?'Mês reaberto para revisão.':'Mês fechado e valores conferidos.');
  }catch(error){notify(error.message);}
 };

 const savePluggyItem=async e=>{
  e.preventDefault();
  const next=structuredClone(finance);
  next.pluggy={...(next.pluggy||{}),itemId:pluggyItemId.trim()};
  await commit(next,'Item ID do Meu Pluggy salvo com segurança na sua carteira privada.');
 };

 const syncPluggy=async()=>{
  if(!finance.pluggy?.itemId)return notify('Salve primeiro o Item ID do Meu Pluggy.');
  if(!supabase)return notify('A integração Pluggy requer a versão publicada com Supabase.');
  setBusy(true);
  try{
   const {data}=await supabase.auth.getSession();
   const token=data.session?.access_token;
   if(!token)throw new Error('Entre na sua conta antes de sincronizar.');
   const response=await fetch('/api/pluggy/sync',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({itemId:finance.pluggy.itemId,startDate:FINANCE_HISTORY_START})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Falha ao sincronizar Meu Pluggy.');
   onServerSave(payload.state,payload.version);
   notify(`Sincronização concluída: ${payload.imported} lançamentos importados e classificados.`);
  }catch(error){notify(error.message);}
  finally{setBusy(false);}
 };

 const handleRecategorize=async(onlyOthers=false)=>{
  setBusy(true);
  try{
   const {state:nextState,updatedCount,byCategory}=recategorizeTransactions(state,{onlyOthers});
   if(updatedCount===0){
    notify(onlyOthers?'Nenhuma despesa em “Outros” pôde ser reclassificada automaticamente. Crie uma regra abaixo para estabelecimentos específicos.':'Todos os lançamentos já estão nas categorias mais adequadas.');
    return;
   }
   const summaryText=Object.entries(byCategory).map(([cat,n])=>`${cat} (${n})`).join(', ');
   await onSave(nextState,`${updatedCount} lançamento(s) distribuído(s): ${summaryText}.`);
  }catch(err){
   notify(err.message);
  }finally{
   setBusy(false);
  }
 };

 const applySuggestedRule=async suggestion=>{
  const chosenCat=suggestionCatOverrides[suggestion.keyword]||suggestion.suggestedCategory||'Alimentação';
  try{
   const rows=previewRule(state,suggestion.keyword,chosenCat);
   const id=crypto.randomUUID();
   const next=applyRule(state,{id,contains:suggestion.keyword,category:chosenCat,active:true,createdAt:new Date().toISOString()},rows.map(r=>r.id));
   await onSave(next,`Regra “${suggestion.keyword} → ${chosenCat}” ativada (${rows.length} lançamento(s) atualizado(s)).`);
  }catch(err){
   notify(err.message);
  }
 };

 const handleCreateRuleFromTx=tx=>{
  const cleanWord=String(tx.description||'').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(w=>w.length>=3)[0]||tx.description.slice(0,20);
  setRuleDraft({contains:cleanWord.toUpperCase(),category:tx.category&&tx.category!=='Outros'?tx.category:'Alimentação'});
  setSection('import');
  try{
   const rows=previewRule(state,cleanWord,tx.category&&tx.category!=='Outros'?tx.category:'Alimentação');
   setRulePreview(rows);
   setSelectedRuleRows(rows.map(r=>r.id));
  }catch{
   setRulePreview(null);
  }
 };

 const prepareRule=()=>{
  try{
   const rows=previewRule(state,ruleDraft.contains,ruleDraft.category);
   setRulePreview(rows);
   setSelectedRuleRows(rows.map(r=>r.id));
   if(!rows.length)notify('Nenhum lançamento histórico corresponde à regra.');
  }catch(e){notify(e.message);}
 };

 const saveRule=async()=>{
  if(!rulePreview)return;
  const id=crypto.randomUUID(),next=applyRule(state,{id,contains:ruleDraft.contains.trim(),category:ruleDraft.category,active:true,createdAt:new Date().toISOString()},selectedRuleRows);
  if(await onSave(next,`Regra salva. ${selectedRuleRows.length} lançamentos atualizados.`)){
   setRulePreview(null);
   setSelectedRuleRows([]);
  }
 };

 const decideTransaction=async(tx,decision)=>{
  let next=structuredClone(finance);
  const target=next.transactions.find(t=>t.id===tx.id),events=[...state.events];
  if(decision==='confirm-investment'){
   const assetId=links[tx.id]||tx.suggestedAssetId;
   if(!assetId)return notify('Selecione o investimento de destino.');
   let event=events.find(e=>e.id===tx.suggestedPortfolioEventId);
   if(event){event.pluggyTransactionId=tx.pluggyTransactionId;event.assetId=assetId;event.amount=tx.amount;}
   else if(tx.matchingManualTransactionId){
    const manual=next.transactions.find(t=>t.id===tx.matchingManualTransactionId);
    event=manual?events.find(e=>e.id===manual.portfolioEventId):null;
    if(event){event.pluggyTransactionId=tx.pluggyTransactionId;event.assetId=assetId;event.amount=tx.amount;}
    if(manual){manual.reconciled=true;manual.supersededByPluggyTransactionId=tx.pluggyTransactionId;}
   }
   if(!event){
    event={id:crypto.randomUUID(),date:tx.date,kind:'aporte',assetId,amount:tx.amount,note:`Aporte conciliado: ${tx.description}`.slice(0,200),createdAt:new Date().toISOString(),pluggyTransactionId:tx.pluggyTransactionId};
    events.push(event);
   }
   target.assetId=assetId;target.portfolioEventId=event.id;target.reconciled=true;target.needsReview=false;
   delete target.suggestedPortfolioEventId;delete target.matchingManualTransactionId;
  }else if(decision==='link-duplicate'){
   try{
    target.matchingManualTransactionId=duplicateLinks[tx.id]||target.matchingManualTransactionId;
    next=reconcileFinanceDuplicate(next,tx.id);
   }catch(error){return notify(error.message);}
  }else if(decision==='confirm'){
   target.needsReview=false;target.reviewDecision='confirmed';
  }else if(decision==='reject'){
   target.needsReview=false;target.reviewDecision='excluded';target.excludedFromBalances=true;
  }
  if(await onSave({...state,events,finance:next},'Pendência atualizada.'))notify('Revisão salva.');
 };

 const decideCard=async(remote,cardId)=>{
  if(!cardId)return notify('Selecione o cartão correspondente.');
  const next=structuredClone(state);
  if(!next.finance.pluggy)next.finance.pluggy={};
  next.finance.pluggy.cardLinks={...(next.finance.pluggy.cardLinks||{}),[remote.id]:{cardId,linkedAt:new Date().toISOString()}};
  if(await onSave(next,`Cartão ${remote.name||'conectado'} vinculado.`))notify('Vínculo salvo.');
 };

 const decidePositionConflict=async(review,useRemote)=>{
  const next=structuredClone(state),reviews=next.finance?.pluggy?.review||[];
  next.finance.pluggy.review=reviews.filter(r=>r.id!==review.id);
  let events=[...state.events];
  if(useRemote){
   events.push({id:crypto.randomUUID(),date:review.remoteDate,kind:'saldo',assetId:review.assetId,amount:review.remoteBalance,note:'Saldo remoto confirmado após revisão',createdAt:new Date().toISOString(),pluggyInvestmentId:review.providerId});
  }
  if(await onSave({...next,events},'Conflito de posição revisado.'))notify(useRemote?'Saldo remoto aplicado à posição.':'Saldo manual mantido.');
 };

 const decidePosition=async(remote,assetId)=>{
  if(!assetId)return notify('Selecione a posição da carteira.');
  const next=structuredClone(state),f=next.finance;
  if(!f.pluggy)f.pluggy={};
  f.pluggy.positionLinks={...(f.pluggy.positionLinks||{}),[remote.id]:{assetId,linkedAt:new Date().toISOString()}};
  if(await onSave(next,`Posição ${remote.name} vinculada.`)){
   setPositionLinks(f.pluggy.positionLinks);
   notify('Vínculo salvo.');
  }
 };

 const addAccount=async e=>{
  e.preventDefault();
  const form=e.currentTarget,d=new FormData(form),next=structuredClone(finance);
  next.accounts.push({id:crypto.randomUUID(),name:String(d.get('name')).trim(),type:String(d.get('type')),openingBalance:Number(d.get('openingBalance')||0),openingDate:String(d.get('openingDate'))});
  if(await commit(next,'Conta adicionada.')){form.reset();setShowAccount(false);}
 };

 const deleteAccount=async account=>{
  if(finance.schedules?.some(s=>s.accountId===account.id))return notify('Esta conta tem programações vinculadas. Preserve a conta para manter o histórico.');
  const linked=finance.transactions.filter(t=>t.accountId===account.id||t.toAccountId===account.id);
  const linkedCards=finance.cards.filter(c=>c.accountId===account.id);
  if(linkedCards.length)return notify('Antes de excluir esta conta, remova ou associe seus cartões a outra conta.');
  if(!confirm(`Excluir “${account.name}” e seus ${linked.length} lançamentos associados? Esta ação não pode ser desfeita.`))return;
  const next=structuredClone(finance);
  next.accounts=next.accounts.filter(a=>a.id!==account.id);
  next.transactions=next.transactions.filter(t=>t.accountId!==account.id&&t.toAccountId!==account.id);
  next.recurring=next.recurring.filter(r=>r.accountId!==account.id);
  await commit(next,'Conta e lançamentos associados excluídos.');
 };

 const addCard=async e=>{
  e.preventDefault();
  const form=e.currentTarget,d=new FormData(form),next=structuredClone(finance);
  next.cards.push({id:crypto.randomUUID(),name:String(d.get('name')).trim(),accountId:String(d.get('accountId')),closeDay:Number(d.get('closeDay')),dueDay:Number(d.get('dueDay'))});
  if(await commit(next,'Cartão adicionado.')){form.reset();setShowCard(false);}
 };

 const saveAccountEdit=async e=>{
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  try{
   const next=editFinanceAccount(state,editingAccount.id,{name:String(data.get('name')),type:String(data.get('type')),openingBalance:Number(data.get('openingBalance')),openingDate:String(data.get('openingDate'))});
   if(await onSave(next,'Conta atualizada.'))setEditingAccount(null);
  }catch(error){notify(error.message);}
 };

 const saveCardEdit=async e=>{
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  try{
   const next=editFinanceCard(state,editingCard.id,{name:String(data.get('name')),accountId:String(data.get('accountId')),closeDay:Number(data.get('closeDay')),dueDay:Number(data.get('dueDay'))});
   if(await onSave(next,'Cartão atualizado.'))setEditingCard(null);
  }catch(error){notify(error.message);}
 };

 const quickPayInvoice=async invoice=>{
  setBusy(true);
  try{
   const next=payFinanceInvoice(state,{cardId:invoice.cardId,invoiceMonth:invoice.invoiceMonth,amount:invoice.open,date:dateISO()});
   await onSave(next,`Fatura ${invoice.cardName} (${invoice.invoiceMonth}) paga.`);
  }catch(error){notify(error.message);}
  finally{setBusy(false);}
 };

 const deleteTransaction=async tx=>{
  if(tx.scheduleId){
   setSection('statement');
   setStatementSubView('calendar');
   return notify('Abra a ocorrência em Programados e Calendário e use Não realizado para preservar o histórico.');
  }
  if(!confirm('Excluir este lançamento?'))return;
  const next=structuredClone(finance);
  next.transactions=next.transactions.filter(t=>t.id!==tx.id);
  if(tx.recurringId&&!next.transactions.some(t=>t.recurringId===tx.recurringId))next.recurring=next.recurring.filter(r=>r.id!==tx.recurringId);
  if(tx.type==='investment'&&!tx.bankInvestment){
   await onSave({...state,events:state.events.filter(e=>e.id!==tx.portfolioEventId),finance:next},'Lançamento e aporte removidos.');
   return;
  }
  await commit(next,tx.bankInvestment?'Aporte bancário removido.':'Lançamento removido.');
 };

 const updateCategory=async(tx,category)=>{
  if(tx.category===category)return;
  const next=structuredClone(finance),updated=next.transactions.find(t=>t.id===tx.id);
  updated.category=category;
  updated.categoryManuallySet=true;
  if(!updated.possibleDuplicate)updated.needsReview=false;
  delete updated.userCategoryRuleId;
  await commit(next,`Categoria alterada para ${category}.`);
 };

 const inlineSaveTransaction=async(tx,patch)=>{
  try{
   const next=editFinanceTransaction(state,tx.id,patch);
   return await onSave(next,'Lançamento atualizado na linha.');
  }catch(error){
   notify(error.message);
   return false;
  }
 };

 const saveTransactionEdit=async e=>{
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  try{
   const next=editFinanceTransaction(state,editingTransaction.id,{date:String(data.get('date')),amount:Number(data.get('amount')),description:String(data.get('description')),category:data.has('category')?String(data.get('category')):undefined,installments:editingTransaction.type==='card_purchase'?Number(data.get('installments')):undefined});
   if(await onSave(next,'Lançamento atualizado.'))setEditingTransaction(null);
  }catch(error){notify(error.message);}
 };

 const loadCsv=async e=>{
  const file=e.target.files?.[0];
  e.target.value='';
  if(!file)return;
  try{
   const rows=parseStatementCsv(await file.text(),FINANCE_HISTORY_START);
   const enriched=rows.map(r=>{
    if(!r.valid)return r;
    const inferred=inferTransactionCategory(r.description,r.category||'',r.type==='income'?'CREDIT':'DEBIT',finance);
    return {...r,category:r.category&&r.category!=='Outros'?r.category:inferred};
   });
   setCsvRows(importPreviewRows(enriched,finance.transactions));
   setCsvAccount(finance.accounts[0]?.id||'');
   notify(`${rows.length} linhas lidas e pré-classificadas por categoria.`);
  }catch(err){notify(err.message);}
 };

 const exportFinanceCsv=()=>{
  const labels={income:'Receita',expense:'Despesa',transfer:'Transferência',investment:'Aporte',card_purchase:'Compra no cartão',card_payment:'Pagamento de fatura'},escape=value=>`"${String(value??'').replace(/"/g,'""')}"`,rows=[['Data','Tipo','Descrição','Categoria','Valor (R$)','Conta/cartão','Fatura'],...finance.transactions.map(t=>[t.date,labels[t.type],t.description,t.category||'',t.amount.toFixed(2).replace('.',','),finance.accounts.find(a=>a.id===t.accountId)?.name||finance.cards.find(c=>c.id===t.cardId)?.name||'',t.invoiceMonth||''])];
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(escape).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`controle-financeiro-${dateISO()}.csv`;a.click();URL.revokeObjectURL(url);
 };

 const importCsv=async()=>{
  if(!csvAccount)return notify('Cadastre ou selecione uma conta antes da importação.');
  const selected=csvRows.filter(r=>r.selected&&!r.duplicate);
  if(!selected.length)return notify('Não há linhas novas selecionadas para importar.');
  const next=structuredClone(finance);
  next.transactions.push(...selected.map(r=>({id:crypto.randomUUID(),type:r.type==='review'?'expense':r.type,accountId:csvAccount,amount:r.amount,date:r.date,description:r.description,category:r.category||csvCategory,needsReview:r.type==='review'||(r.category||csvCategory)==='Outros',importFingerprint:csvFingerprint(r)})));
  if(await commit(markScheduleCandidates(next),`${selected.length} lançamentos importados e distribuídos nas categorias.`))setCsvRows(null);
 };

 const saveBudget=async e=>{
  e?.preventDefault?.();
  const next=structuredClone(finance);
  next.budgets[month]=Object.fromEntries(categories.map(c=>[c,Number(budgetValues[c]||0)]));
  await commit(markScheduleCandidates(next),`Orçamento de ${fmtMonth(month)} salvo.`);
 };

 const addCategory=async e=>{
  e.preventDefault();
  const form=e.currentTarget,d=new FormData(form),name=String(d.get('category')).trim().slice(0,60);
  if(!name)return;
  const next=structuredClone(finance);
  next.categories=[...new Set([...(next.categories||[]),name])];
  if(await commit(next,'Categoria criada.'))form.reset();
 };

 const runBenchmarks=async selected=>{
  setPeriod(selected);setBenchmarkLoading(true);
  try{
   const startDate=periodStartDate(state,selected),response=await fetch(`/api/benchmarks?period=${selected}&startDate=${startDate}`),data=await response.json();
   if(!response.ok)throw new Error(data.error||'Não foi possível carregar as referências.');
   setBenchmark(data);
  }catch(e){setBenchmark({error:e.message,results:[]});}
  finally{setBenchmarkLoading(false);}
 };

 const moveMonth=offset=>{
  const target=shiftMonth(month,offset);
  if(target>=minMonth&&target<='2099-12')setMonth(target);
 };

 const selectedDate=month===today?dateISO():`${month}-01`;
 const personalReturn=moneyWeightedReturn(state,periodStartDate(state,period));
 const visibleTransactions=filterFinanceTransactions(finance,month,{type:filterType,category:filterCategory,source:filterAccount,status:filterStatus,financial:filterFinancial,search});
 const monthInvoices=invoices.filter(i=>i.invoiceMonth===month||i.dueDate.slice(0,7)===month);
 const closing=financeMonthClosing(finance,month);
 const upcoming=upcomingFinanceObligations(finance,dateISO(),45);

 const categorizedTotal=Object.values(summary.expensesByCategory).reduce((sum,value)=>sum+value,0);
 const allBudgetRows=categories.map(category=>{
  const spent=summary.expensesByCategory[category]||0;
  const limit=Number(budgetValues[category]??summary.budget[category]??0);
  const percent=limit>0?spent/limit*100:categorizedTotal>0?spent/categorizedTotal*100:0;
  const shareOfTotal=categorizedTotal>0?spent/categorizedTotal*100:0;
  return {category,spent,limit,percent,shareOfTotal,status:limit&&percent>=100?'over':limit&&percent>=80?'near':'normal'};
 });
 const activeBudgetRows=allBudgetRows.filter(row=>row.spent||row.limit).sort((a,b)=>b.spent-a.spent||b.limit-a.limit);
 const expenseDistributionRows=allBudgetRows.filter(row=>row.spent>0).sort((a,b)=>b.spent-a.spent);
 const visibleExpenseRows=showAllCategories?expenseDistributionRows:expenseDistributionRows.slice(0,4);
 const visibleBudgetRows=showAllBudgets?activeBudgetRows:activeBudgetRows.slice(0,4);
 const visibleUpcoming=showAllUpcoming?upcoming:upcoming.slice(0,4);
 const totalBudgeted=allBudgetRows.reduce((sum,row)=>sum+row.limit,0);
 const overBudgetCount=allBudgetRows.filter(row=>row.status==='over').length;
 const openInvoicesTotal=monthInvoices.reduce((sum,inv)=>sum+inv.open,0);

 const othersTransactionsAll=useMemo(()=>finance.transactions.filter(t=>['expense','card_purchase'].includes(t.type)&&(!t.category||t.category==='Outros')),[finance.transactions]);
 const othersTransactionsMonth=useMemo(()=>othersTransactionsAll.filter(t=>monthOf(t.date)===month),[othersTransactionsAll,month]);

 return <div className="finance-page">
  <div className="finance-context-nav">
   <div className="finance-monthbar">
    <div className="finance-monthbar-title">
     <span className="eyebrow">COMPETÊNCIA FINANCEIRA</span>
     <div className="month-title-with-badge">
      <h2>{fmtMonth(month)}</h2>
      <span className={`tag ${closing.closed?'green':'neutral'}`}>{month===today?'Mês atual':closing.closed?'Mês fechado':'Aberto'}</span>
     </div>
    </div>
    <div className="finance-month-controls">
     <button className="secondary icon-button" aria-label="Mês anterior" disabled={month<=minMonth} onClick={()=>moveMonth(-1)}><ArrowLeft size={17}/></button>
     <input id="finance-month" type="month" aria-label="Selecionar mês" min={minMonth} max="2099-12" value={month} onChange={e=>{if(e.target.value>=minMonth&&e.target.value<='2099-12')setMonth(e.target.value);}}/>
     <button className="secondary icon-button" aria-label="Próximo mês" disabled={month>='2099-12'} onClick={()=>moveMonth(1)}><ArrowRight size={17}/></button>
     <button className="secondary compact-btn" onClick={()=>setMonth(today)}>Hoje</button>
     <button type="button" className="primary compact-btn" aria-expanded={quickAddOpen} onClick={()=>setQuickAddOpen(!quickAddOpen)}>
      <Plus size={15}/>{quickAddOpen?'Fechar lançamento':'Lançamento rápido'}
     </button>
     <button type="button" className="secondary compact-btn" onClick={()=>openFullModalWithDraft('installments')}>
      <Repeat size={14}/>Parcelar / Fixo
     </button>
    </div>
   </div>

   <nav className="finance-sections" aria-label="Visões do controle financeiro">
    {SECTIONS.map(([id,label,Icon])=><button key={id} className={section===id?'active':''} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}>
     <Icon size={15}/>
     {label}
     {id==='statement'&&pendingCount>0&&<span className="finance-section-count">{pendingCount}</span>}
     {id==='planning'&&overBudgetCount>0&&<span className="finance-section-count danger-badge">{overBudgetCount}</span>}
     {id==='import'&&othersTransactionsAll.length>0&&<span className="finance-section-count">{othersTransactionsAll.length}</span>}
    </button>)}
   </nav>
  </div>

  {/* Gaveta de Lançamento Rápido sob demanda */}
  {quickAddOpen&&<section className="panel quick-add-shell" aria-label="Lançamento rápido">
   <div className="quick-add-drawer-head">
    <div>
     <strong>Novo lançamento rápido</strong>
     <small className="muted">Despesa, cartão, receita ou aporte com categoria automática</small>
    </div>
    <div className="button-row">
     <button type="button" className="secondary compact-btn" onClick={()=>openFullModalWithDraft('installments')}>
      <SlidersHorizontal size={14}/>Opções de parcelamento
     </button>
     <button type="button" className="secondary compact-btn" onClick={()=>setQuickAddOpen(false)}>Fechar</button>
    </div>
   </div>

   <form className="quick-add-form is-open" onSubmit={handleQuickSubmit}>
    <div className="quick-type-pills" role="group" aria-label="Tipo de lançamento rápido">
     {[
      ['expense','Despesa'],
      ['card_purchase','Cartão (1x)'],
      ['income','Receita'],
      ['investment','Aporte']
     ].map(([id,label])=><button key={id} type="button" className={`quick-type-pill ${quick.type===id?'active':''}`} data-type={id} onClick={()=>setQuick({...quick,type:id,category:id==='income'?'Salário':prevCategoryForType(id,quick.category)})}>
      {label}
     </button>)}
    </div>

    <div className="quick-add-inputs">
     <input
      aria-label="Descrição rápida"
      placeholder={quick.type==='card_purchase'?'Ex.: Supermercado no crédito, Uber, Restaurante…':quick.type==='income'?'Ex.: Salário, Reembolso, Dividendo…':quick.type==='investment'?'Ex.: Aporte mensal CDB / FIIs…':'Ex.: Padaria, Enel, Farmácia, Condomínio…'}
      maxLength={160}
      value={quick.description}
      onChange={e=>handleQuickDescriptionChange(e.target.value)}
      required
     />
     <input
      aria-label="Valor rápido (R$)"
      type="number"
      min="0.01"
      step="0.01"
      placeholder="Valor R$ 0,00"
      value={quick.amount}
      onChange={e=>setQuick({...quick,amount:e.target.value})}
      required
     />
     {quick.type==='investment'?<select aria-label="Investimento de destino" value={quick.assetId} onChange={e=>setQuick({...quick,assetId:e.target.value})}>
      {state.assets.filter(a=>a.id!=='cash').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>:<select aria-label="Categoria rápida" value={quick.category} onChange={e=>setQuick({...quick,category:e.target.value,categoryTouched:true})}>
      {categories.map(c=><option key={c} value={c}>{c}</option>)}
     </select>}
     {quick.type==='card_purchase'?<select aria-label="Cartão utilizado" value={quick.cardId} onChange={e=>setQuick({...quick,cardId:e.target.value})}>
      {finance.cards.length?finance.cards.map(c=><option key={c.id} value={c.id}>Cartão: {c.name}</option>):<option value="">Sem cartão cadastrado</option>}
     </select>:<select aria-label="Conta utilizada" value={quick.accountId} onChange={e=>setQuick({...quick,accountId:e.target.value})}>
      {finance.accounts.length?finance.accounts.map(a=><option key={a.id} value={a.id}>Conta: {a.name}</option>):<option value="">Sem conta cadastrada</option>}
     </select>}
     <input
      aria-label="Data do lançamento"
      type="date"
      value={quick.date}
      max="2099-12-31"
      onChange={e=>setQuick({...quick,date:e.target.value})}
      required
     />
     <div className="quick-add-actions">
      <button type="submit" className="primary" disabled={busy}><Plus size={16}/>Registrar</button>
     </div>
    </div>
   </form>
  </section>}

  {entryOpen&&<FinanceEntry state={state} date={selectedDate} categories={categories} invoices={invoices} legacy={legacyEntry} initialType={entryType} initialDraft={entrySeed} onSave={onSave} onClose={()=>{setEntryOpen(false);setLegacyEntry(null);setEntrySeed(null);}}/>}

  {/* Banner de pendências quando houver itens para conciliar */}
  {pendingCount>0&&section!=='statement'&&<div className="panel pending-alert-strip">
   <div>
    <strong>Há {pendingCount} movimentação(ões) aguardando revisão em {fmtMonth(month)}</strong>
    <p className="muted small">Confirme categorias de itens sincronizados, duplicidades ou aportes.</p>
   </div>
   <div className="button-row">
    {othersTransactionsMonth.length>0&&<button type="button" className="secondary compact-btn" disabled={busy} onClick={()=>handleRecategorize(true)}>
     <FolderSync size={14}/>Distribuir categorias
    </button>}
    <button type="button" className="primary compact-btn" onClick={()=>{setSection('statement');setStatementSubView('review');}}>
     <Check size={15}/>Revisar agora
    </button>
   </div>
  </div>}

  {/* ========================================================================
      VISÃO 1: VISÃO MENSAL (Painel Executivo Enxuto + Distribuição)
     ======================================================================== */}
  {section==='overview'&&<>
   <Stats summary={summary} display={display} onOpen={(type,status)=>{
    setFilterType(type);
    setFilterStatus(status==='confirmed'?'confirmed':'all');
    setFilterFinancial(status==='scheduled'?'scheduled':status==='confirmed'?'realized':'all');
    setFilterAccount('all');
    setFilterCategory('all');
    setSearch('');
    setStatementSubView('list');
    setSection('statement');
   }}/>

   {/* Painel Principal de Distribuição das Despesas por Categoria */}
   <Card
    title={`Despesas por categoria · ${fmtMonth(month)}`}
    subtitle="Toque em uma categoria para abrir os lançamentos correspondentes no extrato."
    action={<div className="button-row">
     {othersTransactionsMonth.length>0&&<button type="button" className="secondary compact-btn" disabled={busy} onClick={()=>handleRecategorize(true)}>
      <FolderSync size={14}/>Reclassificar “Outros” ({othersTransactionsMonth.length})
     </button>}
     <button type="button" className="text-button" onClick={()=>setSection('planning')}>Ajustar tetos <ArrowRight size={14}/></button>
    </div>}
   >
    {expenseDistributionRows.length>0?<>
     <div className="category-stacked-bar" aria-label="Proporção de gastos por categoria">
      {expenseDistributionRows.map((row,idx)=><div
       key={row.category}
       style={{width:`${Math.max(2,row.shareOfTotal)}%`,background:row.category==='Outros'?'#9b9891':CATEGORY_SWATCHES[idx%CATEGORY_SWATCHES.length]}}
       title={`${row.category}: ${display(row.spent)} (${Math.round(row.shareOfTotal)}%)`}
      />)}
     </div>

     <div className="category-distribution-grid">
      {visibleExpenseRows.map((row,idx)=>{
       const swatch=row.category==='Outros'?'#9b9891':CATEGORY_SWATCHES[idx%CATEGORY_SWATCHES.length];
       return <button
        type="button"
        key={row.category}
        className={`category-dist-card ${row.status==='over'?'is-over':''} ${row.category==='Outros'?'is-others':''}`}
        onClick={()=>{
         setFilterType('all');
         setFilterCategory(row.category);
         setFilterStatus('all');
         setFilterFinancial('all');
         setStatementSubView('list');
         setSection('statement');
        }}
       >
        <div className="category-dist-head">
         <span className="category-dist-label">
          <i className="category-swatch" style={{background:swatch}}/>
          <strong>{row.category}</strong>
         </span>
         <span className="category-dist-share">{Math.round(row.shareOfTotal)}%</span>
        </div>
        <strong className="category-dist-amount">{display(row.spent)}</strong>
        <div className="category-dist-foot">
         <span>{row.limit>0?`Teto ${display(row.limit)} (${Math.round(row.percent)}%)`:'Sem teto definido'}</span>
         <span className="category-dist-link">Extrato →</span>
        </div>
       </button>;
      })}
     </div>
     {expenseDistributionRows.length>4&&<div className="button-row spaced">
      <button type="button" className="secondary compact-btn" onClick={()=>setShowAllCategories(!showAllCategories)}>
       {showAllCategories?'Mostrar apenas as 4 principais':`Ver todas as ${expenseDistributionRows.length} categorias`}
      </button>
     </div>}
    </>:<p className="muted">Nenhuma despesa registrada em {fmtMonth(month)} até o momento.</p>}
   </Card>

   <section className="two-cols">
    <Card title="Contas bancárias & liquidez" subtitle={`Total disponível: ${display(summary.cash)}`} action={<button className="text-button" onClick={()=>setSection('cards_accounts')}>Gerenciar <ArrowRight size={14}/></button>}>
     <div className="finance-list">
      {finance.accounts.slice(0,4).map(a=><div className="finance-row finance-row-with-actions" key={a.id}>
       <span className="finance-row-icon"><Wallet size={17}/></span>
       <span>
        <strong>{a.name}</strong>
        <small>{a.type==='checking'?'Conta corrente':a.type==='savings'?'Poupança':'Dinheiro / Carteira'}</small>
       </span>
       <div className="finance-row-actions">
        <strong>{display(summary.balances[a.id]||0)}</strong>
        <button type="button" className="icon-button" aria-label={`Editar conta ${a.name}`} onClick={()=>setEditingAccount(a)}><Pencil size={14}/></button>
       </div>
      </div>)}
     </div>
     {!finance.accounts.length&&<p className="muted">Cadastre sua conta bancária para acompanhar entradas e saídas.</p>}
     <div className="button-row spaced">
      <button className="secondary compact-btn" onClick={()=>{setSection('cards_accounts');setShowAccount(true);}}><Plus size={14}/>Nova conta</button>
      {finance.accounts.length>4&&<button className="text-button" onClick={()=>setSection('cards_accounts')}>Ver todas ({finance.accounts.length}) <ArrowRight size={14}/></button>}
     </div>
    </Card>

    <Card title="Faturas de cartão no mês" subtitle={openInvoicesTotal>0?`Em aberto: ${display(openInvoicesTotal)}`:'Nenhuma fatura pendente'} action={<button className="text-button" onClick={()=>setSection('cards_accounts')}>Ver cartões <ArrowRight size={14}/></button>}>
     <div className="finance-list">
      {monthInvoices.slice(0,4).map(i=><div className="finance-row finance-row-with-actions" key={`${i.cardId}-${i.invoiceMonth}`}>
       <span className="finance-row-icon"><CreditCard size={17}/></span>
       <span>
        <strong>{i.cardName}</strong>
        <small>Vence {fmtDate(i.dueDate)} · Total {display(i.total)}</small>
       </span>
       <div className="finance-row-actions">
        <strong className={i.open>0?'negative':'positive-text'}>{i.open>0?display(i.open):'Paga'}</strong>
        {i.open>0&&<button type="button" className="primary compact-action" disabled={busy} onClick={()=>quickPayInvoice(i)}><Check size={14}/>Pagar</button>}
       </div>
      </div>)}
     </div>
     {!monthInvoices.length&&<p className="muted">Nenhuma fatura com vencimento ou compras neste mês.</p>}
     <div className="button-row spaced">
      <button className="secondary compact-btn" onClick={()=>{setSection('cards_accounts');setShowCard(true);}}><Plus size={14}/>Novo cartão</button>
     </div>
    </Card>
   </section>

   <section className="two-cols">
    <Card title="Termômetro do orçamento" subtitle={totalBudgeted>0?`Teto total: ${display(totalBudgeted)}`:'Acompanhe os limites mensais'} action={<button className="text-button" onClick={()=>setSection('planning')}>Editar limites <ArrowRight size={14}/></button>}>
     {activeBudgetRows.length?<div className="finance-budget-summary">
      {visibleBudgetRows.map(({category,spent,limit,percent,status})=><article className="finance-budget-item" data-status={status} key={category}>
       <div className="finance-budget-item-heading"><strong>{category}</strong><strong>{display(spent)}</strong></div>
       <div className="finance-budget-item-sub">
        <span>{limit?`${Math.round(percent)}% do teto`:`${Math.round(percent)}% dos gastos`}</span>
        <span>{limit?`Teto ${display(limit)}`:'Sem teto'}</span>
       </div>
       <div className="finance-budget-track"><i style={{width:`${Math.min(100,percent)}%`}}/></div>
      </article>)}
      {activeBudgetRows.length>4&&<button type="button" className="text-button" onClick={()=>setShowAllBudgets(!showAllBudgets)}>
       {showAllBudgets?'Mostrar menos':`Ver todas as ${activeBudgetRows.length} categorias →`}
      </button>}
     </div>:<p className="muted">Registre despesas ou defina tetos em Planejamento & Orçamento.</p>}
    </Card>

    <Card title="Próximos vencimentos" subtitle="Compromissos para os próximos 45 dias" action={<button className="text-button" onClick={()=>{setSection('statement');setStatementSubView('calendar');}}>Calendário <ArrowRight size={14}/></button>}>
     <div className="finance-list">
      {visibleUpcoming.map(item=><div className="finance-row" key={item.id}>
       <span className="finance-row-icon">{item.kind==='invoice'?<CreditCard size={17}/>:<Repeat size={17}/>}</span>
       <span>
        <strong>{item.label}</strong>
        <small>Vence {fmtDate(item.date)} · {item.kind==='invoice'?'Fatura':'Programado'}</small>
       </span>
       <strong>{display(item.amount)}</strong>
      </div>)}
     </div>
     {!upcoming.length&&<p className="muted">Nenhum compromisso pendente para os próximos 45 dias.</p>}
     {upcoming.length>4&&<div className="button-row spaced">
      <button type="button" className="text-button" onClick={()=>setShowAllUpcoming(!showAllUpcoming)}>
       {showAllUpcoming?'Mostrar menos':`Ver todos os ${upcoming.length} vencimentos →`}
      </button>
     </div>}
    </Card>
   </section>

   <Card title={`Fechamento contábil de ${fmtMonth(month)}`} icon={Check}>
    <div className="finance-closing">
     <div>
      <strong>{month===today?'Mês em andamento':closing.closed?closing.stale?'Fechamento precisa de revisão':'Mês fechado e conferido':!finance.accounts.length?'Cadastre uma conta para conferir':!finance.transactions.some(t=>monthOf(t.date)===month)?'Sem lançamentos para conferir':'Pronto para fechar'}</strong>
      <p className="muted">{month===today?'O fechamento fica disponível após o encerramento do mês.':closing.stale?'Os lançamentos ou faturas mudaram após o fechamento. Reabra e confirme novamente.':closing.closed?`Conferido em ${new Date(closing.closedAt).toLocaleString('pt-BR')}.`:summary.review.count?`Há ${summary.review.count} pendência(s) neste mês. Revise antes de fechar.`:'Conferir o mês registra um marco de auditoria familiar sem bloquear edições futuras.'}</p>
     </div>
     {month!==today&&<button className="secondary" disabled={busy||(!closing.closed&&(summary.review.count>0||!finance.accounts.length||!finance.transactions.some(t=>monthOf(t.date)===month)))} onClick={toggleMonthClosing}>{closing.closed?'Reabrir mês':'Fechar mês'}</button>}
    </div>
   </Card>
  </>}

  {/* ========================================================================
      VISÃO 2: EXTRATO & PROGRAMADOS (Unificado + Calendário + Revisão)
     ======================================================================== */}
  {section==='statement'&&<>
   <div className="statement-mode-bar">
    <div className="segmented-control" style={{marginBottom:0}}>
     <button type="button" aria-pressed={statementSubView==='list'} onClick={()=>setStatementSubView('list')}>
      <ReceiptText size={15}/>Extrato unificado ({visibleTransactions.length})
     </button>
     <button type="button" aria-pressed={statementSubView==='calendar'} onClick={()=>setStatementSubView('calendar')}>
      <CalendarDays size={15}/>Programados & Calendário
     </button>
     {(pendingCount>0||statementSubView==='review')&&<button type="button" aria-pressed={statementSubView==='review'} onClick={()=>setStatementSubView('review')}>
      <Check size={15}/>Pendências de revisão ({pendingCount})
     </button>}
    </div>
    <div className="button-row">
     <button type="button" className="secondary compact-btn" onClick={exportFinanceCsv}><Download size={14}/>Exportar CSV</button>
     <button type="button" className="primary compact-btn" onClick={()=>openFullModalWithDraft('monthly')}><Plus size={15}/>Nova programação</button>
    </div>
   </div>

   {statementSubView==='list'&&<FinanceTransactionList
    transactions={visibleTransactions}
    categories={categories}
    accounts={finance.accounts}
    cards={finance.cards}
    types={TYPES}
    filters={{type:filterType,category:filterCategory,source:filterAccount,status:filterStatus,financial:filterFinancial,search}}
    onFilter={changeFilter}
    display={display}
    onCategory={updateCategory}
    onDelete={deleteTransaction}
    onInlineSave={inlineSaveTransaction}
    onAutoCategorize={()=>handleRecategorize(true)}
    onCreateRuleFromTx={handleCreateRuleFromTx}
    pendingCount={pendingCount}
    onEdit={tx=>{
     if(tx.scheduleId){
      setStatementSubView('calendar');
      notify('Selecione a ocorrência na lista ou calendário de Programados para reagendar.');
     }else{
      setEditingTransaction(tx);
     }
    }}
   />}

   {statementSubView==='calendar'&&<Programmed
    finance={finance}
    month={month}
    categories={categories}
    display={display}
    invoices={invoices}
    onCards={()=>setSection('cards_accounts')}
    onSave={commit}
    onNew={legacy=>{setLegacyEntry(legacy||null);setEntryType(legacy?.type||'expense');setEntryOpen(true);}}
   />}

   {statementSubView==='review'&&<>
    <Card
     title={`Pendências de revisão · ${fmtMonth(month)}`}
     subtitle="Confirme categorias de itens sincronizados, possíveis duplicados ou vincule aportes à carteira"
     action={othersTransactionsMonth.length>0&&<button type="button" className="secondary compact-btn" disabled={busy} onClick={()=>handleRecategorize(false)}><FolderSync size={14}/>Reclassificar por regras</button>}
    >
     <div className="finance-review-list">
      {pending.map(tx=><article className="finance-review-item" key={tx.id}>
       <div className="finance-review-copy">
        <strong>{tx.description}</strong>
        <small>{fmtDate(tx.date)} · {TYPES[tx.type]} · {display(tx.amount)}</small>
        <small>{tx.possibleDuplicate?'Possível duplicado':tx.possibleTransfer?'Possível transferência':tx.bankInvestment?'Aplicação financeira':'Revise a categoria atribuída na sincronização'}</small>
       </div>
       {tx.bankInvestment?<>
        <label>Vincular à posição
         <select value={links[tx.id]||tx.suggestedAssetId||''} onChange={e=>setLinks({...links,[tx.id]:e.target.value})}>
          <option value="">Selecione uma posição</option>
          {state.assets.filter(a=>a.id!=='cash').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
         </select>
        </label>
        <button className="primary compact-btn" onClick={()=>decideTransaction(tx,'confirm-investment')} disabled={busy}>Confirmar aporte</button>
        <button className="secondary compact-btn" onClick={()=>decideTransaction(tx,'reject')} disabled={busy}>Manter só no histórico</button>
       </>:<>
        <label>Categoria
         <select aria-label={`Categoria de revisão para ${tx.description}`} value={tx.category||'Outros'} onChange={e=>updateCategory(tx,e.target.value)}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
         </select>
        </label>
        {tx.matchingManualTransactionIds?.length>1&&<label>Registro correspondente
         <select value={duplicateLinks[tx.id]||tx.matchingManualTransactionId} onChange={e=>setDuplicateLinks({...duplicateLinks,[tx.id]:e.target.value})}>
          {tx.matchingManualTransactionIds.map(id=>{const match=finance.transactions.find(t=>t.id===id);return <option key={id} value={id}>{match?.description} · {match?.date} · {display(match?.amount||0)}</option>;})}
         </select>
        </label>}
        {tx.matchingManualTransactionId&&<button className="primary compact-btn" onClick={()=>decideTransaction(tx,'link-duplicate')} disabled={busy}>Vincular duplicado</button>}
        <button className="secondary compact-btn" onClick={()=>decideTransaction(tx,'confirm')} disabled={busy}>Confirmar</button>
        <button className="secondary compact-btn" onClick={()=>decideTransaction(tx,'reject')} disabled={busy}>Ignorar</button>
       </>}
      </article>)}
     </div>
     {!pending.length&&!positionPending.length&&<p className="notice">Nenhuma pendência para revisar em {fmtMonth(month)}.</p>}
    </Card>
    {(finance.pluggy?.review||[]).filter(r=>r.needsReview).map(review=><Card key={review.id} title="Conflito de saldo de investimento" icon={Wallet}>
     <p>O saldo manual de {fmtDate(review.manualDate)} difere da posição remota em {fmtDate(review.remoteDate)}.</p>
     <p>Manual: <strong>{display(state.events.find(e=>e.assetId===review.assetId&&e.kind==='saldo'&&e.date===review.manualDate)?.amount||0)}</strong> · Remoto: <strong>{display(review.remoteBalance)}</strong></p>
     <div className="button-row">
      <button className="primary" onClick={()=>decidePositionConflict(review,true)} disabled={busy}>Usar saldo remoto</button>
      <button className="secondary" onClick={()=>decidePositionConflict(review,false)} disabled={busy}>Manter saldo manual</button>
     </div>
    </Card>)}
   </>}
  </>}

  {/* ========================================================================
      VISÃO 3: CARTÕES & CONTAS (Painel Unificado Lado a Lado)
     ======================================================================== */}
  {section==='cards_accounts'&&<>
   <section className="finance-layout">
    {/* Coluna 1: Contas Bancárias */}
    <Card
     title="Contas bancárias e carteira"
     subtitle={`Liquidez total em ${fmtDate(asOf)}: ${display(summary.cash)}`}
     action={<button type="button" className="secondary compact-btn" onClick={()=>setShowAccount(!showAccount)}><Plus size={15}/>{showAccount?'Fechar':'Nova conta'}</button>}
    >
     {showAccount&&<form className="inline-form spaced" style={{marginTop:0,marginBottom:18}} onSubmit={addAccount}>
      <label>Nome da conta<input name="name" required maxLength="80" placeholder="Ex.: Santander Conta Corrente, Itaú, Nubank…"/></label>
      <div className="form-grid">
       <label>Tipo<select name="type"><option value="checking">Conta corrente</option><option value="savings">Poupança / Reserva</option><option value="cash">Dinheiro / Carteira</option></select></label>
       <label>Saldo inicial (R$)<input name="openingBalance" type="number" step=".01" defaultValue="0"/></label>
      </div>
      <label>Data do saldo inicial<input name="openingDate" type="date" min={FINANCE_HISTORY_START} max={dateISO()} defaultValue={dateISO()}/></label>
      <div className="button-row">
       <button className="primary compact-btn" disabled={busy}>Salvar conta</button>
       <button type="button" className="secondary compact-btn" onClick={()=>setShowAccount(false)}>Cancelar</button>
      </div>
     </form>}

     <div className="accounts-cards-stack">
      {finance.accounts.map(a=>{
       const bal=balances[a.id]||0;
       return <article className="unified-account-card" key={a.id}>
        <div className="unified-account-top">
         <span className="finance-row-icon"><Wallet size={18}/></span>
         <div>
          <strong>{a.name}</strong>
          <small>{a.type==='checking'?'Conta corrente':a.type==='savings'?'Poupança':'Dinheiro'} · Desde {fmtDate(a.openingDate)}</small>
         </div>
         <strong className={`unified-account-balance ${bal<0?'negative':''}`}>{display(bal)}</strong>
        </div>
        <div className="unified-account-actions">
         <button type="button" className="text-button" onClick={()=>{setFilterAccount(`account:${a.id}`);setStatementSubView('list');setSection('statement');}}>Ver extrato →</button>
         <div className="button-row">
          <button type="button" className="secondary compact-action" aria-label={`Editar conta ${a.name}`} onClick={()=>setEditingAccount(a)}><Pencil size={13}/>Editar</button>
          <button type="button" className="icon-button" aria-label={`Excluir conta ${a.name}`} onClick={()=>deleteAccount(a)}><Trash2 size={15}/></button>
         </div>
        </div>
       </article>;
      })}
     </div>
     {!finance.accounts.length&&<p className="muted">Nenhuma conta cadastrada. Adicione sua primeira conta acima.</p>}
    </Card>

    {/* Coluna 2: Cartões de Crédito & Faturas */}
    <Card
     title="Cartões de crédito & faturas"
     subtitle={`Em aberto em ${fmtMonth(month)}: ${display(openInvoicesTotal)}`}
     action={<button type="button" className="secondary compact-btn" onClick={()=>setShowCard(!showCard)}><Plus size={15}/>{showCard?'Fechar':'Novo cartão'}</button>}
    >
     {showCard&&<form className="inline-form spaced" style={{marginTop:0,marginBottom:18}} onSubmit={addCard}>
      <label>Nome do cartão<input name="name" required maxLength="80" placeholder="Ex.: Santander Unique Visa, Nubank Ultravioleta…"/></label>
      <label>Conta de débito da fatura
       <select name="accountId" required>
        {finance.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
       </select>
      </label>
      <div className="form-grid">
       <label>Dia de fechamento<input name="closeDay" type="number" min="1" max="28" defaultValue="10" required/></label>
       <label>Dia de vencimento<input name="dueDay" type="number" min="1" max="28" defaultValue="20" required/></label>
      </div>
      <div className="button-row">
       <button className="primary compact-btn" disabled={busy||!finance.accounts.length}>Salvar cartão</button>
       <button type="button" className="secondary compact-btn" onClick={()=>setShowCard(false)}>Cancelar</button>
      </div>
     </form>}

     <div className="accounts-cards-stack">
      {finance.cards.map(c=>{
       const cardInvoice=monthInvoices.find(i=>i.cardId===c.id)||{cardId:c.id,cardName:c.name,invoiceMonth:month,dueDate:`${month}-${String(c.dueDay).padStart(2,'0')}`,total:0,paid:0,open:0,purchases:[]};
       const paidPct=cardInvoice.total>0?Math.min(100,cardInvoice.paid/cardInvoice.total*100):(cardInvoice.open===0?100:0);
       const linkedAcc=finance.accounts.find(a=>a.id===c.accountId)?.name||'Conta não encontrada';
       const lastDigits=String(1000+([...String(c.id||c.name)].reduce((acc,ch)=>acc*31+ch.charCodeAt(0),7)&8999)).slice(-4);
       return <article className="unified-credit-card" key={c.id}>
        <div className="credit-card-visual-face">
         <div className="credit-card-visual-top">
          <span className="credit-card-chip" aria-hidden="true"/>
          <span className="credit-card-brand">CARTÃO DE CRÉDITO</span>
         </div>
         <div className="credit-card-visual-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;{lastDigits}</div>
         <div className="credit-card-visual-bottom">
          <div>
           <small>Cartão</small>
           <strong>{c.name}</strong>
          </div>
          <div>
           <small>Fecha / Vence</small>
           <strong>{String(c.closeDay).padStart(2,'0')}/{String(c.dueDay).padStart(2,'0')}</strong>
          </div>
          <div>
           <small>Débito</small>
           <strong>{linkedAcc}</strong>
          </div>
         </div>
        </div>
        <div className="unified-card-head">
         <span className="finance-row-icon"><CreditCard size={18}/></span>
         <div>
          <strong>{c.name}</strong>
          <small>Fecha dia {c.closeDay} · Vence dia {c.dueDay} · Débito em {linkedAcc}</small>
         </div>
         <button type="button" className="secondary compact-action" aria-label={`Editar cartão ${c.name}`} onClick={()=>setEditingCard(c)}><Pencil size={13}/>Editar</button>
        </div>

        <div className="unified-invoice-box">
         <div className="unified-invoice-metrics">
          <div>
           <small>Fatura {cardInvoice.invoiceMonth}</small>
           <strong>{display(cardInvoice.total)}</strong>
          </div>
          <div>
           <small>Pago</small>
           <strong className="positive-text">{display(cardInvoice.paid)}</strong>
          </div>
          <div>
           <small>Em aberto</small>
           <strong className={cardInvoice.open>0?'negative':''}>{display(cardInvoice.open)}</strong>
          </div>
         </div>
         <div className="custom-progress-track">
          <i style={{width:`${paidPct}%`,background:cardInvoice.open>0?'var(--warning)':'var(--success)'}}/>
         </div>
         <div className="unified-invoice-footer">
          <span className={`tag ${cardInvoice.open===0&&cardInvoice.total>0?'green':cardInvoice.open>0?'amber':'neutral'}`}>
           {cardInvoice.open===0&&cardInvoice.total>0?'Fatura paga':cardInvoice.open>0?`Aberta · Vence ${fmtDate(cardInvoice.dueDate)}`:'Sem compras nesta fatura'}
          </span>
          <div className="button-row">
           <button type="button" className="text-button" onClick={()=>{setFilterAccount(`card:${c.id}`);setStatementSubView('list');setSection('statement');}}>Ver no extrato →</button>
           {cardInvoice.open>0&&<button type="button" className="primary compact-action" disabled={busy} onClick={()=>quickPayInvoice(cardInvoice)}><Check size={14}/>Pagar fatura</button>}
          </div>
         </div>
        </div>

        {cardInvoice.purchases?.length>0&&<details className="card-purchases-drawer">
         <summary>Ver {cardInvoice.purchases.length} compra(s) / parcela(s) desta fatura</summary>
         <div className="card-purchases-list">
          {cardInvoice.purchases.map((p,idx)=><div className="card-purchase-item" key={idx}>
           <span>
            <strong>{p.description}</strong>
            <small>{p.category||'Outros'} · Venc. {fmtDate(p.dueDate)}</small>
           </span>
           <strong>{display(p.amount)}</strong>
          </div>)}
         </div>
        </details>}
       </article>;
      })}
     </div>
     {!finance.cards.length&&<p className="muted">Cadastre seu cartão para controlar faturas, fechamento, parcelamentos e pagamento em 1 clique.</p>}
    </Card>
   </section>
  </>}

  {/* ========================================================================
      VISÃO 4: PLANEJAMENTO & ORÇAMENTO (Edição Direta na Mesma Tela + Futuro)
     ======================================================================== */}
  {section==='planning'&&<>
   <Card
    title={`Orçamento por categoria · ${fmtMonth(month)}`}
    subtitle="Ajuste o teto mensal diretamente em cada cartão. Compras no cartão entram pela competência."
    action={<button type="button" className="primary compact-btn" disabled={busy} onClick={saveBudget}><Check size={15}/>Salvar orçamento do mês</button>}
   >
    <div className="finance-budget-overview">
     <div><span>Total orçado no mês</span><strong>{display(totalBudgeted)}</strong><small>{fmtMonth(month)}</small></div>
     <div><span>Gasto acumulado</span><strong>{display(categorizedTotal)}</strong><small>{totalBudgeted>0?`${Math.round(categorizedTotal/totalBudgeted*100)}% do orçamento total`:'Defina limites abaixo'}</small></div>
     <div><span>Saldo do orçamento</span><strong className={totalBudgeted-categorizedTotal<0?'negative':'positive-text'}>{display(Math.max(0,totalBudgeted-categorizedTotal))}</strong><small>{overBudgetCount?`${overBudgetCount} categoria(s) acima do teto`:'Todas dentro do limite'}</small></div>
    </div>

    <form onSubmit={saveBudget}>
     <div className="finance-budget-summary editable-budget-grid">
      {allBudgetRows.map(({category,spent,limit,percent,status})=><article className="finance-budget-item" data-status={status} key={category}>
       <div className="finance-budget-item-heading">
        <strong>{category}</strong>
        <strong className={status==='over'?'finance-over-budget':''}>{display(spent)}</strong>
       </div>
       <div className="finance-budget-track" role="progressbar" aria-label={`${category}: ${Math.round(percent)} por cento`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100,Math.round(percent))}>
        <i style={{width:`${Math.min(100,percent)}%`}}/>
       </div>
       <div className="budget-card-inline-editor">
        <label>
         <span>Teto mensal (R$)</span>
         <input
          aria-label={`Limite para ${category}`}
          type="number"
          min="0"
          step="10"
          placeholder="Sem teto"
          value={budgetValues[category]??''}
          onChange={e=>setBudgetValues({...budgetValues,[category]:e.target.value})}
         />
        </label>
        <small className={status==='over'?'finance-over-budget':'muted'}>
         {limit>0?(spent>limit?`Excedido em ${display(spent-limit)}`:`Restam ${display(limit-spent)} (${Math.round(percent)}%)`):'Sem limite definido'}
        </small>
       </div>
      </article>)}
     </div>
     <div className="button-row spaced">
      <button type="submit" className="primary" disabled={busy}><Check size={16}/>Salvar limites de {fmtMonth(month)}</button>
     </div>
    </form>

    <form className="inline-form spaced" onSubmit={addCategory}>
     <div className="new-category-inline">
      <label style={{margin:0,flex:1}}>Criar nova categoria personalizada
       <input name="category" maxLength="60" placeholder="Ex.: Pets, Educação dos filhos, Viagens…" required/>
      </label>
      <button className="secondary" disabled={busy}><Plus size={15}/>Adicionar categoria</button>
     </div>
    </form>
   </Card>

   <Card title="Previsão de caixa · próximos 6 meses" subtitle="Projeção com base no saldo atual, programações ativas e faturas de cartão conhecidas" icon={ArrowRight}>
    <div className="finance-forecast-grid">
     {projection.months.map(row=><article className="finance-forecast-card" key={row.month}>
      <div className="finance-period-heading">
       <strong>{fmtMonth(row.month)}</strong>
       <span className="finance-forecast-caption">Projeção</span>
      </div>
      <div className="finance-forecast-lines">
       <span>Saldo inicial <b>{display(row.opening)}</b></span>
       <span>Receitas previstas <b>{display(row.income)}</b></span>
       <span>Despesas programadas <b>{display(row.recurringExpenses)}</b></span>
       <span>Faturas conhecidas <b>{display(row.knownBills)}</b></span>
       {row.budgetReference>0&&<span className="finance-forecast-reference">Orçamento referência <b>{display(row.budgetReference)}</b></span>}
      </div>
      <div className={`forecast-closing${row.closing<0?' is-negative':''}`}>
       <span>Saldo final estimado</span>
       <strong>{display(row.closing)}</strong>
      </div>
     </article>)}
    </div>
   </Card>

   <Card title="Comparativo histórico entre meses" subtitle="Evolução de receitas, gastos por competência, aportes e geração de caixa" icon={CalendarDays}>
    <div className="finance-comparison-grid">
     {comparisons.map(row=>{
      const hasTransactions=finance.transactions.some(tx=>monthOf(tx.date)===row.month);
      return <article key={row.month} className={`finance-comparison-card${row.month===month?' is-current':''}${hasTransactions?'':' is-empty'}`}>
       <div className="finance-period-heading">
        <strong>{fmtMonth(row.month)}</strong>
        {row.month===month&&<span className="finance-period-badge">Mês selecionado</span>}
       </div>
       {hasTransactions?<>
        <div className="finance-comparison-metrics">
         <span>Receitas <b>{display(row.income)}</b></span>
         <span>Despesas <b>{display(row.expenses)}</b></span>
         <span>Aportes <b>{display(row.investments)}</b></span>
         <span className="finance-comparison-flow">Fluxo líquido <b>{display(row.netCashFlow)}</b></span>
        </div>
        {Object.entries(row.expensesByCategory).length>0&&<small className="finance-comparison-categories">Maiores gastos: {Object.entries(row.expensesByCategory).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([cat,n])=>`${cat} ${display(n)}`).join(' · ')}</small>}
       </>:<p className="finance-empty-month">Sem movimentações registradas</p>}
      </article>;
     })}
    </div>
   </Card>

   <Card title="Comparação da carteira com CDI, IPCA e Ibovespa">
    <p className="muted">Compare o retorno pessoal ponderado da sua carteira com os principais indicadores oficiais.</p>
    <div className="button-row">
     <label style={{margin:0}}>Período
      <select value={period} onChange={e=>runBenchmarks(e.target.value)}>
       <option value="1">1 mês</option>
       <option value="12">12 meses</option>
       <option value="all">Desde o início</option>
      </select>
     </label>
     {!benchmark&&<button className="secondary" onClick={()=>runBenchmarks(period)} disabled={benchmarkLoading}>Carregar índices oficiais</button>}
    </div>
    {benchmarkLoading&&<p className="muted">Consultando séries do Banco Central e B3…</p>}
    {benchmark?.error&&<p className="notice danger">{benchmark.error}</p>}
    {benchmark&&<div className="benchmark-grid">
     <div><span>Sua carteira (TIR)</span><strong>{personalReturn?`${(personalReturn.total*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:'Histórico insuficiente'}</strong></div>
     {benchmark.results?.map(r=><div key={r.id}><span>{r.label}</span><strong>{r.return==null?'Sem dados':`${(r.return*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</strong><small>{r.updatedAt?`Atualizado ${fmtDate(r.updatedAt)}`:r.error||''}</small></div>)}
    </div>}
   </Card>
  </>}

  {/* ========================================================================
      VISÃO 5: SINCRONIZAÇÃO, IMPORTAÇÃO & DISTRIBUIÇÃO POR CATEGORIAS
     ======================================================================== */}
  {section==='import'&&<>
   <Card
    title="Distribuição inteligente de despesas sincronizadas"
    subtitle="Classificação em 3 camadas: (1) Suas regras personalizadas, (2) Aprendizado com edições anteriores e (3) Dicionário brasileiro de estabelecimentos."
    action={<div className="button-row">
     <button type="button" className="secondary compact-btn" disabled={busy} onClick={()=>handleRecategorize(true)}>
      <FolderSync size={14}/>Reclassificar “Outros” ({othersTransactionsAll.length})
     </button>
     <button type="button" className="primary compact-btn" disabled={busy} onClick={()=>handleRecategorize(false)}>
      <Check size={14}/>Aplicar regras em tudo
     </button>
    </div>}
   >
    <div className="finance-budget-overview">
     <div>
      <span>Regras ativas</span>
      <strong>{(finance.pluggy?.rules||[]).filter(r=>r.active!==false).length}</strong>
      <small>Prioridade máxima na sincronização</small>
     </div>
     <div>
      <span>Despesas em “Outros” ({fmtMonth(month)})</span>
      <strong className={othersTransactionsMonth.length>0?'finance-over-budget':'positive-text'}>{othersTransactionsMonth.length}</strong>
      <small>{othersTransactionsAll.length} em todo o histórico</small>
     </div>
     <div>
      <span>Categorias ativas no mês</span>
      <strong>{expenseDistributionRows.length}</strong>
      <small>Total categorizado: {display(categorizedTotal)}</small>
     </div>
    </div>

    {ruleSuggestions.length>0&&<div className="rule-suggestions-block">
     <div className="rule-suggestions-head">
      <strong>Sugestões de regras a partir do seu extrato</strong>
      <small className="muted">Estabelecimentos recorrentes ou ainda em “Outros” que podem ser categorizados automaticamente</small>
     </div>
     <div className="rule-suggestions-grid">
      {ruleSuggestions.map(sug=>{
       const selectedCat=suggestionCatOverrides[sug.keyword]||sug.suggestedCategory||'Alimentação';
       return <article className="rule-suggestion-card" key={sug.keyword}>
        <div className="rule-suggestion-top">
         <div>
          <strong>“{sug.keyword}”</strong>
          <small>{sug.count} lançamento(s) · Total {display(sug.total)}</small>
         </div>
         {sug.unclassifiedCount>0&&<span className="tag amber">{sug.unclassifiedCount} em Outros</span>}
        </div>
        <div className="rule-suggestion-controls">
         <select
          aria-label={`Categoria sugerida para ${sug.keyword}`}
          value={selectedCat}
          onChange={e=>setSuggestionCatOverrides({...suggestionCatOverrides,[sug.keyword]:e.target.value})}
         >
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
         </select>
         <button type="button" className="secondary compact-btn" disabled={busy} onClick={()=>applySuggestedRule(sug)}>
          <Check size={14}/>Fixar regra
         </button>
        </div>
       </article>;
      })}
     </div>
    </div>}
   </Card>

   <Card title="Regras automáticas de categorização" subtitle="Defina palavras-chave para distribuir lançamentos sincronizados na categoria certa" icon={Check}>
    <div className="finance-rule-builder">
     <label>Quando a descrição contiver<input value={ruleDraft.contains} maxLength="80" placeholder="Ex.: UBER, IFOOD, MERCADOLIVRE, ENEL" onChange={e=>setRuleDraft({...ruleDraft,contains:e.target.value})}/></label>
     <label>Aplicar categoria<select value={ruleDraft.category} onChange={e=>setRuleDraft({...ruleDraft,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
     <button className="secondary finance-rule-preview-button" onClick={prepareRule}>Testar regra no histórico</button>
    </div>
    {rulePreview&&<>
     <p className="muted">{selectedRuleRows.length} de {rulePreview.length} lançamentos selecionados</p>
     <div className="table-wrap">
      <table>
       <thead><tr><th>Aplicar</th><th>Data</th><th>Descrição</th><th>Atual</th><th>Nova</th></tr></thead>
       <tbody>{rulePreview.map(row=><tr key={row.id}><td><input type="checkbox" checked={selectedRuleRows.includes(row.id)} onChange={e=>setSelectedRuleRows(e.target.checked?[...selectedRuleRows,row.id]:selectedRuleRows.filter(id=>id!==row.id))}/></td><td>{fmtDate(row.date)}</td><td>{row.description}</td><td>{row.previous}</td><td>{row.next}</td></tr>)}</tbody>
      </table>
     </div>
     <button className="primary spaced" disabled={busy||!selectedRuleRows.length} onClick={saveRule}>Salvar regra e aplicar</button>
    </>}
    {(finance.pluggy?.rules||[]).length>0&&<div className="finance-rules-list">
     <h3>Regras ativas <span>{finance.pluggy.rules.length}</span></h3>
     {finance.pluggy.rules.map(rule=><article className="finance-rule-row" key={rule.id}>
      <div className="finance-rule-description">
       <span className={`finance-rule-status${rule.active===false?' is-paused':''}`}>{rule.active===false?'Pausada':'Ativa'}</span>
       <strong>Contém “{rule.contains}”</strong>
       <small>Categoria: <b>{rule.category}</b></small>
      </div>
      <div className="button-row">
       <button className="secondary compact-btn" disabled={busy} onClick={async()=>{const next=structuredClone(state);next.finance.pluggy.rules=next.finance.pluggy.rules.map(r=>r.id===rule.id?{...r,active:r.active===false}:r);await onSave(next,'Regra atualizada.');}}>{rule.active===false?'Ativar':'Pausar'}</button>
       <button className="icon-button" aria-label={`Remover regra ${rule.contains}`} disabled={busy} onClick={async()=>{const next=structuredClone(state);next.finance.pluggy.rules=(next.finance.pluggy.rules||[]).filter(r=>r.id!==rule.id);await onSave(next,'Regra removida.');}}><Trash2 size={14}/></button>
      </div>
     </article>)}
    </div>}
   </Card>

   <Card title="Importar ou exportar extrato CSV" subtitle="Pré-visualização com classificação automática de categorias e detecção de duplicados" icon={Upload}>
    <input ref={csvRef} hidden type="file" accept=".csv,text/csv" onChange={loadCsv}/>
    <div className="button-row">
     <button className="primary" onClick={()=>csvRef.current?.click()}><Upload size={16}/>Importar arquivo CSV</button>
     <button className="secondary" onClick={exportFinanceCsv}><Download size={16}/>Exportar lançamentos CSV</button>
     {csvRows&&<label style={{margin:0}}>Conta de destino<select value={csvAccount} onChange={e=>setCsvAccount(e.target.value)}>{finance.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
    </div>
    {csvRows&&<>
     <div className="toolbar spaced">
      <span>{csvRows.filter(r=>r.selected&&!r.duplicate).length} selecionadas · {csvRows.filter(r=>r.duplicate).length} duplicadas</span>
      <label style={{margin:0}}>Categoria padrão (quando não identificada)<select value={csvCategory} onChange={e=>setCsvCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
     </div>
     <div className="table-wrap">
      <table>
       <thead><tr><th>Importar</th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria sugerida</th><th>Valor</th><th>Status</th></tr></thead>
       <tbody>{csvRows.slice(0,1000).map((r,i)=><tr key={`${r.row}-${i}`}>
        <td><input type="checkbox" checked={r.selected} disabled={!r.valid||r.duplicate} onChange={e=>setCsvRows(csvRows.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}/></td>
        <td>{r.date}</td>
        <td>{r.description||'—'}</td>
        <td>{r.type==='income'?'Receita':r.type==='review'?'Revisar':'Despesa'}</td>
        <td>
         {r.valid?<select
          aria-label={`Categoria da linha ${r.row}`}
          value={r.category||csvCategory}
          onChange={e=>setCsvRows(csvRows.map((x,j)=>j===i?{...x,category:e.target.value}:x))}
         >
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
         </select>:'—'}
        </td>
        <td>{r.valid?display(r.amount):'—'}</td>
        <td>{r.duplicate?'Duplicada':!r.valid?'Inválida':'Nova'}</td>
       </tr>)}</tbody>
      </table>
     </div>
     <div className="button-row spaced">
      <button className="primary" onClick={importCsv} disabled={busy||!csvAccount}>Confirmar importação</button>
      <button className="secondary" onClick={()=>setCsvRows(null)}>Cancelar</button>
     </div>
    </>}
   </Card>

   <Card title="Conexão Open Finance (Meu Pluggy)" subtitle="Sincronização somente leitura para contas, cartões e investimentos" icon={Wallet}>
    <form className="inline-form" onSubmit={savePluggyItem}>
     <label>Item ID da conexão<input value={pluggyItemId} onChange={e=>setPluggyItemId(e.target.value)} autoComplete="off" spellCheck="false" placeholder="Cole o Item ID do Meu Pluggy" required/></label>
     <div className="button-row">
      <button className="primary" disabled={busy}>Salvar Item ID</button>
      <button className="secondary" type="button" onClick={syncPluggy} disabled={busy||!finance.pluggy?.itemId}>{busy?'Sincronizando…':'Sincronizar agora'}</button>
      {finance.pluggy?.lastSyncAt&&<span className="muted small">Última sincronização: {new Date(finance.pluggy.lastSyncAt).toLocaleString('pt-BR')}</span>}
     </div>
    </form>
    {(finance.pluggy?.inventory||[]).filter(r=>!finance.pluggy?.positionLinks?.[r.id]).map(remote=><div className="finance-link-row spaced" key={remote.id}>
     <span><strong>{remote.name}</strong><small>{remote.subtype||remote.type} · Saldo {display(remote.balance)}</small></span>
     <select aria-label={`Associar ${remote.name}`} value={positionLinks[remote.id]?.assetId||''} onChange={e=>setPositionLinks({...positionLinks,[remote.id]:{assetId:e.target.value}})}>
      <option value="">Selecionar posição da carteira</option>
      {state.assets.filter(a=>a.id!=='cash').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>
     <button className="secondary" disabled={busy||!positionLinks[remote.id]?.assetId} onClick={()=>decidePosition(remote,positionLinks[remote.id]?.assetId)}>Vincular</button>
    </div>)}
    {(finance.pluggy?.remoteCards||[]).map(remote=><div className="finance-link-row spaced" key={remote.id}>
     <span><strong>{remote.name}</strong><small>{remote.mask?`Final ${String(remote.mask).slice(-4)} · `:''}Cartão detectado</small></span>
     <select aria-label={`Associar cartão ${remote.name}`} value={positionLinks[`card:${remote.id}`]?.cardId||finance.pluggy?.cardLinks?.[remote.id]?.cardId||''} onChange={e=>setPositionLinks({...positionLinks,[`card:${remote.id}`]:{cardId:e.target.value}})}>
      <option value="">Selecionar cartão cadastrado</option>
      {finance.cards.map(card=><option key={card.id} value={card.id}>{card.name}</option>)}
     </select>
     <button className="secondary" disabled={busy||!(positionLinks[`card:${remote.id}`]?.cardId||finance.pluggy?.cardLinks?.[remote.id]?.cardId)} onClick={()=>decideCard(remote,positionLinks[`card:${remote.id}`]?.cardId||finance.pluggy?.cardLinks?.[remote.id]?.cardId)}>Vincular</button>
    </div>)}
   </Card>
  </>}

  {/* Modais de Edição de Lançamento, Conta e Cartão */}
  {editingTransaction&&<FinanceDialog title="Editar lançamento" onClose={()=>setEditingTransaction(null)}>
   <form onSubmit={saveTransactionEdit}>
    <label>Data<input name="date" type="date" min={finance.accounts.find(a=>a.id===editingTransaction.accountId)?.openingDate||FINANCE_HISTORY_START} max={dateISO()} defaultValue={editingTransaction.date} required/></label>
    <label>Descrição<input name="description" maxLength="160" defaultValue={editingTransaction.description} required/></label>
    <div className="form-grid">
     <label>Valor (R$)<input name="amount" type="number" min=".01" step=".01" defaultValue={editingTransaction.amount} required/></label>
     {editingTransaction.type==='card_purchase'&&<label>Parcelas<input name="installments" type="number" min="1" max="48" defaultValue={editingTransaction.installments||1} required/></label>}
    </div>
    {['income','expense','card_purchase','investment'].includes(editingTransaction.type)&&<label>Categoria<select name="category" defaultValue={editingTransaction.category||'Outros'}>{categories.map(category=><option key={category}>{category}</option>)}</select></label>}
    <div className="button-row">
     <button className="primary" disabled={busy}>Salvar alterações</button>
     <button className="secondary" type="button" onClick={()=>setEditingTransaction(null)}>Cancelar</button>
    </div>
   </form>
  </FinanceDialog>}

  {editingAccount&&<FinanceDialog title="Editar conta bancária" onClose={()=>setEditingAccount(null)}>
   <form onSubmit={saveAccountEdit}>
    <label>Nome da conta<input name="name" maxLength="80" defaultValue={editingAccount.name} required/></label>
    <div className="form-grid">
     <label>Tipo<select name="type" defaultValue={editingAccount.type}><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro / carteira</option></select></label>
     <label>Saldo inicial (R$)<input name="openingBalance" type="number" step=".01" defaultValue={editingAccount.openingBalance} required/></label>
    </div>
    <label>Data do saldo inicial<input name="openingDate" type="date" min="2000-01-01" max={dateISO()} defaultValue={editingAccount.openingDate} required/></label>
    <div className="button-row">
     <button className="primary" disabled={busy}>Salvar conta</button>
     <button className="secondary" type="button" onClick={()=>setEditingAccount(null)}>Cancelar</button>
    </div>
   </form>
  </FinanceDialog>}

  {editingCard&&<FinanceDialog title="Editar cartão de crédito" onClose={()=>setEditingCard(null)}>
   <form onSubmit={saveCardEdit}>
    <label>Nome do cartão<input name="name" maxLength="80" defaultValue={editingCard.name} required/></label>
    <label>Conta usada para pagar a fatura<select name="accountId" defaultValue={editingCard.accountId} required>{finance.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <div className="form-grid">
     <label>Dia de fechamento<input name="closeDay" type="number" min="1" max="28" defaultValue={editingCard.closeDay} required/></label>
     <label>Dia de vencimento<input name="dueDay" type="number" min="1" max="28" defaultValue={editingCard.dueDay} required/></label>
    </div>
    <div className="button-row">
     <button className="primary" disabled={busy}>Salvar cartão</button>
     <button className="secondary" type="button" onClick={()=>setEditingCard(null)}>Cancelar</button>
    </div>
   </form>
  </FinanceDialog>}
 </div>;
}

function prevCategoryForType(type,current){
 if(type==='income')return 'Salário';
 if(type==='investment')return 'Investimento';
 return current==='Salário'||current==='Investimento'?'Alimentação':(current||'Alimentação');
}
