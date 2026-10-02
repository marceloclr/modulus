/* Motor do gerador de plantas: programa de necessidades → variantes de planta.
   Funções puras, sem DOM. Coordenadas em metros, origem no canto frontal esquerdo da casa:
   x ao longo da frente do lote, y da rua para o fundo. Funciona no navegador (window.Motor) e no Node. */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(); else root.Motor=factory();
})(this, function(){
'use strict';

const C = 1.20;          // largura de circulação
const COL = 2.20;        // coluna de circulação com escada reta (1,20 de passagem + 1,00 de escada)
const VAGA_L = 2.60, VAGA_P = 5.20, MANOBRA = 5.00, RAMPA_L = 3.00;
const r2 = n => Math.round(n*100)/100;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* Tipos de ambiente: área-alvo, área mínima e lado mínimo (código de obras genérico; ajuste conforme o município). */
const TIPOS = {
  quarto:       {nome:'Quarto',          zona:'intimo',  alvo:10.5, min:8.0,  lado:2.60, hab:1},
  suite:        {nome:'Suíte',           zona:'intimo',  alvo:12.0, min:9.0,  lado:2.80, hab:1},
  master:       {nome:'Suíte master',    zona:'intimo',  alvo:16.0, min:12.0, lado:3.20, hab:1},
  banhoSuite:   {nome:'Banho',           zona:'molhado', alvo:3.6,  min:2.4,  lado:1.20, mol:1},
  banhoMaster:  {nome:'Banho master',    zona:'molhado', alvo:5.5,  min:3.5,  lado:1.50, mol:1},
  closet:       {nome:'Closet',          zona:'intimo',  alvo:3.0,  min:2.0,  lado:1.10},
  closetMaster: {nome:'Closet master',   zona:'intimo',  alvo:5.0,  min:3.0,  lado:1.40},
  banhoSocial:  {nome:'Banho social',    zona:'molhado', alvo:3.4,  min:2.4,  lado:1.20, mol:1},
  lavabo:       {nome:'Lavabo',          zona:'molhado', alvo:2.0,  min:1.5,  lado:1.00, mol:1},
  estar:        {nome:'Estar',           zona:'social',  alvo:16.0, min:12.0, lado:3.00, hab:1},
  jantar:       {nome:'Jantar',          zona:'social',  alvo:11.0, min:8.0,  lado:2.60, hab:1},
  tv:           {nome:'Sala de TV',      zona:'social',  alvo:10.0, min:8.0,  lado:2.60, hab:1},
  escritorio:   {nome:'Escritório',      zona:'social',  alvo:8.0,  min:6.0,  lado:2.40, hab:1},
  cozinha:      {nome:'Cozinha',         zona:'social',  alvo:10.0, min:6.5,  lado:2.20, hab:1},
  servico:      {nome:'Serviço',         zona:'apoio',   alvo:5.0,  min:3.5,  lado:1.50, mol:1},
  despensa:     {nome:'Despensa',        zona:'apoio',   alvo:2.5,  min:1.5,  lado:1.00},
  deposito:     {nome:'Depósito',        zona:'apoio',   alvo:6.0,  min:2.0,  lado:1.20},
  rouparia:     {nome:'Rouparia',        zona:'apoio'},
  salaIntima:   {nome:'Sala íntima',     zona:'social',  alvo:8.0,  min:5.0,  lado:2.40, hab:1},
  lazer:        {nome:'Salão de lazer',  zona:'social',  alvo:20.0, min:12.0, lado:3.00},
  gourmet:      {nome:'Varanda gourmet', zona:'varanda', alvo:12.0, min:9.0,  lado:2.80, aberto:1},
  varanda:      {nome:'Varanda',         zona:'varanda', aberto:1},
  terraco:      {nome:'Terraço',         zona:'varanda', aberto:1},
  garagem:      {nome:'Garagem',         zona:'garagem'},
  manobra:      {nome:'Manobra',         zona:'garagem'},
  rampa:        {nome:'Rampa',           zona:'garagem'},
  circ:         {nome:'Circulação',      zona:'circ'},
  hall:         {nome:'Hall',            zona:'circ'},
  galeria:      {nome:'Galeria',         zona:'circ'},
  escada:       {nome:'Escada',          zona:'circ'},
};
const FATOR = {compacto:0.85, medio:1, amplo:1.25};

const PADRAO = {
  frente:12, fundo:30, recFrente:5, recLat:1.5, recFundo:3, taxa:60,
  tipo:'terrea', peDireito:3.0,
  quartos:3, suites:1, master:true, tamanho:'medio',
  banhosSociais:1, lavabo:false,
  estar:true, jantar:true, tv:false, escritorio:false,
  cozinha:'aberta', servico:true, despensa:false,
  vagas:2, garagem:'coberta', varanda:true, gourmet:false,
  subsolo:false, subNivel:'meio', subGaragem:true, subDeposito:true, subLazer:false, inclinacao:20,
};

function normaliza(p){
  const q = Object.assign({}, PADRAO, p||{});
  for(const k of ['frente','fundo','recFrente','recLat','recFundo','taxa','peDireito','quartos','suites','banhosSociais','vagas','inclinacao']) q[k] = +q[k] || 0;
  for(const k of ['master','lavabo','estar','jantar','tv','escritorio','servico','despensa','varanda','gourmet','subsolo','subGaragem','subDeposito','subLazer']) q[k] = q[k]===true||q[k]==='true'||q[k]===1||q[k]==='1'||q[k]==='on';
  q.quartos = clamp(Math.round(q.quartos), 1, 8);
  q.suites = clamp(Math.round(q.suites), 0, q.quartos);
  q.banhosSociais = clamp(Math.round(q.banhosSociais), 0, 4);
  q.vagas = clamp(Math.round(q.vagas), 0, 6);
  q.peDireito = clamp(q.peDireito || 3, 2.6, 4.5);
  q.inclinacao = clamp(q.inclinacao || 20, 8, 25);
  if(!FATOR[q.tamanho]) q.tamanho = 'medio';
  if(q.tipo!=='sobrado') q.tipo = 'terrea';
  if(!['coberta','descoberta','nenhuma'].includes(q.garagem)) q.garagem = 'coberta';
  if(q.vagas===0) q.garagem = 'nenhuma';
  if(!['meio','inteiro'].includes(q.subNivel)) q.subNivel = 'meio';
  if(!q.subsolo){ q.subGaragem = false; }
  return q;
}

/* ---------- Programa → listas de ambientes ---------- */
function alvo(tipo, q){ const t = TIPOS[tipo]; return t.alvo * (t.hab ? FATOR[q.tamanho] : 1); }

function programa(q){
  const mods = [];   // módulos da faixa íntima
  let id = 0;
  const nS = q.suites, nQ = q.quartos - q.suites;
  for(let i=0;i<nS;i++){
    const m = q.master && i===0;
    mods.push({tipo: m?'master':'suite', id: ++id,
      aq: alvo(m?'master':'suite', q), ab: alvo(m?'banhoMaster':'banhoSuite', q), ac: alvo(m?'closetMaster':'closet', q)});
  }
  for(let i=0;i<nQ;i++) mods.push({tipo:'quarto', id: ++id, aq: alvo('quarto', q)});
  let bs = q.banhosSociais;
  if(nQ>0 && bs>0){ mods.push({tipo:'banhoSocial', id: ++id, ab: alvo('banhoSocial', q)}); bs--; }
  // ordem: master no fim (mais ao fundo), banho social no começo (perto do social)
  mods.sort((a,b) => ord(a)-ord(b));
  function ord(m){ return m.tipo==='banhoSocial'?0 : m.tipo==='quarto'?1 : m.tipo==='suite'?2 : 3; }

  const social = [];
  if(q.escritorio) social.push('escritorio');
  if(q.tv) social.push('tv');
  if(q.estar || (!q.tv && !q.jantar)) social.push('estar');
  if(q.jantar) social.push('jantar');

  const apoioDir = ['cozinha'];          // fica sob o jantar
  if(q.servico) apoioDir.push('servico');
  if(q.despensa) apoioDir.push('despensa');
  const apoioEsq = [];
  for(let i=0;i<bs;i++) apoioEsq.push('banhoSocial');
  if(q.lavabo || (q.tipo==='sobrado' && !apoioEsq.length)) apoioEsq.push('lavabo');   // sobrado sempre com lavabo no térreo
  return {mods, social, apoioDir, apoioEsq};
}

/* ---------- Utilidades geométricas ---------- */
let SEQ = 0;
function sala(tipo, x0, y0, x1, y1, extra){
  const t = TIPOS[tipo];
  return Object.assign({id: ++SEQ, tipo, nome:t.nome, zona:t.zona, x0:r2(x0), y0:r2(y0), x1:r2(x1), y1:r2(y1)}, extra||{});
}
const area = s => (s.x1-s.x0)*(s.y1-s.y0);

/* Divide um retângulo ao longo de um eixo, na ordem dada, com larguras proporcionais às áreas.
   Itens pequenos demais para a profundidade são empilhados numa coluna. */
function faixa(x0, y0, x1, y1, itens, eixo){
  const L = eixo==='x' ? x1-x0 : y1-y0, P = eixo==='x' ? y1-y0 : x1-x0;
  if(!itens.length || L<=0.01 || P<=0.01) return [];
  const lado = it => TIPOS[it.tipo].lado || 1;
  // grupos: {itens, peso}; um item fino demais vai para uma coluna empilhada só se cada um mantiver o lado mínimo
  const grupos = []; let col = null;
  const colOk = c => { const sa = c.reduce((t,i)=>t+i.a,0); return c.every(i => P*i.a/sa >= lado(i)-0.01); };
  const fecha = () => { if(col){ const sa = col.reduce((t,i)=>t+i.a,0); grupos.push({itens:col, peso:Math.max(sa, P*Math.max(...col.map(lado)))}); col = null; } };
  for(const it of itens){
    const w = it.a / P;
    if(w >= lado(it) && P/w <= 3.2){ fecha(); grupos.push({itens:[it], peso:it.a}); continue; }
    if(w >= lado(it)){ fecha(); grupos.push({itens:[it], peso:it.a}); continue; }
    const cand = (col||[]).concat(it);
    if(colOk(cand)){ col = cand; const sa = cand.reduce((t,i)=>t+i.a,0); if(sa/P >= Math.max(...cand.map(lado))) fecha(); }
    else { fecha(); if(P >= lado(it)) { col = [it]; } else grupos.push({itens:[it], peso:it.a}); }
  }
  fecha();
  const tot = grupos.reduce((t,g)=>t+g.peso,0);
  const out = []; let p = 0;
  grupos.forEach((g,gi) => {
    const w = gi===grupos.length-1 ? L-p : L*g.peso/tot;
    const ga = g.itens.reduce((t,i)=>t+i.a,0);
    let q = 0;
    g.itens.forEach((it,ii) => {
      const h = ii===g.itens.length-1 ? P-q : P*it.a/ga;
      const r = eixo==='x' ? [x0+p, y0+q, x0+p+w, y0+q+h] : [x0+q, y0+p, x0+q+h, y0+p+w];
      out.push(sala(it.tipo, r[0], r[1], r[2], r[3], it.extra));
      q += h;
    });
    p += w;
  });
  return out;
}

/* ---------- Faixa íntima: módulos (quarto + banho + closet) dos dois lados de um corredor ---------- */
function compModulo(m, ws){
  if(m.tipo==='banhoSocial') return Math.max(1.6, m.ab/ws);
  if(m.tipo==='quarto') return Math.max(TIPOS.quarto.lado, m.aq/ws);
  const tq = m.tipo==='master'?'master':'suite';
  const db = clamp((m.ab+m.ac)/ws, TIPOS[m.tipo==='master'?'banhoMaster':'banhoSuite'].lado+0.3, 3.2);
  return Math.max(TIPOS[tq].lado, m.aq/ws) + db;
}

/* Desenha um módulo no retângulo dado. ladoCorr: 'x0' ou 'x1' (lado do corredor). inv: banho no início (y0) do módulo. */
function desenhaModulo(m, x0, y0, x1, y1, ladoCorr, inv){
  const ws = x1-x0, out = [];
  if(m.tipo==='banhoSocial'){ out.push(sala('banhoSocial', x0,y0,x1,y1,{mod:m.id})); return out; }
  if(m.tipo==='quarto'){ out.push(sala('quarto', x0,y0,x1,y1,{mod:m.id})); return out; }
  const tb = m.tipo==='master'?'banhoMaster':'banhoSuite', tc = m.tipo==='master'?'closetMaster':'closet';
  const db = clamp((m.ab+m.ac)/ws, TIPOS[tb].lado+0.3, 3.2);
  const by0 = inv ? y0 : y1-db, by1 = inv ? y0+db : y1;
  const qy0 = inv ? y0+db : y0, qy1 = inv ? y1 : y1-db;
  // banho na fachada (lado oposto ao corredor), closet para dentro
  const bw = clamp(ws*m.ab/(m.ab+m.ac), TIPOS[tb].lado, ws-TIPOS[tc].lado);
  const ext = ladoCorr==='x1';
  const bx0 = ext ? x0 : x1-bw, bx1 = ext ? x0+bw : x1;
  const cx0 = ext ? x0+bw : x0, cx1 = ext ? x1 : x1-bw;
  out.push(sala(m.tipo, x0, qy0, x1, qy1, {mod:m.id, nome: m.tipo==='master'?'Suíte master':'Suíte'}));
  out.push(sala(tb, bx0, by0, bx1, by1, {mod:m.id}));
  out.push(sala(tc, cx0, by0, cx1, by1, {mod:m.id}));
  return out;
}

/* Distribui módulos em duas tiras (ou uma) e devolve salas + comprimento. */
function faixaIntima(mods, tiras, y0, compMin){
  // tiras: [{x0,x1,lado:'x0'|'x1'}] ; lado = lado em que fica o corredor
  const fila = tiras.map(() => []);
  const comp = tiras.map(() => 0);
  for(const m of mods){
    let k = 0; for(let i=1;i<tiras.length;i++) if(comp[i] < comp[k]-0.01) k = i;
    const ws = tiras[k].x1-tiras[k].x0;
    const L = compModulo(m, ws);
    fila[k].push({m, L}); comp[k] += L;
  }
  const Li = Math.max(compMin||0, ...comp);
  const out = [];
  tiras.forEach((t,k) => {
    const f = fila[k]; if(!f.length){ if(Li>0.5) out.push(sala('deposito', t.x0, y0, t.x1, y0+Li, {nome:'Depósito / armários'})); return; }
    // estica no máximo 25 %; o que sobrar vira sala íntima ou rouparia no fim da tira
    let esc = Li / comp[k], sobra = 0;
    if(esc > 1.25){ esc = 1.25; sobra = Li - comp[k]*esc; if(sobra < 1.2){ esc = Li/comp[k]; sobra = 0; } }
    let y = y0;
    const fim = y0 + Li - sobra;
    f.forEach((it,i) => {
      const L = i===f.length-1 ? fim-y : it.L*esc;
      out.push(...desenhaModulo(it.m, t.x0, y, t.x1, y+L, t.lado, i%2===1));
      y += L;
    });
    if(sobra > 0) out.push(sala(sobra >= 2.4 && (t.x1-t.x0) >= 2.4 ? 'salaIntima' : 'rouparia', t.x0, fim, t.x1, y0+Li));
  });
  return {salas: out, Li};
}

/* ---------- Escada reta ---------- */
function escada(q){
  const n = Math.ceil(q.peDireito/0.18);
  const espelho = q.peDireito/n, piso = 0.28;
  return {n, espelho: r2(espelho*1000)/1000, piso, L: r2((n-1)*piso), blondel: r2(2*espelho+piso)};
}

/* ---------- Tipologia linear (faixas: social → apoio → íntima) e em L ---------- */
function linear(q, P, W, modo, opts){
  opts = opts || {};
  const sobrado = q.tipo==='sobrado', temEscada = sobrado || q.subsolo;
  const esc = temEscada ? escada(q) : null;
  const colw = temEscada ? COL : C;
  const salas = [], av = [], abertos = [];
  const terreo = [];
  // garagem coberta no térreo
  let vagasDentro = 0, Wg = 0;
  if(q.garagem==='coberta' && !q.subGaragem && q.vagas>0){
    vagasDentro = q.vagas;
    while(vagasDentro>0 && W - vagasDentro*VAGA_L < 4.2) vagasDentro--;
    Wg = vagasDentro*VAGA_L;
    if(vagasDentro < q.vagas) av.push(`Só ${vagasDentro} de ${q.vagas} vagas cabem cobertas na largura de ${f2(W)} m; as demais ficam descobertas no recuo frontal.`);
  }
  // faixa social
  const socialItens = P.social.map(t => ({tipo:t, a:alvo(t,q)}));
  const aS = socialItens.reduce((s,i)=>s+i.a,0);
  const Wsoc = W - Wg;
  let Ds = clamp(aS / Wsoc, 3.6, 6.5) * (opts.cresce||1);
  const Dv = q.varanda ? 2.0 : 0;
  let yS = Dv;
  if(Wg>0) Ds = Math.max(Ds, VAGA_P - Dv);
  // faixa de apoio: lados esquerdo/direito da coluna de circulação
  const Wtir = W - C;
  let cxI;  // posição do corredor íntimo
  let tiras;
  const lq = Math.max(TIPOS.suite.lado, Math.sqrt(alvo('suite',q)*0.85));
  if(modo==='duplo'){ cxI = r2(Wtir/2); tiras = [{x0:0,x1:cxI,lado:'x1'},{x0:cxI+C,x1:W,lado:'x0'}]; }
  else if(modo==='simples'){ cxI = r2(W - C); tiras = [{x0:0,x1:cxI,lado:'x1'}]; }
  else { // L: tira única à esquerda e corredor; o resto do fundo fica livre
    const ws = clamp(opts.ws || lq+0.6, 3.0, W-C-3.0);
    cxI = r2(ws); tiras = [{x0:0,x1:cxI,lado:'x1'}];
  }
  const cxA = r2(clamp(cxI, 0, W-colw));
  // apoio
  const dir = P.apoioDir.map(t => ({tipo:t, a:alvo(t,q)}));
  const esq = P.apoioEsq.map(t => ({tipo:t, a:alvo(t,q)}));
  const wE = cxA, wD = W - cxA - colw;
  // equilibra: move itens do lado cheio para o vazio (a cozinha fica à direita)
  const cap = (arr) => arr.reduce((s,i)=>s+i.a,0);
  let guard = 0;
  while(guard++<6){
    const dE = wE>0.5 ? cap(esq)/wE : 0, dD = wD>0.5 ? cap(dir)/wD : 0;
    if(wE>=1.5 && dD > dE + 1.0 && dir.length>1){ esq.push(dir.pop()); continue; }
    if(wD>=1.5 && dE > dD + 1.0 && esq.length>0 && (esq.length>1 || dir.length===0)){ dir.push(esq.pop()); continue; }
    break;
  }
  if(q.gourmet && !sobrado && modo!=='L') (wD >= 1.0 ? dir : esq).push({tipo:'gourmet', a:alvo('gourmet',q)});
  if(wE < 1.0){ dir.push(...esq.splice(0)); }
  if(wD < 1.0){ esq.unshift(...dir.splice(0)); }
  let Da = clamp(Math.max(wE>0.5?cap(esq)/wE:0, wD>0.5?cap(dir)/wD:0), 2.6, 5.0) * (opts.cresce||1);
  if(esc) Da = Math.max(Da, esc.L + 0.3);
  const yA = yS + Ds, yI = yA + Da;
  // monta faixa social
  if(Dv>0) terreo.push(sala('varanda', Wg, 0, W, Dv));
  if(Wg>0) terreo.push(sala('garagem', 0, 0, Wg, yA, {vagas:vagasDentro}));
  terreo.push(...faixa(Wg, yS, W, yA, socialItens, 'x'));
  // monta faixa de apoio
  if(wE>0.5){ if(esq.length) terreo.push(...faixa(0, yA, wE, yA+Da, esq.reverse(), 'x')); else terreo.push(sala('deposito', 0, yA, wE, yA+Da)); }
  if(wD>0.5){ if(dir.length) terreo.push(...faixa(cxA+colw, yA, W, yA+Da, dir, 'x')); else terreo.push(sala('deposito', cxA+colw, yA, W, yA+Da)); }
  let escRect = null;
  if(esc){
    const ey0 = yA + (Da - esc.L)/2;
    escRect = {x0:r2(cxA+C), y0:r2(ey0), x1:r2(cxA+COL), y1:r2(ey0+esc.L)};
    terreo.push(sala('hall', cxA, yA, cxA+C, yA+Da));
    terreo.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {sobe: sobrado, desce: q.subsolo, esc}));
    if(escRect.y0 - yA > 0.3) terreo.push(sala('rouparia', cxA+C, yA, cxA+COL, escRect.y0, {nome:'Armário'}));
    if(yA+Da - escRect.y1 > 0.3) terreo.push(sala('rouparia', cxA+C, escRect.y1, cxA+COL, yA+Da, {nome:'Armário'}));
  } else terreo.push(sala('hall', cxA, yA, cxA+colw, yA+Da));

  const pav = [];
  let Dt;
  if(!sobrado){
    // faixa íntima no térreo
    const fi = faixaIntima(P.mods, tiras, yI, 0);
    terreo.push(...fi.salas);
    terreo.push(sala('circ', cxI, yI, cxI+C, yI+fi.Li));
    Dt = yI + fi.Li;
    if(modo==='L' && q.gourmet){
      // gourmet no canto livre do L, junto à cozinha
      const gx0 = cxI+C, gD = clamp(alvo('gourmet',q)/(W-gx0), 2.5, 4.0);
      terreo.push(sala('gourmet', gx0, yI, W, yI+gD));
    }
    pav.push({nome:'Térreo', salas: terreo});
  } else {
    // sobrado: íntimo no superior, com a mesma coluna de escada
    const tirasS = [{x0:0, x1:cxA, lado:'x1'}, {x0:cxA+COL, x1:W, lado:'x0'}].filter(t => t.x1-t.x0 >= 2.6);
    const fi = faixaIntima(P.mods, tirasS, 0, escRect.y1 + 1.0);
    const sup = fi.salas;
    const Ls = fi.Li;
    sup.push(sala('circ', cxA, 0, cxA+C, Ls, {nome:'Hall íntimo'}));
    sup.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {desce:true, esc}));
    if(escRect.y0 > 0.3) sup.push(sala('rouparia', cxA+C, 0, cxA+COL, escRect.y0));
    if(Ls - escRect.y1 > 0.3) sup.push(sala('rouparia', cxA+C, escRect.y1, cxA+COL, Ls));
    for(const t of [{x0:0,x1:cxA},{x0:cxA+COL,x1:W}]) if(t.x1-t.x0>0.05 && t.x1-t.x0<2.6) sup.push(sala('rouparia', t.x0, 0, t.x1, Ls, {nome:'Armários'}));
    Dt = yI; var Dter = yI, Lsup = Ls;
    if(Ls > Dt + 0.05){
      // completa o térreo sob o superior
      if(q.gourmet) terreo.push(sala('gourmet', 0, Dt, W, Ls));
      else terreo.push(sala('varanda', 0, Dt, W, Ls, {nome:'Varanda de fundos'}));
      Dt = Ls;
    } else if(q.gourmet){
      const gD = clamp(alvo('gourmet',q)/W, 2.5, 4.0);
      terreo.push(sala('gourmet', 0, Dt, W, Dt+gD)); Dt += gD;
    }
    if(Dt - Ls > 0.3) sup.push(sala('terraco', 0, Ls, W, Dt, {nome:'Laje / terraço'}));
    pav.push({nome:'Térreo', salas: terreo});
    pav.push({nome:'Superior', salas: sup});
  }
  if(q.subsolo) pav.unshift(subsolo(q, W, Dt, cxA, escRect, av));
  return {tipologia: modo==='duplo'?'Linear, corredor central':modo==='simples'?'Linear, corredor lateral':'Em L',
    W:r2(W), D:r2(Dt), pav, avisos:av, escada:esc, garagemDentro:vagasDentro, Dter: typeof Dter!=='undefined'?Dter:null, Lsup: typeof Lsup!=='undefined'?Lsup:null,
    cotasY:[0, yS, yA, yI, Dt].filter((v,i,a)=>a.indexOf(v)===i)};
}

