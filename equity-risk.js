(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
var COL=['#ce142d','#b5651d','#2f6f9f','#7a4e9e','#c2453a','#6b8e23','#2a9d8f','#8a6d3b','#5c5758','#d4a017'];
var D,sel=['SPY','QQQ','JPM','GS','TLT'],range='all',W={};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function pc(x,d){return isFinite(x)?(x*100).toFixed(d==null?1:d)+'%':'n/a'}
function cls(x){return x>=0?'pos':'neg'}
function mean(a){return a.reduce(function(s,x){return s+x},0)/a.length}
function sd(a){var m=mean(a);return Math.sqrt(a.reduce(function(s,x){return s+(x-m)*(x-m)},0)/(a.length-1))}
function mlabel(ym){var p=ym.split('-');return['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1]-1]+' '+p[0]}
function bySym(s){return D.tickers.filter(function(t){return t.symbol===s})[0]}

/* ---------- series helpers (index based on D.months) ---------- */
function startIdx(){var n=D.months.length;return range==='all'?0:Math.max(0,n-1-(+range))}
function ser(sym,from){var t=bySym(sym),p=t.prices,first=-1,i;for(i=from;i<p.length;i++){if(p[i]!=null){first=i;break}}
 if(first<0)return null;var idx=[],pr=[];for(i=first;i<p.length;i++){if(p[i]!=null){idx.push(i);pr.push(p[i])}}return{sym:sym,idx:idx,p:pr}}
function rets(s){var r=[];for(var i=1;i<s.p.length;i++)r.push({i:s.idx[i],r:s.p[i]/s.p[i-1]-1});return r}
function rfm(i){var v=D.macro.rf_pct[i];return v==null?0:v/100/12}
function stats(s,spy){
 var r=rets(s),n=r.length;if(n<12)return null;
 var rr=r.map(function(x){return x.r}),cagr=Math.pow(s.p[s.p.length-1]/s.p[0],12/n)-1,vol=sd(rr)*Math.sqrt(12);
 var ex=r.map(function(x){return x.r-rfm(x.i)}),sh=mean(ex)*12/vol;
 var pk=-1/0,mdd=0;s.p.forEach(function(v){pk=Math.max(pk,v);mdd=Math.min(mdd,v/pk-1)});var now=s.p[s.p.length-1]/pk-1;
 var w12=1/0;for(var i=12;i<s.p.length;i++)w12=Math.min(w12,s.p[i]/s.p[i-12]-1);
 var beta=NaN,corr=NaN;if(spy){var m={};spy.forEach(function(x){m[x.i]=x.r});var a=[],b=[];r.forEach(function(x){if(m[x.i]!=null){a.push(x.r);b.push(m[x.i])}});
  if(a.length>=12){var ma=mean(a),mb=mean(b),cv=0,vb=0,va=0;for(var k=0;k<a.length;k++){cv+=(a[k]-ma)*(b[k]-mb);vb+=(b[k]-mb)*(b[k]-mb);va+=(a[k]-ma)*(a[k]-ma)}beta=cv/vb;corr=cv/Math.sqrt(va*vb)}}
 return{cagr:cagr,vol:vol,sharpe:sh,mdd:mdd,now:now,w12:isFinite(w12)?w12:NaN,beta:beta,corr:corr,since:D.months[s.idx[0]],n:n}
}

/* ---------- charts ---------- */
function lineChart(el,series,o){
 var W_=760,H=o.h||300,pl=54,pr=10,pt=10,pb=24,all=[];series.forEach(function(s){s.pts.forEach(function(p){all.push(p[1])})});
 var mn=o.min!=null?o.min:Math.min.apply(null,all),mx=o.max!=null?o.max:Math.max.apply(null,all),log=o.log;
 if(log){mn=Math.max(mn,1)}var f=function(v){return log?Math.log(v):v},lo=f(mn),hi=f(mx);if(hi===lo)hi=lo+1;
 var n=D.months.length,x=function(i){return pl+(W_-pl-pr)*(i-o.i0)/Math.max(1,(n-1-o.i0))},y=function(v){return pt+(H-pt-pb)*(1-(f(v)-lo)/(hi-lo))};
 var svg='',ticks=5;for(var g=0;g<ticks;g++){var v=log?Math.exp(lo+(hi-lo)*g/(ticks-1)):mn+(mx-mn)*g/(ticks-1),yy=y(v);svg+='<line x1="'+pl+'" x2="'+(W_-pr)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e3dfdf"/><text x="'+(pl-6)+'" y="'+(yy+4)+'" font-size="10" text-anchor="end" fill="#625859">'+o.fmt(v)+'</text>'}
 var ys=[];for(var i=o.i0;i<n;i++){var m=D.months[i];if(m.slice(5)==='01'&&(+m.slice(0,4))%Math.max(1,Math.round((n-o.i0)/12/6))===0)ys.push(i)}
 if(o.zero!=null){svg+='<line x1="'+pl+'" x2="'+(W_-pr)+'" y1="'+y(o.zero)+'" y2="'+y(o.zero)+'" stroke="#948d8e"/>'}
 ys.forEach(function(i){svg+='<text x="'+x(i)+'" y="'+(H-6)+'" font-size="10" text-anchor="middle" fill="#625859">'+D.months[i].slice(0,4)+'</text>'});
 series.forEach(function(s){svg+='<polyline fill="none" stroke="'+s.color+'" stroke-width="'+(s.w||1.8)+'" stroke-linejoin="round" points="'+s.pts.map(function(p){return x(p[0]).toFixed(1)+','+y(p[1]).toFixed(1)}).join(' ')+'"/>'});
 svg+='<line id="'+o.id+'x" y1="'+pt+'" y2="'+(H-pb)+'" stroke="#625859" stroke-dasharray="3 3" style="display:none"/>';
 el.innerHTML='<svg class="ch" viewBox="0 0 '+W_+' '+H+'" role="img" aria-label="'+o.label+'">'+svg+'</svg>';
 if(o.tip){var sv=el.firstChild,tip=$('tip'),box=el.parentNode;sv.onmousemove=function(e){var r=sv.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W_,i=Math.round(o.i0+(px-pl)/(W_-pl-pr)*(n-1-o.i0));if(i<o.i0||i>=n)return;
   var line=document.getElementById(o.id+'x');line.style.display='';line.setAttribute('x1',x(i));line.setAttribute('x2',x(i));
   tip.innerHTML='<b>'+mlabel(D.months[i])+'</b><br>'+series.map(function(s){var p=s.pts.filter(function(q){return q[0]===i})[0];return p?'<span style="color:'+s.color+'">■</span> '+esc(s.name)+': '+o.fmt(p[1]):''}).join('<br>');
   tip.style.display='block';var bx=box.getBoundingClientRect();tip.style.left=Math.min(bx.width-170,Math.max(6,e.clientX-bx.left+14))+'px';tip.style.top=(e.clientY-bx.top+10)+'px'};
  sv.onmouseleave=function(){tip.style.display='none';var l=document.getElementById(o.id+'x');if(l)l.style.display='none'}}
}
function legend(el,items){el.innerHTML=items.map(function(s){return '<span><u style="background:'+s.color+'"></u>'+esc(s.name)+'</span>'}).join('')}

/* ---------- render ---------- */
function render(){
 if(!sel.length){$('out').classList.add('hidden');$('status').className='status';$('status').textContent='Select at least one security.';return}
 $('out').classList.remove('hidden');$('status').textContent='';
 var from=startIdx(),spyS=ser('SPY',from),spyR=spyS?rets(spyS):null,S=sel.map(function(s,i){var x=ser(s,from);return x?{sym:s,s:x,col:COL[D.tickers.indexOf(bySym(s))%COL.length],st:stats(x,spyR)}:null}).filter(Boolean);
 if(!S.length){$('status').textContent='No data in this period.';return}
 var best=S.slice().filter(function(x){return x.st}).sort(function(a,b){return b.st.sharpe-a.st.sharpe})[0],low=S.filter(function(x){return x.st}).sort(function(a,b){return a.st.mdd-b.st.mdd})[0],hi=S.filter(function(x){return x.st}).sort(function(a,b){return b.st.cagr-a.st.cagr})[0];
 var K=[];if(hi)K.push(['Highest return',hi.sym,pc(hi.st.cagr)+' per year since '+mlabel(hi.st.since)]);if(best)K.push(['Best risk-adjusted',best.sym,'Sharpe '+best.st.sharpe.toFixed(2)]);if(low)K.push(['Deepest drawdown',low.sym,pc(low.st.mdd)+' peak to trough']);
 K.push(['Securities shown',S.length,'Period: '+(range==='all'?'full history':$('rng').selectedOptions[0].text.toLowerCase())]);
 $('kpis').innerHTML=K.map(function(k){return '<div class="kpi"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('');
 // growth: common start so lines compare fairly
 var cs=Math.max.apply(null,S.map(function(x){return x.s.idx[0]})),ser1=S.map(function(x){var b=null,pts=[];x.s.idx.forEach(function(ix,k){if(ix>=cs){if(b==null)b=x.s.p[k];pts.push([ix,10000*x.s.p[k]/b])}});return{name:x.sym,color:x.col,pts:pts}});
 lineChart($('growth'),ser1,{id:'g',i0:cs,fmt:function(v){return '$'+Math.round(v).toLocaleString('en-US')},log:true,tip:true,label:'Growth of 10,000 dollars',h:320});legend($('lg'),ser1);
 $('growth').parentNode.querySelector('.legend').insertAdjacentHTML('beforeend','<span class="fine">All lines start together on '+mlabel(D.months[cs])+' (the latest start among your picks).</span>');
 // table
 $('rt').innerHTML=S.map(function(x){var s=x.st;if(!s)return '<tr><td>'+x.sym+'</td><td colspan="9">Less than a year of data in this period.</td></tr>';var t=bySym(x.sym);
  return '<tr><td><b>'+x.sym+'</b> <span class="fine">'+esc(t.name)+'</span></td><td>'+mlabel(s.since)+'</td><td class="n '+cls(s.cagr)+'">'+pc(s.cagr)+'</td><td class="n">'+pc(s.vol)+'</td><td class="n">'+s.sharpe.toFixed(2)+'</td><td class="n neg">'+pc(s.mdd)+'</td><td class="n neg">'+pc(s.now)+'</td><td class="n '+cls(s.w12)+'">'+pc(s.w12)+'</td><td class="n">'+(isFinite(s.beta)?s.beta.toFixed(2):'n/a')+'</td><td class="n">'+(isFinite(s.corr)?s.corr.toFixed(2):'n/a')+'</td></tr>'}).join('');
 // drawdown
 var dds=S.map(function(x){var pk=-1/0,pts=[];x.s.p.forEach(function(v,k){pk=Math.max(pk,v);pts.push([x.s.idx[k],v/pk-1])});return{name:x.sym,color:x.col,pts:pts,w:1.4}}),i0=Math.min.apply(null,S.map(function(x){return x.s.idx[0]}));
 lineChart($('dd'),dds,{id:'d',i0:i0,fmt:function(v){return pc(v,0)},min:Math.min.apply(null,dds.map(function(s){return Math.min.apply(null,s.pts.map(function(p){return p[1]}))}))*1.05,max:0,zero:0,h:280,label:'Drawdown from previous peak'});
 // correlation (common months)
 var R=S.map(function(x){var m={};rets(x.s).forEach(function(r){m[r.i]=r.r});return m}),common=Object.keys(R[0]).filter(function(k){return R.every(function(m){return m[k]!=null})});
 var cor=function(a,b){var xa=common.map(function(k){return R[a][k]}),xb=common.map(function(k){return R[b][k]}),ma=mean(xa),mb=mean(xb),cv=0,va=0,vb=0;for(var k=0;k<xa.length;k++){cv+=(xa[k]-ma)*(xb[k]-mb);va+=(xa[k]-ma)*(xa[k]-ma);vb+=(xb[k]-mb)*(xb[k]-mb)}return cv/Math.sqrt(va*vb)};
 if(common.length>=12&&S.length>1){$('cor').innerHTML='<thead><tr><th></th>'+S.map(function(x){return '<th class="n">'+x.sym+'</th>'}).join('')+'</tr></thead><tbody>'+S.map(function(a,i){return '<tr><th>'+a.sym+'</th>'+S.map(function(b,j){var c=i===j?1:cor(i,j),al=Math.abs(c),bg=c>=0?'rgba(200,16,46,'+(al*.7).toFixed(2)+')':'rgba(47,111,159,'+(al*.7).toFixed(2)+')';return '<td style="background:'+bg+';color:'+(al>.55?'#fff':'#282021')+'">'+c.toFixed(2)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody>'}else $('cor').innerHTML='<tbody><tr><td class="fine">Pick at least two securities with a year of overlapping data.</td></tr></tbody>';
 regimes(S);portfolio(S);
}

/* ---------- regimes ---------- */
function regimes(S){
 var n=D.months.length,curve=D.macro.curve,cpi=D.macro.cpi_yoy,H=12;
 var ep=0,prev=false;curve.forEach(function(c){var inv=c!=null&&c<0;if(inv&&!prev)ep++;prev=inv});
 var cells=function(sym,test){var t=bySym(sym).prices,v=[];for(var i=0;i+H<n;i++){if(t[i]==null||t[i+H]==null)continue;var g=test(i);if(g!=null)v.push(t[i+H]/t[i]-1)}return v};
 var show=function(v){return v.length>=6?'<span class="'+cls(mean(v))+'">'+pc(mean(v))+'</span> <span class="fine">('+v.length+' mo)</span>':'<span class="fine">too few</span>'};
 $('reg').innerHTML=S.map(function(x){var c=function(f){return show(cells(x.sym,f))};
  return '<tr><td><b>'+x.sym+'</b></td><td class="n">'+c(function(i){return curve[i]!=null&&curve[i]<0?1:null})+'</td><td class="n">'+c(function(i){return curve[i]!=null&&curve[i]>=0?1:null})+'</td><td class="n">'+c(function(i){return cpi[i]!=null&&cpi[i]>=3?1:null})+'</td><td class="n">'+c(function(i){return cpi[i]!=null&&cpi[i]<3?1:null})+'</td></tr>'}).join('');
 $('regSub').textContent='Average 12-month price return starting from months in each regime, over the full downloaded history (not the period selected above).';
}

/* ---------- portfolio ---------- */
function portfolio(S){
 var keep=S.map(function(x){return x.sym});keep.forEach(function(k){if(W[k]==null)W[k]=100/keep.length});
 $('wts').innerHTML=keep.map(function(k){return '<label>'+k+' weight (%)<input type="number" min="0" max="100" step="5" data-s="'+k+'" value="'+W[k]+'"></label>'}).join('');
 $('wts').querySelectorAll('input').forEach(function(i){i.onchange=function(){W[i.dataset.s]=Math.max(0,+i.value||0);portfolio(S)}});
 var tot=keep.reduce(function(s,k){return s+W[k]},0);if(tot<=0){$('pk').innerHTML='';$('pg').innerHTML='<p class="fine">Enter at least one weight above zero.</p>';return}
 var R=keep.map(function(k){var m={},x=S.filter(function(z){return z.sym===k})[0];rets(x.s).forEach(function(r){m[r.i]=r.r});return m}),spy=ser('SPY',startIdx()),sm={};if(spy)rets(spy).forEach(function(r){sm[r.i]=r.r});
 var idx=Object.keys(R[0]).map(Number).filter(function(i){return R.every(function(m){return m[i]!=null})&&sm[i]!=null}).sort(function(a,b){return a-b});
 if(idx.length<24){$('pk').innerHTML='';$('pg').innerHTML='<p class="fine">Not enough overlapping months with SPY. Choose a shorter period or different securities.</p>';return}
 var pr=idx.map(function(i){return keep.reduce(function(s,k,j){return s+W[k]/tot*R[j][i]},0)}),br=idx.map(function(i){return sm[i]});
 var st=function(r,ix){var g=1,pk=1,mdd=0,v=[1];r.forEach(function(x){g*=1+x;pk=Math.max(pk,g);mdd=Math.min(mdd,g/pk-1);v.push(g)});var vol=sd(r)*Math.sqrt(12),c=Math.pow(g,12/r.length)-1,ex=r.map(function(x,k){return x-rfm(ix[k])});return{c:c,vol:vol,sh:mean(ex)*12/vol,mdd:mdd,v:v}};
 var p=st(pr,idx),b=st(br,idx);
 $('pk').innerHTML=[['Portfolio return / yr',pc(p.c),'SPY '+pc(b.c)],['Volatility',pc(p.vol),'SPY '+pc(b.vol)],['Sharpe ratio',p.sh.toFixed(2),'SPY '+b.sh.toFixed(2)],['Max drawdown',pc(p.mdd),'SPY '+pc(b.mdd)]].map(function(k){return '<div class="kpi"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('');
 var pts=function(v){return v.map(function(x,k){return[k?idx[k-1]:idx[0]-1,10000*x]})},s1=[{name:'Your portfolio',color:'#ce142d',pts:pts(p.v),w:2.2},{name:'SPY',color:'#948d8e',pts:pts(b.v)}];
 lineChart($('pg'),s1,{id:'p',i0:idx[0]-1,fmt:function(v){return '$'+Math.round(v).toLocaleString('en-US')},log:true,h:260,label:'Portfolio versus SPY growth'});legend($('plg'),s1);
}

/* ---------- init ---------- */
function init(){
 fetch('data/equities.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
  D=d;var last=d.months[d.months.length-1];
  $('asof').textContent='Data through '+mlabel(last)+' · refreshed '+d.generated_utc+' UTC'+(d.synthetic?' · TEST FIXTURE, NOT REAL PRICES':'')+'.';
  $('chips').innerHTML=d.tickers.map(function(t,i){return '<button class="chip" data-s="'+t.symbol+'" aria-pressed="'+(sel.indexOf(t.symbol)>-1)+'" title="'+esc(t.name+' · '+t.group)+'">'+t.symbol+'</button>'}).join('');
  $('chips').querySelectorAll('button').forEach(function(b){b.onclick=function(){var s=b.dataset.s,k=sel.indexOf(s);if(k>-1)sel.splice(k,1);else sel.push(s);b.setAttribute('aria-pressed',k===-1);render()}});
  $('rng').onchange=function(){range=this.value;render()};render();
 }).catch(function(){$('asof').textContent='';var s=$('status');s.className='status err';s.textContent='The price data file has not been generated yet. In the GitHub repository, open Actions, choose "Update data", and click Run workflow. Refresh this page after it finishes.'});
}
init();
})();

Findings.load('data/equities.json').then(function(d){if(!d)return;var F=Findings.equity(d);if(F&&document.getElementById('kf')){document.getElementById('kf').innerHTML=Findings.cards(F.items);document.getElementById('kfH').textContent='Key findings, '+F.period}});
