'use strict';
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data;
function bars(rows){const max=Math.max(1,...rows.map(r=>r.value));return rows.map(r=>`<div class="bar-row"><div class="bar-label"><span>${esc(r.name)}</span><strong>${money(r.value)}</strong></div><div class="track"><div class="bar" style="width:${r.value/max*100}%"></div></div></div>`).join('');}
function render(){
 const category=document.getElementById('category').value;
 const s=category==='All'?data.all:data.categories[category];
 document.getElementById('public-metrics').innerHTML=[['Selected source lines',s.rows.toLocaleString(),'Records retained, including review candidates'],['Recorded positive line amounts',money(s.positive_spend),'Not paid invoices, savings, or audited expenditure'],['Records flagged for review',s.flagged.toLocaleString(),'Flags are prompts, not confirmed errors']].map(([a,b,c])=>`<article class="metric"><p>${a}</p><strong>${b}</strong><p>${c}</p></article>`).join('');
 document.getElementById('supplier-chart').innerHTML=bars(s.top_suppliers);
 document.getElementById('flag-counts').innerHTML=Object.entries(s.flags).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.toLocaleString()}</td></tr>`).join('');
 document.getElementById('public-insight').textContent=`${s.pos.toLocaleString()} department/PO combinations and ${s.suppliers.toLocaleString()} populated supplier IDs. The five largest supplier-name groups account for ${s.top5_share.toFixed(1)}% of positive recorded line amounts. Grouping is descriptive; supplier names and classifications need validation.`;
 const q=document.getElementById('public-search').value.trim().toLowerCase();
 const rows=data.preview.filter(r=>(category==='All'||r.category===category)&&[r.item,r.supplier,r.po_number,r.flags].join(' ').toLowerCase().includes(q));
 document.getElementById('public-rows').innerHTML=rows.map(r=>`<tr><td>${r.source_row}</td><td>${esc(r.po_number)}<small>${esc(r.department)}</small></td><td>${esc(r.item)}<small>${esc(r.supplier)}</small></td><td>${r.total_price===''?'n/a':money(+r.total_price)}</td><td>${esc(r.flags||'No rule triggered')}</td></tr>`).join('')||'<tr><td colspan="5">No matches in the preview. Download the full CSV for all records.</td></tr>';
 document.getElementById('public-count').textContent=`Showing ${rows.length} matches within a fixed ${data.preview.length}-row preview (flagged rows first). Filters above summarize all selected records; download the full CSV for complete row-level analysis.`;
}
fetch('data/public/summary.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(d=>{data=d;document.getElementById('category').innerHTML='<option value="All">All selected categories</option>'+Object.keys(d.categories).map(c=>`<option>${esc(c)}</option>`).join('');render();}).catch(()=>{document.getElementById('public-error').textContent='Could not load the public-data snapshot. Use the downloadable CSVs below.';});
document.getElementById('category').addEventListener('change',render);
document.getElementById('public-search').addEventListener('input',()=>{if(data)render();});
