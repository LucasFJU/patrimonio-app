import {monthEnd,monthOf,shiftMonth,summarizeFinance} from './finance.mjs';
import {dateISO} from './portfolio.mjs';

export function confirmedFinanceInsights(finance,today=dateISO()){
 const month=monthOf(today),summary=summarizeFinance(finance,month,today),insights=[];
 for(const [category,limitValue] of Object.entries(summary.budget)){
  const limit=Number(limitValue),spent=summary.expensesByCategory[category]||0;
  if(limit<=0||spent<limit*.8)continue;
  const percent=Math.round(spent/limit*100),over=spent>=limit;
  insights.push({id:`budget:${category}`,kind:'budget',severity:over?'high':'medium',title:over?`Limite de ${category} ultrapassado`:`Limite de ${category} próximo`,detail:`${percent}% do orçamento usado: ${spent.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} de ${limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`,category,spent,limit,percent});
 }
 const previousMonth=shiftMonth(month,-1),day=Math.min(Number(today.slice(8,10)),Number(monthEnd(previousMonth).slice(8,10))),previousAsOf=`${previousMonth}-${String(day).padStart(2,'0')}`;
 const previous=summarizeFinance(finance,previousMonth,previousAsOf),hasCurrentExpense=finance.transactions.some(t=>monthOf(t.date)===month&&t.date<=today&&!t.needsReview&&!t.excludedFromBalances&&!t.supersededByPluggyTransactionId&&['expense','card_purchase'].includes(t.type)),hasPreviousExpense=finance.transactions.some(t=>monthOf(t.date)===previousMonth&&t.date<=previousAsOf&&!t.needsReview&&!t.excludedFromBalances&&!t.supersededByPluggyTransactionId&&['expense','card_purchase'].includes(t.type));
 if(hasCurrentExpense&&hasPreviousExpense&&previous.expenses>0){const change=(summary.expenses-previous.expenses)/previous.expenses;if(change>=.2&&summary.expenses-previous.expenses>=100)insights.push({id:'spending-change',kind:'comparison',severity:'medium',title:'Gastos cresceram em relação ao mês anterior',detail:`Até o dia ${day}, foram ${Math.round(change*100)}% a mais que no mesmo período do mês passado.`,current:summary.expenses,previous:previous.expenses,day});}
 const severity={high:0,medium:1,low:2};
 return insights.sort((a,b)=>severity[a.severity]-severity[b.severity]||(b.spent||b.current||0)-(a.spent||a.current||0));
}
