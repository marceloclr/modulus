// Verificador de percurso das plantas feitas à mão (casa simétrica A–D e casa em H). Só lê as páginas, não altera nada.
// Monta o grafo de portas e vãos de cada planta e responde: algum cômodo só é alcançado passando pela cozinha, pela
// lavanderia ou por um cômodo de permanência? Como a visita chega ao estar e ao jantar, e os moradores, dos quartos às salas?
// Na casa simétrica usa o mesmo modelo da página (circModel, hzTecnica, B2, VARS), como tools/humanizadas.mjs.
// Uso: node tools/percurso-manual.mjs [--json]
import fs from 'node:fs';
import vm from 'node:vm';

const EPS = 1e-6;
// cômodos por onde ninguém deveria precisar passar para chegar a outro
const PASSAGEM_RUIM = /Cozinha|Lavanderia|Área de serviço|Serviço|Despensa|Rouparia|Banho|WC|Closet|Quarto|Suíte|Escritório/i;
const SOCIAL = /Estar|Jantar|Sala/i, QUARTO = /^Quarto|^Suíte/i;

// ---------- casa simétrica ----------
function casaSimetrica(){
  const html = fs.readFileSync(new URL('../casa-simetrica/index.html', import.meta.url), 'utf8');
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function humDoc'));
  const code = js.slice(0, js.indexOf('/* ---------- Navegação')).replace(/^\s*\(function\(\)\{/, '');
  const ctx = {Math, console, document:{documentElement:{}}, window:{matchMedia:() => ({matches:false})}};
  vm.createContext(ctx);
  vm.runInContext(code + ';this.API={circModel,hzTecnica,vFor,B2};', ctx);
  const out = [];
  for(const g of ['A', 'B', 'C', 'D']){
    const M = ctx.API.circModel(g), T = ctx.API.hzTecnica(g), v = g === 'B' ? ctx.API.B2 : ctx.API.vFor(g);
    const salas = M.R.map(r => ({nome: r.n, x0: r.r[0], y0: r.r[1], x1: r.r[2], y1: r.r[3], area: r.area, gOk: r.gOk, gc: r.gc, g18: r.g18, g180: r.g180}));
    const vaos = T.dr.concat(T.vl || []).map(p => ({a1: Math.min(p.a1, p.a2), a2: Math.max(p.a1, p.a2), d1: Math.min(p.d1, p.d2), d2: Math.max(p.d1, p.d2), t: p.t}));
    const fora = (x, y) => y <= 1.8 + 0.31 ? 'Varanda frontal' : y >= M.L - 1.8 - 0.31 ? 'Varanda de fundos' : 'Exterior lateral';
    out.push({id: g, nome: v.nome, salas, vaos, fora, entrada: 'Varanda frontal', faixas: M.faixas, nucleo: v.nucleo, rotas: M.routes});
  }
  return out;
}

// ---------- casa em H ----------
function casaH(){
  const src = fs.readFileSync(new URL('../casa-h/gerar.js', import.meta.url), 'utf8');
  const pega = nome => { const i = src.indexOf(`const ${nome} = [`); const j = src.indexOf('\n];', i); return vm.runInNewContext(src.slice(i + nome.length + 9, j + 3).replace(/\]\.filter[\s\S]*$/, ']')); };
  const AMB = pega('AMB'), PAR = pega('PAR'), PORTAS = pega('PORTAS').filter(p => p[3] > 0), VAOS = pega('VAOS'), JAN = pega('JAN');
  const salas = AMB.filter(a => a[1] !== 'varanda').map(a => ({nome: a[0], x0: a[2], y0: a[3], x1: a[4], y1: a[5], area: (a[4]-a[2])*(a[5]-a[3])}));
  const vg = AMB.find(a => a[1] === 'varanda');
  const vaos = [];
  for(const p of PORTAS){ const [x, y, o, w] = p; vaos.push(o === 'v' ? {a1: x, a2: x, d1: y, d2: y + w, t: 'porta'} : {a1: x, a2: x + w, d1: y, d2: y, t: 'porta'}); }
  for(const q of VAOS) vaos.push({a1: q[0], a2: q[2], d1: q[1], d2: q[3], t: 'vão livre'});
  for(const q of JAN) if(q[4] === 'vidro') vaos.push({a1: q[0], a2: q[2], d1: q[1], d2: q[3], t: 'porta de vidro'});
  const fora = (x, y) => y <= EPS ? 'Rua (frente)' : vg && x > vg[2] - EPS && x < vg[4] + EPS && Math.abs(y - vg[3]) < 0.05 ? 'Varanda gourmet' : y >= 15.8 - EPS ? 'Quintal' : 'Pátio central';
  // cômodos vizinhos sem parede (PAR) no trecho comum: espaço integrado, vira um vão do comprimento do trecho
  const temParede = (o, c, t0, t1) => PAR.some(w => o === 'v' ? Math.abs(w[0] - c) < EPS && Math.abs(w[2] - c) < EPS && Math.min(w[1], w[3]) <= t0 + EPS && Math.max(w[1], w[3]) >= t1 - EPS
    : Math.abs(w[1] - c) < EPS && Math.abs(w[3] - c) < EPS && Math.min(w[0], w[2]) <= t0 + EPS && Math.max(w[0], w[2]) >= t1 - EPS);
  for(const a of salas) for(const b of salas){ if(a === b) continue;
    if(Math.abs(a.x1 - b.x0) < EPS){ const t0 = Math.max(a.y0, b.y0), t1 = Math.min(a.y1, b.y1); if(t1 - t0 > 0.5 && !temParede('v', a.x1, t0, t1)) vaos.push({a1: a.x1, a2: a.x1, d1: t0, d2: t1, t: 'sem parede'}); }
    if(Math.abs(a.y1 - b.y0) < EPS){ const t0 = Math.max(a.x0, b.x0), t1 = Math.min(a.x1, b.x1); if(t1 - t0 > 0.5 && !temParede('h', a.y1, t0, t1)) vaos.push({a1: t0, a2: t1, d1: a.y1, d2: a.y1, t: 'sem parede'}); } }
  return [{id: 'H', nome: 'Casa em H', salas, vaos, fora, entrada: 'Rua (frente)'}];
}

// ---------- grafo ----------
function salaEm(salas, x, y){ return salas.find(r => x > r.x0 + EPS && x < r.x1 - EPS && y > r.y0 + EPS && y < r.y1 - EPS); }
function grafo(P){
  const viz = new Map(), lig = (a, b, t) => { for(const [u, w] of [[a, b], [b, a]]){ if(!viz.has(u)) viz.set(u, []); viz.get(u).push({para: w, t}); } };
  const soltos = [];
  for(const p of P.vaos){
    const hz = Math.abs(p.d1 - p.d2) < EPS, ma = (p.a1 + p.a2)/2, md = (p.d1 + p.d2)/2;
    const [A, B] = hz ? [salaEm(P.salas, ma, p.d1 - 0.3), salaEm(P.salas, ma, p.d1 + 0.3)] : [salaEm(P.salas, p.a1 - 0.3, md), salaEm(P.salas, p.a1 + 0.3, md)];
    const nA = A ? A.nome : P.fora(ma, md), nB = B ? B.nome : P.fora(ma, md);
    if(!A && !B){ soltos.push(p); continue; }
    lig(nA, nB, p.t || 'porta');
  }
  // passagens que as rotas acessíveis do modelo atravessam sem porta: abertas na intenção, mas fechadas no desenho
  const abertas = [];
  for(const rota of P.rotas || []) for(let i = 1; i < rota.length; i++){
    const [a, b] = [rota[i-1], rota[i]], n = Math.max(2, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / 0.05));
    let ant = salaEm(P.salas, a[0], a[1]);
    for(let k = 1; k <= n; k++){ const x = a[0] + (b[0]-a[0])*k/n, y = a[1] + (b[1]-a[1])*k/n, s = salaEm(P.salas, x, y);
      if(s && ant && s !== ant && !(viz.get(ant.nome) || []).some(e => e.para === s.nome)){ lig(ant.nome, s.nome, 'passagem da rota'); abertas.push([ant.nome, s.nome]); }
      if(s) ant = s; }
  }
  return {viz, soltos, abertas};
}
// menor caminho (BFS) de a até b, sem passar pelos nós proibidos (exceto a e b)
function caminho(viz, a, b, proibido = () => false){
  const ant = new Map([[a, null]]), fila = [a];
  while(fila.length){ const u = fila.shift(); if(u === b) break;
    for(const {para} of viz.get(u) || []) if(!ant.has(para) && (para === b || !proibido(para))){ ant.set(para, u); fila.push(para); } }
  if(!ant.has(b)) return null;
  const c = []; for(let u = b; u !== null; u = ant.get(u)) c.unshift(u); return c;
}

