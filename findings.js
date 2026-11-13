/* Builds every written finding from the data files, so the text always matches the dashboards. */
(function(){
var COMM_MAX=1e7; /* $10 billion, in thousands */
function last(b){return b.quarters[b.quarters.length-1]}
function yoy(b){var q=b.quarters,n=q.length;return n>=5&&q[n-5].deposits?(q[n-1].deposits/q[n-5].deposits-1)*100:null}
function med(a){a=a.filter(function(x){return x!=null&&isFinite(x)}).sort(function(x,y){return x-y});if(!a.length)return null;var m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2}
var CUT={roa:0.5,dnim:0.25,eq:8,ld:90,ddep:5,nc:3};
function setCutoffs(c){if(!c)return;['roa','dnim','eq','ld','ddep','nc'].forEach(function(k){if(typeof c[k]==='number')CUT[k]=c[k]})}
function flags(b){var qs=b.quarters,n=qs.length,q=qs[n-1],y=yoy(b),f=[];
 if(q.roa!=null&&q.roa<CUT.roa)f.push('Low ROA');
 if(n>=5&&q.nim!=null&&qs[n-5].nim!=null&&qs[n-5].nim-q.nim>=CUT.dnim)f.push('Margin squeeze');
 if(q.eq_assets!=null&&q.eq_assets<CUT.eq)f.push('Thin equity');
 if(q.loans_dep!=null&&q.loans_dep>CUT.ld)f.push('High loans/deposits');
 if(y!=null&&-y>=CUT.ddep)f.push('Deposit outflow');
 if(q.noncurrent!=null&&q.noncurrent>CUT.nc)f.push('Asset quality');return f}
function tip(){return {'Low ROA':'Return on assets under '+CUT.roa+'%','Margin squeeze':'Net interest margin down '+CUT.dnim+' points or more from a year earlier','Thin equity':'Equity under '+CUT.eq+'% of assets','High loans/deposits':'Loans above '+CUT.ld+'% of deposits','Deposit outflow':'Deposits down '+CUT.ddep+'% or more year over year','Asset quality':'Noncurrent loans above '+CUT.nc+'% of loans'}}
var W=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function w(n){return W[n]!=null?W[n]:String(n)}
function lc(t){return t.charAt(0).toLowerCase()+t.slice(1)}
function cap(t){return t.charAt(0).toUpperCase()+t.slice(1)}
function pc(x,d){return x==null?'n/a':x.toFixed(d==null?2:d)+'%'}
function qlabel(s){return 'Q'+Math.ceil(+s.slice(4,6)/3)+' '+s.slice(0,4)}
function money(k){var d=k*1000;return d>=1e9?'$'+(d/1e9).toFixed(0)+' billion':'$'+Math.round(d/1e6)+' million'}

function bank(D,BT){
 var az=D.banks.filter(function(b){return b.group==='az'}),big=D.banks.filter(function(b){return b.group==='big'}),peer=D.banks.filter(function(b){return b.group==='peer'});
 if(az.length<3||big.length<3)return null;
 var comm=az.filter(function(b){return last(b).assets<COMM_MAX}),giants=az.filter(function(b){return last(b).assets>=COMM_MAX});
 var L=function(g,k){return med(g.map(function(b){return last(b)[k]}))};
 var ql=qlabel(D.latest),items=[],hasPeer=peer.length>=8&&comm.length>=3;
 var nfA=az.filter(function(b){return flags(b).length}).length,nfC=comm.filter(function(b){return flags(b).length}).length,nfP=peer.filter(function(b){return flags(b).length}).length;
 var out={quarter:ql,hasPeer:hasPeer,flagged:nfA,total:az.length};
 if(hasPeer){
  items.push(['Against similar-sized banks, Arizona community banks earn '+(L(comm,'roa')<L(peer,'roa')?'less':'more')+'.','The '+w(comm.length)+' Arizona banks under $10 billion had a median return on assets of '+pc(L(comm,'roa'))+', against '+pc(L(peer,'roa'))+' for '+peer.length+' banks of similar size from other states ('+qlabel(D.latest)+'). The ten largest banks earned '+pc(L(big,'roa'))+', which mostly reflects size and business mix, not Arizona.']);
  var near=Math.abs(L(comm,'loans_dep')-L(peer,'loans_dep'))<Math.abs(L(comm,'loans_dep')-L(big,'loans_dep'))&&Math.abs(L(comm,'eff')-L(peer,'eff'))<Math.abs(L(comm,'eff')-L(big,'eff'));
  items.push([near?'Their business model matches similar-sized peers more than it matches the large banks.':'Their balance sheet differs from both similar-sized peers and the large banks.','Arizona community banks lent out '+Math.round(L(comm,'loans_dep'))+'% of deposits and ran an efficiency ratio of '+Math.round(L(comm,'eff'))+'%, against '+Math.round(L(peer,'loans_dep'))+'% and '+Math.round(L(peer,'eff'))+'% at similar-sized peers and '+Math.round(L(big,'loans_dep'))+'% and '+Math.round(L(big,'eff'))+'% at the ten largest banks.'+(near?' Most of the gap to the largest banks therefore comes from size and funding, not from Arizona.':'')]);
  var dC=nfC/comm.length,dP=nfP/peer.length,cmp=dC>dP+.05?'more often than':dC<dP-.05?'less often than':'about as often as';
  items.push(['The warning screens flagged '+Math.round(100*dC)+'% of Arizona community banks and '+Math.round(100*dP)+'% of peers.','Arizona community banks were flagged '+cmp+' similar-sized peers, so the Arizona pattern is '+(Math.abs(dC-dP)<=.05?'typical of small banks in the region.':dC>dP?'weaker than the region, and worth a closer look.':'stronger than the region.')+' Screens that flag a large share of ordinary small banks are a starting point for review, not a ranking.']);
 }else{
  items.push(['Arizona banks earn '+(L(az,'roa')<L(big,'roa')?'less':'more')+' than the largest banks.','Median return on assets was '+pc(L(az,'roa'))+' against '+pc(L(big,'roa'))+' for the ten largest U.S. banks.']);
  items.push(['They lend out '+(L(az,'loans_dep')>L(big,'loans_dep')?'more':'less')+' of their deposits.','Median loans were '+Math.round(L(az,'loans_dep'))+'% of deposits against '+Math.round(L(big,'loans_dep'))+'% at the largest banks, and the median efficiency ratio was '+Math.round(L(az,'eff'))+'% against '+Math.round(L(big,'eff'))+'%.']);
  items.push([cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped at least one warning screen.','A similar-sized peer group appears here once the weekly data refresh has run.']);
 }
 if(giants.length){var tot=az.reduce(function(s,b){return s+last(b).assets},0),gs=giants.reduce(function(s,b){return s+last(b).assets},0);
  items.push([cap(w(giants.length))+' bank'+(giants.length>1?'s hold':' holds')+' '+Math.round(100*gs/tot)+'% of Arizona-headquartered bank assets.','That is why the community banks are compared with similar-sized peers and the giants with the ten largest banks.'])}
 var bt=backtest(BT);if(bt){items.push([bt.head,bt.text]);out.backtest=bt;var sg=signal(BT);if(sg)items.push(sg)}
 /* structured layout for the dashboard page */
 var share=function(g){return g.length?Math.round(100*g.filter(function(b){return flags(b).length}).length/g.length):null};
 var tiles=[],groups=[],g1=[],g2=[],g3=[];
 var primary=hasPeer?comm:az,cmpG=hasPeer?peer:big,pl=hasPeer?'similar-sized peers':'the ten largest banks';
 tiles.push(['Median ROA, Arizona '+(hasPeer?'community banks':'banks'),pc(L(primary,'roa')),(hasPeer?'Peers '+pc(L(peer,'roa'))+' · ':'')+'Ten largest '+pc(L(big,'roa'))]);
 tiles.push(['Banks tripping a screen',nfA+' of '+az.length,hasPeer?'Community '+share(comm)+'% · peers '+share(peer)+'%':'Ten largest: '+big.filter(function(b){return flags(b).length}).length+' of '+big.length]);
 if(bt)tiles.push(['Failures on alert a year early',Math.round(bt.window.failed_2plus)+'%','Survivors on alert '+Math.round(bt.window.survivors_2plus)+'%']);
 if(giants.length){var tt=az.reduce(function(s,b){return s+last(b).assets},0),gg=giants.reduce(function(s,b){return s+last(b).assets},0);tiles.push(['Assets held by '+w(giants.length)+' banks',Math.round(100*gg/tt)+'%','of '+money(tt)+' in Arizona-headquartered bank assets'])}
 var rl=L(primary,'roa')<L(cmpG,'roa')?'less':'more';
 out.lead='Arizona’s '+(hasPeer?w(comm.length)+' community banks':w(az.length)+' banks')+' earned '+rl+' than '+pl+' ('+pc(L(primary,'roa'))+' against '+pc(L(cmpG,'roa'))+' median return on assets)'+(hasPeer?' and were flagged '+(share(comm)>share(peer)+5?'more':share(comm)<share(peer)-5?'less':'about as')+(Math.abs(share(comm)-share(peer))<=5?' often as them':' often than them')+' ('+share(comm)+'% against '+share(peer)+'%)':'')+'.'+(bt?' In a back-test, '+Math.round(bt.window.failed_2plus)+'% of banks that later failed had two or more screens tripped a year earlier, against '+Math.round(bt.window.survivors_2plus)+'% of survivors, so the screens help choose which banks to review but do not forecast failure.':'');
 if(hasPeer){
  var rowsT=[['Median ROA',function(g){return pc(L(g,'roa'))}],['Net interest margin',function(g){return pc(L(g,'nim'))}],['Equity / assets',function(g){return pc(L(g,'eq_assets'),1)}],['Loans / deposits',function(g){return pc(L(g,'loans_dep'),0)}],['Efficiency ratio',function(g){return pc(L(g,'eff'),0)}],['Banks tripping a screen',function(g){return share(g)+'%'}]];
  out.table={cols:['Arizona community banks ('+comm.length+')','Similar-sized peers ('+peer.length+')','Ten largest U.S. banks'],rows:rowsT.map(function(r){return [r[0],r[1](comm),r[1](peer),r[1](big)]})};
  var gapR=Math.abs(L(comm,'roa')-L(peer,'roa')),gapE=Math.abs(L(comm,'eff')-L(peer,'eff')),trail=L(comm,'roa')<L(peer,'roa')&&gapR>=.4;
  g1.push([trail?'Size does not explain the shortfall: Arizona community banks trail similar-sized peers.':near?'Size, not geography, explains most of the gap to the largest banks.':'Neither comparison group fully explains Arizona\u2019s results.',trail?'Against banks of the same size, Arizona community banks earned '+gapR.toFixed(1)+' points less on assets, lent out '+Math.round(L(comm,'loans_dep'))+'% of deposits against '+Math.round(L(peer,'loans_dep'))+'%, and spent '+Math.round(L(comm,'eff'))+'% of revenue on costs against '+Math.round(L(peer,'eff'))+'%. Because the peers are of similar size, scale alone does not explain these gaps; the cause is more likely the banks themselves, such as age and business mix, or their local markets.':near?'Arizona community banks look like their similar-sized peers on funding and costs and unlike the ten largest banks, so the comparison with the largest banks mostly reflects scale.':'Arizona community banks differ from both groups on funding and costs, so neither comparison alone explains their results.']);
  g1.push(['Profitability is '+(L(comm,'roa')<L(peer,'roa')?'below':'above')+' peers by '+Math.abs(L(comm,'roa')-L(peer,'roa')).toFixed(2)+' points.','The ten Arizona community banks earned a median '+pc(L(comm,'roa'))+' against '+pc(L(peer,'roa'))+' for peers. With ten banks, one or two weak quarters can move that median, so treat the gap as a lead to examine.']);
 }else{
  out.table={cols:['Arizona banks ('+az.length+')','Ten largest U.S. banks'],rows:[['Median ROA',pc(L(az,'roa')),pc(L(big,'roa'))],['Net interest margin',pc(L(az,'nim')),pc(L(big,'nim'))],['Loans / deposits',pc(L(az,'loans_dep'),0),pc(L(big,'loans_dep'),0)],['Efficiency ratio',pc(L(az,'eff'),0),pc(L(big,'eff'),0)]]};
  g1.push(['A size-matched peer group is added after the next data refresh.','Until then, Arizona banks are compared only with the ten largest U.S. banks, which differ in size and business model.']);
 }
 var cnt={};az.forEach(function(b){flags(b).forEach(function(x){cnt[x]=(cnt[x]||0)+1})});
 var top=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,2);
 g2.push([cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped at least one screen.',top.length?'The most common were '+lc(top[0])+' ('+w(cnt[top[0]])+' banks)'+(top[1]?' and '+lc(top[1])+' ('+w(cnt[top[1]])+').':'.')+(hasPeer?(Math.abs(share(comm)-share(peer))<=5?' Peers tripped screens at a similar rate, so a flag by itself does not make a bank unusual.':share(comm)>share(peer)?' Arizona community banks tripped screens more often than peers.':' Arizona community banks tripped screens less often than peers.'):''):'']);
 if(giants.length)g2.push([cap(w(giants.length))+' bank'+(giants.length>1?'s':'')+' hold'+(giants.length>1?'':'s')+' '+Math.round(100*gg/tt)+'% of the assets.','That concentration is why the giants are compared with the ten largest banks and the rest with similar-sized peers.']);
 if(bt){g3.push([bt.head.replace('Back-test: ',''),bt.text]);if(bt.tuning)g3.push(bt.tuning);
  var sg2=signal(BT);if(sg2)g3.push(sg2);
  var rr=BT.windows.filter(function(x){return x.id==='recent'})[0];if(rr&&rr.failed_2plus!=null)g3.push([rr.failed_2plus-rr.survivors_2plus>=20?'The alert level separates failures in the recent rate shock too, with fewer cases.':'The alert level was less informative in the recent rate shock.',Math.round(rr.failed_2plus)+'% of '+rr.failed_n+' failures from '+rr.name+' had two or more screens tripped, against '+Math.round(rr.survivors_2plus)+'% of survivors.'])}
 groups.push({title:'Peer comparison',items:g1,table:true});if(out.explain)groups.push({title:'What explains the profitability gap?',items:[['Median ROA by subgroup, Arizona community banks against peers.',out.explain.text]],explain:out.explain});groups.push({title:'What the screens flag',items:g2});if(g3.length)groups.push({title:'Do the screens work?',items:g3});
 if(hasPeer){
  var trim=function(g){var s=g.slice().sort(function(a,b){return last(b).roa-last(a).roa});return s.slice(0,Math.max(s.length-2,1))};
  var small=function(g,hi){return g.filter(function(b){return last(b).assets<hi})};
  var neg=function(g){return Math.round(100*g.filter(function(b){return last(b).roa!=null&&last(b).roa<0}).length/g.length)};
  var yr=new Date().getFullYear(),old=function(g){return g.filter(function(b){return b.est&&yr-b.est>=10})},young=function(g){return g.filter(function(b){return b.est&&yr-b.est<10})};
  var rows=[['All banks',L(comm,'roa'),L(peer,'roa'),comm.length,peer.length],['Excluding the two weakest',L(trim(comm),'roa'),L(trim(peer),'roa'),Math.max(comm.length-2,1),Math.max(peer.length-2,1)]];
  var sc=small(comm,3e5),sp=small(peer,3e5);if(sc.length>=3&&sp.length>=5)rows.push(['Banks under $300 million',L(sc,'roa'),L(sp,'roa'),sc.length,sp.length]);
  var oc=old(comm),op=old(peer);if(oc.length>=3&&op.length>=5)rows.push(['Banks 10 or more years old',L(oc,'roa'),L(op,'roa'),oc.length,op.length]);
  var yc=young(comm),yp=young(peer);var hasAge=comm.some(function(b){return b.est});
  var tr=rows[1],gAll=rows[0][2]-rows[0][1],gTr=tr[2]-tr[1],t='';
  t=(gAll>0?(gTr>=.6*gAll?'The profitability gap persists after removing the weakest banks, so a few outliers do not explain it. ':'The gap narrows when the weakest banks are removed, so a few outliers account for much of it. '):'Arizona community banks are not behind peers on profitability. ')+'Dropping the two weakest banks from each group moves the Arizona median from '+pc(rows[0][1])+' to '+pc(tr[1])+' and the peer median from '+pc(rows[0][2])+' to '+pc(tr[2])+'. '+neg(comm)+'% of Arizona community banks had negative ROA, against '+neg(peer)+'% of peers.';
  if(hasAge&&yc.length>=1)t+=' '+yc.length+' of the '+comm.length+' Arizona community banks are under ten years old, against '+young(peer).length+' of '+peer.length+' peers; young banks typically earn less while they build loans.';
  out.explain={rows:rows,text:t,hasAge:hasAge}}
 out.tiles=tiles;out.groups=groups;
 out.items=items;
 out.headline=cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped a screen in '+ql+'; '+(hasPeer?'community-bank ROA '+pc(L(comm,'roa'))+' vs '+pc(L(peer,'roa'))+' at similar-sized peers.':'median ROA '+pc(L(az,'roa'))+' vs '+pc(L(big,'roa'))+' at the largest banks.');
 out.card=cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped at least one warning screen in '+ql+'. '+(hasPeer?'Community-bank median ROA was '+pc(L(comm,'roa'))+', against '+pc(L(peer,'roa'))+' for similar-sized peers and '+pc(L(big,'roa'))+' for the ten largest banks.':'Median ROA was '+pc(L(az,'roa'))+' against '+pc(L(big,'roa'))+' for the ten largest banks.')+(bt?' '+bt.short:'');
 return out}

function backtest(BT){
 if(!BT||!BT.windows||!BT.windows.length)return null;
 var c=BT.windows.filter(function(x){return x.id==='crisis'})[0]||BT.windows[0];
 if(c.failed_2plus==null||c.survivors_2plus==null)return null;
 var r=BT.windows.filter(function(x){return x.id==='recent'})[0],R=Math.round;
 var head='Back-test: '+R(c.failed_2plus)+'% of banks that later failed had two or more screens tripped a year before, against '+R(c.survivors_2plus)+'% of survivors.';
 var text='In the '+c.name+', '+c.failed_n+' failed banks were screened using their call reports from about one year before failure, alongside '+c.survivor_obs+' bank-date observations from banks that survived. A single screen is a watch signal: it flagged '+R(c.failed_any)+'% of failures and '+R(c.survivors_any)+'% of survivors. Two or more is the alert level.';
 var tuning=null;
 if(c.before&&BT.tuned){var imp=c.survivors_2plus<c.before.survivors_2plus-3,tg=r&&r.failed_2plus!=null?r.failed_2plus-r.survivors_2plus:null,bg=r&&r.before?r.before.failed_2plus-r.before.survivors_2plus:null;
  tuning=[imp?(tg!=null&&bg!=null&&tg>=bg?'Retuning the cutoffs cut false alarms and the gain held on a second period.':'Retuning cut false alarms on the crisis data, but the gain was smaller on the second period.'):'Retuning the cutoffs did not reduce false alarms much.','The initial cutoffs put two or more screens on '+R(c.before.failed_2plus)+'% of failures but also '+R(c.before.survivors_2plus)+'% of survivors. Cutoffs searched on the 2009-2012 failures alone give '+R(c.failed_2plus)+'% against '+R(c.survivors_2plus)+'%.'+(r&&r.failed_2plus!=null?' Applied unchanged to the '+r.name+', which was not used for tuning, the alert level flagged '+R(r.failed_2plus)+'% of '+r.failed_n+' failures and '+R(r.survivors_2plus)+'% of survivors'+(r.before?' (the initial cutoffs gave '+R(r.before.failed_2plus)+'% and '+R(r.before.survivors_2plus)+'%).':'.'):'')]}
 return {head:head,text:text,tuning:tuning,short:'In a back-test on '+c.failed_n+' bank failures, '+R(c.failed_2plus)+'% had two or more screens tripped a year earlier, against '+R(c.survivors_2plus)+'% of survivors.',window:c,recent:r}}

function signal(BT){var c=BT.windows.filter(function(x){return x.id==='crisis'})[0];if(!c||!c.sweep)return null;
 var rows=[];var CK={'Low ROA':'roa','Margin squeeze':'dnim','Thin equity':'eq','High loans/deposits':'ld','Deposit outflow':'ddep','Asset quality':'nc'};Object.keys(CK).forEach(function(k){var s=(c.sweep[k]||[]).filter(function(r){return r.cutoff===CUT[CK[k]]})[0];if(s&&s.failed!=null&&s.survivors!=null)rows.push({k:k,gap:s.failed-s.survivors,f:s.failed,s:s.survivors})});
 if(rows.length<3)return null;rows.sort(function(a,b){return b.gap-a.gap});var t=rows[0],u=rows[rows.length-1];
 return ['Some screens carried the signal; others did not.',t.k+' separated failures from survivors best ('+Math.round(t.f)+'% of failures against '+Math.round(t.s)+'% of survivors). '+u.k+' separated them least ('+Math.round(u.f)+'% against '+Math.round(u.s)+'%), which makes it the weakest screen on its own. The bank monitor’s cutoff table shows how each screen behaves at other cutoffs.']}
function equity(d){
 var n=d.months.length,P={};d.tickers.forEach(function(t){P[t.symbol]=t.prices});var c=d.macro.curve,cpi=d.macro.cpi_yoy;
 if(!P.NVDA||!P.SPY||!P.JPM||!P.GS||!P.TLT)return null;
 function cagr(s){var a=P[s].filter(function(x){return x}),yrs=(n-1)/12;return(Math.pow(a[a.length-1]/a[0],1/yrs)-1)*100}
 function mdd(s){var pk=0,m=0;P[s].forEach(function(v){if(v){pk=Math.max(pk,v);m=Math.min(m,v/pk-1)}});return -m*100}
 function fwd(s,test){var v=[];for(var i=0;i+12<n;i++){var t=test(i);if(t==null||!P[s][i]||!P[s][i+12])continue;v.push({t:t,r:(P[s][i+12]/P[s][i]-1)*100})}return v}
 function avg(v,t){v=v.filter(function(x){return x.t===t});return v.length?v.reduce(function(a,x){return a+x.r},0)/v.length:null}
 var inv=function(i){return c[i]==null?null:c[i]<0},hi=function(i){return cpi[i]==null?null:cpi[i]>=3};
 var eps=0,prev=false;c.forEach(function(x){var cur=x!=null&&x<0;if(cur&&!prev)eps++;prev=cur});
 var R=Math.round,y=d.months[0].slice(0,4),end=d.months[n-1];
 var jpm=fwd('JPM',inv),gs=fwd('GS',inv),spy=fwd('SPY',hi),xom=fwd('XOM',hi);
 var items=[];
 items.push(['Higher return came with deeper losses.','NVIDIA returned '+R(cagr('NVDA'))+'% a year since '+y+' but fell '+R(mdd('NVDA'))+'% at its worst; the S&P 500 ETF (SPY) returned '+R(cagr('SPY'))+'% a year with a '+R(mdd('SPY'))+'% drop.'+(P.JNJ?' Johnson & Johnson returned '+R(cagr('JNJ'))+'% with a '+R(mdd('JNJ'))+'% drop.':''),R(cagr('NVDA'))+'% vs '+R(cagr('SPY'))+'%','NVIDIA vs SPY, annual return','Return and risk',[['NVIDIA',cagr('NVDA')],['SPY',cagr('SPY')]]]);
 items.push(['Long Treasuries earned little over the period.','TLT returned '+cagr('TLT').toFixed(1)+'% a year and still fell '+R(mdd('TLT'))+'% from its peak, because rising rates hit bond prices.',cagr('TLT').toFixed(1)+'% vs '+R(cagr('SPY'))+'%','TLT vs SPY, annual return','Return and risk',[['Long Treasuries',cagr('TLT')],['SPY',cagr('SPY')]]]);
 (function(){var r=[],s=[];for(var i=1;i<n;i++){if(P.SPY[i]&&P.SPY[i-1]&&P.TLT[i]&&P.TLT[i-1]){var a=P.SPY[i]/P.SPY[i-1]-1,b=P.TLT[i]/P.TLT[i-1]-1;r.push(.6*a+.4*b);s.push(a)}}
  if(r.length<60)return;function st(x){var v=1,pk=1,m=0;x.forEach(function(g){v*=1+g;pk=Math.max(pk,v);m=Math.min(m,v/pk-1)});return{c:(Math.pow(v,12/x.length)-1)*100,d:-m*100}}
  var A=st(r),B=st(s);
  items.push(['A simple stock-and-bond mix cut the worst loss but cost return.','Holding 60% SPY and 40% TLT, rebalanced monthly, returned '+A.c.toFixed(1)+'% a year with a '+R(A.d)+'% worst drop, against '+B.c.toFixed(1)+'% and '+R(B.d)+'% for SPY alone. For an investor who cannot sit through a '+R(B.d)+'% decline, that trade-off matters more than the headline return.',R(A.d)+'% vs '+R(B.d)+'%','worst drop, 60/40 vs SPY','Portfolio mix',[['60/40 mix',A.d],['SPY alone',B.d]]]);})();
 var a1=avg(jpm,true),a2=avg(gs,true),b1=avg(jpm,false),b2=avg(gs,false);
 if([a1,a2,b1,b2].every(function(x){return x!=null}))items.push(['Banks did best after the yield curve inverted.','Average 12-month returns after an inverted curve were '+R(a1)+'% for JPMorgan and '+R(a2)+'% for Goldman Sachs, against '+R(b1)+'% and '+R(b2)+'% after a normal curve, but this rests on only '+w(eps)+' inversion episode'+(eps===1?'':'s')+'.',R(a1)+'% vs '+R(b1)+'%','JPMorgan, next 12 months','Yield curve',[['After inversion',a1],['Normal curve',b1]]]);
 var h=avg(spy,true),l=avg(spy,false),xh=avg(xom,true),xl=avg(xom,false);
 if([h,l].every(function(x){return x!=null}))items.push(['Inflation separated the winners.','After high-inflation months SPY averaged '+h.toFixed(1)+'% against '+l.toFixed(1)+'% after low-inflation months.'+(xh!=null&&xl!=null?' Exxon did '+(xh>xl?'better':'worse')+' in high inflation ('+xh.toFixed(1)+'% vs '+xl.toFixed(1)+'%).':''),h.toFixed(1)+'% vs '+l.toFixed(1)+'%','SPY, next 12 months','Inflation',[['After high inflation',h],['After low inflation',l]]]);
 return {items:items,eps:eps,period:y+' to '+end,
  card:'Higher returns came with deeper losses: NVIDIA returned '+R(cagr('NVDA'))+'% a year since '+y+' but fell '+R(mdd('NVDA'))+'% at its worst, versus '+R(cagr('SPY'))+'% a year and a '+R(mdd('SPY'))+'% drop for SPY.'+(a1!=null?' After the yield curve inverted, JPMorgan and Goldman Sachs averaged '+R(a1)+'% and '+R(a2)+'% over the next year, against '+R(b1)+'% and '+R(b2)+'% otherwise.':''),
  headline:'NVIDIA returned '+R(cagr('NVDA'))+'% a year with a '+R(mdd('NVDA'))+'% drawdown vs '+R(cagr('SPY'))+'% and '+R(mdd('SPY'))+'% for SPY; banks led after yield-curve inversions.'}}

function bars(b){if(!b)return '';var m=Math.max.apply(null,b.map(function(x){return Math.abs(x[1])}))||1;return '<div class="fbars">'+b.map(function(x,k){return '<div class="fb"><span>'+x[0]+'</span><i><u class="c'+k+'" style="width:'+Math.max(3,Math.abs(x[1])/m*100)+'%"></u></i><em>'+(Math.abs(x[1])<20?x[1].toFixed(1):Math.round(x[1]))+'%</em></div>'}).join('')+'</div>'}
function cards(items){return items.map(function(i){return '<article class="fcard"><span class="ftag">'+(i[4]||'')+'</span><div class="fstat"><b>'+(i[2]||'')+'</b><small>'+(i[3]||'')+'</small></div>'+bars(i[5])+'<h3>'+i[0]+'</h3><p>'+i[1]+'</p></article>'}).join('')}
function list(items){return items.map(function(i){return '<li><b>'+i[0]+'</b> '+i[1]+'</li>'}).join('')}
function load(u){return fetch(u,{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){return null})}
window.Findings={cut:CUT,setCutoffs:setCutoffs,tip:tip,bank:bank,equity:equity,list:list,cards:cards,load:load,flags:flags,last:last,med:med,yoy:yoy,COMM_MAX:COMM_MAX};
})();
