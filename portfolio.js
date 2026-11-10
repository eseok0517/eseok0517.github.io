'use strict';
const moneyShort=n=>'$'+(n/1e6).toFixed(2)+'M';
const dollars=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
async function purchasingPreview(){
 const r=await fetch('projects/purchasing/data/public/summary.json');if(!r.ok)throw Error('Purchasing data unavailable');const d=await r.json();
 const labels={'Manufacturing Components and Supplies':'Manufacturing components','Tools and General Machinery':'Tools & machinery','Electrical Systems and Lighting and Components and Accessories and Supplies':'Electrical supplies'};
 const rows=Object.entries(d.categories).map(([name,v])=>({name:labels[name]||name,value:v.positive_spend}));const max=Math.max(...rows.map(x=>x.value));
 document.getElementById('purchase-bars').innerHTML=rows.map(x=>`<div class="preview-bar"><div class="preview-bar-label"><span>${x.name}</span><strong>${moneyShort(x.value)}</strong></div><div class="preview-track"><i style="width:${100*x.value/max}%"></i></div></div>`).join('');
 document.getElementById('purchasing-finding').textContent=`${d.all.flagged.toLocaleString()} of ${d.all.rows.toLocaleString()} selected records trigger review rules. Flags identify follow-up candidates, not confirmed errors or savings.`;
}
async function macroPreview(){
 const local='data/macro_results.json';
 const source=location.hostname.endsWith('github.io')?'https://raw.githubusercontent.com/eseok0517/eseok0517.github.io/main/data/macro_results.json':local;
 let r;try{r=await fetch(source,{cache:'no-store'});if(!r.ok)throw Error('Macro source unavailable')}catch(e){r=await fetch(local)}
 if(!r.ok)throw Error('Macro data unavailable');const d=await r.json(),rows=d.monthly.filter(r=>r.sp500!=null);if(rows.length<2)return;
 const W=460,H=170,pad=12,low=Math.min(...rows.map(r=>r.sp500)),hi=Math.max(...rows.map(r=>r.sp500));
 const points=rows.map((r,i)=>`${pad+(W-2*pad)*i/(rows.length-1)},${H-pad-(H-2*pad)*(r.sp500-low)/(hi-low||1)}`).join(' ');
 document.getElementById('macro-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="S and P 500 month-end level from ${rows[0].month} to ${rows.at(-1).month}"><path d="M${pad} ${H-pad}H${W-pad}" fill="none" stroke="#d6b9bd"/><polyline points="${points}" fill="none" stroke="#c8102e" stroke-width="2.2"/></svg>`;
 document.getElementById('macro-period').textContent=`${rows[0].month}–${rows.at(-1).month} · ${rows.length} completed monthly observations · price index`;
 const inv=d.stats.curve_regime.find(x=>x.regime==='Inverted'),normal=d.stats.curve_regime.find(x=>x.regime==='Normal');
 if(inv&&normal)document.getElementById('macro-finding').textContent=`The S&P 500 gained an average of ${inv.mean_fwd12.toFixed(1)}% over the following year after inverted yield-curve months, compared with ${normal.mean_fwd12.toFixed(1)}% after normal yield-curve months.`;
}
purchasingPreview().catch(()=>{});macroPreview().catch(()=>{});