/* ---------- Tipologia em H: ala íntima | pátio + ligação (cozinha e serviço) | ala social ---------- */
function emH(q, P, W){
  const av = [];
  const lq = clamp(Math.sqrt(alvo('suite',q)*1.25), 3.2, 4.6);
  const ws = r2(lq+0.6), wi = ws + C;
  let wsoc = 5.5;
  let vagasDentro = 0;
  if(q.garagem==='coberta' && q.vagas>0){ vagasDentro = Math.min(q.vagas, 2); wsoc = Math.max(wsoc, vagasDentro*VAGA_L); if(vagasDentro<q.vagas) av.push(`Só ${vagasDentro} vagas cabem cobertas na ala social; as demais ficam no recuo frontal.`); }
  const wp = W - wi - wsoc;
  if(wp < 4.0) return null;
  const salas = [];
  // ala íntima, tira única com corredor do lado do pátio
  const fi = faixaIntima(P.mods, [{x0:0, x1:ws, lado:'x1'}], 0, 0);
  salas.push(...fi.salas);
  // ala social empilhada ao longo de y
  const xs = W - wsoc;
  const col = [];
  if(vagasDentro) col.push({tipo:'garagem', a: VAGA_P*wsoc, fixo:VAGA_P});
  for(const t of P.apoioEsq) col.push({tipo:t, a:alvo(t,q)});
  for(const t of P.social) col.push({tipo:t, a:alvo(t,q)});
  let y = 0, yJ = null;
  const pequenos = col.filter(c => c.tipo==='banhoSocial'||c.tipo==='lavabo');
  const grandes = col.filter(c => !pequenos.includes(c));
  for(const c of grandes){
    if((c.tipo==='estar' || (c.tipo==='jantar' && !q.estar)) && pequenos.length){
      const pa = pequenos.reduce((s,i)=>s+i.a,0), pd = Math.max(1.6, pa/wsoc);
      salas.push(...faixa(xs, y, W, y+pd, pequenos.splice(0), 'x')); y += pd;
    }
    const L = c.fixo || Math.max(TIPOS[c.tipo].lado||2.5, c.a/wsoc);
    if(c.tipo==='garagem') salas.push(sala('garagem', xs, y, W, y+L, {vagas:vagasDentro}));
    else salas.push(sala(c.tipo, xs, y, W, y+L));
    if(c.tipo==='jantar' || (c.tipo==='estar' && !q.jantar)) yJ = y;
    y += L;
    if(false){
      // banhos sociais e lavabo logo depois do escritório/garagem, com acesso pelo vestíbulo/estar
      if(pequenos.length){ const pa = pequenos.reduce((s,i)=>s+i.a,0), pd = Math.max(1.6, pa/wsoc);
        salas.push(...faixa(xs, y, W, y+pd, pequenos.splice(0), 'x')); y += pd; }
    }
  }
  if(pequenos.length){ const pa = pequenos.reduce((s,i)=>s+i.a,0), pd = Math.max(1.6, pa/wsoc);
    const ultimo = salas.pop(); // coloca antes do último (jantar)
    salas.push(...faixa(xs, ultimo.y0, W, ultimo.y0+pd, pequenos.splice(0), 'x'));
    salas.push(Object.assign(ultimo, {y0:r2(ultimo.y0+pd), y1:r2(ultimo.y1+pd)})); if(yJ!==null) yJ += pd; y += pd; }
  let Ls = y;
  if(q.gourmet){ const gD = clamp(alvo('gourmet',q)/wsoc, 2.5, 4.0); salas.push(sala('gourmet', xs, Ls, W, Ls+gD)); Ls += gD; }
  if(yJ===null) yJ = Math.max(0, Ls-4);
  // ligação: galeria + serviço/despensa/cozinha
  const bar = P.apoioDir.slice().reverse().map(t => ({tipo:t, a:alvo(t,q)})); // serviço perto da ala íntima, cozinha perto do jantar
  const Db = clamp(bar.reduce((s,i)=>s+i.a,0)/wp, 3.0, 5.0);
  const yb = r2(yJ);
  salas.push(sala('galeria', wi, yb, xs, yb+C));
  salas.push(...faixa(wi, yb+C, xs, yb+C+Db, bar, 'x'));
  const Lcorr = Math.max(fi.Li, yb+C);
  salas.push(sala('circ', ws, 0, wi, Lcorr));
  if(Lcorr > fi.Li+0.05) salas.push(sala('rouparia', 0, fi.Li, ws, Lcorr, {nome:'Depósito'}));
  const D = Math.max(Lcorr, Ls, yb+C+Db);
  return {tipologia:'Em H', W:r2(W), D:r2(D), pav:[{nome:'Térreo', salas}], avisos:av, escada:null, garagemDentro:vagasDentro,
    cotasY:[0, yb, yb+C+Db, D], patios:[{x0:wi, y0:0, x1:xs, y1:yb}, {x0:wi, y0:yb+C+Db, x1:xs, y1:D}]};
}

