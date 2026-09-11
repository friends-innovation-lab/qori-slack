// prototype.js — local-only interactions. No backend, no persistence.
document.addEventListener('DOMContentLoaded',function(){
  // dirty-state on edit pages
  var save=document.querySelector('[data-save]');
  var state=document.querySelector('[data-save-state]');
  function setState(cls,label){if(!state)return;state.className='save-state '+cls;state.innerHTML='<span class="dot"></span>'+label;}
  document.querySelectorAll('[contenteditable="true"]').forEach(function(el){
    el.addEventListener('input',function(){if(save){save.disabled=false;}setState('dirty','Unsaved changes');});
  });
  if(save){save.addEventListener('click',function(){
    var steps=[['busy','Saving to canonical state…',700],['busy','Rendering artifact…',800],['busy','Updating GitHub projection…',700],['synced','Synced — GitHub updated',900]];
    var i=0;save.disabled=true;
    (function step(){if(i<steps.length){setState(steps[i][0],steps[i][1]);setTimeout(step,steps[i][2]);i++;}
      else{var to=save.getAttribute('data-save-redirect');if(to)location.href=to;}})();
  });}
  // review rail overlay
  var tog=document.querySelector('[data-rail-toggle]'),rail=document.querySelector('.review-rail');
  if(tog&&rail){tog.addEventListener('click',function(){rail.classList.add('overlay');});
    rail.querySelectorAll('[data-rail-close]').forEach(function(b){b.addEventListener('click',function(){rail.classList.remove('overlay');});});}
});