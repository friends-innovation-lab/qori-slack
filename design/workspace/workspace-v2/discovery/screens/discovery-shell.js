/* Qori Discovery screens — shared reference shell. NOT PRODUCTION.
   Injects: spec bar (annotation), app rail + lifecycle panel (LifecycleRail inverse), icons.
   Icons: <i data-i="lucide-name" data-s="12"></i> → lucide icon of that name and size. */
(function(){
const SCREENS=[
['01 Hub - Empty.html','01','Discovery Hub — empty',['DISC-3']],
['02 Hub - Populated.html','02','Discovery Hub — populated',['DISC-3','DISC-4','DISC-5','DISC-6']],
['03 Add Desk Research.html','03','Add desk research — validation',['DISC-3']],
['04 Add Stakeholder Material.html','04','Add stakeholder material',['DISC-3']],
['05 Run - Processing.html','05','Run — processing',['DISC-3']],
['05b Run - Privacy Blocked.html','05b','Run — privacy blocked',['DISC-3']],
['06 Run - Report.html','06','Run — report (D1)',['DISC-3']],
['07 Run - Sources.html','07','Run — sources',['DISC-3']],
['08 Run - Extracted.html','08','Run — extracted',['DISC-3']],
['09 Survey - Upload.html','09','Survey — upload',['DISC-4']],
['10 Survey - Fields.html','10','Survey — fields',['DISC-4']],
['11 Survey - Privacy.html','11','Survey — privacy',['DISC-4']],
['12 Survey - Response Groups.html','12','Survey — response groups',['DISC-4']],
['13 Survey - Matches.html','13','Survey — matches',['DISC-4']],
['14a Survey - Summary Readiness.html','14a','Survey — summary readiness',['DISC-4']],
['14b Survey - Summary.html','14b','Survey — summary (V1)',['DISC-4']],
['15 Synthesis - Select.html','15','Synthesis — source selection',['DISC-5']],
['16 Synthesis - Result.html','16','Synthesis — result (X2)',['DISC-5','DISC-6']],
['16b Synthesis - Superseded and History.html','16b','Synthesis — superseded X1, history',['DISC-5']],
['17a Evidence Rail - Claim.html','17a','Evidence rail — claim → artifact',['DISC-6']],
['17b Evidence Rail - Source.html','17b','Evidence rail — source level',['DISC-6']],
['18a Brief - What Informs.html','18a','Brief step 0 — synthesis selected',['DISC-6']],
['18b Brief - No Discovery.html','18b','Brief step 0 — no Discovery path',['DISC-6']],
['19 Responsive.html','19','Responsive / narrow views',['DISC-3','DISC-4','DISC-5','DISC-6']],
['20 Component Redlines.html','20','Component redlines',['DISC-3','DISC-4','DISC-5','DISC-6']]
];
const P={
check:'<path d="M20 6 9 17l-5-5"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
'triangle-alert':'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
'file-text':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
'file-spreadsheet':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h2M14 13h2M8 17h2M14 17h2"/>',
upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
'chevron-right':'<path d="m9 18 6-6-6-6"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>','chevron-up':'<path d="m18 15-6-6-6 6"/>',
'more-horizontal':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
'loader-circle':'<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
x:'<path d="M18 6 6 18M6 6l12 12"/>','arrow-left':'<path d="M19 12H5M12 19l-7-7 7-7"/>','arrow-right':'<path d="M5 12h14M12 5l7 7-7 7"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
'message-square':'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
'list-tree':'<path d="M21 12h-8M21 6H8M21 18h-8M3 6v4c0 1.1.9 2 2 2h3M3 10v6c0 1.1.9 2 2 2h3"/>',
menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',plus:'<path d="M12 5v14M5 12h14"/>',
'grip-vertical':'<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
folder:'<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
'book-open':'<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
sparkles:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
'eye-off':'<path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-2.2 3.3M6.6 6.6A17 17 0 0 0 2 12s3 8 10 8a10 10 0 0 0 5.4-1.6M2 2l20 20"/>',
'shield-check':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
'undo-2':'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
'circle-slash':'<circle cx="12" cy="12" r="9"/><path d="m9 15 6-6"/>',
keyboard:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
'external-link':'<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
'rotate-ccw':'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
};
function svg(n,s){return '<svg class="i" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[n]||'')+'</svg>';}
function icons(root){root.querySelectorAll('i[data-i]').forEach(el=>{el.outerHTML=svg(el.dataset.i,el.dataset.s||16);});}
const b=document.body,d=b.dataset,active=d.nav||'',empty=d.navstate==='empty';
const L=(f)=>f; // file links
const disc=[
 ['all','All evidence',empty?'01 Hub - Empty.html':'02 Hub - Populated.html',null,false,'DISC-3'],
 ['desk','Desk Research','02 Hub - Populated.html','2',true,'DISC-3'],
 ['stakeholder','Stakeholders','02 Hub - Populated.html','1',false,'DISC-3'],
 ['survey','Surveys','02 Hub - Populated.html','1',true,'DISC-3 row · DISC-4 counts from survey runs'],
 ['synthesis','Synthesis','16 Synthesis - Result.html',null,false,'DISC-5']
];
let h='<nav class="nav" aria-label="Workspace"><div class="arail" aria-label="Primary"><div class="q" aria-hidden="true">q</div>';
[['home','Home'],['folder','Projects'],['book-open','Studies',1],['sparkles','Ask Qori']].forEach(([i,l,on])=>{h+='<button class="ai'+(on?' on':'')+'" aria-label="'+l+'"'+(on?' aria-current="page"':'')+' title="'+l+'">'+svg(i,16)+'</button>';});
h+='<span class="sp"></span><button class="ai" aria-label="Admin" title="Admin">'+svg('settings',16)+'</button><div class="av" title="John Doe · Lead researcher">JD</div></div>';
h+='<div class="srail"><div class="study"><div class="k">Study</div><a class="nm" href="#">Claim Status Experience</a><a class="bk" href="#">← All studies</a></div>';
h+='<section aria-labelledby="lc-d"><h2 class="grp" id="lc-d">Discovery</h2><ul>';
disc.forEach(([k,l,href,ct,dot])=>{
 const on=active===k;let extra='',sr='';
 if(!empty&&ct){extra+='<span class="ct">'+ct+'</span>';sr+=', '+ct+' ready';}
 if(!empty&&dot){extra+='<span class="rdot" aria-hidden="true"></span>';sr+=', needs your review';}
 if(k==='synthesis'&&!empty){const s=d.synth||'stale';if(s==='stale'){extra+='<span class="ring" aria-hidden="true"></span>';sr+=', out of date';}if(s==='current'){extra+='<span class="okc">'+svg('check',12)+'</span>';sr+=', current';}}
 h+='<li><a class="nv'+(on?' on':'')+'" href="'+href+'"'+(on?' aria-current="page"':'')+'><span class="t">'+l+'</span>'+extra+(sr?'<span class="sr">'+sr+'</span>':'')+'</a></li>';
});
h+='</ul></section>';
const rest=[['Planning',[['Research Brief','18a Brief - What Informs.html','brief'],['Research Plan','#','plan'],['Discussion Guide']]],['Fieldwork',[['Outreach'],['Participants'],['Sessions'],['Observers']]],['Analysis',[['Session Analysis'],['Affinity & Themes']]],['Outputs',[['Design Opportunities'],['Readouts'],['Tickets']]]];
rest.forEach(([g,items],gi)=>{h+='<section aria-labelledby="lc-'+gi+'"><h2 class="grp" id="lc-'+gi+'">'+g+'</h2><ul>';items.forEach(([l,href,k])=>{if(href){const on=active===k;h+='<li><a class="nv'+(on?' on':'')+'" href="'+href+'"'+(on?' aria-current="page"':'')+'><span class="t">'+l+'</span></a></li>';}else h+='<li class="nv dim"><span class="t">'+l+'</span><span class="sr">, not yet available</span></li>';});h+='</ul></section>';});
h+='<div class="spacer"></div></div></nav><div class="scrim"></div>';
const app=document.querySelector('.app');
if(app&&!d.nonav)app.insertAdjacentHTML('afterbegin',h);
// spec bar
const me=SCREENS.findIndex(s=>s[1]===d.screen);
if(me>=0){const s=SCREENS[me],pv=SCREENS[me-1],nx=SCREENS[me+1];
 let sb='<div class="specbar" role="note" aria-label="Design annotation"><span class="sn">'+s[1]+'</span><span class="ti">'+s[2]+'</span><span class="ms">'+s[3].map(m=>'<span>'+m+'</span>').join('')+'</span><span class="grow"></span>';
 sb+='<a href="00 Index.html">Index</a><a href="20 Component Redlines.html">Redlines</a>'+(pv?'<a href="'+pv[0]+'">← '+pv[1]+'</a>':'')+(nx?'<a href="'+nx[0]+'">'+nx[1]+' →</a>':'')+'<button type="button" id="annt">Hide annotations</button></div>';
 b.insertAdjacentHTML('afterbegin',sb);}
if(new URLSearchParams(location.search).has('clean')||localStorage.getItem('qd-ann')==='off')b.classList.add('noann');
const t=document.getElementById('annt');if(t)t.onclick=()=>{b.classList.add('noann');localStorage.setItem('qd-ann','off');};
document.addEventListener('keydown',e=>{if(e.key==='a'&&e.altKey){const off=b.classList.toggle('noann');localStorage.setItem('qd-ann',off?'off':'on');}});
// milestone tags
document.querySelectorAll('[data-ms]').forEach(el=>{const tg=document.createElement('span');tg.className='mstag';tg.textContent=el.dataset.ms;el.appendChild(tg);});
icons(document);
// interactions (reference only)
const nt=document.querySelector('.navtg');if(nt&&app){nt.onclick=()=>app.classList.toggle('nav-open');const sc=app.querySelector('.scrim');if(sc)sc.onclick=()=>app.classList.remove('nav-open','sheet-open');}
document.querySelectorAll('[data-pop]').forEach(btn=>{const pop=document.getElementById(btn.dataset.pop);btn.onclick=e=>{e.stopPropagation();const open=pop.hidden;pop.hidden=!open;btn.setAttribute('aria-expanded',String(open));};});
document.addEventListener('click',()=>document.querySelectorAll('[data-pop]').forEach(btn=>{const pop=document.getElementById(btn.dataset.pop);if(pop&&!pop.hasAttribute('data-keep')){pop.hidden=true;btn.setAttribute('aria-expanded','false');}}));
document.querySelectorAll('.seg').forEach(g=>g.addEventListener('change',()=>g.querySelectorAll('label').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked))));
document.querySelectorAll('.split .er').forEach(r=>r.addEventListener('click',()=>r.closest('.split').classList.add('detail')));
document.querySelectorAll('.split .back').forEach(x=>x.addEventListener('click',()=>x.closest('.split').classList.remove('detail')));
document.querySelectorAll('.bopts input[type=radio]').forEach(r=>r.addEventListener('change',()=>document.querySelectorAll('.bopt').forEach(o=>o.classList.toggle('on',o.querySelector('input[type=radio]').checked))));
if(document.querySelector('.rail')&&matchMedia('(max-width:767px)').matches&&app)app.classList.add('sheet-open');
const hs=location.hash;
if(hs.includes('nav')&&app)app.classList.add('nav-open');
if(hs.includes('detail'))document.querySelectorAll('.split').forEach(s=>s.classList.add('detail'));
if(hs.includes('strip'))document.querySelectorAll('.strip-sm').forEach(s=>s.open=true);
if(hs.includes('norail'))document.querySelectorAll('.rail').forEach(r=>r.remove()),app&&app.classList.remove('sheet-open');
window.QD={SCREENS,svg};
})();
