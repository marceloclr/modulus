/* Brises: estudo do tipo e do ângulo que melhor sombreiam cada face, pela geometria solar de Fortaleza.
   Funções puras (Node e navegador). Plano: docs/planos/2026-10-05-blocos-custos-solar-estilos.md, seção 8.

   Sol: declinação δ = 23,45°·sen(360/365·(284+n)); ângulo horário ω = 15°·(hora solar − 12);
        sen h = sen φ·sen δ + cos φ·cos δ·cos ω; azimute α a partir do norte, no sentido horário.
   Face de azimute ψ (normal para fora): HSA = α − ψ (sombra horizontal), VSA = atan(tan h / cos HSA) (sombra vertical).
   Lâminas de profundidade d, espaçamento s e inclinação β (horizontais: borda externa para baixo é positivo;
   verticais: giro em planta): fração de sol que passa = máx(0, 1 − |d·sen β + d·cos β·tan θ| / s),
   com θ = VSA nas horizontais e θ = HSA nas verticais. Vista livre (olhar perpendicular, θ = 0) = 1 − d·|sen β|/s.
   Peso de cada instante: radiação direta (Meinel: 1353·0,7^(AM^0,678)) × cosseno do ângulo de incidência na face. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./motor.js'));
  else root.Brises = factory(root.Motor);
})(this, function(Motor){
'use strict';
const LAT = -3.73, LON = -38.52, VENTO = 112.5, S_PADRAO = 0.30;
const rad = g => g * Math.PI / 180, grau = r => r * 180 / Math.PI;
const DIAS = [21, 52, 80, 111, 141, 172, 202, 233, 264, 294, 325, 355];      // dia 21 de cada mês
const HORAS = []; for(let t = 7; t <= 17.001; t += 0.5) HORAS.push(t);
const DIAS_MES = 365 / 12, PASSO_H = 0.5;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const norm180 = a => ((a % 360) + 540) % 360 - 180;

function sol(n, hora){
  const d = rad(23.45 * Math.sin(rad(360 / 365 * (284 + n)))), w = rad(15 * (hora - 12)), f = rad(LAT);
  const sh = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(w), h = Math.asin(sh);
  let ca = (Math.sin(d) - sh * Math.sin(f)) / (Math.cos(h) * Math.cos(f)); ca = Math.max(-1, Math.min(1, ca));
  let az = grau(Math.acos(ca)); if(w > 0) az = 360 - az;
  return {h: grau(h), az};
}
function dni(h){ if(h <= 2) return 0; const am = 1 / Math.sin(rad(h)); return 1353 * Math.pow(0.7, Math.pow(am, 0.678)); }

// instantes de sol numa face: {mes, hora, h, az, hsa, vsa, peso}
const CACHE = {};
function instantes(psi){
  if(CACHE[psi]) return CACHE[psi];
  const out = [];
  DIAS.forEach((n, mes) => HORAS.forEach(hora => {
    const s = sol(n, hora); if(s.h <= 0) return;
    const hsa = norm180(s.az - psi); if(Math.abs(hsa) >= 90) return;
    const cosi = Math.cos(rad(s.h)) * Math.cos(rad(hsa)), peso = dni(s.h) * cosi; if(peso <= 0) return;
    out.push({mes, hora, h:s.h, az:s.az, hsa, vsa: grau(Math.atan(Math.tan(rad(s.h)) / Math.cos(rad(hsa)))), peso});
  }));
  return CACHE[psi] = out;
}
const passa = (ds, beta, teta) => Math.max(0, 1 - Math.abs(ds * Math.sin(rad(beta)) + ds * Math.cos(rad(beta)) * Math.tan(rad(teta))));
const vista = (ds, beta) => 1 - ds * Math.abs(Math.sin(rad(beta)));
function luz(tipo, p, i){
  if(tipo === 'horizontal') return passa(p.ds, p.beta, i.vsa);
  if(tipo === 'vertical') return passa(p.ds, p.beta, i.hsa);
  if(tipo === 'misto') return passa(p.ds, p.beta, i.vsa) * passa(p.dsV, p.betaV, i.hsa);
  return 1;
}
function avaliar(tipo, p, inst){
  let tot = 0, sombra = 0, horas = 0, horasSol = 0;
  for(const i of inst){ const l = tipo === 'movel' ? luzMovel(i, p) : luz(tipo, p, i); tot += i.peso; sombra += i.peso * (1 - l);
    horasSol += PASSO_H * DIAS_MES; if(l > 0.5) horas += PASSO_H * DIAS_MES; }
  return {pct: tot ? 100 * sombra / tot : 100, horasSemProtecao: Math.round(horas), horasSol: Math.round(horasSol), energia: tot};
}
// brise móvel (lâminas horizontais): a cada instante a inclinação que mais sombreia, mantendo a vista livre mínima
function luzMovel(i, p){ let m = 1; for(let b = -45; b <= 45; b += 5){ if(vista(p.ds, b) < 0.4 - 1e-9) continue; m = Math.min(m, passa(p.ds, b, i.vsa)); } return m; }

const BETAS = []; for(let b = -45; b <= 45; b += 5) BETAS.push(b);
const DSS = []; for(let x = 0.5; x <= 1.501; x += 0.1) DSS.push(Math.round(x * 10) / 10);
// varredura de β e d/s; restrições: vista livre ≥ 40 %, abertura para ventilação (cos β) ≥ 50 %,
// lâminas verticais a barlavento giradas a favor do vento (β com o sinal que deixa o vento de L/SE passar)
const MEMO = {};
function otimizar(tipo, psi){ const k = tipo + '|' + psi; return MEMO[k] || (MEMO[k] = otimizar0(tipo, psi)); }
function otimizar0(tipo, psi){
  const inst = instantes(psi), hsaVento = norm180(VENTO - psi), barlavento = Math.abs(hsaVento) < 90;
  const ok = (ds, b, vert) => vista(ds, b) >= 0.4 - 1e-9 && Math.cos(rad(b)) >= 0.5 && !(vert && barlavento && b * hsaVento > 0);
  // critério: entre as configurações a até 3 pontos do melhor sombreamento, a de maior vista livre (e depois a de lâmina mais curta)
  const todas = [];
  const vistaDe = p => tipo === 'misto' ? vista(p.ds, p.beta) * vista(p.dsV, p.betaV) : tipo === 'movel' ? 1 : vista(p.ds, p.beta);
  const prova = (p) => todas.push({p, r: avaliar(tipo, p, inst), vista: vistaDe(p)});
  if(tipo === 'misto'){
    const h = otimizar('horizontal', psi).p, v = otimizar('vertical', psi).p;
    for(const k of [0.6, 0.8, 1]) for(const kv of [0.6, 0.8, 1]){
      const p = {ds: Math.round(h.ds * k * 10) / 10, beta: h.beta, dsV: Math.round(v.ds * kv * 10) / 10, betaV: v.beta};
      if(vista(p.ds, p.beta) * vista(p.dsV, p.betaV) >= 0.4 - 1e-9) prova(p); }
    if(!todas.length) prova({ds:0.5, beta:0, dsV:0.5, betaV:0});
  } else if(tipo === 'movel'){
    for(const ds of DSS) prova({ds, beta:null});
  } else for(const ds of DSS) for(const b of BETAS) if(ok(ds, b, tipo === 'vertical')) prova({ds, beta:b});
  const topo = Math.max(...todas.map(c => c.r.pct));
  return todas.filter(c => c.r.pct >= topo - 3).sort((a, b) => b.vista - a.vista || a.p.ds - b.p.ds)[0];
}

const RUMOS = Motor.RUMOS, NOMES = Motor.NOMES_RUMO;
const rumoDe = az => Object.keys(RUMOS).find(k => RUMOS[k] === ((Math.round(az) % 360) + 360) % 360);
// energia solar direta anual em cada um dos 8 rumos (para escolher as faces críticas)
const ENERGIA = {}; for(const k of Object.keys(RUMOS)) ENERGIA[k] = instantes(RUMOS[k]).reduce((t, i) => t + i.peso, 0);
const EMAX = Math.max(...Object.values(ENERGIA));
const critica = k => ENERGIA[k] >= 0.5 * EMAX;

/* Faces da variante com janelas: {rumo: [janelas]} (janela: pav, o, c, t0, t1, h, lado). */
function faces(v, q){
  const F = RUMOS[q.orientacao]; if(F === undefined) return null;
  const out = {};
  for(const p of v.pav){
    if(p.nome === 'Subsolo') continue;
    for(const j of (p.janelas || [])){
      let lado = null; for(const s of p.salas){ lado = Motor.ladoDaJanela(j, s); if(lado) break; }
      if(!lado) continue;
      const k = rumoDe(Motor.rumoFace(lado, F, false)); if(!k) continue;
      (out[k] = out[k] || []).push(Object.assign({pav:p.nome, lado}, j));
    }
  }
  return out;
}