/* ---------- Subsolo ---------- */
function subsolo(q, W, D, cxA, escRect, av){
  const salas = [];
  const h = q.subNivel==='meio' ? 1.40 : q.peDireito + 0.20;
  const Lr = r2(h / (q.inclinacao/100));
  if(q.subNivel==='meio') av.push('Subsolo semienterrado: o térreo fica 1,40 m acima da rua, com escada ou rampa de acesso na frente.');
  const Lin = q.subGaragem ? Math.max(0, r2(Lr - q.recFrente)) : 0;
  const obst = escRect ? {x0:cxA, y0:escRect.y0, x1:cxA+COL, y1:escRect.y1} : null;
  if(obst){
    salas.push(sala('hall', obst.x0, obst.y0, obst.x0+C, obst.y1));
    salas.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {sobe:true, esc:escada(q)}));
  }
  // linhas de corte em y
  const cortes = [];
  const livres = [];  // retângulos livres por faixa
  function faixaY(y0, y1, tipo){
    if(y1 - y0 < 0.3) return [];
    if(obst && obst.y0 < y1-0.001 && obst.y1 > y0+0.001){
      const out = [];
      if(obst.x0 > 0.3) out.push({x0:0, y0, x1:obst.x0, y1, tipo});
      if(W - obst.x1 > 0.3) out.push({x0:obst.x1, y0, x1:W, y1, tipo});
      if(obst.y0 - y0 > 0.3) livres.push({x0:obst.x0, y0, x1:obst.x1, y1:obst.y0, tipo:'livre'});
      if(y1 - obst.y1 > 0.3) livres.push({x0:obst.x0, y0:obst.y1, x1:obst.x1, y1, tipo:'livre'});
      return out;
    }
    const ys = [y0, y1]; if(obst){ if(obst.y0>y0 && obst.y0<y1) ys.push(obst.y0); if(obst.y1>y0 && obst.y1<y1) ys.push(obst.y1); }
    ys.sort((a,b)=>a-b);
    const out = [];
    for(let i=0;i<ys.length-1;i++){
      const a = ys[i], b = ys[i+1];
      const cobre = obst && obst.y0 <= a+0.001 && obst.y1 >= b-0.001;
      if(cobre){ if(obst.x0>0.3) out.push({x0:0,y0:a,x1:obst.x0,y1:b,tipo}); if(W-obst.x1>0.3) out.push({x0:obst.x1,y0:a,x1:W,y1:b,tipo}); }
      else out.push({x0:0,y0:a,x1:W,y1:b,tipo});
    }
    return out;
  }
  let y = 0;
  let vagasOk = 0;
  if(q.subGaragem){
    if(Lin>0){
      salas.push(sala('rampa', 0, 0, RAMPA_L, Lin, {inclinacao:q.inclinacao}));
      for(const r of faixaY(0, Lin, 'deposito')) if(r.x1 > RAMPA_L+0.5){ livres.push(Object.assign({}, r, {x0:Math.max(r.x0, RAMPA_L)})); }
    }
    y = Lin;
    for(const r of faixaY(y, y+MANOBRA, 'manobra')) salas.push(sala('manobra', r.x0, r.y0, r.x1, r.y1));
    y += MANOBRA;
    for(const r of faixaY(y, y+VAGA_P, 'vaga')){
      let x = r.x0;
      while(x + 2.5 <= r.x1 + 0.001 && vagasOk < q.vagas && (r.y1-r.y0) >= VAGA_P-0.01){ salas.push(sala('garagem', x, r.y0, x+2.5, r.y1, {nome:'Vaga '+(vagasOk+1), vaga:1})); x += 2.5; vagasOk++; }
      if(r.x1 - x > 0.3) livres.push({x0:x, y0:r.y0, x1:r.x1, y1:r.y1});
    }
    y += VAGA_P;
    if(vagasOk < q.vagas) av.push(`Subsolo: cabem ${vagasOk} de ${q.vagas} vagas.`);
    if(y > D) av.push(`Subsolo: a garagem precisa de ${f2(y)} m de profundidade, mas a casa tem ${f2(D)} m.`);
  }
  for(const r of faixaY(Math.min(y, D), D, 'livre')) livres.push(r);
  // distribui depósito e lazer nos livres, do maior para o menor
  livres.sort((a,b)=>area(b)-area(a));
  const usos = [];
  if(q.subLazer) usos.push('lazer');
  if(q.subDeposito) usos.push('deposito');
  livres.forEach((r,i) => {
    if(r.y1 > D) r.y1 = D;
    if(r.y1 - r.y0 < 0.3) return;
    const t = usos[i] || (r.tipo==='deposito' ? 'deposito' : (usos.length ? 'deposito' : 'deposito'));
    salas.push(sala(t, r.x0, r.y0, r.x1, r.y1, i>=usos.length ? {nome: (r.x1-r.x0)<1.5||(r.y1-r.y0)<1.5 ? 'Área técnica' : 'Depósito'} : {}));
  });
  return {nome:'Subsolo', salas, rampa:{desnivel:h, L:Lr, Lin, Lout:r2(Lr-Lin), largura:RAMPA_L, inclinacao:q.inclinacao}, vagas:vagasOk};
}

