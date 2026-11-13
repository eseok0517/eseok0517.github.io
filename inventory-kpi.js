(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
var DAY=86400000, state={items:[],dq:{},asof:null,win:30,rows:[]};
var ALIAS={date:['timestamp','date','datetime','time','scan_time','transaction_date'],id:['item_id','sku','item','part','part_number','barcode','item_code'],name:['item_name','description','name'],room:['supply_room','room','location','site','warehouse'],action:['action','type','transaction','movement','txn_type'],qty:['quantity','qty','units','count'],cost:['unit_cost','cost','price','unit_price'],min:['min_level','minimum','min','reorder_point','par']};
var ACT={issue:'ISSUE',out:'ISSUE',checkout:'ISSUE',check_out:'ISSUE',take:'ISSUE',consume:'ISSUE',receive:'RECEIVE',in:'RECEIVE',checkin:'RECEIVE',check_in:'RECEIVE',restock:'RECEIVE',delivery:'RECEIVE',opening:'OPENING',open:'OPENING',start:'OPENING',adjust:'ADJUST',adjustment:'ADJUST',count:'ADJUST'};

function parseCSV(t){var r=[],row=[],f='',q=false,i=0,c;t=t.replace(/^﻿/,'');
for(;i<t.length;i++){c=t[i];
if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
else if(c=='"')q=true;else if(c==','){row.push(f);f=''}
else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;row.push(f);f='';if(row.length>1||row[0]!=='')r.push(row);row=[]}
else f+=c}
if(f!==''||row.length){row.push(f);r.push(row)}return r}

function mapCols(h){var m={},low=h.map(function(x){return x.trim().toLowerCase().replace(/[\s-]+/g,'_')});
Object.keys(ALIAS).forEach(function(k){for(var j=0;j<ALIAS[k].length;j++){var p=low.indexOf(ALIAS[k][j]);if(p>-1){m[k]=p;break}}});return m}

function num(x){if(x==null||x==='')return NaN;var n=parseFloat(String(x).replace(/[$,\s]/g,''));return n}
function fmt(n,d){return isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d==null?0:d,minimumFractionDigits:d||0}):'n/a'}
function money(n){return isFinite(n)?'$'+(Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e4?(n/1e3).toFixed(1)+'K':fmt(n)):'n/a'}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

function load(text,label){
 var t=parseCSV(text);if(t.length<2)return err('The file has no data rows.');
 var m=mapCols(t[0]);var miss=['date','id','action','qty'].filter(function(k){return m[k]==null});
 if(miss.length)return err('Could not find column(s): '+miss.join(', ')+'. See "Expected columns".');
 var rows=[],dq={total:t.length-1,badDate:0,badItem:0,badAction:0,badQty:0,dup:0,neg:0,returns:0};
 var seen={};
 for(var i=1;i<t.length;i++){var r=t[i];
  var d=new Date(String(r[m.date]||'').trim().replace(' ','T'));if(isNaN(d)||d.getFullYear()<2000||d.getFullYear()>2100){dq.badDate++;continue}
  var id=String(r[m.id]||'').trim();if(!id){dq.badItem++;continue}
  var a=ACT[String(r[m.action]||'').trim().toLowerCase().replace(/[\s-]+/g,'_')];if(!a){dq.badAction++;continue}
  var q=num(r[m.qty]);if(!isFinite(q)||(a!=='ADJUST'&&q<0)){dq.badQty++;continue}
  var key=[id,r[m.room],a,q,d.getTime()].join('|');
  if(a==='ISSUE'||a==='RECEIVE'){if(seen[key]){dq.dup++;continue}seen[key]=1}
  rows.push({t:d.getTime(),id:id,name:m.name!=null?String(r[m.name]||'').trim():'',room:m.room!=null?String(r[m.room]||'').trim():'',a:a,q:q,cost:m.cost!=null?num(r[m.cost]):NaN,min:m.min!=null?num(r[m.min]):NaN})}
 if(!rows.length)return err('No usable rows after validation.');
 rows.sort(function(x,y){return x.t-y.t});
 state.rows=rows;state.dq=dq;state.label=label;compute();
 $('msg').className='';$('msg').textContent=label+': '+fmt(rows.length)+' usable records of '+fmt(dq.total)+'.';
}
function err(s){$('msg').className='err';$('msg').textContent=s}

