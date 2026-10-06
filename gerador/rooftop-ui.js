/* Rosa do rooftop (etapa E2.1, 06/10/2026): escolha da posição a partir da caixa de escada, com o rumo de cada opção.
   A opção cuja fachada fica a oeste (poente) fica indisponível; sudoeste e noroeste aparecem com aviso de sol da tarde.
   As regras vêm do motor (Motor.rooftopOpcoes); este módulo só desenha e liga os rádios name="rtPos". */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./motor.js')); else root.RooftopUI = factory(root.Motor);
})(this, function(Motor){
'use strict';
const GRAUS = {N:0, NE:45, L:90, SE:135, S:180, SO:225, O:270, NO:315};

/* Texto de cada opção para a orientação dada. */
function opcoes(orientacao){
  return Motor.rooftopOpcoes({orientacao}).map(o => {
    const rumo = o.rumo ? Motor.NOMES_RUMO[o.rumo].toLowerCase() : null;
    const dica = o.valor === 'centro' ? 'só o necessário para os itens marcados, dos dois lados da escada'
      : o.proibido ? `abre para ${rumo} (poente): indisponível` : rumo ? `abre para ${rumo}${o.tarde ? ' — sol da tarde em parte do ano' : ''}` : 'informe a orientação da frente para ver o rumo';
    return Object.assign({}, o, {dica});
  });
}

/* SVG: casa girada pelo rumo da frente (norte para cima), escada no meio e a faixa da opção escolhida. */
function svg(orientacao, valor){
  const a = GRAUS[orientacao] || 0, ops = opcoes(orientacao);
  const faixa = {frente:[-46, 9], centro:[-20, 20], fundo:[-9, 46]}[valor] || [-20, 20];
  const zona = (v, y0, y1) => { const o = ops.find(x => x.valor === v);
    return `<rect class="rt-zona${o.proibido ? ' proibida' : ''}" data-v="${v}" x="-26" y="${y0}" width="52" height="${y1 - y0}"><title>${o.rotulo}: ${o.dica}</title></rect>`; };
  return `<svg viewBox="-70 -70 140 140" role="img" aria-label="Posição do rooftop sobre a casa">
  <circle r="62" fill="none" stroke="currentColor" stroke-opacity=".2"/>
  ${Object.entries(GRAUS).filter(([, g]) => g % 90 === 0).map(([k, g]) => { const r = g*Math.PI/180; return `<text x="${(58*Math.sin(r)).toFixed(1)}" y="${(-58*Math.cos(r) + 3.5).toFixed(1)}" text-anchor="middle" class="rt-rumo${k === 'O' ? ' poente' : ''}">${k}</text>`; }).join('')}
  <g transform="rotate(${a})"${orientacao ? '' : ' opacity=".45"'}>
    <rect x="-26" y="-46" width="52" height="92" rx="2" class="rt-casa"/>
    <rect x="-26" y="${faixa[0]}" width="52" height="${faixa[1] - faixa[0]}" class="rt-sel"/>
    ${zona('frente', -46, -9)}${zona('centro', -9, 9)}${zona('fundo', 9, 46)}
    <rect x="-6" y="-9" width="12" height="18" class="rt-escada"/>
    <text y="-50" text-anchor="middle" class="rt-frente" transform="rotate(${-a} 0 -50)">frente</text>
  </g>
</svg>`;
}

/* Liga a rosa ao formulário: redesenha quando muda a orientação ou a posição e desativa a opção a oeste. */
function ligar(form, caixa){
  if(!form || !caixa) return;
  const rumo = () => (form.querySelector('input[name=orientacao]:checked') || {}).value || '';
  const atualizar = () => {
    const ori = rumo(), ops = opcoes(ori);
    let marcado = form.querySelector('input[name=rtPos]:checked');
    for(const o of ops){
      const inp = form.querySelector(`input[name=rtPos][value="${o.valor}"]`); if(!inp) continue;
      inp.disabled = !!o.proibido;
      const d = inp.closest('label') && inp.closest('label').querySelector('small'); if(d) d.textContent = o.dica;
      if(o.proibido && inp.checked){ inp.checked = false; marcado = null; }
    }
    if(!marcado){ const c = form.querySelector('input[name=rtPos][value="centro"]'); if(c) c.checked = true; }
    caixa.innerHTML = svg(ori, (form.querySelector('input[name=rtPos]:checked') || {}).value);
  };
  caixa.addEventListener('click', e => {
    const z = e.target.closest('.rt-zona'); if(!z || z.classList.contains('proibida')) return;
    const inp = form.querySelector(`input[name=rtPos][value="${z.dataset.v}"]`);
    if(inp && !inp.checked){ inp.checked = true; inp.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  form.addEventListener('change', e => { if(e.target.name === 'orientacao' || e.target.name === 'rtPos' || e.target.name === 'rooftop') atualizar(); });
  atualizar();
  return atualizar;
}

return {opcoes, svg, ligar};
});
