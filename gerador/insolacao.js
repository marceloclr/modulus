/* Insolação da variante ao longo do ano: sombras da casa no lote, manchas de sol no piso pelas janelas,
   fachadas iluminadas, incidência por fachada no mês e horas de sol por cômodo. Funções puras (Node e navegador).
   Plano: docs/planos/2026-10-05-sol-vento-animacao.md.

   Coordenadas da casa: x ao longo da frente (vista da rua), y para o fundo. A face y0 olha para o rumo F da frente,
   x1 para F + 90°, y1 para F + 180°, x0 para F + 270° (Motor.rumoFace). Uma direção de azimute β vale
   (cos(β − F − 90°), cos(β − F − 180°)) nesse sistema. A sombra de um ponto à altura H anda H / tan h no sentido
   oposto ao sol; a luz que entra por uma janela à altura z chega ao piso a z / tan h para dentro. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./motor.js'), require('./brises.js'));
  else root.Insolacao = factory(root.Motor, root.Brises);
})(this, function(Motor, Brises){
'use strict';
const rad = g => g * Math.PI / 180;
const DIAS = Brises.DIAS, MESES = Brises.MESES, PASSO = 0.25;
const ABERTOS = ['terraco', 'jardim', 'rampa', 'manobra'];
// peitoril e verga por tipo de janela (m)
const ALTURAS = j => j.vidro ? [0, 2.2] : j.alta ? [2.2 - (j.h || 0.6), 2.2] : [1.0, 1.0 + (j.h || 1.2)];

// direção horizontal para o sol, no sistema da casa
function direcao(az, F){ return {x: Math.cos(rad(az - F - 90)), y: Math.cos(rad(az - F - 180))}; }
function solEm(mes, hora){ return Brises.sol(DIAS[mes - 1], hora); }

// envoltório convexo (cadeia monótona)
function envoltorio(pts){
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = [], hi = [];
  for(const q of p){ while(lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
  for(let i = p.length - 1; i >= 0; i--){ const q = p[i]; while(hi.length >= 2 && cr(hi[hi.length-2], hi[hi.length-1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// recorte de polígono por retângulo (Sutherland–Hodgman)
function recorta(poly, r){
  const lados = [[p => p[0] >= r.x0, (a, b) => inter(a, b, 0, r.x0)], [p => p[0] <= r.x1, (a, b) => inter(a, b, 0, r.x1)],
                 [p => p[1] >= r.y0, (a, b) => inter(a, b, 1, r.y0)], [p => p[1] <= r.y1, (a, b) => inter(a, b, 1, r.y1)]];
  function inter(a, b, k, v){ const t = (v - a[k]) / (b[k] - a[k]); return [a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1])]; }
  let out = poly;
  for(const [dentro, corta] of lados){
    const inp = out; out = [];
    for(let i = 0; i < inp.length; i++){ const a = inp[i], b = inp[(i + 1) % inp.length];
      if(dentro(b)){ if(!dentro(a)) out.push(corta(a, b)); out.push(b); } else if(dentro(a)) out.push(corta(a, b)); }
    if(!out.length) break;
  }
  return out;
}
const areaPoly = p => Math.abs(p.reduce((t, a, i) => { const b = p[(i + 1) % p.length]; return t + a[0]*b[1] - b[0]*a[1]; }, 0)) / 2;

// pavimentos da casa com a cota do teto (o subsolo semienterrado levanta a casa 1,40 m)
function andares(v, q){
  const pd = q.peDireito || 3, base = q.subsolo && q.subNivel === 'meio' ? 1.4 : 0;
  return v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo').map((p, i) => ({p, topo: base + (i + 1) * pd, piso: base + i * pd}));
}

/* Sombras no lote para um instante: [{pts:[[x,y]…], altura}] em coordenadas da casa. */
function sombras(v, q, s){
  if(!s || s.h <= 0.5) return [];
  const F = Motor.RUMOS[q.orientacao] || 0, d = direcao(s.az, F), k = 1 / Math.tan(rad(s.h)), out = [];
  const caixa = (r, H) => { const dx = -d.x * H * k, dy = -d.y * H * k, c = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
    out.push({pts: envoltorio(c.concat(c.map(([x, y]) => [x + dx, y + dy]))), altura: H}); };
  for(const {p, topo} of andares(v, q)) for(const r of p.salas) if(!ABERTOS.includes(r.tipo)) caixa(r, topo);
  if(v.torre) caixa(v.torre, andares(v, q).slice(-1)[0].topo + 1.5);
  for(const a of (v.anexos || [])) if(a.tipo === 'edicula') caixa(a, (a.dois ? 2 : 1) * (q.peDireito || 3));
  return out;
}

/* Fator de brise de uma face (Brises.estudar), 1 sem brise. */
function fatorBrise(est, rumo, hsa, vsa){
  const fc = est && est.faces && est.faces.find(f => f.rumo === rumo); if(!fc) return 1;
  const p = {ds:fc.ds, beta:fc.beta, dsV:fc.dsV, betaV:fc.betaV}, i = {hsa, vsa};
  return fc.tipo === 'movel' ? Brises.luzMovel(i, p) : Brises.luz(fc.tipo, p, i);
}