/* ---------- Portas, vãos e janelas ---------- */
const PREF = {
  quarto:['circ','hall'], suite:['circ','hall'], master:['circ','hall'],
  banhoSocial:['circ','hall','galeria','estar','jantar','tv','escritorio'], lavabo:['hall','galeria','estar','jantar','circ','tv'],
  escritorio:['estar','hall','galeria','circ','tv','jantar','garagem'], tv:['estar','jantar','hall','circ','galeria'],
  cozinha:['jantar','hall','galeria','estar'], servico:['cozinha','hall','galeria','garagem','circ'], despensa:['cozinha','servico','hall'],
  garagem:['hall','servico','cozinha','estar','galeria','escritorio'], rouparia:['circ','hall'], deposito:['hall','circ','manobra','galeria','servico','garagem','lazer','cozinha'],
  lazer:['hall','manobra'], gourmet:['cozinha','jantar','servico','estar','galeria'],
  salaIntima:['circ','hall'], hall:[], circ:[], galeria:[], escada:[], manobra:['hall'], rampa:[], varanda:[], terraco:['circ','hall'],
};
const ABERTOS = [['estar','jantar'],['estar','tv'],['hall','estar'],['hall','jantar'],['hall','tv'],['hall','circ'],['galeria','circ'],['galeria','jantar'],['galeria','estar'],['galeria','cozinha'],['manobra','garagem'],['manobra','rampa'],['hall','manobra']];

