'use strict';
const moneyShort=n=>'$'+(n/1e6).toFixed(2)+'M';
const dollars=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
async function purchasingPreview(){
 const r=await fetch('projects/purchasing/data/analysis.json');if(!r.ok)throw Error('Purchasing data unavailable');const d=await r.json();
 const summaries=['Current','Frequent','Bulk'].map(policy=>d.policies.filter(r=>r.policy===policy).reduce((a,r)=>({policy,capital:a.capital+r.avg_inventory_value,filled:a.filled+r.filled_units,demand:a.demand+r.demand_units}),{policy,capital:0,filled:0,demand:0}));
 const max=Math.max(...summaries.map(x=>x.capital));
 document.getElementById('purchase-bars').innerHTML=summaries.map(x=>`<div class="preview-bar"><div class="preview-bar-label"><span>${x.policy}</span><strong>${moneyShort(x.capital)}</strong></div><div class="preview-track"><i style="width:${100*x.capital/max}%"></i></div></div>`).join('');
 const [a,b]=summaries;document.getElementById('purchasing-finding').textContent=`Frequent ordering reduces modeled average inventory by ${dollars(a.capital-b.capital)}, while unit fill rate falls from ${(100*a.filled/a.demand).toFixed(2)}% to ${(100*b.filled/b.demand).toFixed(2)}%.`;
}
async function macroPreview(){
 const local='data/macro_results.json';
 const source=location.hostname.endsWith('github.io')?'https://raw.githubusercontent.com/eseok0517/eseok0517.github.io/main/data/macro_results.json':local;
 let r;try{r=await fetch(source,{cache:'no-store'});if(!r.ok)throw Error('Macro source unavailable')}catch(e){r=await fetch(local)}
 if(!r.ok)throw Error('Macro data unavailable');const d=await r.json(),rows=d.monthly.filter(r=>r.sp500!=null);if(rows.length<2)return;
 const W=460,H=170,pad=12,low=Math.min(...rows.map(r=>r.sp500)),hi=Math.max(...rows.map(r=>r.sp500));
 const points=rows.map((r,i)=>`${pad+(W-2*pad)*i/(rows.length-1)},${H-pad-(H-2*pad)*(r.sp500-low)/(hi-low||1)}`).join(' ');
 document.getElementById('macro-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="S and P 500 month-end level from ${rows[0].month} to ${rows.at(-1).month}"><path d="M${pad} ${H-pad}H${W-pad}" fill="none" stroke="#b7c6bd"/><polyline points="${points}" fill="none" stroke="#235f4c" stroke-width="2.2"/></svg>`;
 document.getElementById('macro-period').textContent=`${rows[0].month}–${rows.at(-1).month} · ${rows.length} completed monthly observations · price index`;
 const inv=d.stats.curve_regime.find(x=>x.regime==='Inverted'),normal=d.stats.curve_regime.find(x=>x.regime==='Normal');
 if(inv&&normal)document.getElementById('macro-finding').textContent=`Average next-12-month price return: ${inv.mean_fwd12.toFixed(1)}% after inverted-curve months (n=${inv.months}) versus ${normal.mean_fwd12.toFixed(1)}% after normal-curve months (n=${normal.months}). These are overlapping historical observations, not independent forecasts.`;
}
// Preserve meaningful text fallbacks if a source cannot load.
purchasingPreview().catch(()=>{});macroPreview().catch(()=>{});