/* Manchas de sol no piso do pavimento p: [{pts, sala, intensidade, rumo}]; fachadas: [{o,c,t0,t1,lado,rumo,intensidade}]. */
function luzPavimento(v, q, p, s, est){
  const F = Motor.RUMOS[q.orientacao] || 0, manchas = [], fachadas = [];
  if(!s || s.h <= 0.5) return {manchas, fachadas};
  const d = direcao(s.az, F), k = 1 / Math.tan(rad(s.h));
  const naFace = lado => { const psi = Motor.rumoFace(lado, F, false), hsa = Brises.norm180(s.az - psi);
    if(Math.abs(hsa) >= 90) return null;
    return {psi, hsa, vsa: Math.atan(Math.tan(rad(s.h)) / Math.cos(rad(hsa))) * 180 / Math.PI, cosi: Math.cos(rad(s.h)) * Math.cos(rad(hsa)),
      rumo: Object.keys(Motor.RUMOS).find(r => Motor.RUMOS[r] === ((Math.round(psi) % 360) + 360) % 360)}; };
  // fachadas: trechos externos de cada cômodo
  const fechados = p.salas.filter(x => !Motor.TIPOS[x.tipo].aberto);
  for(const r of fechados) for(const t of Motor._interno.trechosExternos(r, fechados)){ const f = naFace(t.lado); if(f) fachadas.push(Object.assign({rumo:f.rumo, intensidade:f.cosi}, t)); }
  // janelas
  for(const j of (p.janelas || [])){
    let sala = null, lado = null; for(const r of p.salas){ lado = Motor.ladoDaJanela(j, r); if(lado){ sala = r; break; } }
    if(!sala) continue;
    const f = naFace(lado); if(!f) continue;
    const luz = fatorBrise(est, f.rumo, f.hsa, f.vsa); if(luz <= 0.02) continue;
    const [z0, z1] = ALTURAS(j), P = (t, z) => { const w = j.o === 'h' ? [t, j.c] : [j.c, t]; return [w[0] - d.x * z * k, w[1] - d.y * z * k]; };
    const poly = recorta([P(j.t0, z0), P(j.t1, z0), P(j.t1, z1), P(j.t0, z1)], sala);
    if(poly.length >= 3 && areaPoly(poly) > 0.01) manchas.push({pts:poly, sala:sala.id, nomeSala:sala.nome, intensidade:f.cosi * luz, rumo:f.rumo, area:areaPoly(poly)});
  }
  return {manchas, fachadas};
}

/* Incidência direta por fachada no mês (kWh/m²), nas faces com janela ou parede externa. */
function incidenciaFaces(v, q, mes){
  if(Motor.RUMOS[q.orientacao] === undefined) return [];
  const F = Motor.RUMOS[q.orientacao], rumos = new Set();
  for(const {p} of andares(v, q)){ const fe = p.salas.filter(x => !Motor.TIPOS[x.tipo].aberto);
    for(const r of fe) for(const t of Motor._interno.trechosExternos(r, fe)){ const psi = Motor.rumoFace(t.lado, F, false); rumos.add(((Math.round(psi) % 360) + 360) % 360); } }
  return [...rumos].sort((a, b) => a - b).map(psi => {
    const kwh = Brises.instantes(psi).filter(i => i.mes === mes - 1).reduce((t, i) => t + i.peso, 0) * 0.5 * 365 / 12 / 1000;
    const rumo = Object.keys(Motor.RUMOS).find(r => Motor.RUMOS[r] === psi);
    return {rumo, nome: Motor.NOMES_RUMO[rumo], psi, kwh};
  });
}

/* Horas de sol direto pelas janelas de cada cômodo no dia 21 do mês (passo de 15 min), e se o sol é da tarde. */
function horasSolComodos(v, q, mes, est){
  if(Motor.RUMOS[q.orientacao] === undefined) return [];
  const acc = new Map();
  for(const {p} of andares(v, q)){
    for(let t = 6; t <= 18.001; t += PASSO){
      const s = solEm(mes, t); if(s.h <= 0.5) continue;
      const vistos = new Set();
      for(const m of luzPavimento(v, q, p, s, est).manchas){ if(vistos.has(m.sala)) continue; vistos.add(m.sala);
        const key = p.nome + '|' + m.sala, a = acc.get(key) || {pav:p.nome, sala:m.sala, nome:m.nomeSala, tipo:p.salas.find(x => x.id === m.sala).tipo, horas:0, tarde:0, inicio:t, fim:t};
        a.horas += PASSO; if(t >= 14) a.tarde += PASSO; a.fim = t; acc.set(key, a); }
    }
  }
  return [...acc.values()].sort((a, b) => b.horas - a.horas);
}

/* Quadro de um instante: sol, sombras e luz de um pavimento. */
function quadro(v, q, pi, mes, hora, est){
  const s = solEm(mes, hora), p = v.pav[pi];
  const sob = s.h > 0.5 ? sombras(v, q, s) : [];
  return Object.assign({sol:s, sombras:sob}, p && !p.anexo && p.nome !== 'Subsolo' ? luzPavimento(v, q, p, s, est) : {manchas:[], fachadas:[]});
}

return {direcao, solEm, sombras, luzPavimento, incidenciaFaces, horasSolComodos, quadro, envoltorio, recorta, areaPoly, ALTURAS, MESES};
});