function compartilhado(a, b){
  // aresta comum entre retângulos: {o:'v'|'h', c, t0, t1}
  const e = 0.001;
  if(Math.abs(a.x1-b.x0)<e || Math.abs(b.x1-a.x0)<e){
    const c = Math.abs(a.x1-b.x0)<e ? a.x1 : a.x0, t0 = Math.max(a.y0,b.y0), t1 = Math.min(a.y1,b.y1);
    if(t1-t0 > 0.05) return {o:'v', c, t0, t1};
  }
  if(Math.abs(a.y1-b.y0)<e || Math.abs(b.y1-a.y0)<e){
    const c = Math.abs(a.y1-b.y0)<e ? a.y1 : a.y0, t0 = Math.max(a.x0,b.x0), t1 = Math.min(a.x1,b.x1);
    if(t1-t0 > 0.05) return {o:'h', c, t0, t1};
  }
  return null;
}

/* Trechos de cada lado de uma sala que não encostam em nenhuma outra sala (fachada). */
function trechosExternos(s, salas, filtro){
  const lados = [
    {o:'h', c:s.y0, t0:s.x0, t1:s.x1, n:'y0'}, {o:'h', c:s.y1, t0:s.x0, t1:s.x1, n:'y1'},
    {o:'v', c:s.x0, t0:s.y0, t1:s.y1, n:'x0'}, {o:'v', c:s.x1, t0:s.y0, t1:s.y1, n:'x1'}];
  const out = [];
  for(const l of lados){
    let livres = [[l.t0, l.t1]];
    for(const o of salas){ if(o===s || (filtro && !filtro(o))) continue; const sh = compartilhado(s, o); if(!sh || sh.o!==l.o || Math.abs(sh.c-l.c)>0.001) continue;
      livres = livres.flatMap(([a,b]) => { const r=[]; if(sh.t0>a) r.push([a, Math.min(b, sh.t0)]); if(sh.t1<b) r.push([Math.max(a, sh.t1), b]); return r.filter(([p,q]) => q-p>0.05); }); }
    for(const [a,b] of livres) out.push({o:l.o, c:l.c, t0:a, t1:b, lado:l.n});
  }
  return out;
}