function analisa(P){
  const {viz, soltos, abertas} = grafo(P), nomes = P.salas.map(s => s.nome), ent = P.entrada, ach = [];
  const meio = c => c ? c.slice(1, -1) : [];
  const linha = c => c ? c.join(' → ') : 'sem caminho';
  const semPorta = nomes.filter(n => !viz.has(n));
  for(const n of semPorta) ach.push({grav: 'alta', txt: `${n}: nenhuma porta ou vão encontrado no desenho`});
  // 1. cômodos de permanência e salas só alcançáveis por cômodos de passagem ruim
  const rotas = {};
  for(const n of nomes){
    if(!viz.has(n)) continue;
    const c = caminho(viz, ent, n);
    rotas[n] = c;
    if(!c){ ach.push({grav: 'alta', txt: `${n}: não é alcançado a partir de ${ent}`}); continue; }
    const ruins = meio(c).filter(x => PASSAGEM_RUIM.test(x));
    if(!ruins.length) continue;
    const limpo = caminho(viz, ent, n, x => PASSAGEM_RUIM.test(x));
    // suíte: banho e closet podem ser alcançados pelo quarto da própria suíte
    const daSuite = /Banho|Closet/.test(n) && ruins.every(x => /Quarto|Suíte|Closet|Banho/.test(x));
    if(!limpo && !daSuite && (SOCIAL.test(n) || QUARTO.test(n) || /WC|social/i.test(n)))
      ach.push({grav: 'alta', txt: `${n}: só é alcançado passando por ${ruins.join(', ')} (${linha(c)})`});
    else if(!limpo && !daSuite) ach.push({grav: 'média', txt: `${n}: só é alcançado passando por ${ruins.join(', ')} (${linha(c)})`});
  }
  // 2. visita: entrada → estar → jantar
  const estar = nomes.find(n => /Estar/i.test(n)), jantar = nomes.find(n => /Jantar/i.test(n)) || estar;
  const visita = estar && jantar ? [caminho(viz, ent, estar), estar === jantar ? null : caminho(viz, estar, jantar)] : [];
  for(const c of visita) if(c){ const r = meio(c).filter(x => PASSAGEM_RUIM.test(x)); if(r.length) ach.push({grav: 'alta', txt: `Visita passa por ${r.join(', ')}: ${linha(c)}`}); }
  // 3. moradores: cada quarto até a sala
  const moradores = nomes.filter(n => QUARTO.test(n)).map(q => ({q, c: estar ? caminho(viz, q, estar) : null}));
  for(const {q, c} of moradores){ const r = meio(c).filter(x => PASSAGEM_RUIM.test(x)); if(r.length) ach.push({grav: 'alta', txt: `Do ${q.toLowerCase()} à sala passa por ${r.join(', ')}: ${linha(c)}`}); }
  // 4. giro e faixas (casa simétrica: já calculados pelo modelo da página)
  for(const s of P.salas) if(s.gOk === false && !(s.g180 && s.g18)) ach.push({grav: 'média', txt: `${s.nome}: sem giro de 1,50 m livre`});
  for(const f of P.faixas || []) if(f[2] && f[1] < 0.90 - EPS) ach.push({grav: 'média', txt: `Faixa livre de ${f[1].toFixed(2).replace('.', ',')} m (< 0,90 m): ${f[0]}`});
  // 5. coerência: soma dos cômodos × área fechada declarada
  const soma = P.salas.reduce((t, s) => t + s.area, 0);
  if(P.nucleo && Math.abs(soma - P.nucleo) > 0.5) ach.push({grav: 'baixa', txt: `Soma dos cômodos (${soma.toFixed(2)} m²) difere da área fechada declarada (${P.nucleo.toFixed(2)} m²) em ${(P.nucleo - soma).toFixed(2)} m² (paredes ou erro de quadro)`});
  for(const [a, b] of abertas) ach.push({grav: 'média', txt: `${a} ↔ ${b}: a rota acessível passa por aqui, mas não há porta nem vão no modelo; a humanizada desenha parede contínua`});
  for(const p of soltos) ach.push({grav: 'baixa', txt: `Vão sem cômodo dos dois lados em (${p.a1.toFixed(2)}, ${p.d1.toFixed(2)})`});
  return {id: P.id, nome: P.nome, achados: ach, visita: visita.filter((c, i) => c || i === 0).map(linha), moradores: moradores.map(m => `${m.q}: ${linha(m.c)}`),
    ligacoes: [...viz].map(([u, l]) => `${u}: ${[...new Set(l.map(x => x.para))].join(', ')}`), soma: +soma.toFixed(2), nucleo: P.nucleo};
}

const res = [...casaSimetrica(), ...casaH()].map(analisa);
if(process.argv.includes('--json')) console.log(JSON.stringify(res, null, 2));
else for(const r of res){
  console.log(`\n=== ${r.id} · ${r.nome} ===`);
  console.log('Visita:', r.visita.join(' | ') || '—');
  for(const m of r.moradores) console.log('Morador:', m);
  if(!r.achados.length) console.log('Sem achados.');
  for(const a of r.achados) console.log(`[${a.grav}] ${a.txt}`);
}
