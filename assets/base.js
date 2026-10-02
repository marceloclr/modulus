/* Comportamentos comuns às páginas da coleção: tema claro/escuro, dicas (data-tip) e menu lateral móvel. */
(function(){
'use strict';
var root=document.documentElement;
try{var sv=localStorage.getItem('plantas-tema'); if(sv==='dark'||sv==='light') root.setAttribute('data-theme',sv);}catch(e){}
function currentTheme(){var t=root.getAttribute('data-theme'); if(t) return t; return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
window.plantasTema=currentTheme;
document.addEventListener('DOMContentLoaded',function(){
  var themeBtn=document.getElementById('themeBtn');
  function labelTheme(){if(themeBtn) themeBtn.textContent=currentTheme()==='dark'?'Tema claro':'Tema escuro';}
  labelTheme();
  if(themeBtn) themeBtn.addEventListener('click',function(){var n=currentTheme()==='dark'?'light':'dark'; root.setAttribute('data-theme',n); try{localStorage.setItem('plantas-tema',n);}catch(e){} labelTheme(); document.dispatchEvent(new CustomEvent('plantas:tema'));});
  if(window.matchMedia){var mq=window.matchMedia('(prefers-color-scheme: dark)'); if(mq.addEventListener) mq.addEventListener('change',labelTheme);}

  var body=document.body,menuBtn=document.getElementById('menuBtn'),scrim=document.getElementById('scrim');
  function setDrawer(o){body.classList.toggle('sb-open',o); if(menuBtn) menuBtn.setAttribute('aria-expanded',o?'true':'false');}
  if(menuBtn) menuBtn.addEventListener('click',function(){setDrawer(!body.classList.contains('sb-open'));});
  if(scrim) scrim.addEventListener('click',function(){setDrawer(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape') setDrawer(false);});

  var tip=document.getElementById('tip'),hideT=null;
  if(!tip){tip=document.createElement('div'); tip.id='tip'; tip.setAttribute('role','tooltip'); body.appendChild(tip);}
  function showTip(el){var t=el.getAttribute('data-tip'); if(!t) return; tip.textContent=t; tip.classList.add('on');
    var r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
    var left=Math.max(8,Math.min(window.innerWidth-tw-8,r.left+r.width/2-tw/2)),top=r.bottom+8;
    if(top+th>window.innerHeight-8) top=r.top-th-8;
    tip.style.left=left+'px'; tip.style.top=top+'px';}
  function hideTip(){tip.classList.remove('on');}
  document.addEventListener('mouseover',function(e){var el=e.target.closest&&e.target.closest('[data-tip]'); if(el) showTip(el);});
  document.addEventListener('mouseout',function(e){var el=e.target.closest&&e.target.closest('[data-tip]'); if(el) hideTip();});
  document.addEventListener('focusin',function(e){var el=e.target.closest&&e.target.closest('[data-tip]'); if(el) showTip(el);});
  document.addEventListener('focusout',hideTip);
  document.addEventListener('touchstart',function(e){var el=e.target.closest&&e.target.closest('[data-tip]'); if(!el){hideTip(); return;} showTip(el); clearTimeout(hideT); hideT=setTimeout(hideTip,2800);},{passive:true});
  window.addEventListener('scroll',hideTip,{passive:true});
});
})();