function compute(){
 var rows=state.rows,win=+$('win').value||30,lead=Math.max(1,+$('lead').value||7),cover=Math.max(1,+$('cover').value||30);
 var asof=rows[rows.length-1].t,from=asof-win*DAY,span=Math.max(1,Math.min(win,(asof-rows[0].t)/DAY));
 var it={},dq=state.dq;dq.neg=0;
 rows.forEach(function(r){var o=it[r.id]||(it[r.id]={id:r.id,name:'',room:'',onhand:0,issued:0,cost:NaN,min:NaN,episodes:0,neg:false,lastMove:0,hasIssue:false});
  if(r.name)o.name=r.name;if(r.room)o.room=r.room;if(isFinite(r.cost))o.cost=r.cost;if(isFinite(r.min))o.min=r.min;
  var was=o.onhand;
  if(r.a==='ISSUE'){o.onhand-=r.q;o.hasIssue=true;o.lastIssue=r.t;if(r.t>from){o.issued+=r.q}}
  else if(r.a==='RECEIVE'||r.a==='OPENING')o.onhand+=r.q;else o.onhand+=r.q;
  if(was>0&&o.onhand<=0)o.episodes++;
  if(o.onhand<0&&!o.neg){o.neg=true;dq.neg++}
 });
 var list=Object.keys(it).map(function(k){var o=it[k];
  o.rate=o.issued/span;o.dos=o.rate>0?Math.max(0,o.onhand)/o.rate:Infinity;
  o.value=isFinite(o.cost)?Math.max(0,o.onhand)*o.cost:NaN;o.issuedVal=isFinite(o.cost)?o.issued*o.cost:o.issued;
  var min=isFinite(o.min)?o.min:0;
  if(o.onhand<=0)o.status='Out of stock';
  else if(o.rate===0)o.status='No movement';
  else if(o.onhand<=min||o.dos<=lead)o.status='Reorder now';
  else if(o.dos<=lead*2)o.status='Watch';else o.status='OK';
  var tgt=Math.max(min,Math.ceil(o.rate*cover));
  o.reorder=(o.status==='Out of stock'||o.status==='Reorder now'||o.status==='Watch')&&o.rate>0?Math.max(0,Math.ceil(tgt-o.onhand)):0;
  return o});
 var tot=list.reduce(function(s,o){return s+o.issuedVal},0),acc=0;
 list.slice().sort(function(a,b){return b.issuedVal-a.issuedVal}).forEach(function(o){
  if(o.issuedVal<=0){o.abc='C';return}
  o.abc=acc<tot*.8?'A':acc<tot*.95?'B':'C';acc+=o.issuedVal});
 state.items=list;state.asof=asof;state.win=win;state.span=span;state.lead=lead;state.cover=cover;state.from=from;
 render();
}

