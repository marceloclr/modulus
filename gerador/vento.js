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

/* V3: caixa da casa (cômodos fechados de todos os pavimentos, sem subsolo e anexos), para o escoamento externo. */
function caixaCasa(v){
  const rs = v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo').flatMap(p => p.salas.filter(s => !(Motor.TIPOS[s.tipo] || {}).aberto));
  if(!rs.length) return {x0:0, y0:0, x1:v.W, y1:v.D};
  return {x0:Math.min(...rs.map(s => s.x0)), y0:Math.min(...rs.map(s => s.y0)), x1:Math.max(...rs.map(s => s.x1)), y1:Math.max(...rs.map(s => s.y1))};
}
/* V3: escoamento ilustrativo em volta da casa (não é CFD): vento uniforme U (unitário, sentido do escoamento) mais dipolos
   ao longo do eixo maior da caixa, para o ar contornar o volume, e uma esteira a sotavento mais lenta, com redemoinhos (t em s).
   Devolve [vx, vy] em unidades de U. */
function campo(x, y, U, cx, t){
  let vx = U.x, vy = U.y;
  const w = cx.x1 - cx.x0, d = cx.y1 - cx.y0, curto = Math.min(w, d), longo = Math.max(w, d), n = Math.max(1, Math.round(longo / curto)), a = curto * 0.58;
  for(let i = 0; i < n; i++){
    const f = (i + 0.5) / n, ox = w >= d ? cx.x0 + w * f : (cx.x0 + cx.x1) / 2, oy = w >= d ? (cx.y0 + cx.y1) / 2 : cx.y0 + d * f;
    const dx = x - ox, dy = y - oy, r2 = dx*dx + dy*dy + 0.01, k = a*a / (r2*r2) * (1.1 / n + 0.45);
    vx += -k * (U.x*(dx*dx - dy*dy) + 2*U.y*dx*dy); vy += -k * (2*U.x*dx*dy + U.y*(dy*dy - dx*dx));
  }
  const px = x - (cx.x0 + cx.x1)/2, py = y - (cx.y0 + cx.y1)/2, ao = px*U.x + py*U.y, lat = -px*U.y + py*U.x;
  const meiaL = Math.abs(-w/2*U.y) + Math.abs(d/2*U.x), meiaC = Math.abs(w/2*U.x) + Math.abs(d/2*U.y);
  if(ao > meiaC*0.6 && Math.abs(lat) < meiaL + 1){
    const dd = ao - meiaC, fe = 0.25 + 0.75*(1 - Math.exp(-Math.max(0, dd) / (2.5*curto))), sl = Math.max(0, 1 - Math.abs(lat)/(meiaL + 1));
    const m = 1 - (1 - fe)*sl; vx *= m; vy *= m;
    const wv = Math.sin(ao*0.9 + (t || 0)*1.6) * 0.35 * sl * (1 - fe); vx += -U.y*wv; vy += U.x*wv;
  }
  return [vx, vy];
}

/* V3: ventilação natural dentro do pavimento p, pelas dimensões das aberturas (BS 5925; ASHRAE Fundamentals, cap. 16;
   CIBSE AM10 para somar vento e chaminé). Estimativa para estudo preliminar, não simulação.
   - Caminhos: de cada janela de entrada (barlavento), pelas portas (largura × 2,10 m) e vãos (× 2,40 m), até a janela de saída
     mais próxima (sotavento) ou até a torre de ar. Q = Cd · A_ef · U · √ΔCp, 1/A_ef² = Σ 1/A_i², Cd = 0,6;
     Cp = +0,6·cos(incidência) na entrada e −0,3 na saída; na torre, sucção −dCp (Motor.TORRES) e efeito chaminé
     Q = Cd · A_ef · √(2gHΔT/T), somados por Q = √(Qv² + Qc²). O captador é entrada, com ΔCp = dCp + 0,3.
   - Janelas: área livre = largura × altura × 0,5 (de correr) ou 0,7 (alta, maxim-ar).
   - U: o vento a 10 m levado à altura das janelas pelo perfil suburbano do ASHRAE (≈ 0,55 × U10), com fator de abrigo 0,5.
   - Cômodo com janela numa face só: Q = 0,025 · A · U (BS 5925).
   - Caminhos que dividem a mesma saída (ou a torre) dividem a vazão: entradas em paralelo, em série com a saída.
   Devolve {U, caminhos:[{pts, As, vel, Q, tipo, de, para, salas}], comodos:[{id, nome, tipo, ach, Q, umaFace}], torre, janelas}. */
