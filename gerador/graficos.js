/* Gráficos em SVG (strings), sem biblioteca, para os cards do gerador.
   - barrasFaixa: barras horizontais de um só tom (magnitude), com a faixa mínima–máxima como traço e valor à direita;
   - linhas: série mensal com até 3 linhas de uma rampa ordinal (um tom, claro → escuro), legenda e rótulo direto no fim.
   Cores pelos tokens do tema (CSS): --c (barra), --rampa-1..3 (linhas), --ink*, --line. Textos sempre na cor de texto.
   Cada barra e cada ponto recebe foco e traz data-tip (dica do site) com valor e fórmula; a tabela fica no card. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(); else root.Graficos = factory();
})(this, function(){
'use strict';
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* itens: [{nome, min, med, max, dica}] · fmt: número → texto */
function barrasFaixa(itens, fmt, op){
  op = op || {};
  const W = op.largura || 440, rot = op.rotulo || 150, valW = 78, alt = 26, gap = 8, x0 = rot + 8, x1 = W - valW - 8;
  const max = Math.max(...itens.map(i => i.max || i.med), 1), X = v => x0 + (x1 - x0) * v / max;
  const H = itens.length * (alt + gap) + 8;
  const o = [`<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(op.titulo || 'Gráfico de barras')}">`];
  o.push(`<line x1="${x0}" y1="0" x2="${x0}" y2="${H - 4}" stroke="var(--line)" stroke-width="1"/>`);
  itens.forEach((it, i) => {
    const y = 4 + i * (alt + gap), cy = y + alt/2, w = Math.max(2, X(it.med) - x0), destaque = op.destaque === i;
    o.push(`<g class="marca" tabindex="0" data-tip="${esc(it.dica || '')}" aria-label="${esc(it.nome + ': ' + fmt(it.med))}">`);
    o.push(`<rect x="${x0 - rot}" y="${y - 3}" width="${W - x0 + rot}" height="${alt + 6}" fill="transparent"/>`);   // área de toque maior que a barra
    o.push(`<text x="${x0 - 8}" y="${cy + 4}" text-anchor="end" class="g-rot">${esc(it.nome)}</text>`);
    // barra com ponta arredondada só do lado do valor (4 px), presa à linha de base
    const r = Math.min(4, w/2), h = alt - 8, yb = y + 4;
    o.push(`<path d="M${x0},${yb} H${x0 + w - r} Q${x0 + w},${yb} ${x0 + w},${yb + r} V${yb + h - r} Q${x0 + w},${yb + h} ${x0 + w - r},${yb + h} H${x0} Z" fill="var(--c)" fill-opacity="${destaque || op.destaque === undefined ? 1 : .45}"/>`);
    if(it.max > it.min){ o.push(`<line x1="${X(it.min)}" y1="${cy}" x2="${X(it.max)}" y2="${cy}" stroke="var(--ink-2)" stroke-width="1.5"/>`);
      for(const v of [it.min, it.max]) o.push(`<line x1="${X(v)}" y1="${cy - 5}" x2="${X(v)}" y2="${cy + 5}" stroke="var(--ink-2)" stroke-width="1.5"/>`); }
    o.push(`<text x="${W - 4}" y="${cy + 4}" text-anchor="end" class="g-val">${esc(fmt(it.med))}</text></g>`);
  });
  o.push('</svg>');
  return o.join('');
}

/* series: [{nome, pontos:[{x:'2026-07', y:2366.68}]}] (ordem = rampa 1..3) */
function linhas(series, fmt, op){
  op = op || {};
  const W = op.largura || 440, H = op.altura || 200, m = {l:64, r:150, t:12, b:28};
  const xs = [...new Set(series.flatMap(s => s.pontos.map(p => p.x)))].sort(), ys = series.flatMap(s => s.pontos.map(p => p.y));
  let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * .15 || hi * .05; lo -= pad; hi += pad;
  const X = x => m.l + (xs.length > 1 ? (W - m.l - m.r) * xs.indexOf(x) / (xs.length - 1) : (W - m.l - m.r)/2), Y = y => m.t + (H - m.t - m.b) * (1 - (y - lo)/(hi - lo));
  const o = [`<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(op.titulo || 'Série mensal')}">`];
  for(let k = 0; k <= 3; k++){ const v = lo + (hi - lo) * k/3, y = Y(v);
    o.push(`<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end" class="g-eixo">${esc(fmt(v))}</text>`); }
  for(const x of xs) o.push(`<text x="${X(x)}" y="${H - 8}" text-anchor="middle" class="g-eixo">${esc(op.mes ? op.mes(x) : x)}</text>`);
  series.forEach((s, i) => {
    const cor = `var(--rampa-${i + 1})`, pts = s.pontos.map(p => `${X(p.x)},${Y(p.y)}`).join(' ');
    o.push(`<polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    for(const p of s.pontos) o.push(`<g class="marca" tabindex="0" data-tip="${esc(`${s.nome} · ${op.mes ? op.mes(p.x) : p.x}: ${fmt(p.y)}`)}"><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="12" fill="transparent"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${cor}" stroke="var(--surface-2)" stroke-width="2"/></g>`);
    const ult = s.pontos[s.pontos.length - 1];
    o.push(`<line x1="${X(ult.x) + 10}" y1="${Y(ult.y)}" x2="${X(ult.x) + 24}" y2="${Y(ult.y)}" stroke="${cor}" stroke-width="2"/><text x="${X(ult.x) + 28}" y="${Y(ult.y) + 4}" class="g-rot">${esc(s.nome)} · ${esc(fmt(ult.y))}</text>`);
  });
  o.push('</svg>');
  return o.join('');
}

return {barrasFaixa, linhas};
});