function aberturas(pav, q, ehTerreo){
  const S = pav.salas, portas = [], vaos = [], janelas = [], av = [];
  const aberto = (a,b) => ABERTOS.some(([p,r]) => (a.tipo===p&&b.tipo===r)||(a.tipo===r&&b.tipo===p))
    || (q.cozinha==='aberta' && ((a.tipo==='cozinha'&&b.tipo==='jantar')||(a.tipo==='jantar'&&b.tipo==='cozinha')));
  // vãos abertos (sem parede)
  for(let i=0;i<S.length;i++) for(let j=i+1;j<S.length;j++){
    const a = S[i], b = S[j]; const sh = compartilhado(a,b); if(!sh) continue;
    if(aberto(a,b)) vaos.push({o:sh.o, c:sh.c, t0:sh.t0, t1:sh.t1, livre:true, a:a.id, b:b.id});
  }
  const temAcesso = new Set(S.filter(s => ['hall','circ','galeria','manobra','rampa','varanda','terraco','escada'].includes(s.tipo)).map(s=>s));
  for(const s of S){
    if(['hall','circ','galeria','escada','rampa','varanda','terraco','manobra'].includes(s.tipo)) continue;
    // closet → quarto do mesmo módulo (vão), banho de suíte → closet do mesmo módulo
    if(s.tipo==='closet'||s.tipo==='closetMaster'){
      const q2 = S.find(o => o.mod===s.mod && (o.tipo==='suite'||o.tipo==='master')); const sh = q2 && compartilhado(s,q2);
      if(sh){ const m=(sh.t0+sh.t1)/2, w=Math.min(1.4, (sh.t1-sh.t0)*0.7); vaos.push({o:sh.o, c:sh.c, t0:m-w/2, t1:m+w/2, a:s.id, b:q2.id}); continue; }
    }
    if(s.tipo==='banhoSuite'||s.tipo==='banhoMaster'){
      const c2 = S.find(o => o.mod===s.mod && (o.tipo==='closet'||o.tipo==='closetMaster')); const sh = c2 && compartilhado(s,c2);
      if(sh){ portas.push(porta(s, c2, sh, 0.7)); continue; }
    }
    if(S.some(o => o!==s && aberto(s,o) && compartilhado(s,o))) continue;
    const pref = PREF[s.tipo] || [];
    let feito = false;
    for(const t of pref){
      const viz = S.filter(o => o!==s && o.tipo===t).map(o => ({o, sh:compartilhado(s,o)})).filter(v => v.sh && v.sh.t1-v.sh.t0 >= 0.85)
        .sort((a,b) => (b.sh.t1-b.sh.t0)-(a.sh.t1-a.sh.t0));
      if(viz.length){ portas.push(porta(s, viz[0].o, viz[0].sh, larguraPorta(s))); feito = true; break; }
    }
    if(!feito && s.tipo!=='estar' && pref.length && !['garagem','gourmet'].includes(s.tipo)) av.push(`${pav.nome}: ${rotulo(s)} sem acesso por ${pref.slice(0,3).map(t=>TIPOS[t].nome.toLowerCase()).join(', ')}.`);
  }
  // entrada principal: estar → varanda ou fachada frontal
  if(ehTerreo){
    const estar = S.find(s => s.tipo==='estar') || S.find(s => s.tipo==='jantar') || S.find(s => s.tipo==='tv');
    if(estar){
      const v = S.find(o => o.tipo==='varanda' && compartilhado(estar,o));
      if(v) portas.push(Object.assign(porta(estar, v, compartilhado(estar,v), 1.0, true), {entrada:true}));
      else {
        const ext = trechosExternos(estar, S).filter(t => t.t1-t.t0 >= 1.2).sort((a,b) => (a.lado==='y0'?0:1)-(b.lado==='y0'?0:1) || (b.t1-b.t0)-(a.t1-a.t0));
        if(ext.length){ const t = ext[0]; portas.push({o:t.o, c:t.c, t0:(t.t0+t.t1)/2-0.5, t1:(t.t0+t.t1)/2+0.5, sala:estar.id, dentro:dentro(estar,t), entrada:true}); }
        else av.push('Térreo: a sala não tem parede externa para a entrada principal.');
      }
    }
  }
  // conectividade: a partir da entrada (térreo) ou da escada/hall (outros pavimentos)
  const ini = ehTerreo ? (portas.find(p=>p.entrada)||{}).sala : (S.find(s=>s.tipo==='escada')||S.find(s=>s.tipo==='hall')||{}).id;
  if(ini){
    const adj = new Map(S.map(s=>[s.id,[]]));
    const liga = (a,b) => { if(adj.has(a)&&adj.has(b)){ adj.get(a).push(b); adj.get(b).push(a); } };
    portas.forEach(p => { if(p.viz) liga(p.sala, p.viz); }); vaos.forEach(v => liga(v.a, v.b));
    const esc = S.find(s=>s.tipo==='escada'); if(esc){ S.filter(o=>o.tipo==='hall'||o.tipo==='circ').forEach(o=>{ if(compartilhado(esc,o)) liga(esc.id,o.id); }); }
    S.filter(s=>s.tipo==='varanda'||s.tipo==='garagem'||s.tipo==='rampa'||s.tipo==='terraco').forEach(s=>{ if(ehTerreo || s.tipo==='rampa') liga(s.id, ini); });
    const vis = new Set([ini]), fila=[ini];
    while(fila.length){ const x=fila.shift(); for(const y of adj.get(x)||[]) if(!vis.has(y)){ vis.add(y); fila.push(y); } }
    for(const s of S) if(!vis.has(s.id) && !['rouparia','deposito','terraco'].includes(s.tipo) && !s.vaga) av.push(`${pav.nome}: ${rotulo(s)} não se liga ao resto da casa.`);
  }
  // janelas
  const fechados = S.filter(o => !TIPOS[o.tipo].aberto);
  for(const s of S){
    if(TIPOS[s.tipo].aberto || pav.nome==='Subsolo') continue;
    const t = TIPOS[s.tipo];
    if(!(t.hab || t.mol || s.tipo==='circ' || s.tipo==='galeria' || s.tipo==='hall' || s.tipo==='closetMaster')) continue;
    const ext = trechosExternos(s, fechados).filter(e => e.t1-e.t0 >= 0.8);
    if(!ext.length){
      if(t.hab) av.push(`${pav.nome}: ${rotulo(s)} sem janela para fora.`);
      else if(t.mol) av.push(`${pav.nome}: ${rotulo(s)} sem janela; prever exaustão mecânica.`);
      continue;
    }
    ext.sort((a,b) => (b.t1-b.t0)-(a.t1-a.t0));
    const e = ext[0], L = e.t1-e.t0;
    const alta = !!t.mol || s.tipo==='closetMaster';
    const w = alta ? Math.min(0.8, L-0.3) : s.tipo==='galeria' ? L-0.6 : clamp(L*0.45, 0.8, 2.4);
    const m = (e.t0+e.t1)/2;
    // não sobrepor porta de entrada
    const pe = portas.find(p => p.entrada && p.o===e.o && Math.abs(p.c-e.c)<0.001 && p.t1>m-w/2 && p.t0<m+w/2);
    const mm = pe ? (pe.t1 + 0.3 + w/2 <= e.t1 ? pe.t1+0.3+w/2 : pe.t0-0.3-w/2) : m;
    janelas.push({o:e.o, c:e.c, t0:mm-w/2, t1:mm+w/2, alta, vidro: s.tipo==='galeria'});
    if(s.tipo==='circ' && ext.length>1 && ext[1].t1-ext[1].t0 >= 2.0) { const e2 = ext[1], m2=(e2.t0+e2.t1)/2; janelas.push({o:e2.o, c:e2.c, t0:m2-0.6, t1:m2+0.6, alta:false}); }
  }
  return {portas, vaos, janelas, avisos:av};

  function larguraPorta(s){ return ['banhoSocial','lavabo','closet','despensa','rouparia','banhoSuite'].includes(s.tipo) ? 0.7 : s.tipo==='garagem' ? 0.9 : 0.8; }
}
function rotulo(s){ return (s.nome || TIPOS[s.tipo].nome).toLowerCase(); }
function dentro(s, t){ return t.o==='h' ? (Math.abs(t.c-s.y0)<0.001 ? 1 : -1) : (Math.abs(t.c-s.x0)<0.001 ? 1 : -1); }
function porta(s, o, sh, w, centro){
  const L = sh.t1 - sh.t0; w = Math.min(w, L-0.2);
  // perto do canto, deixando 0,15 m de boneca; abre para dentro da sala s
  const t0 = centro ? (sh.t0+sh.t1)/2 - w/2 : sh.t0 + Math.min(0.15, (L-w)/2);
  const ds = sh.o==='h' ? (s.y0 >= sh.c-0.001 ? 1 : -1) : (s.x0 >= sh.c-0.001 ? 1 : -1);
  return {o:sh.o, c:sh.c, t0:r2(t0), t1:r2(t0+w), sala:s.id, viz:o.id, dentro:ds};
}