function render(){
 var L=state.items,dq=state.dq,hasCost=L.some(function(o){return isFinite(o.cost)});
 var c=function(s){return L.filter(function(o){return o.status===s}).length};
 var invVal=L.reduce(function(s,o){return s+(isFinite(o.value)?o.value:0)},0);
 var winIssuedVal=L.reduce(function(s,o){return s+(isFinite(o.cost)?o.issued*o.cost:0)},0);
 var turn=hasCost&&invVal>0?(winIssuedVal*365/state.span)/invVal:NaN;
 var eps=L.reduce(function(s,o){return s+o.episodes},0),epsItems=L.filter(function(o){return o.episodes>0}).length;
 var fin=L.filter(function(o){return isFinite(o.dos)&&o.onhand>0}).map(function(o){return o.dos}).sort(function(a,b){return a-b});
 var med=fin.length?fin[Math.floor(fin.length/2)]:NaN;
 var act=c('Reorder now')+c('Out of stock');
 var stuck=L.filter(function(o){return o.status==='No movement'});
 var stuckVal=stuck.reduce(function(s,o){return s+(isFinite(o.value)?o.value:0)},0);
 var K=[
  ['Items tracked',fmt(L.length),fmt(state.rows.length)+' records, through '+new Date(state.asof).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),''],
  ['Need action now',fmt(act),c('Out of stock')+' out of stock, '+c('Reorder now')+' at or under reorder level',act?'b':''],
  ['Median days of supply',isFinite(med)?fmt(med,0):'n/a','Across items with usage in the last '+state.win+' days',''],
  ['Stockout episodes',fmt(eps),epsItems+' items hit zero at least once in the file',eps?'w':''],
  ['Inventory value',hasCost?money(invVal):'n/a',hasCost?'Positive on-hand × unit cost':'Add a unit_cost column to see value',''],
  ['Annualized turnover',isFinite(turn)?fmt(turn,1)+'×':'n/a','Issued value in window, scaled to a year ÷ inventory value',''],
  ['No movement',fmt(stuck.length),hasCost?money(stuckVal)+' on hand with no issues in the window':'On hand, no issues in the window',stuck.length?'w':''],
  ['Records excluded or flagged',fmt(dq.badDate+dq.badItem+dq.badAction+dq.badQty+dq.dup+dq.neg),'See Data checks below','']
 ];
 $('kpis').innerHTML=K.map(function(k){return '<div class="kpi '+k[3]+'"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('');

 // status stack
 var S=[['Out of stock','var(--bad)'],['Reorder now','#c2763c'],['Watch','#d4b25a'],['OK','var(--ok)'],['No movement','var(--grey)']];
 $('status').innerHTML='<div class="stack" role="img" aria-label="Stock status distribution">'+S.map(function(s){var n=c(s[0]);return n?'<i style="width:'+n/L.length*100+'%;background:'+s[1]+'" title="'+s[0]+': '+n+'"></i>':''}).join('')+'</div><div class="legend">'+S.map(function(s){return '<span><u style="background:'+s[1]+'"></u>'+s[0]+' '+c(s[0])+'</span>'}).join('')+'</div>';

 // rooms
 var rm={};state.rows.forEach(function(r){if(r.a==='ISSUE'&&r.t>state.from){var k=r.room||'(no room)';rm[k]=(rm[k]||0)+r.q}});
 var rk=Object.keys(rm).sort(function(a,b){return rm[b]-rm[a]}),rmax=rk.length?rm[rk[0]]:1;
 $('rooms').innerHTML=rk.length?rk.map(function(k){return '<div class="b"><span>'+esc(k)+'</span><span class="t"><i style="width:'+rm[k]/rmax*100+'%"></i></span><span class="x">'+fmt(rm[k])+'</span></div>'}).join(''):'<p class="fine">No issues in this window.</p>';

 // low dos
 var low=L.filter(function(o){return o.rate>0}).sort(function(a,b){return a.dos-b.dos}).slice(0,10),mx=Math.max.apply(null,low.map(function(o){return o.dos}).concat([1]));
 $('lowdos').innerHTML=low.map(function(o){return '<div class="b"><span title="'+esc(o.name||o.id)+'">'+esc(o.id)+'</span><span class="t"><i style="width:'+Math.max(2,o.dos/mx*100)+'%;background:'+(o.dos<=state.lead?'var(--bad)':o.dos<=state.lead*2?'#d4b25a':'var(--ok)')+'"></i></span><span class="x">'+fmt(o.dos,1)+' d</span></div>'}).join('');

 // ABC
 var ab={A:[0,0],B:[0,0],C:[0,0]},tv=0;L.forEach(function(o){ab[o.abc][0]++;ab[o.abc][1]+=o.issuedVal;tv+=o.issuedVal});
 var AC={A:'var(--accent)',B:'#95787c',C:'#d3c8ca'};
 $('abc').innerHTML='<div class="stack" role="img" aria-label="Share of issued value by class">'+['A','B','C'].map(function(k){return '<i style="width:'+(tv?ab[k][1]/tv*100:0)+'%;background:'+AC[k]+'"></i>'}).join('')+'</div><div class="legend">'+['A','B','C'].map(function(k){return '<span><u style="background:'+AC[k]+'"></u>Class '+k+': '+ab[k][0]+' items, '+(tv?Math.round(ab[k][1]/tv*100):0)+'% of value</span>'}).join('')+'</div>';
 $('abcNote').textContent='Class A items deserve the tightest reorder points and the most frequent counts. Ranked by '+(hasCost?'issued value':'issued units')+' in the last '+state.win+' days.';

 // weekly trend
 var wk={},w0=Math.floor(state.rows[0].t/(7*DAY));
 state.rows.forEach(function(r){if(r.a==='ISSUE'){var w=Math.floor(r.t/(7*DAY))-w0;wk[w]=(wk[w]||0)+r.q}});
 var wl=Math.floor(state.asof/(7*DAY))-w0,vals=[];for(var i=0;i<=wl;i++)vals.push(wk[i]||0);
 var W=640,H=200,pl=40,pb=22,pt=8,n=vals.length,vm=Math.max.apply(null,vals)||1,bw=(W-pl)/n,svg='';
 for(var g=0;g<=4;g++){var y=pt+(H-pb-pt)*(1-g/4);svg+='<line x1="'+pl+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="#e3dfdf"/><text x="'+(pl-6)+'" y="'+(y+4)+'" font-size="10" text-anchor="end" fill="#625859">'+fmt(vm*g/4)+'</text>'}
 vals.forEach(function(v,i){var h=(H-pb-pt)*v/vm,x=pl+i*bw+bw*.15,last=i===n-1;svg+='<rect x="'+x+'" y="'+(H-pb-h)+'" width="'+bw*.7+'" height="'+h+'" fill="'+(last?'#baa6a9':'#ce142d')+'"><title>Week of '+new Date((w0+i)*7*DAY).toLocaleDateString('en-US',{month:'short',day:'numeric'})+': '+v+' units'+(last?' (partial week)':'')+'</title></rect>'});
 [0,Math.floor(n/2),n-1].forEach(function(i){svg+='<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-6)+'" font-size="10" text-anchor="middle" fill="#625859">'+new Date((w0+i)*7*DAY).toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</text>'});
 $('trend').innerHTML='<svg class="trend" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Weekly units issued">'+svg+'</svg>';
 $('trendNote').textContent='Each bar is one calendar week of issues. The lighter last bar may be a partial week.';

 // data checks
 var D=[[dq.badDate,'rows with an unreadable date'],[dq.badItem+dq.badAction+dq.badQty,'rows with a missing item, unknown action, or invalid quantity'],[dq.dup,'duplicate records (identical timestamp, item, room, action and quantity)'],[dq.neg,'items whose balance went below zero, which usually means a missing receipt or opening balance'],[L.filter(function(o){return !isFinite(o.min)}).length,'items with no minimum level in the file']];
 $('dq').innerHTML=D.map(function(d){return '<div><b>'+fmt(d[0])+'</b>'+d[1]+'</div>'}).join('');
 $('out').classList.remove('hidden');
 table();
}

var sortK='dos',sortD=1;
function table(){
 var q=$('q').value.toLowerCase(),f=$('flt').value;
 var L=state.items.filter(function(o){return(!f||o.status===f)&&(!q||(o.id+' '+o.name+' '+o.room).toLowerCase().indexOf(q)>-1)});
 L.sort(function(a,b){var x=a[sortK],y=b[sortK];if(typeof x==='string')return sortD*x.localeCompare(y);if(!isFinite(x)&&!isFinite(y))return 0;if(!isFinite(x))return 1;if(!isFinite(y))return -1;return sortD*(x-y)});
 var cls={'Out of stock':'bad','Reorder now':'bad','Watch':'warn','OK':'ok','No movement':'na'};
 $('tb').innerHTML=L.map(function(o){return '<tr><td><b>'+esc(o.id)+'</b> <span class="fine">'+esc(o.name)+'</span></td><td>'+esc(o.room)+'</td><td class="n">'+fmt(o.onhand)+'</td><td class="n">'+fmt(o.rate,2)+'</td><td class="n">'+(isFinite(o.dos)?fmt(o.dos,1):'—')+'</td><td class="n">'+(isFinite(o.min)?fmt(o.min):'—')+'</td><td><span class="pill '+cls[o.status]+'">'+o.status+'</span></td><td class="n">'+(o.reorder?fmt(o.reorder):'—')+'</td><td class="n">'+(isFinite(o.value)?money(o.value):'—')+'</td><td>'+o.abc+'</td></tr>'}).join('');
 $('cnt').textContent=L.length+' of '+state.items.length+' items';
}

function download(name,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function csvq(v){v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}

$('demo').onclick=function(){$('msg').className='';$('msg').textContent='Loading demo data…';
 fetch('data/inventory-sample.csv').then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){load(t,'Demo data (synthetic)')}).catch(function(){err('Could not load the demo file.')})};
function pick(file){if(!file)return;var r=new FileReader();r.onload=function(){load(r.result,file.name)};r.onerror=function(){err('Could not read that file.')};r.readAsText(file)}
$('file').onchange=function(e){pick(e.target.files[0])};
var dz=$('drop');dz.onclick=function(){$('file').click()};dz.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click()}};
dz.ondragover=function(e){e.preventDefault();dz.classList.add('over')};dz.ondragleave=function(){dz.classList.remove('over')};
dz.ondrop=function(e){e.preventDefault();dz.classList.remove('over');pick(e.dataTransfer.files[0])};
['win','lead','cover'].forEach(function(i){$(i).onchange=function(){if(state.rows.length)compute()}});
$('q').oninput=table;$('flt').onchange=table;
document.querySelectorAll('th[data-k]').forEach(function(th){th.style.cursor='pointer';th.onclick=function(){var k=th.dataset.k;sortD=sortK===k?-sortD:1;sortK=k;table()}});
$('tmpl').onclick=function(){download('inventory_template.csv','timestamp,item_id,item_name,supply_room,action,quantity,unit_cost,min_level\n2026-01-05 08:00:00,GLV-M,Nitrile gloves M,Room A,OPENING,100,9.40,30\n2026-01-06 09:14:22,GLV-M,Nitrile gloves M,Room A,ISSUE,2,9.40,30\n2026-01-12 08:30:00,GLV-M,Nitrile gloves M,Room A,RECEIVE,50,9.40,30\n')};
$('exp').onclick=function(){var L=state.items.filter(function(o){return o.reorder>0}).sort(function(a,b){return a.dos-b.dos});
 download('reorder_list.csv',['item_id,item_name,supply_room,status,on_hand,issued_per_day,days_of_supply,minimum,suggested_order'].concat(L.map(function(o){return [o.id,o.name,o.room,o.status,o.onhand,o.rate.toFixed(2),isFinite(o.dos)?o.dos.toFixed(1):'',isFinite(o.min)?o.min:'',o.reorder].map(csvq).join(',')})).join('\n'))};
if(location.search.indexOf('demo=1')>-1)$('demo').click();
})();
