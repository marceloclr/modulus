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
  const o = [`<svg class="graf" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W*1.1)}px" role="img" aria-label="${esc(op.titulo || 'Gráfico de barras')}">`];
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
  const o = [`<svg class="graf" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W*1.1)}px" role="img" aria-label="${esc(op.titulo || 'Série mensal')}">`];
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

/* Colunas mensais de uma série (cor --c) com linha de referência tracejada (ex.: consumo). */
function colunas(valores, op){
  op = op || {};
  const W = op.largura || 440, H = op.altura || 210, m = {l:52, r:12, t:16, b:26}, n = valores.length;
  const hi = Math.max(...valores, op.ref || 0) * 1.15 || 1, Y = v => m.t + (H - m.t - m.b) * (1 - v/hi);
  const passo = (W - m.l - m.r) / n, larg = Math.max(4, passo - 6);
  const o = [`<svg class="graf" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W*1.1)}px" role="img" aria-label="${esc(op.titulo || 'Colunas mensais')}">`];
  for(let k = 0; k <= 3; k++){ const v = hi * k/3, y = Y(v); o.push(`<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end" class="g-eixo">${esc(op.fmt ? op.fmt(v) : Math.round(v))}</text>`); }
  valores.forEach((v, i) => {
    const x = m.l + i * passo + (passo - larg)/2, y = Y(v), h = Y(0) - y, r = Math.min(4, larg/2, h);
    o.push(`<g class="marca" tabindex="0" data-tip="${esc(op.dica ? op.dica(i) : v)}"><rect x="${m.l + i*passo}" y="${m.t}" width="${passo}" height="${H - m.t - m.b}" fill="transparent"/>`);
    o.push(`<path d="M${x},${Y(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + larg - r} Q${x + larg},${y} ${x + larg},${y + r} V${Y(0)} Z" fill="var(--c)"/></g>`);
    o.push(`<text x="${m.l + i*passo + passo/2}" y="${H - 8}" text-anchor="middle" class="g-eixo">${esc(op.rotulos ? op.rotulos[i] : i + 1)}</text>`);
  });
  if(op.ref){ const y = Y(op.ref); o.push(`<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - m.r}" y="${y - 5}" text-anchor="end" class="g-rot">${esc(op.refRotulo || '')}</text>`); }
  o.push('</svg>');
  return o.join('');
}

/* Uma série ao longo do tempo (cor --c), com a linha do zero e um marco opcional (ex.: payback). */
function linhaUnica(pontos, op){
  op = op || {};
  const W = op.largura || 440, H = op.altura || 210, m = {l:62, r:14, t:16, b:26};
  const ys = pontos.map(p => p.y), lo = Math.min(0, ...ys), hi = Math.max(0, ...ys), x0 = pontos[0].x, x1 = pontos[pontos.length-1].x;
  const X = x => m.l + (W - m.l - m.r) * (x - x0)/(x1 - x0 || 1), Y = y => m.t + (H - m.t - m.b) * (1 - (y - lo)/((hi - lo) || 1));
  const o = [`<svg class="graf" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W*1.1)}px" role="img" aria-label="${esc(op.titulo || 'Série')}">`];
  for(let k = 0; k <= 3; k++){ const v = lo + (hi - lo) * k/3, y = Y(v); o.push(`<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end" class="g-eixo">${esc(op.fmt ? op.fmt(v) : Math.round(v))}</text>`); }
  o.push(`<line x1="${m.l}" y1="${Y(0)}" x2="${W - m.r}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-width="1.5"/>`);
  for(const p of pontos) if(p.x % 5 === 0) o.push(`<text x="${X(p.x)}" y="${H - 8}" text-anchor="middle" class="g-eixo">${esc(op.xRot ? op.xRot(p.x) : p.x)}</text>`);
  o.push(`<polyline points="${pontos.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}" fill="none" stroke="var(--c)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
  for(const p of pontos) o.push(`<g class="marca" tabindex="0" data-tip="${esc(op.dica ? op.dica(p) : p.y)}"><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="8" fill="transparent"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.x % 5 === 0 ? 3.5 : 2}" fill="var(--c)"/></g>`);
  if(op.marco !== undefined && op.marco !== null && op.marco <= x1){ const x = X(op.marco);
    o.push(`<line x1="${x}" y1="${m.t}" x2="${x}" y2="${H - m.b}" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 3"/><text x="${x + 4}" y="${m.t + 10}" class="g-rot">${esc(op.marcoRotulo || '')}</text>`); }
  o.push('</svg>');
  return o.join('');
}

return {barrasFaixa, linhas, colunas, linhaUnica};
});