/* ---------- Avaliação ---------- */
function avalia(v, q){
  let pen = 0; const av = [];
  for(const p of v.pav) for(const s of p.salas){
    const t = TIPOS[s.tipo]; const w = s.x1-s.x0, h = s.y1-s.y0, a = w*h, lmin = Math.min(w,h), lmax = Math.max(w,h);
    if(t.min && !s.vaga && s.nome!=='Área técnica'){
      if(a < t.min - 0.01){ pen += 6*(t.min-a); av.push(`${p.nome}: ${rotulo(s)} com ${f2(a)} m², abaixo do mínimo de ${f2(t.min)} m².`); }
      if(lmin < t.lado - 0.01){ pen += 12*(t.lado-lmin); av.push(`${p.nome}: ${rotulo(s)} com lado de ${f2(lmin)} m, abaixo de ${f2(t.lado)} m.`); }
      const ra = a / (t.alvo || a);
      if(ra > 1.8) pen += (ra-1.8)*4;
    }
    if(!['circ','hall','galeria','rampa','manobra','escada','rouparia','varanda','terraco','garagem','deposito'].includes(s.tipo) && lmax/lmin > 2.6) pen += 2*(lmax/lmin-2.6);
  }
  for(const p of v.pav){ const ab = aberturas(p, q, p.nome==='Térreo'); p.portas = ab.portas; p.vaos = ab.vaos; p.janelas = ab.janelas; av.push(...ab.avisos); pen += 6*ab.avisos.length; }
  // terreno
  const B = q.frente - 2*q.recLat, Dmax = q.fundo - q.recFrente - q.recFundo;
  if(v.W > B + 0.01){ pen += 40*(v.W-B); av.push(`A casa (${f2(v.W)} m) é mais larga que a área edificável (${f2(B)} m).`); }
  if(v.D > Dmax + 0.01){ pen += 25*(v.D-Dmax); av.push(`A casa precisa de ${f2(v.D)} m de profundidade; o terreno permite ${f2(Dmax)} m.`); }
  const proj = projecao(v);
  const taxa = 100*proj/(q.frente*q.fundo);
  if(taxa > q.taxa + 0.01){ pen += 2*(taxa-q.taxa); av.push(`Ocupação de ${f2(taxa)} %, acima do máximo de ${f2(q.taxa)} %.`); }
  // circulação
  const tot = v.pav.reduce((s,p)=>s+p.salas.filter(x=>!TIPOS[x.tipo].aberto).reduce((t,x)=>t+area(x),0),0);
  const circ = v.pav.reduce((s,p)=>s+p.salas.filter(x=>['circ','hall','galeria'].includes(x.tipo)).reduce((t,x)=>t+area(x),0),0);
  if(circ/tot > 0.14) pen += 60*(circ/tot-0.14);
  v.score = Math.max(0, Math.round(100 - pen));
  v.avisos = (v.avisos||[]).concat(av);
  v.ocupacao = r2(taxa); v.projecao = r2(proj); v.circPct = r2(100*circ/tot);
  return v;
}

