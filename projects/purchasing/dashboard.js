'use strict';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const pct=n=>(100*n).toFixed(2)+'%';
let data;
function adjusted(r,rate,discount){return r.freight+r.avg_inventory_value*rate*.5+r.shortage_penalty-(r.policy==='Bulk'?r.filled_units*r.unit_cost*discount:0)}
function render(){
 const rate=Number($('rate').value)/100,discount=Number($('discount').value)/100,location=$('location').value;
 $('rate-label').textContent=Math.round(rate*100)+'%';$('discount-label').textContent=(discount*100).toFixed(1)+'%';
 const rows=data.policies.filter(r=>location==='All'||r.location===location),policies=['Current','Frequent','Bulk'];
 const totals=policies.map(policy=>rows.filter(r=>r.policy===policy).reduce((a,r)=>({policy,cost:a.cost+adjusted(r,rate,discount),capital:a.capital+r.avg_inventory_value,filled:a.filled+r.filled_units,demand:a.demand+r.demand_units}),{policy,cost:0,capital:0,filled:0,demand:0}));
 const current=totals[0],frequent=totals[1],bulk=totals[2],best=totals.reduce((a,b)=>a.cost<b.cost?a:b);
 $('metrics').innerHTML=[['Capital released: frequent',money(current.capital-frequent.capital),'Average inventory reduction vs current'],['6-mo cost reduction: frequent',money(current.cost-frequent.cost),'Modeled period economics vs current'],['Unit fill rate: frequent',pct(frequent.filled/frequent.demand),'Current: '+pct(current.filled/current.demand)]].map(([label,value,note])=>`<div class="metric"><p>${label}</p><strong>${value}</strong><p>${note}</p></div>`).join('');
 const maxCost=Math.max(...totals.map(r=>Math.abs(r.cost)),1),maxCapital=Math.max(...totals.map(r=>r.capital),1);
 $('cost-chart').innerHTML=totals.map(r=>`<div class="bar-row"><div class="bar-label"><b>${r.policy}</b><span>${money(r.cost)}</span></div><div class="track"><div class="bar ${r.cost<0?'negative':''}" style="width:${Math.abs(r.cost)/maxCost*100}%"></div></div></div>`).join('');
 $('capital-chart').innerHTML=totals.map(r=>`<div class="bar-row"><div class="bar-label"><b>${r.policy}</b><span>${money(r.capital)} · ${pct(r.filled/r.demand)} fill</span></div><div class="track"><div class="bar" style="width:${r.capital/maxCapital*100}%"></div></div></div>`).join('');
 $('insight').textContent=`${best.policy} has the lowest modeled policy cost under these assumptions. Bulk ties up ${money(bulk.capital-current.capital)} more inventory capital than current. Negative policy cost means the discount benefit exceeds modeled policy expenses; it does not mean materials are free.`;
 const chosen=$('policy').value,search=$('search').value.toLowerCase(),base=new Map(rows.filter(r=>r.policy==='Current').map(r=>[r.item_id,r]));
 const filtered=rows.filter(r=>r.policy===chosen&&(r.item_id+' '+r.category).toLowerCase().includes(search)).sort((a,b)=>(adjusted(base.get(b.item_id),rate,discount)-adjusted(b,rate,discount))-(adjusted(base.get(a.item_id),rate,discount)-adjusted(a,rate,discount)));
 $('items').innerHTML=filtered.map(r=>{const c=base.get(r.item_id);return `<tr><td><b>${r.item_id}</b><small>${r.location}</small></td><td>${r.category}</td><td>${money(adjusted(c,rate,discount)-adjusted(r,rate,discount))}</td><td>${money(c.avg_inventory_value-r.avg_inventory_value)}</td><td>${pct(r.fill_rate)}</td></tr>`}).join('');
 $('count').textContent=`${filtered.length} items · sorted by modeled cost reduction, highest first`;
}
fetch('data/analysis.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json()}).then(d=>{data=d;render();for(const id of ['location','rate','discount','policy','search'])$(id).addEventListener('input',render)}).catch(()=>{$('error').textContent='The analysis data could not load. Please reload or download the CSV results.'});
