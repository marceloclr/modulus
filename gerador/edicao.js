/* Edição direta da planta (etapa J, 06/10/2026). Puro: aplica operações sobre uma cópia da variante gerada e reavalia
   com Motor.reavaliar (as mesmas regras da geração). Operações (guardadas no estado, no link, no arquivo e no banco):
   - {op:'parede', pav, o:'h'|'v', c, t, d}: move a linha de parede c (horizontal 'h' = y, vertical 'v' = x) que passa pelo
     ponto t ao longo dela, em d metros. Pega a cadeia contínua de cômodos encostados na linha; interna: os dois lados mudam
     juntos; externa: a casa muda de tamanho.
   - {op:'troca', pav, a, b}: os cômodos a e b (ids) trocam de retângulo.
   Cada operação é validada antes de entrar (lado mínimo, sem sobreposição, ligações obrigatórias); a que não se aplica é
   pulada com o motivo. */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./motor.js')); else root.Edicao=factory(root.Motor);
})(this, function(Motor){
'use strict';
const E = 0.005, PASSO = 0.05;
const r2 = n => Math.round(n * 100) / 100;
const f2 = Motor.f2, T = Motor.TIPOS;
const aberto = s => !!(T[s.tipo] && T[s.tipo].aberto);
const sobrepoe = (a, b) => a.x0 < b.x1 - E && b.x0 < a.x1 - E && a.y0 < b.y1 - E && b.y0 < a.y1 - E;
const nomeDe = s => s.nome || (T[s.tipo] && T[s.tipo].nome) || s.tipo;
const TRAVADOS = ['escada', 'elevador', 'rampa', 'manobra'];   // núcleo vertical e acesso de carros não se mexem

/* Cômodos encostados na linha (o, c): lado 'antes' (borda de fim na linha) e 'depois' (borda de início na linha). */
function naLinha(S, o, c){
  const fim = o === 'h' ? 'y1' : 'x1', ini = o === 'h' ? 'y0' : 'x0', a0 = o === 'h' ? 'x0' : 'y0', a1 = o === 'h' ? 'x1' : 'y1';
  const sp = s => [s[a0], s[a1]];
  return {antes: S.filter(s => Math.abs(s[fim] - c) < E).map(s => ({s, sp:sp(s)})), depois: S.filter(s => Math.abs(s[ini] - c) < E).map(s => ({s, sp:sp(s)})), fim, ini};
}
/* Cadeia contínua (pelos dois lados) que contém o ponto t: expande até as pontas de cada lado coincidirem. */
function cadeia(L, t){
  let lo = t, hi = t, mudou = true;
  const pega = arr => arr.filter(z => z.sp[0] < Math.max(hi, t + E) - E / 2 && z.sp[1] > Math.min(lo, t - E) + E / 2);   // sobreposição estrita com o trecho
  let A = [], B = [];
  while(mudou){ mudou = false;
    A = pega(L.antes); B = pega(L.depois);
    const all = A.concat(B); if(!all.length) break;
    const nlo = Math.min(...all.map(z => z.sp[0])), nhi = Math.max(...all.map(z => z.sp[1]));
    if(nlo < lo - E || nhi > hi + E){ lo = nlo; hi = nhi; mudou = true; }
  }
  return {A, B, lo, hi};
}

function aplicaParede(v, op){
  const p = v.pav.find(x => x.nome === op.pav); if(!p) return 'pavimento não encontrado';
  const d = Math.round(op.d / PASSO) * PASSO; if(Math.abs(d) < E) return 'movimento nulo';
  const L = naLinha(p.salas, op.o, op.c), {A, B} = cadeia(L, op.t);
  if(!A.length && !B.length) return 'não há parede nessa linha';
  const mexe = A.concat(B).map(z => z.s);
  const trav = mexe.find(s => TRAVADOS.includes(s.tipo) || s.nucleo); if(trav) return `${nomeDe(trav)} não se move (núcleo vertical ou acesso de carros)`;
  // novos retângulos
  const novo = new Map();
  for(const z of A) novo.set(z.s, Object.assign({}, z.s, {[L.fim]: r2(z.s[L.fim] + d)}));
  for(const z of B) novo.set(z.s, Object.assign({}, z.s, {[L.ini]: r2(z.s[L.ini] + d)}));
  for(const [s, n] of novo){
    const w = n.x1 - n.x0, h = n.y1 - n.y0, lado = (T[s.tipo] && T[s.tipo].lado) || 0.8;
    if(w < E || h < E) return `${nomeDe(s)} sumiria`;
    if(!aberto(s) && Math.min(w, h) < Math.min(lado, 0.8) - E) return `${nomeDe(s)} ficaria com ${f2(Math.min(w, h))} m, abaixo de ${f2(Math.min(lado, 0.8))} m`;
  }
  // sem sobreposição com os cômodos que não se mexem
  const fixos = p.salas.filter(s => !novo.has(s));
  for(const [s, n] of novo) for(const o of fixos) if(sobrepoe(n, o)) return `${nomeDe(s)} invadiria ${nomeDe(o)}`;
  for(const [s, n] of novo) Object.assign(s, {x0:n.x0, y0:n.y0, x1:n.x1, y1:n.y1});
  return null;
}

function aplicaTroca(v, op){
  const p = v.pav.find(x => x.nome === op.pav); if(!p) return 'pavimento não encontrado';
  const a = p.salas.find(s => s.id === op.a), b = p.salas.find(s => s.id === op.b);
  if(!a || !b || a === b) return 'cômodos não encontrados';
  for(const s of [a, b]){
    if(TRAVADOS.includes(s.tipo) || s.nucleo || s.tipo === 'garagem') return `${nomeDe(s)} não troca de lugar (núcleo vertical ou acesso de carros)`;
    // cômodo de um módulo de suíte (quarto, banho e closet juntos) não se separa dos outros do módulo
    if(s.mod !== undefined && p.salas.some(o => o !== s && o.mod === s.mod) && !(a.mod === b.mod)) return `${nomeDe(s)} faz parte da suíte e não se separa do banho e do closet`;
  }
  if(aberto(a) !== aberto(b)) return 'um cômodo aberto (varanda, terraço) não troca com um fechado';
  const ra = {x0:a.x0, y0:a.y0, x1:a.x1, y1:a.y1};
  Object.assign(a, {x0:b.x0, y0:b.y0, x1:b.x1, y1:b.y1}); Object.assign(b, ra);
  return null;
}

const OPS = {parede: aplicaParede, troca: aplicaTroca};

/* Aplica as operações sobre uma cópia de v e reavalia. Devolve {v, aplicadas, puladas:[{op, motivo}]}. */
function aplicar(v0, ops, q){
  if(!ops || !ops.length) return {v:v0, aplicadas:[], puladas:[]};
  const base = Motor.avisosDeGeracao ? Motor.avisosDeGeracao(v0) : (v0.avisos || []);
  const v = JSON.parse(JSON.stringify(v0)); v.avisos = base.slice();
  const aplicadas = [], puladas = [];
  for(const op of ops){
    const f = OPS[op.op], motivo = f ? f(v, op) : 'operação desconhecida';
    if(motivo) puladas.push({op, motivo}); else aplicadas.push(op);
  }
  if(aplicadas.length){ Motor.reavaliar(v, q); v.editada = aplicadas.length; }
  if(puladas.length) v.avisos.push(`Edição: ${puladas.length} alteração(ões) não se aplicaram (${puladas.map(z => z.motivo).join('; ')}).`);
  return {v, aplicadas, puladas};
}
/* Testa uma operação sem guardar: o motivo da recusa ou null. */
function testar(v0, ops, op, q){ const r = aplicar(v0, (ops || []).concat([op]), q); return r.puladas.some(z => z.op === op) ? r.puladas.find(z => z.op === op).motivo : null; }

return {aplicar, testar, OPS, _interno:{naLinha, cadeia}};
});
