/* Comportamentos comuns às páginas da coleção: tema claro/escuro, dicas (data-tip) e menu lateral móvel. */
(function(){
'use strict';
var root=document.documentElement;
try{var sv=localStorage.getItem('plantas-tema'); if(sv==='dark'||sv==='light') root.setAttribute('data-theme',sv);}catch(e){}
function currentTheme(){var t=root.getAttribute('data-theme'); if(t) return t; return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
window.plantasTema=currentTheme;
document.addEventListener('DOMContentLoaded',function(){
  // menu geral: <body data-nav="inicio|gerador|banco" data-root="../">
  var nav=document.body.getAttribute('data-nav'), barIn=document.querySelector('.bar-in');
  if(nav!==null && barIn){
    var raiz=document.body.getAttribute('data-root')||'';
    var ic={inicio:'<path d="M2 7.5L8 2.5l6 5V14H10v-4H6v4H2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
      gerador:'<rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 7h7M9 2v12M9 10h5" stroke="currentColor" stroke-width="1.3"/>',
      banco:'<rect x="2" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>'};
    var itens=[['inicio','Início',raiz||'./'],['gerador','Gerador',raiz+'gerador/'],['banco','Banco de projetos',raiz+'banco/']];
    var el=document.createElement('nav'); el.className='topnav'; el.id='topnav'; el.setAttribute('aria-label','Seções');
    el.innerHTML=itens.map(function(i){return '<a href="'+i[2]+'"'+(i[0]===nav?' aria-current="page"':'')+'><svg viewBox="0 0 16 16" aria-hidden="true">'+ic[i[0]]+'</svg>'+i[1]+'</a>';}).join('');
    var bt=document.createElement('button'); bt.className='btn navbtn'; bt.type='button'; bt.setAttribute('aria-controls','topnav'); bt.setAttribute('aria-expanded','false');
    bt.innerHTML='<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Menu';
    bt.addEventListener('click',function(){var o=!document.body.classList.contains('nav-open'); document.body.classList.toggle('nav-open',o); bt.setAttribute('aria-expanded',o?'true':'false');});
    document.addEventListener('click',function(e){if(!e.target.closest('#topnav')&&!e.target.closest('.navbtn')){document.body.classList.remove('nav-open'); bt.setAttribute('aria-expanded','false');}});
    var tb=document.getElementById('themeBtn'); barIn.insertBefore(el,tb); barIn.insertBefore(bt,tb);
  }
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