const TIPOS = {horizontal:'Lâminas horizontais', vertical:'Lâminas verticais', misto:'Grelha (horizontais e verticais)', movel:'Lâminas móveis'};
/* Estudo completo da variante (null sem brises ou sem orientação). */
function estudar(v, q){
  if(!q.brises) return null;
  const fs = faces(v, q);
  if(!fs) return {semOrientacao:true, faces:[]};
  const escolha = q.brisesFaces === 'escolha' ? Object.keys(RUMOS).filter(k => q['brisesFace_' + k]) : null;
  const lista = Object.keys(fs).filter(k => escolha ? escolha.includes(k) : critica(k));
  const res = lista.map(k => {
    const psi = RUMOS[k];
    let tipo = q.brisesTipo, m;
    if(!TIPOS[tipo]){                                   // automático: o mais simples que chega perto do melhor
      const cands = ['horizontal', 'vertical', 'misto'].map(t => ({t, m: otimizar(t, psi)}));
      const top = Math.max(...cands.map(c => c.m.r.pct));
      const esc = cands.find(c => c.m.r.pct >= top - 5); tipo = esc.t; m = esc.m;
    } else m = otimizar(tipo, psi);
    const sem = avaliar('nenhum', {}, instantes(psi));
    const jan = fs[k], area = jan.reduce((t, j) => t + (j.t1 - j.t0) * (j.h || 1.2), 0);
    const d = m.p.ds * S_PADRAO, dV = m.p.dsV ? m.p.dsV * S_PADRAO : null;
    const hsaVento = norm180(VENTO - psi), vistaFixa = m.vista;
    let alternativa = null;
    if(tipo !== 'movel' && vistaFixa < 0.7){ const mv = otimizar('movel', psi); if(mv.r.pct >= m.r.pct - 3) alternativa = {tipo:'movel', pct:mv.r.pct, ds:mv.p.ds}; }
    return {rumo:k, nome:NOMES[k], azimute:psi, tipo, nomeTipo:TIPOS[tipo], beta:m.p.beta, ds:m.p.ds, betaV:m.p.betaV, dsV:m.p.dsV,
      vista:vistaFixa, alternativa, espacamento:S_PADRAO, profundidade:d, profundidadeV:dV, pct:m.r.pct, horasSemProtecao:m.r.horasSemProtecao, horasSol:m.r.horasSol,
      horasSemBrise:sem.horasSemProtecao, janelas:jan.length, areaJanelas:area, critica:critica(k), barlavento:Math.abs(hsaVento) < 90,
      formula: tipo === 'movel' ? `Móvel: a cada meia hora, a inclinação (−45° a +45°) que mais sombreia, com vista livre ≥ 40 %; d/s = ${m.p.ds}` :
        `${tipo === 'vertical' ? 'HSA' : 'VSA'}: luz = máx(0, 1 − |d/s·sen β + d/s·cos β·tan θ|) com β = ${m.p.beta}° e d/s = ${m.p.ds}${tipo === 'misto' ? `; verticais β = ${m.p.betaV}°, d/s = ${m.p.dsV}` : ''}; vista livre ${Math.round(100 * vista(m.p.ds, m.p.beta || 0))} %`};
  });
  const janelas = res.flatMap(r => fs[r.rumo].map(j => Object.assign({nomeTipo:r.nomeTipo}, j)));
  return {faces:res, janelas, area: res.reduce((t, r) => t + r.areaJanelas, 0), semFaces: !res.length};
}

return {luz, luzMovel, norm180, sol, instantes, otimizar, avaliar, estudar, faces, passa, vista, critica, ENERGIA, TIPOS, MESES, LAT, LON, DIAS, HORAS, S_PADRAO};
});
