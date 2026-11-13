(function(){
var c=document.body.getAttribute('data-case');function $(i){return document.getElementById(i)}
function tiles(a){$('cs-tiles').innerHTML=a.map(function(k){return '<div class="kpi"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('')}
function groupsHtml(F){return F.groups.filter(function(g){return !g.explain}).map(function(g){return '<div class="fg"><h3>'+g.title+'</h3><ul class="kf">'+Findings.list(g.items)+'</ul></div>'}).join('')+(F.groups.filter(function(g){return g.explain})[0]?'<div class="fg"><h3>What explains the profitability gap?</h3><ul class="kf">'+Findings.list(F.groups.filter(function(g){return g.explain})[0].items)+'</ul></div>':'')}
if(c==='equity')Findings.load('data/equities.json').then(function(d){if(!d)return;var F=Findings.equity(d);if(!F)return;
 $('cs-found').innerHTML='<ul class="kf">'+Findings.list(F.items)+'</ul>';
 tiles([['Securities',String(d.tickers.length),'stocks and ETFs, including two banks'],['History',F.period,'month-end prices'],['Inversion episodes',String(F.eps),'so regime results rest on few events'],['Refresh','Weekly','automatic, via GitHub Actions']])});
if(c==='bank')Findings.load('data/backtest.json').then(function(BT){if(BT&&BT.tuned)Findings.setCutoffs(BT.tuned.cutoffs);return Findings.load('data/banks.json').then(function(D){if(!D)return;var F=Findings.bank(D,BT);if(!F)return;
 $('cs-lead').textContent=F.lead;
 $('cs-found').innerHTML=groupsHtml(F);
 var az=D.banks.filter(function(b){return b.group==='az'}).length,pe=D.banks.filter(function(b){return b.group==='peer'}).length,ft=0;if(BT&&BT.windows)BT.windows.forEach(function(w){ft+=w.failed_n||0});
 tiles([['Arizona banks',String(az),'FDIC call reports, '+F.quarter],['Peer banks',pe?String(pe):'n/a','similar size, other states'],['Failed banks tested',ft?String(ft):'n/a','2009-2012 and 2023-2026'],['Written in','SQL','plus Python and JavaScript']])})});
})();
