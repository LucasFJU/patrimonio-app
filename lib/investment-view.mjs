import {calculate,dateISO} from './portfolio.mjs';

export function investmentPositions(state,asOf=dateISO()){
 const values=calculate(state,asOf).values;
 const inventory=state.finance?.pluggy?.inventory||[];
 const links=state.finance?.pluggy?.positionLinks||{};
 return state.assets.filter(asset=>asset.id!=='cash').map(asset=>{
  const closing=state.events.filter(event=>event.assetId===asset.id&&event.kind==='saldo'&&event.date<=asOf).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''))[0];
  const linked=inventory.find(remote=>links[remote.id]?.assetId===asset.id);
  const institution=asset.institution?.trim()||'Instituição não informada';
  return {asset,value:values[asset.id]||0,institution,balanceDate:closing?.date||null,source:closing?.pluggyInvestmentId?'Meu Pluggy':closing?'Informado manualmente':'Saldo inicial e movimentações',linked:Boolean(linked),remoteDate:linked?.date||null};
 });
}

export function allocationByInstitution(positions){
 const rows=new Map();
 for(const position of positions){const key=position.institution;rows.set(key,(rows.get(key)||0)+position.value);}
 return [...rows].map(([institution,value])=>({institution,value})).sort((a,b)=>b.value-a.value||a.institution.localeCompare(b.institution,'pt-BR'));
}
