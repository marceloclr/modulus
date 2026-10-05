/* Zoom das imagens do gerador (planta e implantação): botões −, + e "Ajustar", percentual anunciado e atalhos + − 0
   com o foco no desenho. O zoom muda a largura do SVG (sem perder nitidez) e a caixa rola para navegar; o centro da vista
   é mantido. O nível sobrevive aos redesenhos (o SVG é trocado a cada alteração). */
(function(root){
'use strict';
const NIVEIS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

function ligar(caixa, ondeBarra, rotulo){
  let z = 1, base = 0;
  caixa.classList.add('zoom-caixa');
  if(!caixa.hasAttribute('tabindex')) caixa.setAttribute('tabindex', '0');
  caixa.setAttribute('aria-label', (rotulo || 'Desenho') + ': use + e − para aproximar e afastar, 0 para ajustar');
  const barra = document.createElement('span');
  barra.className = 'zoom-barra';
  barra.setAttribute('role', 'group');
  barra.setAttribute('aria-label', 'Zoom: ' + (rotulo || 'desenho'));
  barra.innerHTML = '<button class="btn" type="button" data-z="-1" aria-label="Afastar" data-tip="Afasta (reduz o zoom). Atalho: tecla − com o foco no desenho">−</button>'
    + '<output class="zoom-nivel" aria-live="polite">100 %</output>'
    + '<button class="btn" type="button" data-z="1" aria-label="Aproximar" data-tip="Aproxima (aumenta o zoom). Atalho: tecla + com o foco no desenho">+</button>'
    + '<button class="btn" type="button" data-z="0" data-tip="Volta o desenho ao tamanho da caixa. Atalho: tecla 0">Ajustar</button>';
  ondeBarra(barra);
  const nivel = barra.querySelector('.zoom-nivel');

  function aplicar(manterCentro){
    const svg = caixa.querySelector('svg'); if(!svg) return;
    const cx = caixa.scrollLeft + caixa.clientWidth/2, cy = caixa.scrollTop + caixa.clientHeight/2;
    const w0 = svg.getBoundingClientRect().width || 1, h0 = svg.getBoundingClientRect().height || 1;
    svg.style.width = ''; svg.style.maxWidth = ''; svg.style.maxHeight = '';
    // largura visível no modo "ajustar": a caixa ou, no desenho alto, a altura máxima vezes a proporção do desenho
    const r0 = svg.getBoundingClientRect(), vb = svg.viewBox && svg.viewBox.baseVal, mh = parseFloat(getComputedStyle(svg).maxHeight);
    base = (vb && vb.width && vb.height && mh) ? Math.min(r0.width, mh * vb.width / vb.height) : r0.width;
    if(z !== 1){ svg.style.width = (base * z).toFixed(0) + 'px'; svg.style.maxWidth = 'none'; svg.style.maxHeight = 'none'; }
    nivel.textContent = Math.round(z * 100) + ' %';
    barra.querySelector('[data-z="-1"]').disabled = z <= NIVEIS[0];
    barra.querySelector('[data-z="1"]').disabled = z >= NIVEIS[NIVEIS.length-1];
    if(manterCentro){ const r = svg.getBoundingClientRect(), kx = r.width / w0, ky = r.height / h0;
      caixa.scrollLeft = cx * kx - caixa.clientWidth/2; caixa.scrollTop = cy * ky - caixa.clientHeight/2; }
  }
  function passo(d){
    if(d === 0) z = 1;
    else { const i = NIVEIS.findIndex(n => Math.abs(n - z) < 0.001); z = NIVEIS[Math.min(NIVEIS.length-1, Math.max(0, (i < 0 ? 2 : i) + d))]; }
    aplicar(true);
  }
  barra.addEventListener('click', e => { const b = e.target.closest('[data-z]'); if(b) passo(+b.dataset.z); });
  caixa.addEventListener('keydown', e => {
    if(e.target !== caixa || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.key === '+' || e.key === '='){ e.preventDefault(); passo(1); }
    else if(e.key === '-' || e.key === '_'){ e.preventDefault(); passo(-1); }
    else if(e.key === '0'){ e.preventDefault(); passo(0); }
  });
  // o SVG é trocado a cada geração ou troca de pavimento: reaplica o nível atual
  new MutationObserver(() => aplicar(false)).observe(caixa, {childList:true});
  window.addEventListener('resize', () => aplicar(false));
  return {passo, nivel: () => z};
}

root.Zoom = {ligar, NIVEIS};
})(this);