function projecao(v){
  // área da projeção: térreo (inclui varandas cobertas) unido com superior
  const ter = v.pav.find(p => p.nome==='Térreo');
  return ter.salas.filter(s => s.tipo!=='terraco').reduce((t,s)=>t+area(s),0);
}

function quadro(v){
  const linhas = [];
  for(const p of v.pav){
    const fech = p.salas.filter(s => !TIPOS[s.tipo].aberto);
    const abertas = p.salas.filter(s => TIPOS[s.tipo].aberto);
    linhas.push({pav:p.nome, salas: p.salas.map(s => ({nome:s.nome, tipo:s.tipo, zona:s.zona, w:r2(s.x1-s.x0), h:r2(s.y1-s.y0), a:r2(area(s))})),
      fechada:r2(fech.reduce((t,s)=>t+area(s),0)), aberta:r2(abertas.reduce((t,s)=>t+area(s),0))});
  }
  const fechada = r2(linhas.reduce((t,l)=>t+l.fechada,0)), aberta = r2(linhas.reduce((t,l)=>t+l.aberta,0));
  return {pavimentos:linhas, fechada, aberta, total:r2(fechada+aberta)};
}

const f2 = n => (Math.round(n*100)/100).toFixed(2).replace('.', ',');

/* ---------- Geração ---------- */
function geraTodas(q, P, Ws){
  const out = [];
  for(const W of Ws){
    const modos = [];
    const larguraCol = (q.tipo==='sobrado'||q.subsolo) ? COL : C;
    if(W >= 2*TIPOS.suite.lado + larguraCol - 0.01) modos.push('duplo');
    if(W <= 7.6) modos.push('simples');
    if(W >= 10 && q.tipo==='terrea') modos.push('L');
    for(const m of modos){ try{
      let v = linear(q, P, W, m);
      // no sobrado, se o superior for bem mais longo, aumenta as faixas do térreo (até 30 %) antes de criar varanda
      if(q.tipo==='sobrado' && v.Lsup && v.Lsup > v.Dter + 1.0){ const k = Math.min(1.3, 1 + (v.Lsup - v.Dter)/Math.max(1, v.Dter - (q.varanda?2:0))); v = linear(q, P, W, m, {cresce:k}); }
      out.push(v);
    }catch(e){ /* combinação inviável */ } }
    if(W >= 15 && q.tipo==='terrea' && !q.subsolo){ const h = emH(q, P, W); if(h) out.push(h); }
  }
  return out;
}

function gerar(entrada){
  const q = normaliza(entrada);
  const P = programa(q);
  const B = r2(q.frente - 2*q.recLat), Dmax = r2(q.fundo - q.recFrente - q.recFundo);
  const avisos = [];
  if(B < 5) avisos.push(`A área edificável tem só ${f2(B)} m de largura.`);
  const Ws = [];
  for(let w = Math.floor(B*2)/2; w >= Math.max(6, B-6); w -= 0.5) Ws.push(r2(w));
  if(!Ws.length) Ws.push(B);
  const todas = geraTodas(q, P, Ws).map(v => avalia(v, q));
  todas.sort((a,b) => b.score-a.score || a.W*a.D-b.W*b.D);
  // até 3 variantes, preferindo tipologias diferentes
  const escolhidas = [];
  for(const v of todas){ if(escolhidas.length>=3) break; if(!escolhidas.some(e => e.tipologia===v.tipologia)) escolhidas.push(v); }
  for(const v of todas){ if(escolhidas.length>=3) break; if(!escolhidas.includes(v) && !escolhidas.some(e => e.tipologia===v.tipologia && Math.abs(e.W-v.W)<1)) escolhidas.push(v); }
  escolhidas.forEach((v,i) => { v.nome = 'Variante ' + String.fromCharCode(65+i); v.quadro = quadro(v); v.x0 = r2(q.recLat + (B - v.W)/2); v.y0 = q.recFrente; });
  const lm = loteMinimo(q, P);
  if(escolhidas.length && escolhidas[0].score < 60) avisos.push('O programa não cabe bem neste terreno. Veja o terreno mínimo sugerido.');
  return {entrada:q, B, Dmax, variantes:escolhidas, loteMinimo:lm, avisos, escada: (q.tipo==='sobrado'||q.subsolo) ? escada(q) : null};
}

/* Menor terreno (frente × fundo) em que a melhor variante cabe sem violações de terreno. */
function loteMinimo(q, P){
  let best = null;
  for(let W = 6; W <= 24; W += 0.5){
    const vs = geraTodas(q, P, [W]);
    for(const v of vs){
      const fr = r2(W + 2*q.recLat);
      let fu = Math.ceil((v.D + q.recFrente + q.recFundo)*2)/2;
      const q2 = Object.assign({}, q, {frente:fr, fundo:fu});
      avalia(v, q2);
      const proj = v.projecao;
      if(100*proj/(fr*fu) > q.taxa) fu = r2(Math.ceil(proj/(q.taxa/100)/fr*2)/2);
      if(v.score < 70) continue;
      const a = fr*fu;
      if(!best || a < best.area - 0.01) best = {frente:fr, fundo:fu, area:r2(a), tipologia:v.tipologia, W:v.W, D:v.D};
    }
  }
  // fundo mínimo mantendo a frente informada
  let comFrente = null;
  const vs = geraTodas(q, P, [r2(q.frente - 2*q.recLat)]).map(v => avalia(v, Object.assign({}, q, {fundo: 999})));
  vs.sort((a,b) => b.score-a.score || a.D-b.D);
  if(vs.length){ const v = vs[0]; comFrente = {frente:q.frente, fundo:r2(Math.ceil((v.D + q.recFrente + q.recFundo)*2)/2), tipologia:v.tipologia}; }
  return {minimo:best, comFrente};
}

return {gerar, normaliza, programa, escada, TIPOS, PADRAO, f2, area, _interno:{linear, emH, faixa, faixaIntima, compartilhado, trechosExternos, avalia}};
});
