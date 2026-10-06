/* Comportamentos comuns às páginas da coleção: tema claro/escuro, dicas (data-tip) e menu lateral móvel. */
(function(){
'use strict';
var root=document.documentElement;
try{var sv=localStorage.getItem('plantas-tema'); if(sv==='dark'||sv==='light') root.setAttribute('data-theme',sv);}catch(e){}
// o beta foi encerrado em 05/10/2026: todos os recursos valem para todos (apaga o sinalizador antigo deste navegador)
try{localStorage.removeItem('plantas-beta');}catch(e){}
function currentTheme(){var t=root.getAttribute('data-theme'); if(t) return t; return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
window.plantasTema=currentTheme;
document.addEventListener('DOMContentLoaded',function(){
  // marca Modulus no lugar do quadradinho
  var bm=document.querySelector('.brand-mark');
  if(bm){ var rz=document.body.getAttribute('data-root')||''; var lk=document.createElement('a'); lk.className='brand-logo'; lk.href=rz||'./'; lk.setAttribute('aria-label','Modulus, página inicial');
    lk.innerHTML='<img src="'+rz+'assets/logo.svg" alt=""><span class="wordmark">Modulus</span>'; bm.replaceWith(lk); }
  // menu geral: <body data-nav="inicio|gerador|banco" data-root="../">
  var nav=document.body.getAttribute('data-nav'), barIn=document.querySelector('.bar-in');
  if(nav!==null && barIn){
    var raiz=document.body.getAttribute('data-root')||'';
    var ic={inicio:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      gerador:'<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12h9M13 4v16M13 15h7" stroke="currentColor" stroke-width="1.8"/>',
      banco:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'};
    // [chave, rótulo, rótulo curto (celular), endereço]
    var itens=[['inicio','Início','Início',raiz||'./'],['gerador','Gerador','Gerador',raiz+'gerador/'],['banco','Banco de projetos','Banco',raiz+'banco/']];
    var el=document.createElement('nav'); el.className='topnav'; el.id='topnav'; el.setAttribute('aria-label','Seções');
    el.innerHTML=itens.map(function(i){return '<a class="nav-b" style="--c:var(--nav-'+i[0]+')" href="'+i[3]+'"'+(i[0]===nav?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true">'+ic[i[0]]+'</svg><span class="ll">'+i[1]+'</span><span class="ls" aria-hidden="true">'+i[2]+'</span></a>';}).join('');
    var tb=document.getElementById('themeBtn'); barIn.insertBefore(el,tb);
    // o botão de tema entra no menu, no mesmo formato
    if(tb){ tb.className='nav-b'; tb.style.setProperty('--c','var(--nav-tema)'); el.appendChild(tb); }
  }
  var themeBtn=document.getElementById('themeBtn');
  var icTema={sol:'<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    lua:'<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'};
  function labelTheme(){if(!themeBtn) return; var esc=currentTheme()==='dark', t=esc?'Tema claro':'Tema escuro';
    if(themeBtn.classList.contains('nav-b')) themeBtn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(esc?icTema.sol:icTema.lua)+'</svg><span class="ll">'+t+'</span><span class="ls" aria-hidden="true">'+(esc?'Claro':'Escuro')+'</span>';
    else themeBtn.textContent=t;
    themeBtn.setAttribute('aria-label',t);}
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
