/* Vento por mês (dados/vento.json, ERA5) aplicado à variante: janelas de entrada (barlavento) e de saída (sotavento)
   e linhas de corrente ilustrativas sobre o lote. Funções puras (Node e navegador). Não é simulação (CFD). */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./motor.js'));
  else root.Vento = factory(root.Motor);
})(this, function(Motor){
'use strict';
const rad = g => g * Math.PI / 180;
// direção (azimute β) no sistema da casa (ver insolacao.js)
const direcao = (az, F) => ({x: Math.cos(rad(az - F - 90)), y: Math.cos(rad(az - F - 180))});

function mesDe(dados, mes){ return dados && dados.meses ? dados.meses[mes - 1] : null; }

/* Janelas do pavimento p classificadas pelo vento que vem de dirDe: entrada (a normal da face aponta até 67,5° do vento),
   saída (face oposta, a mais de 112,5°) ou lateral. */
function janelas(v, q, p, dirDe){
  const F = Motor.RUMOS[q.orientacao] || 0, out = [];
  for(const j of (p.janelas || [])){
    let lado = null; for(const s of p.salas){ lado = Motor.ladoDaJanela(j, s); if(lado) break; }
    if(!lado) continue;
    const psi = Motor.rumoFace(lado, F, false), dif = Math.abs(((psi - dirDe) % 360 + 540) % 360 - 180);
    out.push(Object.assign({lado, papel: dif <= 67.5 ? 'entrada' : dif >= 112.5 ? 'saida' : 'lateral'}, j));
  }
  return out;
}

/* Linhas de corrente paralelas ao vento, cobrindo a caixa (x0..x1, y0..y1) da casa e do lote: [{a:[x,y], b:[x,y]}]. */
function linhas(caixa, dirDe, F, n){
  const d = direcao(dirDe + 180, F), nx = -d.y, ny = d.x;                 // sentido do escoamento e sua perpendicular
  const cx = (caixa.x0 + caixa.x1)/2, cy = (caixa.y0 + caixa.y1)/2, R = Math.hypot(caixa.x1 - caixa.x0, caixa.y1 - caixa.y0)/2;
  const k = n || 9, out = [];
  for(let i = 0; i < k; i++){ const o = -R + (2*R) * (i + 0.5) / k;
    out.push({a:[cx + nx*o - d.x*R, cy + ny*o - d.y*R], b:[cx + nx*o + d.x*R, cy + ny*o + d.y*R]}); }
  return out;
}

/* Resumo do mês para o painel. */
function resumo(dados, mes){
  const m = mesDe(dados, mes); if(!m) return null;
  const top = m.rosa.slice().sort((a, b) => b.freq - a.freq).slice(0, 3);
  const rumo16 = ['N','NNE','NE','ENE','L','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  const nome = d => rumo16[Math.round(d / 22.5) % 16];
  return {mes, velMedia:m.velMedia, calmaria:m.calmaria, dirPredominante:m.dirPredominante, nomePredominante:nome(m.dirPredominante),
    dirMedia:m.dirMedia, principais: top.map(r => ({dir:r.dir, nome:nome(r.dir), freq:r.freq, vel:r.vel})), velHora:m.velHora, rosa:m.rosa,
    velMax: Math.max(...dados.meses.map(x => x.velMedia))};
}

return {direcao, mesDe, janelas, linhas, resumo};
});