const CD = 0.6, G = 9.81, T_AR = 301;
const fatorU = Math.pow(270/10, 0.14) * Math.pow(3/370, 0.22) * 0.5;
function alturas(j){ return j.vidro ? [0, 2.2] : j.alta ? [2.2 - (j.h || 0.6), 2.2] : [1.0, 1.0 + (j.h || 1.2)]; }
function interno(v, q, p, dirDe, U10){
  const F = Motor.RUMOS[q.orientacao] || 0, U = U10 * fatorU, salas = p.salas || [], porId = new Map(salas.map(s => [s.id, s]));
  const fechado = s => s && !(Motor.TIPOS[s.tipo] || {}).aberto;
  const viz = new Map(), liga = (a, b, A, pt) => { for(const [x, y] of [[a, b], [b, a]]){ if(!viz.has(x)) viz.set(x, []); viz.get(x).push({para:y, A, pt}); } };
  const meio = o => o.o === 'h' ? [(o.t0 + o.t1)/2, o.c] : [o.c, (o.t0 + o.t1)/2];
  for(const d of (p.portas || [])) if(d.viz !== undefined && fechado(porId.get(d.sala)) && fechado(porId.get(d.viz))) liga(d.sala, d.viz, (d.t1 - d.t0) * 2.1, meio(d));
  for(const d of (p.vaos || [])) if(fechado(porId.get(d.a)) && fechado(porId.get(d.b))) liga(d.a, d.b, (d.t1 - d.t0) * 2.4, meio(d));
  const jan = [];
  for(const j of (p.janelas || [])){
    let sala = null, lado = null; for(const s of salas){ lado = Motor.ladoDaJanela(j, s); if(lado){ sala = s; break; } }
    if(!fechado(sala)) continue;
    const psi = Motor.rumoFace(lado, F, false), dif = Math.abs(((psi - dirDe) % 360 + 540) % 360 - 180), [z0, z1] = alturas(j);
    jan.push({j, sala:sala.id, A:(j.t1 - j.t0) * (z1 - z0) * (j.alta ? 0.7 : 0.5), pt:meio(j), papel: dif <= 67.5 ? 'entrada' : dif >= 112.5 ? 'saida' : 'lateral', cp: dif <= 67.5 ? 0.6*Math.cos(dif*Math.PI/180) : -0.3});
  }
  // torre de ar no pavimento: no cômodo sob o centro dela
  let torre = null;
  if(v.torre && Motor.TORRES[v.torre.tipo]){
    const t = v.torre, cx = (t.x0 + t.x1)/2, cy = (t.y0 + t.y1)/2, s = salas.find(r => fechado(r) && cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1), TP = Motor.TORRES[t.tipo];
    if(s){ const pav = t.pavimentos || 1, H = pav * (q.peDireito || 3) + 1.5 - 1.0, cap = t.tipo === 'captador', comb = t.tipo === 'combinado';
      torre = {sala:s.id, pt:[cx, cy], A:1.0, H, dCp:TP.dCp || 0, dT:TP.dT || 0, entrada: cap || comb, saida: !cap, nome:TP.nome, Q:0}; }
  }
  // menor caminho (portas e vãos) de um cômodo até o primeiro que satisfaz "alvo"
  const busca = (de, alvo) => { const ant = new Map([[de, null]]), fila = [de];
    while(fila.length){ const u = fila.shift(); if(alvo(u)){ const pas = []; for(let x = u; ant.get(x); x = ant.get(x).de) pas.unshift(ant.get(x).e); return {fim:u, pas}; }
      for(const e of viz.get(u) || []) if(!ant.has(e.para)){ ant.set(e.para, {de:u, e}); fila.push(e.para); } }
    return null; };
  const saidas = jan.filter(x => x.papel === 'saida'), caminhos = [];
  const fluxo = (Ais, dCp, Hc, dT) => { const Aef = 1 / Math.sqrt(Ais.reduce((s, a) => s + 1/(a*a), 0)), qv = CD * Aef * U * Math.sqrt(Math.max(0.05, dCp)), qc = Hc && dT ? CD * Aef * Math.sqrt(2*G*Hc*dT/T_AR) : 0; return Math.sqrt(qv*qv + qc*qc); };
  for(const e of jan.filter(x => x.papel === 'entrada')){
    const r = busca(e.sala, u => saidas.some(s => s.sala === u));
    if(r){ const s = saidas.filter(x => x.sala === r.fim).sort((a, b) => b.A - a.A)[0], As = [e.A, ...r.pas.map(x => x.A), s.A], Q = fluxo(As, e.cp - s.cp);
      caminhos.push({tipo:'cruzada', pts:[e.pt, ...r.pas.map(x => x.pt), s.pt], As, Q, de:e.sala, para:s.sala, salas:[e.sala, ...r.pas.map(x => x.para)], g:{ent:e, sai:s, dCp:e.cp - s.cp}}); }
    if(torre && torre.saida){ const rt = busca(e.sala, u => u === torre.sala);
      if(rt){ const As = [e.A, ...rt.pas.map(x => x.A), torre.A], Q = fluxo(As, e.cp + torre.dCp, torre.H, torre.dT);
        caminhos.push({tipo:'torre', pts:[e.pt, ...rt.pas.map(x => x.pt), torre.pt], As, Q, de:e.sala, para:torre.sala, salas:[e.sala, ...rt.pas.map(x => x.para)], g:{ent:e, sai:torre, dCp:e.cp + torre.dCp, chamine:true}}); } }
  }
  if(torre && torre.entrada) for(const s of saidas){ const rt = busca(torre.sala, u => u === s.sala);
    if(rt){ const As = [torre.A, ...rt.pas.map(x => x.A), s.A], Q = fluxo(As, torre.dCp + 0.3);
      caminhos.push({tipo:'torre', pts:[torre.pt, ...rt.pas.map(x => x.pt), s.pt], As, Q, de:torre.sala, para:s.sala, salas:[torre.sala, ...rt.pas.map(x => x.para)], g:{ent:torre, sai:s, dCp:torre.dCp + 0.3, captador:true}}); } }
  // caminhos que dividem a mesma abertura (a janela de saída, a torre, ou a torre como entrada) dividem a vazão:
  // entradas em paralelo (áreas somadas) em série com a saída, mais a resistência média das portas no meio
  const grupos = new Map(); for(const c of caminhos){ const k = c.g.captador ? c.g.ent : c.g.sai; if(!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(c); }
  for(const [, gs] of grupos){
    const ents = [...new Set(gs.map(c => c.g.ent))], sais = [...new Set(gs.map(c => c.g.sai))], Ain = ents.reduce((s, x) => s + x.A, 0), Aout = sais.reduce((s, x) => s + x.A, 0);
    const Rint = gs.reduce((s, c) => s + c.As.slice(1, -1).reduce((u, a) => u + 1/(a*a), 0), 0) / gs.length;
    const Aef = 1 / Math.sqrt(1/(Ain*Ain) + 1/(Aout*Aout) + Rint), dCp = gs.reduce((s, c) => s + c.g.dCp * c.g.ent.A, 0) / gs.reduce((s, c) => s + c.g.ent.A, 0);
    const qv = CD * Aef * U * Math.sqrt(Math.max(0.05, dCp)), qc = gs[0].g.chamine && torre ? CD * Aef * Math.sqrt(2*G*torre.H*torre.dT/T_AR) : 0, Qg = Math.sqrt(qv*qv + qc*qc);
    const soma = gs.reduce((s, c) => s + c.Q, 0); for(const c of gs) c.Q = Qg * c.Q / soma;
    if(gs[0].tipo === 'torre') torre.Q = Qg;
  }
  for(const c of caminhos){ c.vel = c.As.map(a => c.Q / a); delete c.g; }
  const Qs = new Map(); for(const c of caminhos) for(const id of new Set(c.salas)) Qs.set(id, (Qs.get(id) || 0) + c.Q);
  const comodos = salas.filter(fechado).map(s => { let Q = Qs.get(s.id) || 0, umaFace = false;
    if(!Q){ const js = jan.filter(x => x.sala === s.id); if(js.length){ Q = js.reduce((t, x) => t + 0.025 * x.A / 0.5 * U, 0); umaFace = true; } }
    const V = Motor.area(s) * (s.pd || q.peDireito || 2.8);
    return {id:s.id, nome:s.nome, tipo:s.tipo, Q, ach: V > 0 ? Q * 3600 / V : 0, umaFace}; }).filter(x => x.Q > 0).sort((a, b) => b.ach - a.ach);
  return {U, caminhos, comodos, torre, janelas:jan};
}
// faixa de leitura das renovações de ar por hora
const faixa = ach => ach >= 30 ? 'forte' : ach >= 10 ? 'bom' : ach >= 3 ? 'fraco' : 'pouco';

/* Resumo do mês para o painel. */
function resumo(dados, mes){
  const m = mesDe(dados, mes); if(!m) return null;
  const top = m.rosa.slice().sort((a, b) => b.freq - a.freq).slice(0, 3);
  const rumo16 = ['N','NNE','NE','ENE','L','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  const nome = d => rumo16[Math.round(d / 22.5) % 16];
  return {mes, velMedia:m.velMedia, calmaria:m.calmaria, dirPredominante:m.dirPredominante, nomePredominante:nome(m.dirPredominante),
    dirMedia:m.dirMedia, dirHora:m.dirHora || null, principais: top.map(r => ({dir:r.dir, nome:nome(r.dir), freq:r.freq, vel:r.vel})), velHora:m.velHora, rosa:m.rosa,
    velMax: Math.max(...dados.meses.map(x => x.velMedia))};
}

return {direcao, mesDe, janelas, linhas, resumo, caixaCasa, campo, interno, faixa, fatorU};
});
