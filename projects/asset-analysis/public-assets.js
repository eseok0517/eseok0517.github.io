'use strict';
fetch('data/summary.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(d=>{
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 document.getElementById('fleet-metrics').innerHTML=[['Equipment records',d.rows.toLocaleString(),'One source summary row excluded'],['Recorded in-service cost',money(d.total_cost),'Historical recorded cost, not current market value'],['Planned replacement year reached',d.replacement_year_reached.toLocaleString(),`Year ≤ ${d.as_of.slice(0,4)}; review planning assumptions`]].map(([a,b,c])=>`<article class="metric"><p>${a}</p><strong>${b}</strong><p>${c}</p></article>`).join('');
 document.getElementById('fleet-rows').innerHTML=d.preview.slice(0,20).map(r=>`<tr><td>${esc(r.asset_id)}</td><td>${esc(r.name)}</td><td>${esc(r.department)}</td><td>${r.in_service_cost===''?'n/a':money(+r.in_service_cost)}</td><td>${esc(r.planned_replacement_year)}</td><td>${esc(r.review_flags)}</td></tr>`).join('');
}).catch(()=>{document.getElementById('fleet-metrics').textContent='Snapshot could not load. Download the source and exception CSVs below.';});
