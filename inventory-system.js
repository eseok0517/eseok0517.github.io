(function(){
'use strict';
var KEY='is_state_v1',DAY=86400000,UNITS=['Box','Pack','Roll','Individual'];
var $=function(i){return document.getElementById(i)};
var S=null,tab='dash',room='ALL',pending={IN:[],OUT:[]},calc={};
var ROOMS=['Room A','Room B','Room C'];
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fmt(n,d){return isFinite(n)?Number(n).toLocaleString('en-US',{maximumFractionDigits:d||0,minimumFractionDigits:d||0}):'—'}
function money(n){return isFinite(n)?'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:n<1000?2:0,maximumFractionDigits:n<1000?2:0}):'—'}
function pad(n,l){return String(n).padStart(l||2,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())}
function stamp(d){return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())}
function code(r){return r.replace('Room ','R')}
function mkey(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')}

/* ---------- demo data ---------- */
function rng(seed){return function(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296}}
var T=[ // name, category, price per piece, {Box,Pack,Roll}, monthly pieces
['Nitrile gloves, M','PPE',.19,{Box:100,Pack:10},900],['Nitrile gloves, L','PPE',.19,{Box:100,Pack:10},700],
['Cleanroom wipes','Cleaning',.42,{Box:300,Pack:50},1200],['Safety glasses','PPE',3.8,{Box:12},40],
['Ear plugs','PPE',.31,{Box:200,Pack:20},300],['Kapton tape','Tape',14.5,{Box:24,Roll:1},45],
['Pressing tape','Tape',7.9,{Box:24,Pack:6,Roll:1},60],['Thermal labels 4x6','Labels',9.2,{Box:12,Roll:1},70],
['Cable ties, 8 in','Hardware',.06,{Box:1000,Pack:100},1500],['M4 screws','Hardware',.09,{Box:500,Pack:50},800],
['M4 washers','Hardware',.04,{Box:500,Pack:50},800],['Isopropyl alcohol, 1 gal','Chemicals',21,{Box:4},18],
['Foam swabs','Cleaning',.18,{Box:500,Pack:50},900],['Sleeve covers','PPE',.35,{Box:200,Pack:20},500],
['Printer paper','Office',5.2,{Box:10},60],['Marker pens','Office',.8,{Box:12,Pack:4},50],
['AA batteries','Electrical',.95,{Box:48,Pack:4},120],['Fuse 5A','Electrical',.7,{Box:100,Pack:10},60],
['Stretch wrap','Packaging',15,{Roll:1},20],['Small cartons','Packaging',1.3,{Box:25,Pack:5},130]];
var NAMES=['Coordinator A','Coordinator B','Coordinator C','Coordinator D'];
var PICK={'Room A':[0,16],'Room B':[4,20],'Room C':[0,4,8,20]};
function demo(){
 var r=rng(42),items=[],log=[],now=new Date(),n=0;
 ROOMS.forEach(function(rm,ri){
  var idx=[];if(ri==2){[0,1,2,3].concat([8,9,10,11,12,13,14,15,16,17,18,19]).forEach(function(i){idx.push(i)})}else{for(var i=PICK[rm][0];i<PICK[rm][1];i++)idx.push(i)}
  idx.forEach(function(ti){var t=T[ti],u={Individual:1};Object.keys(t[3]).forEach(function(k){u[k]=t[3][k]});
   var mu=t[4]*(.6+r()*.8);
   items.push({room:rm,barcode:'7'+(ri+1)+pad(ti)+String(1000+Math.floor(r()*8999)),code:'SKU-'+code(rm)+pad(ti),name:t[0],cat:t[1],price:t[2],units:u,lead:ti%5==0?2:1,usage:null,phys:Math.round(mu*(1.6+r()*1.2)),_mu:mu})})});
 var bal={};items.forEach(function(it){bal[it.room+'|'+it.barcode]=it.phys});
 var oid=0;
 function add(it,dir,qty,unit,d,by,cid,lid){var pieces=qty*it.units[unit];log.push({id:lid,cid:cid,ts:iso(d),room:it.room,barcode:it.barcode,name:it.name,dir:dir,by:by,qty:qty,unit:unit,pieces:pieces,price:it.price,total:+(pieces*it.price).toFixed(2)})}
 var late={'Kapton tape':75,'Pressing tape':60,'Sleeve covers':50,'Isopropyl alcohol, 1 gal':45,'AA batteries':40};
 for(var k=95;k>=0;k--){var d0=new Date(now.getTime()-k*DAY);if(d0.getDay()==0||d0.getDay()==6)continue;
  ROOMS.forEach(function(rm){
   var ri=ROOMS.indexOf(rm),its=items.filter(function(i){return i.room==rm}),orders=1+Math.floor(r()*3);
   for(var o=0;o<orders;o++){var dd=new Date(d0.getFullYear(),d0.getMonth(),d0.getDate(),6+Math.floor(r()*12),Math.floor(r()*60),Math.floor(r()*60)),by=NAMES[Math.floor(r()*4)],cid='OUT-'+code(rm)+'-'+stamp(dd)+'-'+(++oid),lines=1+Math.floor(r()*4);
    for(var l=0;l<lines;l++){var it=its[Math.floor(r()*its.length)],w=it._mu/22,units=Object.keys(it.units).filter(function(x){return it.units[x]>0}),u=units[Math.floor(r()*units.length)];
     if(u!=='Individual'&&it.units[u]>w*4)u='Individual';var q=u==='Individual'?Math.max(1,Math.round(w*3*(.5+r()))):1+Math.floor(r()*2),p=q*it.units[u],bk=it.room+'|'+it.barcode;
     if(bal[bk]>=p){bal[bk]-=p;add(it,'OUT',q,u,dd,by,cid,cid+'-'+pad(l+1))}}}
   if(d0.getDay()==5&&Math.floor(k/7)%2==0){var rd=new Date(d0.getFullYear(),d0.getMonth(),d0.getDate(),8,Math.floor(r()*30),0),cid='IN-'+code(rm)+'-'+stamp(rd),ln=0;
    its.forEach(function(it){var bk=it.room+'|'+it.barcode,rp=it.lead*it._mu;if(late[it.name]&&k<late[it.name])return;
     if(bal[bk]<=rp*1.6){var u=it.units.Box?'Box':'Individual',per=it.units[u],q=Math.max(1,Math.round(it._mu*(it.lead+1.2)/per));bal[bk]+=q*per;add(it,'IN',q,u,rd,'Coordinator A',cid,cid+'-'+pad(++ln))}})}
  })}
 log.sort(function(a,b){return a.ts<b.ts?-1:a.ts>b.ts?1:0});
 items.forEach(function(i){delete i._mu});
 return{items:items,log:log,seq:oid+1}
}

/* ---------- state ---------- */
function load(){try{var j=localStorage.getItem(KEY);if(j){var s=JSON.parse(j);if(s&&s.items&&s.log)return s}}catch(e){}return null}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function find(rm,q){var k=mkey(q);if(!k)return null;return S.items.filter(function(i){return i.room===rm&&(mkey(i.barcode)===k||mkey(i.code)===k||mkey(i.name)===k)})[0]||null}
function it4(rm,bc){for(var i=0;i<S.items.length;i++){var x=S.items[i];if(x.room===rm&&x.barcode===bc)return x}return null}

/* ---------- calculations ---------- */
function compute(){
 var now=new Date(),mStart=new Date(now.getFullYear(),now.getMonth(),1).getTime(),win=now.getTime()-90*DAY,by={};
 S.items.forEach(function(i){by[i.room+'|'+i.barcode]={in_:0,out:0,out90:0}});
 var monthCost=0,monthPieces=0,monthRows=0,cr={},topm={},daily={};
 S.log.forEach(function(l){var o=by[l.room+'|'+l.barcode];if(!o)return;var t=new Date(l.ts.replace(' ','T')).getTime();
  if(l.dir==='IN')o.in_+=l.pieces;else{o.out+=l.pieces;if(t>=win)o.out90+=l.pieces;
   if(t>=mStart){monthCost+=l.total;monthPieces+=l.pieces;monthRows++;cr[l.room]=(cr[l.room]||0)+l.total;var k=l.room+'|'+l.name;topm[k]=(topm[k]||0)+l.pieces}
   if(t>=now.getTime()-30*DAY){var dk=l.ts.slice(0,10);daily[dk]=(daily[dk]||0)+l.total}}});
 var firstT=S.log.length?new Date(S.log[0].ts.replace(' ','T')).getTime():now.getTime();
 var months=Math.max(1,Math.min(3,(now.getTime()-firstT)/(30*DAY)));
 S.items.forEach(function(i){var o=by[i.room+'|'+i.barcode];i._in=o.in_;i._out=o.out;i._cur=i.phys+o.in_-o.out;i._val=Math.max(0,i._cur)*i.price;
  i._mu=isFinite(i.usage)&&i.usage!==null&&i.usage!==''?+i.usage:o.out90/months;
  i._rp=Math.ceil((+i.lead||0)*i._mu);
  i._st=i._cur<=0?'OUT':(i._rp>0&&i._cur<=i._rp)?'REORDER':'OK';
  i._dos=i._mu>0?Math.max(0,i._cur)/(i._mu/30):Infinity;i._sug=i._st==='OK'?0:Math.max(0,Math.ceil(i._mu*((+i.lead||0)+1)-i._cur))});
 calc={monthCost:monthCost,monthPieces:monthPieces,monthRows:monthRows,cr:cr,topm:topm,daily:daily,now:now};
}
function scope(){return S.items.filter(function(i){return room==='ALL'||i.room===room})}

/* ---------- render: dashboard ---------- */
function dash(){
 var L=scope(),re=L.filter(function(i){return i._st!=='OK'}),val=L.reduce(function(s,i){return s+i._val},0),units=L.reduce(function(s,i){return s+Math.max(0,i._cur)},0);
 var rows=S.log.filter(function(l){return l.dir==='OUT'&&(room==='ALL'||l.room===room)&&new Date(l.ts.replace(' ','T'))>=new Date(calc.now.getFullYear(),calc.now.getMonth(),1)});
 var cost=rows.reduce(function(s,l){return s+l.total},0),pcs=rows.reduce(function(s,l){return s+l.pieces},0);
 var K=[['Inventory lines',fmt(L.length),room==='ALL'?'Across 3 supply rooms':room,''],['Units on hand',fmt(units),'Pieces, all items',''],['Inventory value',money(val),'Pieces on hand × unit price',''],['Reorder items',fmt(re.length),L.filter(function(i){return i._st==='OUT'}).length+' out of stock',re.length?'r':''],
  ['Checkout cost this month',money(cost),'Pieces × unit price',''],['Items checked out this month',fmt(pcs),'Pieces',''],['Checkout rows this month',fmt(rows.length),'Scan lines',''],['Low-stock rate',L.length?fmt(re.length/L.length*100,1)+'%':'—','Reorder or out ÷ lines',re.length/(L.length||1)>.15?'w':'']];
 $('kpis').innerHTML=K.map(function(k){return '<div class="kpi '+k[3]+'"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('');
 // daily
 var d=[],mx=1;for(var i=29;i>=0;i--){var dt=new Date(calc.now.getTime()-i*DAY),k=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
  var v=S.log.reduce(function(s,l){return s+(l.dir==='OUT'&&l.ts.slice(0,10)===k&&(room==='ALL'||l.room===room)?l.total:0)},0);d.push([k,v]);mx=Math.max(mx,v)}
 var W=620,H=190,pl=46,pb=22,bw=(W-pl)/30,svg='';
 for(var g=0;g<=4;g++){var y=8+(H-pb-8)*(1-g/4);svg+='<line x1="'+pl+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="#e3dfdf"/><text x="'+(pl-6)+'" y="'+(y+4)+'" font-size="10" text-anchor="end" fill="#625859">$'+fmt(mx*g/4)+'</text>'}
 d.forEach(function(p,i){var h=(H-pb-8)*p[1]/mx;svg+='<rect x="'+(pl+i*bw+bw*.15)+'" y="'+(H-pb-h)+'" width="'+bw*.7+'" height="'+h+'" fill="#ce142d"><title>'+p[0]+': '+money(p[1])+'</title></rect>'});
 [0,15,29].forEach(function(i){svg+='<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-6)+'" font-size="10" text-anchor="middle" fill="#625859">'+d[i][0].slice(5)+'</text>'});
 $('daily').innerHTML='<svg class="ch" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Daily checkout cost">'+svg+'</svg>';
 // status
 var C=[['OK','var(--ok)'],['REORDER','#c2763c'],['OUT','var(--bad)']],cnt=function(s){return L.filter(function(i){return i._st===s}).length};
 $('status').innerHTML='<div class="stack">'+C.map(function(c){var n=cnt(c[0]);return n?'<i style="width:'+n/L.length*100+'%;background:'+c[1]+'" title="'+c[0]+' '+n+'"></i>':''}).join('')+'</div><div class="legend">'+C.map(function(c){return '<span><u style="background:'+c[1]+'"></u>'+c[0]+' '+cnt(c[0])+'</span>'}).join('')+'</div>';
 // by room
 var rk=ROOMS,rm=Math.max.apply(null,rk.map(function(k){return calc.cr[k]||0}).concat([1]));
 $('byRoom').innerHTML=rk.map(function(k){return '<div class="b"><span>'+k+'</span><span class="t"><i style="width:'+(calc.cr[k]||0)/rm*100+'%"></i></span><span class="x">'+money(calc.cr[k]||0)+'</span></div>'}).join('');
 // top
 var tl=Object.keys(calc.topm).filter(function(k){return room==='ALL'||k.split('|')[0]===room}).sort(function(a,b){return calc.topm[b]-calc.topm[a]}).slice(0,8),tm=tl.length?calc.topm[tl[0]]:1;
 $('top').innerHTML=tl.length?tl.map(function(k){var p=k.split('|');return '<div class="b"><span title="'+esc(p[1])+'">'+esc(p[1])+(room==='ALL'?' ('+code(p[0])+')':'')+'</span><span class="t"><i style="width:'+calc.topm[k]/tm*100+'%"></i></span><span class="x">'+fmt(calc.topm[k])+'</span></div>'}).join(''):'<p class="fine">No checkouts this month yet.</p>';
 // reorder
 var R=re.slice().sort(function(a,b){return (a._st==='OUT'?0:1)-(b._st==='OUT'?0:1)||a._cur/(a._rp||1)-b._cur/(b._rp||1)});
 $('reo').innerHTML=R.length?R.map(function(i){return '<tr class="'+(i._st==='OUT'?'out':'low')+'"><td>'+code(i.room)+'</td><td>'+esc(i.name)+'</td><td class="n">'+fmt(i._cur)+'</td><td class="n">'+fmt(i._rp)+'</td><td class="n">'+(isFinite(i._dos)?fmt(i._dos):'—')+'</td><td class="n">'+fmt(i._sug)+'</td></tr>'}).join(''):'<tr><td colspan="6">Nothing needs reordering.</td></tr>';
}

/* ---------- stations ---------- */
function station(dir){
 var el=$('st-'+dir.toLowerCase()),isOut=dir==='OUT',rm=room==='ALL'?ROOMS[0]:room;
 var P=pending[dir],tot=P.reduce(function(s,l){return s+l.total},0);
 el.innerHTML='<div class="panel"><h2>'+(isOut?'Check out':'Scan in')+' · '+rm+'</h2><div class="form">'
 +'<label class="full">'+(isOut?'Name':'Coordinator')+'<select id="n_'+dir+'">'+NAMES.map(function(n){return '<option>'+n+'</option>'}).join('')+'</select></label>'
 +'<label class="full">Barcode (scan, or type a barcode, SKU code or item name)<input type="text" id="b_'+dir+'" class="scanbox" autocomplete="off" placeholder="Scan here"></label>'
 +'<label>Unit type<select id="u_'+dir+'">'+UNITS.map(function(u){return '<option>'+u+'</option>'}).join('')+'</select></label>'
 +'<label>Quantity<input type="number" id="q_'+dir+'" min="1" step="1" placeholder="1"></label>'
 +'<div class="full"><button class="b p" id="add_'+dir+'">Add item</button> <button class="b" id="sim_'+dir+'">Simulate a scan</button></div></div>'
 +'<div class="msg" id="m_'+dir+'" role="status"></div><p class="fine" id="info_'+dir+'"></p></div>'
 +'<div class="panel"><h2>Current '+(isOut?'order':'delivery')+'</h2><div class="tw"><table class="data"><thead><tr><th>Item</th><th>Unit</th><th class="n">Qty</th><th class="n">Pieces</th><th class="n">Total</th><th></th></tr></thead><tbody id="t_'+dir+'">'
 +(P.length?P.map(function(l,i){return '<tr><td>'+esc(l.name)+'</td><td>'+l.unit+'</td><td class="n">'+l.qty+'</td><td class="n">'+fmt(l.pieces)+'</td><td class="n">'+money(l.total)+'</td><td><button class="b d" data-rm="'+i+'" style="padding:3px 9px">Remove</button></td></tr>'}).join(''):'<tr><td colspan="6" class="fine">No items yet.</td></tr>')
 +'</tbody></table></div><div class="total"><span>Total '+money(tot)+'</span><span><button class="b" id="clr_'+dir+'">Clear</button> <button class="b p" id="done_'+dir+'">Complete '+(isOut?'order':'scan in')+'</button></span></div></div>';
 var bc=$('b_'+dir),msg=function(t,c){var m=$('m_'+dir);m.className='msg '+(c||'');m.textContent=t};
 function lookup(){var it=find(rm,bc.value);if(!it){$('info_'+dir).textContent='';return null}
  $('info_'+dir).textContent=it.name+' · on hand '+fmt(it._cur)+' pieces · '+money(it.price)+' per piece';
  var sel=$('u_'+dir);Array.prototype.forEach.call(sel.options,function(o){o.disabled=!(it.units[o.value]>0)});if(sel.selectedOptions[0].disabled)sel.value='Individual';return it}
 bc.oninput=lookup;
 function addLine(){
  var it=lookup(),qv=$('q_'+dir).value.trim(),nm=$('n_'+dir).value,u=$('u_'+dir).value;
  if(!bc.value.trim())return msg('Please scan a barcode.','err');
  if(!it)return msg('"'+bc.value.trim()+'" was not found in '+rm+'.','err');
  var cv=it.units[u]||0;if(cv<=0)return msg(u+' is not available for '+it.name+'.','err');
  var q=qv===''?1:Number(qv);if(!isFinite(q)||q<=0)return msg('Quantity must be greater than zero.','err');if(q!==Math.floor(q))return msg('Quantity must be a whole number.','err');
  var pcs=q*cv,already=P.filter(function(l){return l.barcode===it.barcode}).reduce(function(s,l){return s+l.pieces},0);
  if(isOut&&pcs+already>it._cur)return msg('Only '+fmt(it._cur-already)+' pieces of '+it.name+' are available.','err');
  P.push({barcode:it.barcode,name:it.name,unit:u,qty:q,pieces:pcs,price:it.price,total:+(pcs*it.price).toFixed(2),by:nm,room:rm});
  station(dir);$('m_'+dir).className='msg ok';$('m_'+dir).textContent='Added '+it.name+'.';$('n_'+dir).value=nm;$('b_'+dir).focus()}
 $('add_'+dir).onclick=addLine;
 [bc,$('q_'+dir)].forEach(function(e){e.onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();addLine()}}});
 $('sim_'+dir).onclick=function(){var L=S.items.filter(function(i){return i.room===rm&&(!isOut||i._cur>0)});if(!L.length)return;bc.value=L[Math.floor(Math.random()*L.length)].barcode;lookup();$('q_'+dir).value=''};
 el.querySelectorAll('[data-rm]').forEach(function(b){b.onclick=function(){P.splice(+b.dataset.rm,1);station(dir)}});
 $('clr_'+dir).onclick=function(){pending[dir]=[];station(dir)};
 $('done_'+dir).onclick=function(){
  if(!P.length)return msg('There are no items to complete.','err');
  var now=new Date(),cid=dir+'-'+code(rm)+'-'+stamp(now)+'-'+(S.seq++),by=$('n_'+dir).value;
  P.forEach(function(l,i){var it=it4(rm,l.barcode);S.log.push({id:cid+'-'+pad(i+1),cid:cid,ts:iso(now),room:rm,barcode:l.barcode,name:l.name,dir:dir,by:by,qty:l.qty,unit:l.unit,pieces:l.pieces,price:l.price,total:l.total})});
  var n=P.length;pending[dir]=[];save();compute();station(dir);var m=$('m_'+dir);m.className='msg ok';m.textContent=(isOut?'Order':'Scan in')+' '+cid+' saved: '+n+' line'+(n>1?'s':'')+'.'};
 if(!el.dataset.f){el.dataset.f=1}
}

/* ---------- inventory ---------- */
function inv(){
 var q=mkey($('q').value),f=$('flt').value;
 var L=scope().filter(function(i){return(!f||i._st===f)&&(!q||mkey(i.name+i.barcode+i.code).indexOf(q)>-1)}).sort(function(a,b){return(a._st==='OK')-(b._st==='OK')||a.room.localeCompare(b.room)||a.name.localeCompare(b.name)});
 var cls={OK:'ok',REORDER:'warn',OUT:'bad'};
 $('invTb').innerHTML=L.map(function(i){var k=S.items.indexOf(i);return '<tr class="'+(i._st==='OUT'?'out':i._st==='REORDER'?'low':'')+'"><td>'+code(i.room)+'</td><td>'+esc(i.name)+'</td><td>'+esc(i.barcode)+'</td><td class="n">'+money(i.price)+'</td>'
  +'<td class="n"><input type="number" min="0" data-k="'+k+'" data-f="phys" value="'+i.phys+'"></td><td class="n">'+fmt(i._in)+'</td><td class="n">'+fmt(i._out)+'</td><td class="n"><b>'+fmt(i._cur)+'</b></td><td class="n">'+money(i._val)+'</td>'
  +'<td class="n"><input type="number" min="0" step="0.5" data-k="'+k+'" data-f="lead" value="'+i.lead+'"></td><td class="n"><input type="number" min="0" data-k="'+k+'" data-f="usage" value="'+(i.usage===null||i.usage===''?'':i.usage)+'" placeholder="'+fmt(i._mu)+'"></td><td class="n">'+fmt(i._rp)+'</td><td class="n">'+(isFinite(i._dos)?fmt(i._dos):'—')+'</td><td><span class="pill '+cls[i._st]+'">'+i._st+'</span></td></tr>'}).join('');
 $('invCnt').textContent=L.length+' of '+scope().length+' items';
 $('invTb').querySelectorAll('input').forEach(function(inp){inp.onchange=function(){var it=S.items[+inp.dataset.k],f=inp.dataset.f,v=inp.value.trim();
  if(f==='usage')it.usage=v===''?null:Math.max(0,+v);else it[f]=Math.max(0,+v||0);save();compute();inv()}});
}

/* ---------- log ---------- */
function logv(){
 var q=mkey($('lq').value),d=$('ldir').value;
 var L=S.log.filter(function(l){return(room==='ALL'||l.room===room)&&(!d||l.dir===d)&&(!q||mkey(l.name+l.barcode+l.by).indexOf(q)>-1)});
 $('logCnt').textContent=fmt(L.length)+' rows'+(L.length>300?' (showing latest 300)':'');
 $('logTb').innerHTML=L.slice(-300).reverse().map(function(l){return '<tr><td>'+esc(l.id)+'</td><td>'+l.ts+'</td><td>'+code(l.room)+'</td><td><span class="pill '+(l.dir==='OUT'?'warn':'ok')+'">'+l.dir+'</span></td><td>'+esc(l.name)+'</td><td class="n">'+l.qty+'</td><td>'+l.unit+'</td><td class="n">'+fmt(l.pieces)+'</td><td class="n">'+money(l.price)+'</td><td class="n">'+money(l.total)+'</td><td>'+esc(l.by)+'</td></tr>'}).join('');
}
function csvq(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function dl(name,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function expLog(){var L=S.log.filter(function(l){return room==='ALL'||l.room===room});
 dl((room==='ALL'?'All_Rooms':code(room))+'_Data_Log.csv',['Log ID,Item Name,Timestamp,Barcode,Scan (In/Out),Scanned by,Quantity,Checkout ID,Unit Price,Order Total,Supply Room,Unit Type'].concat(L.map(function(l){return [l.id,l.name,l.ts,l.barcode,l.dir==='IN'?'In':'Out',l.by,l.qty,l.cid,l.price,l.total,l.room,l.unit].map(csvq).join(',')})).join('\n'))}
function parseCSV(t){var r=[],row=[],f='',q=false,i,c;t=t.replace(/^﻿/,'');for(i=0;i<t.length;i++){c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){row.push(f);f=''}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;row.push(f);f='';if(row.length>1||row[0]!=='')r.push(row);row=[]}else f+=c}if(f!==''||row.length){row.push(f);r.push(row)}return r}
function importText(text,fname){
 var t=parseCSV(text);if(t.length<2)return{added:0,dup:0,bad:0,unk:{}};
 var h=t[0].map(mkey),ix=function(a){for(var i=0;i<a.length;i++){var p=h.indexOf(a[i]);if(p>-1)return p}return -1};
 var c={id:ix(['logid','orderid']),cid:ix(['checkoutid','lineid']),ts:ix(['timestamp','datetime']),bc:ix(['barcode']),dir:ix(['scaninout','transaction','scan']),by:ix(['scannedbyspvcl','scannedby','coordinator','name']),q:ix(['quantity','qty']),pr:ix(['unitprice']),room:ix(['supplyroom','location']),unit:ix(['unittype','unit'])};
 if(c.bc<0||c.dir<0||c.q<0)throw new Error('Missing required columns (Barcode, Scan (In/Out), Quantity) in '+fname);
 var fr=(/(?:^|[^a-z])(?:room[ _-]?)?([abc])(?:[ _-]|data)/i.exec(fname)||[])[1],defRoom=fr?'Room '+fr.toUpperCase():null;
 var seen={};S.log.forEach(function(l){seen[l.room+'|'+l.id]=1});
 var res={added:0,dup:0,bad:0,unk:{}};
 t.slice(1).forEach(function(r){
  var rm=(c.room>-1&&r[c.room]||'').trim()||defRoom,bcv=String(r[c.bc]||'').replace(/[^0-9A-Za-z]/g,''),dv=/out/i.test(r[c.dir])?'OUT':/in/i.test(r[c.dir])?'IN':null,q=+r[c.q];
  var d=new Date(String(c.ts>-1?r[c.ts]:'').trim().replace(' ','T'));
  if(!rm||ROOMS.indexOf(rm)<0||!bcv||!dv||!isFinite(q)||q<=0||isNaN(d)){res.bad++;return}
  var it=it4(rm,bcv);if(!it){res.unk[bcv]=1;return}
  var u=(c.unit>-1&&UNITS.filter(function(x){return x.toLowerCase()===String(r[c.unit]).trim().toLowerCase()})[0])||'Individual';if(!(it.units[u]>0))u='Individual';
  var cid=(c.cid>-1&&r[c.cid])||(c.id>-1&&r[c.id])||'',id=(c.id>-1&&r[c.id])||(cid+'-'+bcv+'-'+dv);
  var key=rm+'|'+id;if(seen[key]){res.dup++;return}seen[key]=1;
  var pcs=q*it.units[u],pr=c.pr>-1&&isFinite(+r[c.pr])&&+r[c.pr]>0?+r[c.pr]:it.price;
  S.log.push({id:id,cid:cid,ts:iso(d),room:rm,barcode:bcv,name:it.name,dir:dv,by:(c.by>-1&&r[c.by])||'',qty:q,unit:u,pieces:pcs,price:pr,total:+(pcs*pr).toFixed(2)});res.added++});
 S.log.sort(function(a,b){return a.ts<b.ts?-1:a.ts>b.ts?1:0});return res}

/* ---------- ui ---------- */
function show(t){tab=t;['dash','out','in','inv','log','how'].forEach(function(x){$('p-'+x).classList.toggle('hidden',x!==t)});
 document.querySelectorAll('#tabs button').forEach(function(b){b.setAttribute('aria-selected',b.dataset.t===t)});render()}
function render(){compute();if(tab==='dash')dash();else if(tab==='out')station('OUT');else if(tab==='in')station('IN');else if(tab==='inv')inv();else if(tab==='log')logv()}
function init(){
 S=load();if(!S){S=demo();save()}
 $('room').innerHTML='<option value="ALL">All rooms</option>'+ROOMS.map(function(r){return '<option>'+r+'</option>'}).join('');
 $('room').onchange=function(){room=this.value;pending={IN:[],OUT:[]};render()};
 document.querySelectorAll('#tabs button').forEach(function(b){b.onclick=function(){show(b.dataset.t)}});
 $('q').oninput=inv;$('flt').onchange=inv;$('lq').oninput=logv;$('ldir').onchange=logv;
 $('resetDemo').onclick=function(){if(confirm('Replace everything in this browser with fresh demo data?')){S=demo();save();pending={IN:[],OUT:[]};render()}};
 $('expLog').onclick=expLog;
 $('expReo').onclick=function(){var L=scope().filter(function(i){return i._st!=='OK'});dl('reorder_list.csv',['Supply Room,Barcode,Item,Status,On Hand,Reorder Point,Days of Supply,Suggested Order'].concat(L.map(function(i){return [i.room,i.barcode,i.name,i._st,i._cur,i._rp,isFinite(i._dos)?Math.round(i._dos):'',i._sug].map(csvq).join(',')})).join('\n'))};
 $('impBtn').onclick=function(){$('impFile').click()};
 $('impFile').onchange=function(e){var fs=Array.prototype.slice.call(e.target.files),tot={added:0,dup:0,bad:0,unk:{}},m=$('impMsg');m.className='msg';
  Promise.all(fs.map(function(f){return f.text().then(function(t){return importText(t,f.name)})})).then(function(rs){
   rs.forEach(function(r){tot.added+=r.added;tot.dup+=r.dup;tot.bad+=r.bad;Object.keys(r.unk).forEach(function(k){tot.unk[k]=1})});save();render();
   var nu=Object.keys(tot.unk).length;m.className='msg ok';m.textContent='Imported '+tot.added+' rows. Skipped '+tot.dup+' already imported, '+tot.bad+' unreadable'+(nu?', and '+nu+' barcode'+(nu>1?'s':'')+' not in the item list':'')+'.'
  }).catch(function(er){m.className='msg err';m.textContent=er.message});e.target.value=''};
 $('addItem').onclick=function(){var rm=room==='ALL'?ROOMS[0]:room,m=$('addMsg'),bc=$('a_bc').value.trim(),nm=$('a_nm').value.trim(),pr=+$('a_pr').value;
  if(!bc||!nm||!(pr>=0)||$('a_pr').value==='')return m.className='msg err',m.textContent='Barcode, name and price are required.';
  if(it4(rm,bc))return m.className='msg err',m.textContent='That barcode already exists in '+rm+'.';
  var u={Individual:1};[['Box','a_box'],['Pack','a_pack'],['Roll','a_roll']].forEach(function(p){var v=+$(p[1]).value;if(v>0)u[p[0]]=v});
  S.items.push({room:rm,barcode:bc,code:'SKU-'+bc,name:nm,cat:'Other',price:pr,units:u,lead:+$('a_lt').value||0,usage:null,phys:+$('a_pc').value||0});save();render();m.className='msg ok';m.textContent='Added '+nm+' to '+rm+'.'};
 render();
}
init();
})();
