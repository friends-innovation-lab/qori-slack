/* Qori Study Workspace shell — navigation correction reference. NOT PRODUCTION.
   Injects ONE persistent shell: org icon rail (64) + study lifecycle panel (224) + spec bar.
   Must load BEFORE ../../discovery/screens/discovery-shell.js (which converts <i data-i> icons,
   wires popovers and the annotation toggle). Body needs data-nonav="1" so discovery-shell skips its old nav.
   Body attrs: data-screen (id), data-active (row key), data-org="1" for the org-shell screen. */
(function(){
const SCREENS=[
['01 Studies - Enter Study.html','S01','Studies → enter a study (org shell)'],
['02 Study Overview.html','S02','Study overview — workspace landing'],
['03 Discovery Overview.html','S03','Discovery → Overview (landing)'],
['04 Discovery - Desk Research.html','S04','Discovery → Desk research'],
['05 Discovery - Stakeholders.html','S05','Discovery → Stakeholders'],
['06 Discovery - Completed Run.html','S06','Discovery → Desk research → completed run'],
['07 Brief.html','S07','Planning → Research brief'],
['08 Plan.html','S08','Planning → Research plan'],
['09 Shell Redlines.html','S09','Shell redlines — rail anatomy, states, drawer']
];
const I={
home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
folder:'<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
book:'<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
queue:'<path d="M10 6h11M10 12h11M10 18h11M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
panel:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M16 15l-3-3 3-3"/>'
};
const svg=(n,s)=>'<svg class="i" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[n]+'</svg>';
const b=document.body,d=b.dataset,act=d.active||'';
const app=document.querySelector('.app');
if(app&&!d.org){
 const row=(k,label,href,extra,sr)=>{const on=act===k;return '<li><a class="nv'+(on?' on':'')+'" href="'+href+'"'+(on?' aria-current="page"':'')+'><span class="t">'+label+'</span>'+(extra||'')+(sr?'<span class="sr">'+sr+'</span>':'')+'</a></li>';};
 const dim=l=>'<li class="nv dim"><span class="t">'+l+'</span><span class="sr">, not yet available</span></li>';
 const grp=(id,label,keys,inner)=>{const cur=keys.includes(act);return '<section aria-labelledby="lc-'+id+'"><h2 class="grp'+(cur?' cur':'')+'" id="lc-'+id+'">'+label+'</h2><ul>'+inner+'</ul></section>';};
 let h='<nav class="nav" aria-label="Workspace"><div class="arail" aria-label="Main"><div class="q" aria-hidden="true">q</div>';
 [['home','Home'],['folder','Projects'],['book','Studies',1],['msg','Ask Qori']].forEach(([i,l,on])=>{h+='<a class="ai'+(on?' on':'')+'" href="'+(on?'01 Studies - Enter Study.html':'#')+'" aria-label="'+l+'" title="'+l+'"'+(on?' aria-current="true"':'')+'>'+svg(i,20)+'</a>';});
 h+='<span class="sp"></span><a class="ai" href="#" aria-label="Admin" title="Admin">'+svg('settings',20)+'</a><div class="av" title="John Doe">JD</div></div>';
 h+='<div class="srail" aria-label="Study"><div class="study"><div class="k">Claim Status Experience</div><div class="nm">Status page usability</div><a class="bk" href="01 Studies - Enter Study.html">← All studies</a></div>';
 h+='<ul class="top" aria-label="Study">'+row('study','Study overview','02 Study Overview.html')+'</ul>';
 h+=grp('d','Discovery',['disc','desk','stakeholder','survey','synthesis'],
  row('disc','Overview','03 Discovery Overview.html','<span class="rdot" aria-hidden="true"></span>',', 3 need your review')+
  row('desk','Desk research','04 Discovery - Desk Research.html','<span class="ct">2</span><span class="rdot" aria-hidden="true"></span>',', 2 ready, needs your review')+
  row('stakeholder','Stakeholders','05 Discovery - Stakeholders.html','<span class="ct">1</span>',', 1 ready')+
  row('survey','Surveys','#','<span class="ct">1</span><span class="rdot" aria-hidden="true"></span>',', 1 ready, needs your review')+
  row('synthesis','Synthesis','#','<span class="ring" aria-hidden="true"></span>',', out of date'));
 h+=grp('p','Planning',['brief','plan'],row('brief','Research brief','07 Brief.html')+row('plan','Research plan','08 Plan.html')+dim('Discussion guide'));
 h+=grp('f','Fieldwork',[],dim('Outreach')+dim('Participants')+dim('Sessions')+dim('Observers'));
 h+=grp('a','Analysis',[],dim('Session analysis')+dim('Affinity &amp; themes'));
 h+=grp('o','Outputs',[],dim('Design opportunities')+dim('Readouts')+dim('Tickets'));
 h+='<div class="spacer"></div></div></nav><div class="scrim"></div>';
 app.insertAdjacentHTML('afterbegin',h);
}
const me=SCREENS.findIndex(s=>s[1]===d.screen);
if(me>=0){const s=SCREENS[me],pv=SCREENS[me-1],nx=SCREENS[me+1];
 let sb='<div class="specbar" role="note" aria-label="Design annotation"><span class="sn">'+s[1]+'</span><span class="ti">'+s[2]+'</span><span class="ms"><span>NAV-1</span></span><span class="grow"></span>';
 sb+='<a href="00 Index.html">Index</a><a href="09 Shell Redlines.html">Redlines</a><a href="../STUDY_WORKSPACE_NAV_CORRECTION.md">Spec</a>'+(pv?'<a href="'+pv[0]+'">← '+pv[1]+'</a>':'')+(nx?'<a href="'+nx[0]+'">'+nx[1]+' →</a>':'')+'<button type="button" id="annt">Hide annotations</button></div>';
 b.insertAdjacentHTML('afterbegin',sb);}
document.querySelectorAll('[data-svg]').forEach(el=>{el.outerHTML=svg(el.dataset.svg,el.dataset.s||20);});
window.QS={SCREENS,svg};
})();
