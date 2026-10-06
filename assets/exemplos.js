/* Exemplos do banco: um por formato de planta, todos com 3 suítes e 3 vagas, gerados ao vivo pelo motor
   (acompanham as regras atuais do sistema). Usado na página inicial (estudos em destaque) e no banco.
   Depende de gerador/motor.js e gerador/desenho.js. */
(function(root){
'use strict';
const BASE = {quartos:3, suites:3, master:true, vagas:3, tipo:'terrea', orientacao:'N'};
const LISTA = [
  {id:'ex-bloco', formato:'Bloco', nome:'Bloco único', resumo:'Casa térrea compacta em bloco único, com as três suítes enfileiradas no fundo e o corredor terminando na suíte master.', programa:{formato:'bloco', frente:12, fundo:35}},
  {id:'ex-L', formato:'L', nome:'Em L', resumo:'Ala social na frente e ala íntima em L, deixando um quintal protegido ao lado das suítes.', programa:{formato:'L', frente:12, fundo:35}},
  {id:'ex-U', formato:'U', nome:'Em U', resumo:'Ala social na frente, suítes numa ala lateral e serviço na outra, em volta de um pátio aberto para o fundo.', programa:{formato:'U', frente:24, fundo:30}},
  {id:'ex-H', formato:'H', nome:'Em H', resumo:'Ala íntima e ala social paralelas, ligadas pela galeria e pela cozinha, com o pátio de entrada entre elas.', programa:{formato:'H', frente:19, fundo:25}},
];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const codifica = d => btoa(unescape(encodeURIComponent(JSON.stringify(d))));

// gera cada exemplo; devolve [{ex, programa, v, svg, link}] (ignora o que não montar)
function gerar(raiz){
  const f2 = root.Motor.f2;
  return LISTA.map(ex => {
    const programa = Object.assign({}, BASE, ex.programa);
    try{
      const v = root.Motor.gerar(programa).variantes[0]; if(!v) return null;
      const pi = Math.max(0, v.pav.findIndex(p => p.nome === 'Térreo'));
      const svg = root.Desenho.planta(v, pi, {titulo: ex.nome + ' · 3 suítes · 3 vagas', sub: v.tipologia});
      const link = `${raiz}gerador/#q=${codifica(root.Motor.normaliza(programa))}&v=0&e=0`;
      return {ex, programa, v, svg, link, f2};
    }catch(e){ return null; }
  }).filter(Boolean);
}

// cartão no padrão .proj; com {acoes:true} o cartão é um <article> com botão, senão o cartão todo é o link
function cartao(g, opc){
  const {ex, programa: p, v, svg, link, f2} = g, o = opc || {};
  const corpo = `
      <div class="thumb">${svg}</div>
      <div class="body">
        <span class="tag-ex">Gerado pelo Modulus · regras atuais</span>
        <h2>${esc(ex.nome)} · 3 suítes, 3 vagas</h2>
        <p>${esc(ex.resumo)}</p>
        <dl><dt>Formato</dt><dd>${esc(v.tipologia)} · térrea</dd><dt>Casa</dt><dd>${f2(v.W)} × ${f2(v.D)} m · ${f2(v.quadro.fechada)} m²</dd><dt>Lote</dt><dd>${f2(p.frente)} × ${f2(p.fundo)} m, frente para o norte</dd><dt>Pontuação</dt><dd>${v.score} / 100</dd></dl>
        ${o.acoes ? `<div class="acts"><a class="btn prim" href="${esc(link)}">Abrir no gerador</a></div>` : '<span class="go">Abrir no gerador →</span>'}
      </div>`;
  return o.acoes ? `<article class="proj salvo" style="--c:var(--plum)">${corpo}</article>` : `<a class="proj" href="${esc(link)}" style="--c:var(--plum)">${corpo}</a>`;
}

// recorta as miniaturas para o lote desenhado (o desenho completo tem margens, rosa e legenda)
function ajustar(el){
  for(const svg of el.querySelectorAll('.thumb > svg')){
    // recorta na área edificável (onde está a casa); sem ela, no lote
    try{ const titulo = re => [...svg.querySelectorAll('rect')].find(r => re.test((r.querySelector('title') || {}).textContent || ''));
      const lote = titulo(/^Área edificável/) || titulo(/^Lote /);
      if(!lote) continue;
      // caixa do retângulo levada para o sistema do SVG (considera os grupos deslocados e girados)
      const bb = lote.getBBox(), M = svg.getScreenCTM().inverse().multiply(lote.getScreenCTM()), m = 18;
      const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(([x, y]) => [M.a*x + M.c*y + M.e, M.b*x + M.d*y + M.f]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
      if(bb.width > 2) svg.setAttribute('viewBox', [x0 - m, y0 - m, Math.max(...xs) - x0 + 2*m, Math.max(...ys) - y0 + 2*m].join(' '));
      svg.removeAttribute('width'); svg.removeAttribute('height'); }catch(e){ /* fora da tela */ }
  }
}

root.Exemplos = {LISTA, BASE, gerar, cartao, ajustar};
})(this);
