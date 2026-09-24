export function compoundDailyPercent(rows){return rows.reduce((value,row)=>value*(1+Number(String(row.valor).replace(',','.'))/100),1)-1;}
export function compoundMonthlyPercent(rows){return rows.reduce((value,row)=>value*(1+Number(String(row.valor).replace(',','.'))/100),1)-1;}
export function pointReturn(rows){const values=rows.map(r=>Number(String(r.valor).replace(',','.'))).filter(Number.isFinite);return values.length>1&&values[0]!==0?values.at(-1)/values[0]-1:null;}
export function parseSgsDate(value){const [day,month,year]=value.split('/');return `${year}-${month}-${day}`;}
export function formatSgsDate(value){const [year,month,day]=value.split('-');return `${day}/${month}/${year}`;}
export function seriesReturn(rows,type){if(!Array.isArray(rows)||rows.length<1||(type==='index'&&rows.length<2))return null;if(type==='index')return pointReturn(rows);if(type==='monthly')return compoundMonthlyPercent(rows);return compoundDailyPercent(rows);}
