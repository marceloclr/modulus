/* Limpeza dos dados do Modulus neste navegador (06/10/2026). Carregado em todas as páginas, inclusive na casa simétrica.
   Dois botões no rodapé, cada um com confirmação na própria página:
   - "Limpar dados do navegador": apaga escolhas e estado (localStorage plantas-*, memorial-*, modulus-*, menos as plantas
     salvas), o sessionStorage, o IndexedDB "modulus" (valores de custo), o Cache Storage e os service workers, e recarrega
     com ?limpo=<hora> para buscar de novo scripts e estilos;
   - "Apagar plantas salvas": apaga só o banco de plantas (plantas-banco). */
(function(){
'use strict';
var BANCO = 'plantas-banco', PREFIXOS = ['plantas-', 'memorial-', 'modulus-'];
function qtdPlantas(){ try{ var l = JSON.parse(localStorage.getItem(BANCO) || '[]'); return Array.isArray(l) ? l.length : 0; }catch(e){ return 0; } }
function chaves(){ var k = []; try{ for(var i = 0; i < localStorage.length; i++){ var c = localStorage.key(i); if(c !== BANCO && PREFIXOS.some(function(p){ return c.indexOf(p) === 0; })) k.push(c); } }catch(e){} return k; }
function recarrega(msg){
  try{ sessionStorage.setItem('modulus-limpeza-msg', msg); }catch(e){}
  location.replace(location.pathname + '?limpo=' + Date.now());
}
function limparTudo(){
  chaves().forEach(function(c){ try{ localStorage.removeItem(c); }catch(e){} });
  try{ sessionStorage.clear(); }catch(e){}
  var tarefas = [];
  try{ if(window.indexedDB) tarefas.push(new Promise(function(ok){ var r = indexedDB.deleteDatabase('modulus'); r.onsuccess = r.onerror = r.onblocked = function(){ ok(); }; })); }catch(e){}
  try{ if(window.caches) tarefas.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })); }catch(e){}
  try{ if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations) tarefas.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.unregister(); })); })); }catch(e){}
  // o banco IndexedDB aberto nesta página só termina de apagar quando ela fecha: espera no máximo 1 s e recarrega
  Promise.race([Promise.all(tarefas.map(function(t){ return t.catch(function(){}); })), new Promise(function(ok){ setTimeout(ok, 1000); })])
    .then(function(){ recarrega('Dados do navegador apagados. As plantas salvas foram mantidas.'); });
}
function apagarPlantas(){ var n = qtdPlantas(); try{ localStorage.removeItem(BANCO); }catch(e){} recarrega(n === 1 ? '1 planta salva apagada.' : n + ' plantas salvas apagadas.'); }

var CSS = '.limpeza{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
  '.limpeza .btn{font-size:12.5px;padding:7px 10px}' +
  'dialog.limpa{max-width:min(92vw,460px);border:1px solid var(--line);border-radius:14px;background:var(--surface-2);color:var(--ink);padding:20px 22px;box-shadow:0 18px 48px rgba(0,0,0,.3)}' +
  'dialog.limpa::backdrop{background:rgba(10,14,20,.5)}' +
  'dialog.limpa h2{font-size:20px;margin:0 0 8px}dialog.limpa p,dialog.limpa li{font-size:14px;color:var(--ink-2)}dialog.limpa ul{margin:6px 0 12px;padding-left:18px}' +
  'dialog.limpa .acoes{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}' +
  'dialog.limpa .perigo{background:var(--rust);border-color:var(--rust);color:var(--bg)}' +
  '.limpa-aviso{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);transform:translateX(-50%);z-index:70;background:var(--ink);color:var(--bg);font-size:13.5px;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:92vw}';

function dialogo(titulo, corpo, botao, acao){
  var d = document.createElement('dialog'); d.className = 'limpa';
  d.innerHTML = '<h2>' + titulo + '</h2>' + corpo + '<div class="acoes"><button class="btn" type="button" data-x="nao">Cancelar</button><button class="btn perigo" type="button" data-x="sim">' + botao + '</button></div>';
  d.addEventListener('click', function(e){ var b = e.target.closest('[data-x]'); if(!b) return; if(b.getAttribute('data-x') === 'sim'){ b.disabled = true; b.textContent = 'Apagando…'; acao(); } else { d.close(); d.remove(); } });
  d.addEventListener('close', function(){ if(d.parentNode) d.remove(); });
  document.body.appendChild(d);
  if(d.showModal) d.showModal(); else d.setAttribute('open', '');
  d.querySelector('[data-x="nao"]').focus();
}

document.addEventListener('DOMContentLoaded', function(){
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // aviso depois da recarga e limpeza do ?limpo= da barra de endereço
  var msg = null; try{ msg = sessionStorage.getItem('modulus-limpeza-msg'); sessionStorage.removeItem('modulus-limpeza-msg'); }catch(e){}
  if(/[?&]limpo=/.test(location.search)){ try{ history.replaceState(null, '', location.pathname); }catch(e){} }
  if(msg){ var av = document.createElement('div'); av.className = 'limpa-aviso'; av.setAttribute('role', 'status'); av.textContent = msg; document.body.appendChild(av); setTimeout(function(){ av.remove(); }, 4500); }

  var ft = document.querySelector('footer'); if(!ft) return;
  var box = document.createElement('div'); box.className = 'limpeza';
  box.innerHTML = '<button class="btn" type="button" id="limparDados" data-tip="Apaga o que o Modulus guardou neste navegador (escolhas, tema, estado do gerador, valores de custo e cópias em cache) e recarrega a página. As plantas salvas ficam.">Limpar dados do navegador</button>' +
    '<button class="btn" type="button" id="apagarPlantas" data-tip="Apaga só as plantas que você salvou no banco deste navegador">Apagar plantas salvas</button>';
  ft.appendChild(box);
  document.getElementById('limparDados').addEventListener('click', function(){
    dialogo('Limpar dados do navegador?',
      '<p>O Modulus volta ao estado de primeira visita neste navegador:</p><ul><li>campos do gerador, blocos concluídos e vista da planta;</li><li>tema, menu e preferências de exibição;</li><li>valores de custo atualizados ou ajustados;</li><li>cópias em cache dos arquivos do site.</li></ul><p><strong>As plantas salvas no banco são mantidas.</strong> Para apagá-las, use "Apagar plantas salvas".</p>',
      'Apagar e recarregar', limparTudo);
  });
  document.getElementById('apagarPlantas').addEventListener('click', function(){
    var n = qtdPlantas();
    dialogo('Apagar as plantas salvas?',
      n ? '<p>' + (n === 1 ? 'A planta salva' : 'As ' + n + ' plantas salvas') + ' no banco deste navegador ' + (n === 1 ? 'será apagada' : 'serão apagadas') + '. Não há como desfazer.</p><p>Para guardar uma cópia, exporte o JSON na página do Banco de projetos antes.</p>'
        : '<p>Não há plantas salvas neste navegador.</p>',
      n ? 'Apagar plantas' : 'Recarregar', apagarPlantas);
  });
});
})();
