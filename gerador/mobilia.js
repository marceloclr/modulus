/* Mobília da planta humanizada (etapa F1, 06/10/2026).
   Puro: recebe um pavimento do motor (salas, portas, vãos e janelas) e devolve as peças de cada cômodo, em metros.
   Não desenha nada; desenho.js desenha as peças e auditoria.js confere M08 (peça dentro do cômodo) e M09 (peça fora
   da abertura das portas). Regras de posição são do projeto (sem norma citada):
   - nenhuma peça na faixa de 0,60 m em frente a um vão de porta nem no arco da folha (dos dois lados);
   - cada peça tem um "uso" (a frente livre para usar a peça) que não pode ter outra peça;
   - mesa de jantar com 0,75 m livres atrás das cadeiras (no aperto, 0,45 m: 0,90 m da borda da mesa à parede);
   - sofá de frente para o rack, de 1,60 a 3,20 m dele;
   - cama com a cabeceira longe da porta e, se der, fora da parede da janela; pé com 0,50 m livres e um lado com 0,60 m;
   - peças altas (armário, geladeira, estante) nunca na frente de janela baixa;
   - se a peça não cabe com as folgas, não entra: o cômodo fica com menos móveis, nunca com móvel invadindo. */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./motor.js')); else root.Mobilia=factory(root.Motor);
})(this, function(Motor){
'use strict';
const E = 0.005;
const PAREDE_INT = 0.10, PAREDE_EXT = 0.15;   // espessuras desenhadas (eixo da parede na linha do cômodo)
const FOLGA_PORTA = 0.60;
const LADOS = ['y0','y1','x0','x1'];
const aberto = s => !!(Motor.TIPOS[s.tipo] && Motor.TIPOS[s.tipo].aberto);
const sobrepoe = (a, b) => a.x0 < b.x1 - E && b.x0 < a.x1 - E && a.y0 < b.y1 - E && b.y0 < a.y1 - E;
const dentro = (a, R) => a.x0 >= R.x0 - E && a.x1 <= R.x1 + E && a.y0 >= R.y0 - E && a.y1 <= R.y1 + E;
const centro = r => [(r.x0 + r.x1)/2, (r.y0 + r.y1)/2];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const r2 = n => Math.round(n * 1000) / 1000;

/* Lado da sala em que está o segmento {o, c, t0, t1}, ou null. */
function ladoDe(seg, s){
  if(seg.o === 'h'){ if(seg.t1 < s.x0 + E || seg.t0 > s.x1 - E) return null; return Math.abs(seg.c - s.y0) < E ? 'y0' : Math.abs(seg.c - s.y1) < E ? 'y1' : null; }
  if(seg.t1 < s.y0 + E || seg.t0 > s.y1 - E) return null; return Math.abs(seg.c - s.x0) < E ? 'x0' : Math.abs(seg.c - s.x1) < E ? 'x1' : null;
}
const extensao = (s, l) => l === 'y0' || l === 'y1' ? [s.x0, s.x1] : [s.y0, s.y1];
const corta = (seg, s) => { const [a, b] = extensao(s, ladoDe(seg, s)); return [Math.max(a, seg.t0), Math.min(b, seg.t1)]; };

/* Espessura (metade, para dentro do cômodo) de cada lado: externa se algum trecho do lado dá para fora. */
function meiasParedes(s, S){
  const ext = Motor._interno.trechosExternos(s, S.filter(o => !aberto(o)));
  const m = {};
  for(const l of LADOS){
    if(aberto(s)){ m[l] = 0; continue; }
    const [a, b] = extensao(s, l), externo = ext.filter(e => ladoDe(e, s) === l).reduce((t, e) => t + Math.max(0, Math.min(b, e.t1) - Math.max(a, e.t0)), 0);
    m[l] = (externo > E ? PAREDE_EXT : PAREDE_INT) / 2;   // lado com qualquer trecho externo usa a parede externa (mais grossa)
  }
  return m;
}

/* Retângulo de uma faixa de profundidade p encostada no lado l, no trecho [t0, t1] do lado. */
function faixa(R, l, t0, t1, p0, p1){
  if(l === 'y0') return {x0:t0, x1:t1, y0:R.y0 + p0, y1:R.y0 + p1};
  if(l === 'y1') return {x0:t0, x1:t1, y0:R.y1 - p1, y1:R.y1 - p0};
  if(l === 'x0') return {y0:t0, y1:t1, x0:R.x0 + p0, x1:R.x0 + p1};
  return {y0:t0, y1:t1, x0:R.x1 - p1, x1:R.x1 - p0};
}

/* Zonas livres das portas (e vãos parciais) de um cômodo: faixa de 0,60 m (ou a folha, se abre para este lado) em frente ao vão. */
function zonasPortas(s, p){
  const z = [];
  for(const d of (p.portas || [])){
    const l = ladoDe(d, s); if(!l) continue;
    const [t0, t1] = corta(d, s), w = d.t1 - d.t0, sg = d.dentro || 1;
    const paraCa = (l === 'x0' || l === 'y0') ? sg > 0 : sg < 0;
    z.push({...faixa(s, l, t0, t1, 0, paraCa ? Math.max(w, FOLGA_PORTA) : FOLGA_PORTA), porta:d});
  }
  for(const v of (p.vaos || []).filter(v => !v.livre)){ const l = ladoDe(v, s); if(!l) continue; const [t0, t1] = corta(v, s); z.push({...faixa(s, l, t0, t1, 0, FOLGA_PORTA), porta:v}); }
  return z;
}

/* Contexto de um cômodo: retângulo interno, apoios por lado, janelas baixas, zonas proibidas e peças já postas. */
function contexto(s, p){
  const S = p.salas, meia = meiasParedes(s, S);
  const R = {x0:s.x0 + meia.x0, x1:s.x1 - meia.x1, y0:s.y0 + meia.y0, y1:s.y1 - meia.y1};
  const ab = {}, jan = {}, livre = {};
  for(const l of LADOS){ ab[l] = []; jan[l] = []; livre[l] = 0; }
  for(const d of (p.portas || [])){ const l = ladoDe(d, s); if(l) ab[l].push(corta(d, s)); }
  for(const v of (p.vaos || [])){ const l = ladoDe(v, s); if(!l) continue; const t = corta(v, s); ab[l].push(t); if(v.livre) livre[l] += t[1] - t[0]; }
  for(const j of (p.janelas || [])){ const l = ladoDe(j, s); if(l && !j.alta) jan[l].push(corta(j, s)); }
  // uso pode atravessar um lado aberto (vão livre de mais da metade do lado): mesa e sofá usam a sala vizinha integrada
  const RU = {...R};
  for(const l of LADOS){ const [a, b] = extensao(s, l); if(livre[l] > (b - a) / 2){ if(l === 'x0') RU.x0 -= 1.2; if(l === 'x1') RU.x1 += 1.2; if(l === 'y0') RU.y0 -= 1.2; if(l === 'y1') RU.y1 += 1.2; } }
  const portas = zonasPortas(s, p);
  return {s, p, R, RU, ab, jan, livre, proib:portas, portas, pecas:[], usos:[], decor:[]};
}

/* Trechos de parede contínua (sem portas nem vãos; sem janela baixa se alto) num lado, recortados ao retângulo interno. */
function apoios(ctx, l, alto){
  const R = ctx.R, [a, b] = l === 'y0' || l === 'y1' ? [R.x0, R.x1] : [R.y0, R.y1];
  let livres = [[a, b]];
  const tira = (t0, t1) => { livres = livres.flatMap(([u, v]) => t1 <= u + E || t0 >= v - E ? [[u, v]] : [[u, Math.max(u, t0)], [Math.min(v, t1), v]]).filter(([u, v]) => v - u > 0.2); };
  for(const [t0, t1] of ctx.ab[l]) tira(t0, t1);
  if(alto) for(const [t0, t1] of ctx.jan[l]) tira(t0, t1);
  return livres;
}

const livreDe = (ctx, corpo, uso) => dentro(corpo, ctx.R) && !ctx.proib.some(z => sobrepoe(corpo, z)) && !ctx.pecas.some(q => sobrepoe(corpo, q)) && !ctx.usos.some(u => sobrepoe(corpo, u))
  && uso.every(u => dentro(u, ctx.RU) && !ctx.pecas.some(q => sobrepoe(u, q)));
const janelaEm = (ctx, l, t0, t1) => ctx.jan[l].some(([a, b]) => a < t1 - E && b > t0 + E);
const centroPortas = ctx => ctx.portas.map(z => centro(z));

function poe(ctx, tipo, corpo, usos, lado, extra){
  const q = {sala:ctx.s.id, tipo, x0:r2(corpo.x0), y0:r2(corpo.y0), x1:r2(corpo.x1), y1:r2(corpo.y1), lado:lado || null, ...(extra || {})};
  ctx.pecas.push(q); usos.forEach(u => ctx.usos.push(u));
  return q;
}

/* Peça encostada numa parede: larguras em ordem de preferência (a primeira que couber), profundidade d, frente livre f.
   op.nota(l, t0, t1, corpo) dá a nota de cada posição (maior é melhor); op.alto evita janela baixa; op.lados restringe. */
function naParede(ctx, tipo, larguras, d, f, op){
  op = op || {};
  for(const w of larguras){
    let melhor = null;
    for(const l of (op.lados || LADOS)) for(const [a, b] of apoios(ctx, l, op.alto)){
      if(b - a < w - E) continue;
      const passos = Math.max(1, Math.round((b - a - w) / 0.05));
      for(let i = 0; i <= passos; i++){
        const t0 = a + (b - a - w) * i / passos, t1 = t0 + w, corpo = faixa(ctx.R, l, t0, t1, 0, d), uso = f > 0 ? [faixa(ctx.R, l, t0, t1, d, d + f)] : [];
        if(op.lateral){ const ls = op.lateral(l, t0, t1, d); if(!ls) continue; }
        if(!livreDe(ctx, corpo, uso)) continue;
        const n = (op.nota ? op.nota(l, t0, t1, corpo) : 0) - (op.canto === false ? 0 : Math.min(t0 - a, b - t1) * 0.3);
        if(!melhor || n > melhor.n + 1e-9) melhor = {n, corpo, uso, l, t0, t1};
      }
    }
    if(melhor){ const q = poe(ctx, tipo, melhor.corpo, melhor.uso, melhor.l, {w}); q._t = [melhor.t0, melhor.t1]; return q; }
  }
  return null;
}

/* Peça solta (mesa): retângulo w × h centrado no cômodo, com faixa livre f em volta; tenta as duas orientações. */
function solta(ctx, tipo, tamanhos, f, extra){
  const [cx, cy] = centro(ctx.R);
  for(const [a, b] of tamanhos) for(const [w, h] of (ctx.R.x1 - ctx.R.x0 >= ctx.R.y1 - ctx.R.y0 ? [[a, b], [b, a]] : [[b, a], [a, b]])){
    // posições numa grade de 0,10 m, da mais central para a mais afastada
    const gx = Math.max(0, Math.floor((ctx.R.x1 - ctx.R.x0 - w) / 2 / 0.1)), gy = Math.max(0, Math.floor((ctx.R.y1 - ctx.R.y0 - h) / 2 / 0.1)), pos = [];
    for(let i = -gx; i <= gx; i++) for(let j = -gy; j <= gy; j++) pos.push([i * 0.1, j * 0.1]);
    pos.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
    for(const [dx, dy] of pos){
      const corpo = {x0:cx + dx - w/2, x1:cx + dx + w/2, y0:cy + dy - h/2, y1:cy + dy + h/2};
      const uso = f > 0 ? [{x0:corpo.x0 - f, x1:corpo.x1 + f, y0:corpo.y0 - f, y1:corpo.y1 + f}] : [];
      if(livreDe(ctx, corpo, uso)) return poe(ctx, tipo, corpo, uso, null, {...(extra || {}), w, h, eixo: w >= h ? 'x' : 'y'});
    }
  }
  return null;
}

/* Tapete (F1.5): retângulo r ampliado por m nos lados pedidos, recortado ao cômodo; desiste se pegar a faixa de uma porta. */
function tapete(ctx, r, m){
  for(const k of [1, 0.6, 0.3]){
    const c = {x0:Math.max(ctx.R.x0 + 0.1, r.x0 - m.x0*k), x1:Math.min(ctx.R.x1 - 0.1, r.x1 + m.x1*k), y0:Math.max(ctx.R.y0 + 0.1, r.y0 - m.y0*k), y1:Math.min(ctx.R.y1 - 0.1, r.y1 + m.y1*k)};
    if(c.x1 - c.x0 < 1 || c.y1 - c.y0 < 1) return null;
    if(!ctx.proib.some(z => sobrepoe(c, z))){ const q = {sala:ctx.s.id, tipo:'tapete', x0:r2(c.x0), y0:r2(c.y0), x1:r2(c.x1), y1:r2(c.y1), lado:'y0', decor:true}; ctx.decor.push(q); return q; }
  }
  return null;
}
/* Planta em vaso num canto livre (F1.5). */
const planta = ctx => naParede(ctx, 'vaso', [0.5], 0.5, 0, {nota:() => 0});
/* Converte um retângulo local de um bloco encostado no lado l (u ao longo da parede, v para dentro) em retângulo global. */
function doBloco(b, l, u0, v0, u1, v1){
  const p = (u, v) => l === 'y0' ? [b.x0 + u, b.y0 + v] : l === 'y1' ? [b.x1 - u, b.y1 - v] : l === 'x0' ? [b.x0 + v, b.y1 - u] : [b.x1 - v, b.y0 + u];
  const [a, c] = [p(u0, v0), p(u1, v1)];
  return {x0:Math.min(a[0], c[0]), x1:Math.max(a[0], c[0]), y0:Math.min(a[1], c[1]), y1:Math.max(a[1], c[1])};
}
/* Lado global que corresponde ao início (u0) e ao fim (u1) do bloco encostado em l. */
const ladoU = (l, fim) => ({y0:['x0','x1'], y1:['x1','x0'], x0:['y1','y0'], x1:['y0','y1']})[l][fim ? 1 : 0];

/* Normal (para dentro do cômodo) do lado l. */
const normal = l => l === 'y0' ? [0, 1] : l === 'y1' ? [0, -1] : l === 'x0' ? [1, 0] : [-1, 0];
const oposto = l => ({y0:'y1', y1:'y0', x0:'x1', x1:'x0'})[l];

/* ---------- programas por tipo de cômodo ---------- */
function cama(ctx, larg, comp){
  const P = centroPortas(ctx);
  // a cabeceira fica na parede; o pé precisa de 0,50 m e um dos lados de 0,60 m (dentro do cômodo)
  const lateral = (l, t0, t1, d) => { const a = faixa(ctx.R, l, t0 - 0.6, t0, 0, d), b = faixa(ctx.R, l, t1, t1 + 0.6, 0, d); return dentro(a, ctx.R) || dentro(b, ctx.R); };
  // a distância à porta é medida do meio da parede (escolhe a parede); na parede, a cama fica centrada
  const nota = (l, t0, t1) => { const [a, b] = extensao(ctx.R, l), mp = faixa(ctx.R, l, (a + b)/2, (a + b)/2, 0, 0), c = [mp.x0, mp.y0];
    const dp = P.length ? Math.min(...P.map(q => dist(c, q))) : 0, meio = Math.abs((t0 + t1)/2 - (a + b)/2);
    const mesmaPorta = ctx.ab[l].length > 0;
    return dp * 2 - (janelaEm(ctx, l, t0, t1) ? 3 : 0) - (mesmaPorta ? 2 : 0) - meio * 0.8; };
  for(const [w, d] of larg.map((w, i) => [w, comp[i]])){
    const q = naParede(ctx, 'cama', [w], d, 0.5, {nota, lateral, canto:false});
    if(q){ q.casal = w >= 1.3;
      // criados-mudos ao lado da cabeceira, se couberem
      const [t0, t1] = q._t, l = q.lado;
      for(const [u, v] of (q.casal ? [[t0 - 0.5, t0 - 0.05], [t1 + 0.05, t1 + 0.5]] : [[t1 + 0.05, t1 + 0.5], [t0 - 0.5, t0 - 0.05]])){
        const corpo = faixa(ctx.R, l, u, v, 0, 0.4);
        if(dentro(corpo, ctx.R) && !ctx.proib.some(z => sobrepoe(corpo, z)) && !ctx.pecas.some(p => sobrepoe(corpo, p))){ poe(ctx, 'criado', corpo, [], l); if(!q.casal) break; }
      }
      return q; }
  }
  return null;
}
const temCloset = ctx => (ctx.p.portas || []).concat(ctx.p.vaos || []).some(d => {
  const ids = [d.sala, d.viz, d.a, d.b]; if(!ids.includes(ctx.s.id)) return false;
  return ctx.p.salas.some(o => o.id !== ctx.s.id && ids.includes(o.id) && /closet/i.test(o.tipo)); });
const armario = (ctx, larg) => naParede(ctx, 'armario', larg, 0.6, 0.6, {alto:true});

function quarto(ctx){
  const R = ctx.R, w = R.x1 - R.x0, h = R.y1 - R.y0, a = w * h, t = ctx.s.tipo;
  if(t === 'master') cama(ctx, [1.93, 1.6, 1.4], [2.03, 2.0, 1.9]);
  else if(t === 'suite' || (Math.min(w, h) >= 3.2 && a >= 11)) cama(ctx, [1.6, 1.4, 0.9], [2.0, 1.9, 1.9]);
  else cama(ctx, [0.9], [1.9]);
  const cm = ctx.pecas.find(q => q.tipo === 'cama');
  if(cm){ const l = cm.lado, m = {x0:0.5, x1:0.5, y0:0.5, y1:0.5}; m[l] = 0; tapete(ctx, cm, m); }   // tapete sob a cama, menos do lado da cabeceira
  if(!temCloset(ctx)) armario(ctx, [2.4, 2.0, 1.6, 1.2, 0.9]);
  if(a >= 10) planta(ctx);
  if(t === 'quarto' && a >= 9) naParede(ctx, 'escrivaninha', [1.0, 0.8], 0.5, 0.7, {nota:(l, t0, t1) => janelaEm(ctx, l, t0, t1) ? 1 : 0});
}
function banho(ctx){
  const R = ctx.R, w = R.x1 - R.x0, h = R.y1 - R.y0, P = centroPortas(ctx);
  const longe = (l, t0, t1, c) => P.length ? Math.min(...P.map(q => dist(centro(c), q))) : 0;
  if(ctx.s.tipo !== 'lavabo'){
    const curto = Math.min(w, h);
    naParede(ctx, 'boxe', [Math.min(curto, 1.6), 1.2, 1.0, 0.9].filter((x, i, A) => A.indexOf(x) === i && x >= 0.9 - E), 0.9, 0, {nota:longe});
  }
  naParede(ctx, 'bacia', [0.4], 0.65, 0.6, {nota:(l, t0, t1, c) => longe(l, t0, t1, c) * 0.5});
  naParede(ctx, ctx.s.tipo === 'lavabo' ? 'lavatorio' : 'bancada', ctx.s.tipo === 'lavabo' ? [0.5, 0.4] : [1.2, 0.9, 0.6, 0.5], 0.5, 0.6);
}
function cozinha(ctx){
  const R = ctx.R, lg = Math.max(R.x1 - R.x0, R.y1 - R.y0);
  const larg = []; for(let x = Math.min(3.6, lg); x >= 1.2 - E; x -= 0.2) larg.push(r2(x));
  naParede(ctx, 'bancada-cozinha', larg, 0.6, 0.9, {nota:(l, t0, t1) => (t1 - t0) * 0.5 + (janelaEm(ctx, l, t0, t1) ? 0.5 : 0)});
  naParede(ctx, 'geladeira', [0.75], 0.75, 0.9, {alto:true});
}
function servico(ctx){ naParede(ctx, 'tanque', [0.6], 0.55, 0.6); naParede(ctx, 'maquina', [0.65], 0.65, 0.6); }
function estar(ctx){
  if(ctx.s.tipo === 'estar' && ctx.op.estarTipo !== 'tv' && estarTradicional(ctx)) return;
  estarTV(ctx);
}
/* Sala tradicional: bloco encostado numa parede, com o sofá de 3 lugares no fundo, o de 2 lugares num lado, a poltrona no
   outro e a mesa de centro no meio; tapete por baixo. Medidas usuais: sofá de 3 lugares 2,10 × 0,90 m, de 2 lugares
   1,50 × 0,85 m, poltrona 0,80 × 0,80 m, mesa de centro 1,00 × 0,55 m. */
function estarTradicional(ctx){
  const notaB = (l, t0, t1) => { const [a, b] = extensao(ctx.R, l); return -Math.abs((t0 + t1)/2 - (a + b)/2) * 0.5 - (janelaEm(ctx, l, t0, t1) ? 1.5 : 0) - ctx.livre[l] * 0.5; };
  for(const [W, P] of [[3.6, 3.0], [3.2, 2.9], [2.9, 2.7]]){
    const b = naParede(ctx, 'grupo-estar', [W], P, 0.4, {canto:false, nota:notaB}); if(!b) continue;
    const l = b.lado; ctx.pecas.splice(ctx.pecas.indexOf(b), 1);
    ctx.usos.push({x0:b.x0, y0:b.y0, x1:b.x1, y1:b.y1});   // o miolo da sala fica livre para circular
    const s3 = Math.min(2.1, W - 1.0), u3 = (W - s3)/2;
    poe(ctx, 'sofa', doBloco(b, l, u3, 0, u3 + s3, 0.9), [], l, {w:s3, lugares:3});
    poe(ctx, 'sofa', doBloco(b, l, 0, 1.0, 0.85, Math.min(P, 2.55)), [], ladoU(l, false), {lugares:2});
    poe(ctx, 'poltrona', doBloco(b, l, W - 0.8, 1.15, W, 1.95), [], ladoU(l, true));
    poe(ctx, 'mesa-centro', doBloco(b, l, W/2 - 0.5, 1.25, W/2 + 0.5, 1.8), [], l);
    tapete(ctx, doBloco(b, l, 0.45, 0.6, W - 0.45, P - 0.2), {x0:0, x1:0, y0:0, y1:0});
    planta(ctx);
    return true;
  }
  return false;
}
function estarTV(ctx){
  const R = ctx.R;
  const notaRack = (l, t0, t1) => { const [a, b] = extensao(ctx.R, l); return -Math.abs((t0 + t1)/2 - (a + b)/2) - (janelaEm(ctx, l, t0, t1) ? 2 : 0) - ctx.livre[l] * 0.5; };
  // paredes na ordem de preferência para o rack; se o sofá não couber na frente, tenta a parede seguinte
  const ordem = LADOS.slice().sort((p, q) => { const m = l => { const [a, b] = extensao(ctx.R, l); return notaRack(l, (a + b)/2, (a + b)/2); }; return m(q) - m(p); });
  for(const l of ordem){
    const rack = naParede(ctx, 'rack', [2.0, 1.8, 1.6, 1.2], 0.45, 0, {canto:false, lados:[l], nota:notaRack});
    if(!rack) continue;
    const [t0, t1] = rack._t, tm = (t0 + t1)/2;
    const prof = l === 'y0' || l === 'y1' ? R.y1 - R.y0 : R.x1 - R.x0;
    const max = Math.min(prof - 0.45 - 0.9, 3.2);   // sofá de 0,90 m de fundo, dentro do cômodo
    for(const sw of [2.2, 2.0, 1.8, 1.6]) for(let dd = max; dd >= 1.6 - E; dd -= 0.2){   // distância do rack ao sofá: até 3,20 m, no mínimo 1,60 m
      const p0 = 0.45 + dd, corpo = faixa(R, l, tm - sw/2, tm + sw/2, p0, p0 + 0.9);
      if(!dentro(corpo, ctx.R) || ctx.proib.some(z => sobrepoe(corpo, z)) || ctx.pecas.some(q => sobrepoe(corpo, q)) || ctx.usos.some(u => sobrepoe(corpo, u))) continue;
      const vista = faixa(R, l, tm - sw/2, tm + sw/2, 0.45, p0);   // entre o rack e o sofá
      poe(ctx, 'sofa', corpo, [vista], oposto(l), {w:sw});
      if(dd >= 1.4){ const m0 = 0.45 + dd/2 - 0.25, mesa = faixa(R, l, tm - 0.45, tm + 0.45, m0, m0 + 0.5);   // mesa de centro no meio da vista, se não pegar porta
        if(!ctx.proib.some(z => sobrepoe(mesa, z))){ ctx.usos.pop(); poe(ctx, 'mesa-centro', mesa, [], l); ctx.usos.push(vista); } }
      tapete(ctx, faixa(R, l, tm - sw/2 - 0.2, tm + sw/2 + 0.2, 0.75, p0 + 0.6), {x0:0, x1:0, y0:0, y1:0});
      if((R.x1 - R.x0) * (R.y1 - R.y0) >= 10) planta(ctx);
      return;
    }
    ctx.pecas.splice(ctx.pecas.indexOf(rack), 1);   // sem sofá, o rack sai desta parede
  }
}
function jantar(ctx){
  const a = (ctx.R.x1 - ctx.R.x0) * (ctx.R.y1 - ctx.R.y0);
  const tams = [[2.0, 1.0, 8], [1.6, 0.9, 6], [1.2, 0.8, 4], [0.9, 0.9, 4]].filter(t => t[2] <= (a >= 12 ? 8 : a >= 8 ? 6 : 4));
  for(const f of [0.75, 0.6, 0.45]) for(const [w, h, n] of tams){   // 0,45 atrás da cadeira = 0,90 m da borda da mesa à parede (mínimo usual)
    const q = solta(ctx, 'mesa-jantar', [[w + (n > 4 ? 0.9 : 0), h + 0.9]], f, {lugares:n, mesa:[w, h]});   // cadeiras nos lados compridos; nas pontas só com 6 ou 8
    if(q){ if(a >= 9) planta(ctx); return q; }
  }
}
function escritorio(ctx){
  // escritório grande (ampliado, 11 m² ou mais): mesa de atendimento solta, cadeira de um lado e duas de visita do outro
  const R = ctx.R; if((R.x1 - R.x0) * (R.y1 - R.y0) >= 11 && solta(ctx, 'mesa-atendimento', [[1.5, 1.8], [1.3, 1.8]], 0.5, {lugares:3})){ naParede(ctx, 'estante', [2.0, 1.6, 1.2, 0.9], 0.35, 0.6, {alto:true}); return; }
  naParede(ctx, 'escrivaninha', [1.4, 1.2, 1.0], 0.6, 0.8, {nota:(l, t0, t1) => janelaEm(ctx, l, t0, t1) ? 1 : 0});
  naParede(ctx, 'estante', [1.6, 1.2, 0.9], 0.35, 0.6, {alto:true});
}
function gourmet(ctx){
  naParede(ctx, 'churrasqueira', [0.9], 0.6, 0.9);
  naParede(ctx, 'bancada', [1.8, 1.4, 1.0], 0.6, 0.9);
  solta(ctx, 'mesa-jantar', [[2.1, 1.7], [1.8, 1.6]], 0.5, {lugares:4, mesa:[1.2, 0.8]});
}
function varanda(ctx){
  const R = ctx.R, w = R.x1 - R.x0, h = R.y1 - R.y0;
  if(Math.min(w, h) >= 1.5 && w * h >= 5) solta(ctx, 'mesa-externa', [[1.5, 0.7]], 0.3, {lugares:2});
  for(const l of LADOS) if(ctx.pecas.filter(q => q.tipo === 'vaso').length < 2) naParede(ctx, 'vaso', [0.45], 0.45, 0, {lados:[l]});
}
function closet(ctx){ for(let i = 0; i < 2; i++){ const R = ctx.R, lg = Math.max(R.x1 - R.x0, R.y1 - R.y0), larg = []; for(let x = lg; x >= 0.8 - E; x -= 0.2) larg.push(r2(x)); naParede(ctx, 'armario', larg, 0.55, 0.6, {alto:true}); } }
function prateleiras(ctx){ const R = ctx.R, lg = Math.max(R.x1 - R.x0, R.y1 - R.y0), larg = []; for(let x = lg; x >= 0.8 - E; x -= 0.2) larg.push(r2(x)); naParede(ctx, 'prateleiras', larg, 0.4, 0.6, {alto:true}); }
function jardim(ctx){
  const R = ctx.R, w = R.x1 - R.x0, h = R.y1 - R.y0, d = Math.min(1.4, w - 0.2, h - 0.2);
  if(d < 0.6) return;
  for(const [fx, fy] of [[0.2, 0.25], [0.8, 0.75], [0.8, 0.2], [0.2, 0.8]]){
    const cx = R.x0 + w * fx, cy = R.y0 + h * fy, c = {x0:cx - d/2, x1:cx + d/2, y0:cy - d/2, y1:cy + d/2};
    if(dentro(c, R) && !ctx.proib.some(z => sobrepoe(c, z)) && !ctx.pecas.some(q => sobrepoe(c, q))) poe(ctx, 'arvore', c, [], null);
    if(ctx.pecas.length >= Math.max(1, Math.min(3, Math.floor(w * h / 6)))) break;
  }
}

const PROG = {quarto, suite:quarto, master:quarto, banhoSuite:banho, banhoMaster:banho, banhoSocial:banho, lavabo:banho, cozinha, servico,
  estar, tv:estar, salaIntima:estar, jantar, escritorio, gourmet, varanda, terraco:varanda, closet, closetMaster:closet,
  despensa:prateleiras, deposito:prateleiras, rouparia:prateleiras, jardim};

/* Peças de um pavimento: [{sala, tipo, x0, y0, x1, y1, lado, ...}]. O subsolo não recebe mobília (desenho técnico). */
function pavimento(p, op){
  if(!p || p.nome === 'Subsolo') return [];
  const out = [], dec = [];
  for(const s of p.salas){
    const f = PROG[s.tipo]; if(!f) continue;
    const ctx = contexto(s, p); ctx.op = op || {};
    if(ctx.R.x1 - ctx.R.x0 < 0.5 || ctx.R.y1 - ctx.R.y0 < 0.5) continue;
    f(ctx);
    for(const q of ctx.pecas){ delete q._t; out.push(q); }
    dec.push(...ctx.decor);
  }
  return dec.concat(out);   // tapetes primeiro: ficam por baixo dos móveis
}

return {pavimento, zonasPortas, meiasParedes, PAREDE_INT, PAREDE_EXT, FOLGA_PORTA, _interno:{contexto, ladoDe}};
});
