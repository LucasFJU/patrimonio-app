import {monthEnd,monthOf,summarizeFinance} from './finance.mjs';
import {dateISO} from './portfolio.mjs';

const included=t=>!t.needsReview&&!t.excludedFromBalances&&!t.supersededByPluggyTransactionId;
const category=t=>t.category||'Outros';

export function financeReportMonth(finance,month){
 const today=dateISO(),end=monthEnd(month),asOf=end>today?today:end;
 const transactions=finance.transactions.filter(t=>monthOf(t.date)===month&&t.date<=asOf);
 const confirmed=transactions.filter(included);
 const sum=type=>confirmed.filter(t=>t.type===type).reduce((total,t)=>total+t.amount,0);
 const income=sum('income'),directExpenses=sum('expense'),cardPurchases=sum('card_purchase'),cardPayments=sum('card_payment'),investments=sum('investment');
 const accrualExpenses=directExpenses+cardPurchases,cashExpenses=directExpenses+cardPayments;
 const categories=new Map();
 for(const t of confirmed.filter(t=>['expense','card_purchase'].includes(t.type)))categories.set(category(t),(categories.get(category(t))||0)+t.amount);
 const summary=summarizeFinance(finance,month,asOf);
 return {month,hasData:transactions.length>0||finance.accounts.some(a=>a.openingDate<=asOf),income,accrualExpenses,cashExpenses,cardPurchases,cardPayments,investments,accrualResult:income-accrualExpenses,cashResult:income-cashExpenses-investments,pending:transactions.filter(t=>t.needsReview).length,cashBalance:summary.cash,categories:[...categories].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),transactions};
}

export function financeReport(finance,{period='month',anchor=dateISO().slice(0,7)}={}){
 const months=period==='year'?Array.from({length:12},(_,i)=>`${anchor.slice(0,4)}-${String(i+1).padStart(2,'0')}`):[anchor];
 const rows=months.filter(month=>month<=dateISO().slice(0,7)).map(month=>financeReportMonth(finance,month));
 const sum=key=>rows.reduce((total,row)=>total+row[key],0);
 return {period,anchor,rows,income:sum('income'),accrualExpenses:sum('accrualExpenses'),cashExpenses:sum('cashExpenses'),cardPurchases:sum('cardPurchases'),cardPayments:sum('cardPayments'),investments:sum('investments'),accrualResult:sum('accrualResult'),cashResult:sum('cashResult'),pending:sum('pending')};
}

export function reportTransactions(finance,month,{view='accrual',kind='all',category:filterCategory='all'}={}){
 const eligible=view==='cash'?['income','expense','investment','card_payment']:['income','expense','card_purchase'];
 return finance.transactions.filter(t=>monthOf(t.date)===month&&included(t)&&eligible.includes(t.type))
  .filter(t=>kind==='all'||(kind==='income'?t.type==='income':kind==='investments'?t.type==='investment':t.type!=='income'&&t.type!=='investment'))
  .filter(t=>filterCategory==='all'||category(t)===filterCategory)
  .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
