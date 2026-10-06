/* Motor do gerador de plantas: programa de necessidades → variantes de planta.
   Funções puras, sem DOM. Coordenadas em metros, origem no canto frontal esquerdo da casa:
   x ao longo da frente do lote, y da rua para o fundo. Funciona no navegador (window.Motor) e no Node. */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(); else root.Motor=factory();
})(this, function(){
'use strict';

const C = 1.20;          // largura de circulação
const COL = 2.20;        // coluna de circulação com escada reta (1,20 de passagem + 1,00 de escada)
const VAGA_L = 2.60, VAGA_P = 5.20, MANOBRA = 5.00, RAMPA_L = 3.50;
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
  elevador:     {nome:'Elevador',        zona:'circ'},
  jardim:       {nome:'Jardim de inverno', zona:'patio', aberto:1},
};
const FATOR = {compacto:0.85, medio:1, amplo:1.25};
/* Vento predominante de leste/sudeste (de onde sopra, em graus). */
const VENTO = 112.5;
const difAng = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };
/* Rumo para onde aponta cada face da casa: y0 = frente; y1 = fundo; x1 = direita de quem olha para a rua; x0 = esquerda. */
function rumoFace(lado, F, espelho){ const base = {y0:0, x1:90, y1:180, x0:270}[lado]; let a = base; if(espelho && (lado==='x0'||lado==='x1')) a = 360 - base; return (F + a) % 360; }
/* Rumos da frente do terreno (graus no sentido horário a partir do norte). */
const RUMOS = {N:0, NE:45, L:90, SE:135, S:180, SO:225, O:270, NO:315};
const NOMES_RUMO = {N:'Norte', NE:'Nordeste', L:'Leste', SE:'Sudeste', S:'Sul', SO:'Sudoeste', O:'Oeste', NO:'Noroeste'};
const DIMENSIONAVEIS = ['quarto','suite','master','banhoSuite','closet','banhoSocial','lavabo','estar','jantar','tv','escritorio','cozinha','servico','despensa','gourmet'];

const PADRAO = {
  frente:12, fundo:30, recFrente:5, recLatE:1.5, recLatD:1.5, recFundo:3, taxa:60, orientacao:'',
  tipo:'terrea', formato:'auto', peDireito:3.0,
  quartos:3, suites:1, master:true, tamanho:'medio',
  banhosSociais:1, lavabo:false,
  estar:true, jantar:true, tv:false, escritorio:false,
  cozinha:'aberta', servico:true, despensa:false,
  vagas:2, garagem:'coberta', varanda:true, varandaForma:'corrida', gourmet:false,
  gourmetDest:false, edicula:'nenhuma', edGourmet:true, edBanho:true, edDeposito:true, edQuarto:true,
  piscina:false, pisForma:'retangular', pisC:8, pisL:4, pisP:1.4, pisPrainha:false, afastAnexo:3, anexoFundo:true,
  elevador:false, vaoMax:10,
  supModo:'corresp', secFrente:true, secMeio:true, secFundo:true, secAlaE:true, secAlaD:false,
  supQuartos:-1, supEscritorio:false, supTv:false, supServico:false,
  torreTipo:'nenhuma',
  rooftop:false, rtPos:'centro', rtTecnica:true, rtGourmet:true, rtVaranda:true, rtBanho:true, rtSpa:false,
  subRecuos:'nenhum', permeab:20, subVagasMax:0,
  acessivel:false,
  invEstarJantar:false, invCozinhaServico:false,
  brises:false, brisesTipo:'auto', brisesFaces:'auto', brisesFace_N:false, brisesFace_NE:false, brisesFace_L:false, brisesFace_SE:false, brisesFace_S:false, brisesFace_SO:false, brisesFace_O:false, brisesFace_NO:false,
  subsolo:false, subNivel:'meio', garagemLocal:'subsolo', vagasTerreo:1, subLazer:false, inclinacao:20,
};

function normaliza(p){
  const q = Object.assign({}, PADRAO, p||{});
  for(const k of ['frente','fundo','recFrente','recLatE','recLatD','recFundo','taxa','peDireito','quartos','suites','banhosSociais','vagas','inclinacao','pisC','pisL','pisP','afastAnexo','vaoMax']) q[k] = +q[k] || 0;
  // recuos laterais (E2.2): esquerdo e direito de quem olha da rua para o lote. Pela convenção do motor, a esquerda de quem
  // olha da rua é o lado x1 e a direita é o x0. Links e arquivos antigos com um só recuo lateral (recLat) valem para os dois.
  // (o estado expande links antigos com o padrão: o recLat antigo vale quando os dois campos novos estão no padrão)
  if(p && p.recLat !== undefined && p.recLat !== null && (p.recLatE === undefined || p.recLatE === PADRAO.recLatE) && (p.recLatD === undefined || p.recLatD === PADRAO.recLatD)) q.recLatE = q.recLatD = +p.recLat || 0;
  q.recLatE = clamp(q.recLatE, 0, 20); q.recLatD = clamp(q.recLatD, 0, 20);
  q.recX0 = q.recLatD; q.recX1 = q.recLatE; delete q.recLat;
  q.elevador = q.elevador===true||q.elevador==='true'||q.elevador===1||q.elevador==='1'||q.elevador==='on';
  q.vaoMax = clamp(q.vaoMax || 10, 5, 20);
  if(!['frente','centro','fundo'].includes(q.rtPos)) q.rtPos = 'centro';
  // rooftop (E2.1): as áreas em m² deram lugar a itens marcados; links e arquivos antigos com m² viram "marcado se > 0"
  for(const [k, a] of [['rtTecnica','rtTecnicaA'], ['rtGourmet','rtGourmetA'], ['rtVaranda','rtVarandaA']]) if(p && p[k] === undefined && p[a] !== undefined) q[k] = +p[a] > 0;
  for(const a of ['rtTecnicaA','rtGourmetA','rtVarandaA','rtTerracoA','rtArea']) delete q[a];
  // torre de ar (Fase 4): torreTipo substitui torreCalor (true passa a valer chaminé)
  const torreAntiga = p && (p.torreCalor===true||p.torreCalor==='true'||p.torreCalor==='on'||p.torreCalor===1);
  if(!TORRES[q.torreTipo] && q.torreTipo !== 'auto') q.torreTipo = 'nenhuma';
  if(torreAntiga && (!p.torreTipo || p.torreTipo === 'nenhuma')) q.torreTipo = 'chamine';
  q.torreCalor = q.torreTipo !== 'nenhuma';
  for(const k of ['secFrente','secMeio','secFundo','secAlaE','secAlaD','supEscritorio','supTv','supServico','rooftop','rtDeck','rtGourmet','rtVaranda','rtBanho','rtSpa','rtTecnica']) q[k] = q[k]===true||q[k]==='true'||q[k]===1||q[k]==='1'||q[k]==='on';
  if(q.supModo!=='parcial') q.supModo = 'corresp';
  q.supQuartos = Math.round(+q.supQuartos); if(!(q.supQuartos >= 0) || q.supQuartos > q.quartos) q.supQuartos = q.quartos;
  for(const k of ['gourmetDest','edGourmet','edBanho','edDeposito','edQuarto','piscina','pisPrainha','anexoFundo']) q[k] = q[k]===true||q[k]==='true'||q[k]===1||q[k]==='1'||q[k]==='on';
  if(!['nenhuma','1','2'].includes(String(q.edicula))) q.edicula = 'nenhuma'; q.edicula = String(q.edicula);
  if(q.edicula==='2'){ q.edQuarto = true; q.edGourmet = true; }
  if(!['retangular','raia','L','oval'].includes(q.pisForma)) q.pisForma = 'retangular';
  q.pisC = clamp(q.pisC || 8, 2, 25); q.pisL = clamp(q.pisL || 4, 1.5, 12); q.pisP = clamp(q.pisP || 1.4, 0.4, 3); q.afastAnexo = clamp(q.afastAnexo, 1.5, 10);
  for(const k of ['master','lavabo','estar','jantar','tv','escritorio','servico','despensa','varanda','gourmet','subsolo','subGaragem','subDeposito','subLazer']) q[k] = q[k]===true||q[k]==='true'||q[k]===1||q[k]==='1'||q[k]==='on';
  q.quartos = clamp(Math.round(q.quartos), 1, 8);
  q.suites = clamp(Math.round(q.suites), 0, q.quartos);
  q.banhosSociais = clamp(Math.round(q.banhosSociais), 0, 4);
  q.vagas = clamp(Math.round(q.vagas), 0, 6);
  q.peDireito = clamp(q.peDireito || 3, 2.6, 4.5);
  q.inclinacao = clamp(q.inclinacao || 20, 8, 25);
  if(!FATOR[q.tamanho]) q.tamanho = 'medio';
  if(q.tipo!=='sobrado') q.tipo = 'terrea';
  if(!['auto','bloco','L','U','H'].includes(q.formato)) q.formato = 'auto';
  if(!['coberta','descoberta','nenhuma'].includes(q.garagem)) q.garagem = 'coberta';
  if(q.vagas===0 && !q.subsolo) q.garagem = 'nenhuma';
  if(!['meio','inteiro'].includes(q.subNivel)) q.subNivel = 'meio';
  if(q.varandaForma!=='L') q.varandaForma = 'corrida';
  if(!Object.prototype.hasOwnProperty.call(RUMOS, q.orientacao)) q.orientacao = '';
  // dimensões pedidas: d_<tipo>_w × d_<tipo>_l, ou só a área d_<tipo>_a
  q.dims = {};
  for(const t of DIMENSIONAVEIS){
    const w = +q['d_'+t+'_w'] || 0, l = +q['d_'+t+'_l'] || 0, a = +q['d_'+t+'_a'] || 0;
    if(w > 0.5 && l > 0.5) q.dims[t] = {w:Math.min(w,l), l:Math.max(w,l), a:r2(w*l)};
    else if(a > 0.5) q.dims[t] = {a};
  }
  if(!['nenhum','lateraisFundo','todos'].includes(q.subRecuos)) q.subRecuos = 'nenhum';
  q.subVagasMax = clamp(Math.round(+q.subVagasMax || 0), 0, 40);      // teto opcional de vagas no subsolo (0 = o máximo que couber)
  // brises (Fase 4): estudo em gerador/brises.js; o motor só normaliza os campos
  const sim = x => x===true||x==='true'||x===1||x==='1'||x==='on';
  q.brises = sim(q.brises);
  // acessibilidade (NBR 9050) é opcional; com ela, ao menos um banho social, que será o banho acessível
  q.acessivel = sim(q.acessivel);
  q.invEstarJantar = sim(q.invEstarJantar); q.invCozinhaServico = sim(q.invCozinhaServico);
  if(q.acessivel && q.banhosSociais < 1) q.banhosSociais = 1;
  if(!['auto','horizontal','vertical','misto','movel'].includes(q.brisesTipo)) q.brisesTipo = 'auto';
  if(q.brisesFaces !== 'escolha') q.brisesFaces = 'auto';
  for(const k of Object.keys(RUMOS)) q['brisesFace_' + k] = sim(q['brisesFace_' + k]);
  q.permeab = clamp(isNaN(+q.permeab) ? 20 : +q.permeab, 0, 80);
  // onde ficam as vagas: só no térreo, só no subsolo ou nos dois
  if(!['terreo','subsolo','ambos'].includes(q.garagemLocal)) q.garagemLocal = (p && p.subGaragem===false) ? 'terreo' : 'subsolo';
  if(!q.subsolo) q.garagemLocal = 'terreo';
  q.subLazer = false;                         // o subsolo é só garagem: rampa, vagas, núcleo e jardim
  q.vagasTerreo = clamp(Math.round(+q.vagasTerreo || 0), 0, 4);
  q.subGaragem = q.subsolo && q.garagemLocal !== 'terreo';
  q.vagasT = q.garagemLocal==='terreo' ? q.vagas : q.garagemLocal==='ambos' ? q.vagasTerreo : 0;
  return q;
}

/* ---------- Programa → listas de ambientes ---------- */
const BANHO_ACESSIVEL = {lado:2.40, comp:2.50};
function alvo(tipo, q){ const d = q.dims && q.dims[tipo]; if(d) return d.a; const t = TIPOS[tipo]; const a = t.alvo * (t.hab ? FATOR[q.tamanho] : 1);
  return q.acessivel && tipo === 'banhoSocial' ? Math.max(a, BANHO_ACESSIVEL.lado * BANHO_ACESSIVEL.comp) : a; }
/* Largura pedida para a faixa dos quartos (lado menor da suíte, da master ou do quarto), se houver. */
function larguraQuartoPedida(q){ const d = q.dims || {}; for(const t of ['suite','master','quarto']) if(d[t] && d[t].w) return d[t].w; return null; }

function programa(q){
  const mods = [];   // módulos da faixa íntima
  let id = 0;
  const nS = q.suites, nQ = q.quartos - q.suites;
  for(let i=0;i<nS;i++){
    const m = q.master && i===0;
    mods.push({tipo: m?'master':'suite', id: ++id, fixo: !!(q.dims && q.dims[m?'master':'suite'] && q.dims[m?'master':'suite'].w),
      aq: alvo(m?'master':'suite', q), ab: alvo(m?'banhoMaster':'banhoSuite', q), ac: alvo(m?'closetMaster':'closet', q)});
  }
  for(let i=0;i<nQ;i++) mods.push({tipo:'quarto', id: ++id, aq: alvo('quarto', q), fixo: !!(q.dims && q.dims.quarto && q.dims.quarto.w), acess: q.acessivel});
  let bs = q.banhosSociais;
  if(nQ>0 && bs>0){ mods.push({tipo:'banhoSocial', id: ++id, ab: alvo('banhoSocial', q), acess: q.acessivel}); bs--; }
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
  const sup = [];
  if(q.tipo==='sobrado'){
    // sobem primeiro a master e as suítes; o banho social acompanha os quartos simples
    const quartosM = mods.filter(m => m.tipo!=='banhoSocial'), banhoM = mods.filter(m => m.tipo==='banhoSocial');
    const k = q.supQuartos;
    const sobem = quartosM.slice(quartosM.length - k), ficam = quartosM.slice(0, quartosM.length - k);
    const simplesSobe = sobem.some(m => m.tipo==='quarto'), simplesFica = ficam.some(m => m.tipo==='quarto');
    const bS = [], bT = [];
    for(const b of banhoM){ if(simplesSobe && !bS.length) bS.push(b); else bT.push(b); }
    if(simplesFica && !bT.length && bs > 0){ bT.push({tipo:'banhoSocial', id:++id, ab:alvo('banhoSocial', q), acess: q.acessivel}); apoioEsq.splice(apoioEsq.indexOf('banhoSocial'), 1); }
    if(q.supEscritorio && social.includes('escritorio')){ social.splice(social.indexOf('escritorio'), 1); sup.push({tipo:'escritorio', id:++id, a:alvo('escritorio', q)}); }
    if(q.supTv && social.includes('tv')){ social.splice(social.indexOf('tv'), 1); sup.push({tipo:'tv', id:++id, a:alvo('tv', q), nome:'Sala íntima / TV'}); }
    if(q.supServico && apoioDir.includes('servico')){ apoioDir.splice(apoioDir.indexOf('servico'), 1); sup.push({tipo:'servico', id:++id, a:alvo('servico', q), nome:'Lavanderia'}); }
    sup.unshift(...bS); sup.push(...sobem);
    mods.length = 0; mods.push(...bT, ...ficam);
  }
  return {mods, social, apoioDir, apoioEsq, sup};
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
  if(m.a) return Math.max(TIPOS[m.tipo].lado || 2.4, m.a/ws);
  if(m.tipo==='banhoSocial') return Math.max(m.acess ? BANHO_ACESSIVEL.comp : 1.6, m.ab/ws);
  if(m.tipo==='quarto') return Math.max(m.acess ? 2.8 : TIPOS.quarto.lado, m.aq/ws);
  const tq = m.tipo==='master'?'master':'suite';
  const db = clamp((m.ab+m.ac)/ws, TIPOS[m.tipo==='master'?'banhoMaster':'banhoSuite'].lado+0.3, 3.2);
  return Math.max(TIPOS[tq].lado, m.aq/ws) + db;
}

/* Desenha um módulo no retângulo dado. ladoCorr: 'x0' ou 'x1' (lado do corredor). inv: banho no início (y0) do módulo. */
function desenhaModulo(m, x0, y0, x1, y1, ladoCorr, inv){
  const ws = x1-x0, out = [];
  if(m.a){ out.push(sala(m.tipo, x0,y0,x1,y1,{mod:m.id, nome:m.nome || TIPOS[m.tipo].nome})); return out; }
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
function faixaIntima(mods, tiras, y0, compMin, fixo){
  if(!tiras.length) throw new Error('sem tira para os quartos');
  // tiras: [{x0,x1,lado:'x0'|'x1'}] ; lado = lado em que fica o corredor
  const fila = tiras.map(() => []);
  const comp = tiras.map(() => 0);
  for(const m of mods){
    let k = 0; for(let i=1;i<tiras.length;i++) if(comp[i] < comp[k]-0.01) k = i;
    const ws = tiras[k].x1-tiras[k].x0;
    const L = compModulo(m, ws);
    fila[k].push({m, L}); comp[k] += L;
  }
  const Li = fixo ? compMin : Math.max(compMin||0, ...comp);
  const out = [];
  tiras.forEach((t,k) => {
    const f = fila[k]; if(!f.length){ if(Li>0.5) out.push(sala('deposito', t.x0, y0, t.x1, y0+Li, {nome:'Depósito / armários'})); return; }
    // estica no máximo 25 %; o que sobrar vira sala íntima ou rouparia no fim da tira
    // módulos com medida pedida não esticam; os demais esticam até 25 %; o resto vira sala íntima ou rouparia
    const X = f.filter(it => it.m.fixo).reduce((t,it) => t + it.L, 0), F = comp[k] - X;
    let escF = 1, escX = 1, sobra = 0;
    if(Li < comp[k] - 0.01){ escF = escX = Li/comp[k]; }
    else if(Li > comp[k] + 0.01){
      const extra = Li - comp[k];
      if(F > 0){ escF = Math.min(1.25, 1 + extra/F); sobra = Li - X - F*escF; if(sobra < 1.2){ escF = (Li - X)/F; sobra = 0; } }
      else { sobra = extra; if(sobra < 1.2){ escX = Li/comp[k]; sobra = 0; } }
    }
    let y = y0;
    const fim = y0 + Li - sobra;
    f.forEach((it,i) => {
      const L = i===f.length-1 ? fim-y : it.L*(it.m.fixo ? escX : escF);
      out.push(...desenhaModulo(it.m, t.x0, y, t.x1, y+L, t.lado, i%2===1));
      y += L;
    });
    if(sobra > 0) out.push(sala(sobra >= 2.4 && (t.x1-t.x0) >= 2.4 ? 'salaIntima' : 'rouparia', t.x0, fim, t.x1, y0+Li));
  });
  return {salas: out, Li};
}

/* ---------- Escada reta ---------- */
function escada(q){
  const n = Math.ceil(q.peDireito/0.18 - 1e-9);         // 2,70 / 0,18 = 15,000…02 em ponto flutuante: sem a folga, viravam 16 degraus
  const espelho = q.peDireito/n;
  // piso de 0,28 m; se 2e + p sair da faixa de Blondel (0,63–0,65 m), o piso é ajustado para entrar nela
  const piso = 2*espelho + 0.28 < 0.63 ? Math.ceil((0.63 - 2*espelho)*100)/100 : 2*espelho + 0.28 > 0.65 ? Math.floor((0.65 - 2*espelho)*100)/100 : 0.28;
  return {n, espelho: r2(espelho*1000)/1000, piso, L: r2((n-1)*piso), blondel: r2(2*espelho+piso)};
}

/* ---------- Sobrado: seções com dois pavimentos e montagem do superior ---------- */
function secoesEscolhidas(q, forma){
  if(q.supModo !== 'parcial') return {corresp:true, frente:true, meio:true, fundo:true, alaE:true, alaD:true};
  const s = {corresp:false, frente:!!q.secFrente, meio:true, fundo:!!q.secFundo, alaE:!!q.secAlaE, alaD:!!q.secAlaD};
  if(forma==='U' && s.alaD) s.frente = true;           // a ala de apoio só se liga ao superior pela frente
  return s;
}
function moduloFiller(q){ return {tipo:'salaIntima', id:9999, a:alvo('salaIntima', q)*1.5, nome:'Estar íntimo / estúdio'}; }

/* Distribui os módulos do superior em faixas de comprimento fixo (verticais 'v' ou horizontais 'h'). */
function superiorTiras(mods, tiras, av){
  const larg = t => t.o==='h' ? t.y1-t.y0 : t.x1-t.x0, comp = t => t.o==='h' ? t.x1-t.x0 : t.y1-t.y0;
  if(av && mods.length){
    const cap = tiras.reduce((t,x) => t + comp(x)*larg(x), 0);
    const pede = mods.reduce((t,m) => t + compModulo(m, 3.6)*3.6, 0);
    if(pede > cap*1.02) av.push(`Superior: as seções escolhidas têm ${f2(cap)} m² úteis, mas os cômodos levados para cima pedem cerca de ${f2(pede)} m². Marque mais seções com dois pavimentos ou leve menos cômodos.`);
  }
  const fila = tiras.map(() => []), usado = tiras.map(() => 0);
  for(const m of mods){
    let k = 0, melhor = -1e9;
    tiras.forEach((t,i) => { const sobra = comp(t) - usado[i] - compModulo(m, larg(t)); if(sobra > melhor){ melhor = sobra; k = i; } });
    fila[k].push(m); usado[k] += compModulo(m, larg(tiras[k]));
  }
  const out = [];
  tiras.forEach((t,i) => {
    if(!fila[i].length){ out.push(sala('terraco', t.x0, t.y0, t.x1, t.y1, {nome:'Terraço'})); return; }
    if(t.o==='h'){
      // faixa horizontal: monta transposta (x ↔ y) e devolve
      const lado = t.lado==='y1' ? 'x1' : 'x0';
      const r = faixaIntima(fila[i], [{x0:t.y0, x1:t.y1, lado}], t.x0, comp(t), true);
      for(const s of r.salas){ const a = [s.x0, s.y0, s.x1, s.y1]; s.x0 = a[1]; s.y0 = a[0]; s.x1 = a[3]; s.y1 = a[2]; }
      out.push(...r.salas);
    } else out.push(...faixaIntima(fila[i], [{x0:t.x0, x1:t.x1, lado:t.lado}], t.y0, comp(t), true).salas);
  });
  return out;
}

/* ---------- Tipologia linear (faixas: social → apoio → íntima) e em L ---------- */
function linear(q, P, W, modo, opts){
  opts = opts || {};
  const sobrado = q.tipo==='sobrado', temNucleo = q.subsolo || (q.elevador && sobrado);
  const empilha = !!opts.empilha && sobrado && temNucleo, temEscada = (sobrado && !empilha) || (q.rooftop && !sobrado && !temNucleo);
  const esc = (sobrado || q.subsolo || q.rooftop) ? escada(q) : null;
  const colw = empilha ? 0 : temEscada ? COL : C;
  const cw = temNucleo ? larguraNucleo(q) : 0;          // núcleo lateral (escada do subsolo e/ou elevador)
  const salas = [], av = [], abertos = [];
  const terreo = [];
  // garagem coberta no térreo
  let vagasDentro = 0, Wg = 0;
  if(q.garagem==='coberta' && q.vagasT>0){
    vagasDentro = q.vagasT;
    while(vagasDentro>0 && W - vagasDentro*VAGA_L < 4.2) vagasDentro--;
    Wg = vagasDentro*VAGA_L;
    if(vagasDentro < q.vagasT) av.push(`Só ${vagasDentro} de ${q.vagasT} vagas do térreo cabem cobertas na largura de ${f2(W)} m; as demais ficam descobertas no recuo frontal.`);
  }
  // faixa social
  const socialItens = P.social.map(t => ({tipo:t, a:alvo(t,q)}));
  if(temNucleo && !Wg){ const k = socialItens.findIndex(i => i.tipo==='estar'); if(k > 0) socialItens.unshift(socialItens.splice(k,1)[0]); }
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
    const ws = clamp(opts.ws || larguraQuartoPedida(q) || lq+0.6, 3.0, W-C-3.0);
    cxI = r2(ws); tiras = [{x0:0,x1:cxI,lado:'x1'}];
  }
  let cxA = r2(clamp(cxI, 0, W-colw));
  if((sobrado && q.elevador) || empilha) cxA = r2(cw);    // elevador: circulação toda na lateral, para chegar ao superior
  if(cxA < cw - 0.01) throw new Error('núcleo não cabe');
  // apoio
  const dir = P.apoioDir.map(t => ({tipo:t, a:alvo(t,q)}));
  const esq = P.apoioEsq.map(t => ({tipo:t, a:alvo(t,q)}));
  const wE = cxA - cw, wD = W - cxA - colw;
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
  const vL = Dv>0 && q.varandaForma==='L' ? Dv : 0;          // perna lateral da varanda em L
  if(Dv>0) terreo.push(sala('varanda', Wg, 0, W, Dv));
  if(vL) terreo.push(sala('varanda', W - vL, Dv, W, yA, {nome:'Varanda'}));
  if(Wg>0) terreo.push(sala('garagem', 0, 0, Wg, yA, {vagas:vagasDentro}));
  terreo.push(...faixa(Wg, yS, W - vL, yA, socialItens, 'x'));
  // monta faixa de apoio
  let celNucleo = null;
  if(temNucleo){
    celNucleo = nucleo(0, yA, cw, esc.L, q, empilha ? {desce:q.subsolo, sobe:true} : {desce:true, sobe: q.rooftop && !sobrado});
    terreo.push(...celNucleo);
    if(Da - esc.L > 0.3) terreo.push(sala('deposito', 0, yA+esc.L, cw, yA+Da, {nome:'Área técnica'}));
  }
  if(wE>0.5){ if(esq.length) terreo.push(...faixa(cw, yA, cxA, yA+Da, esq.reverse(), 'x')); else terreo.push(sala('deposito', cw, yA, cxA, yA+Da)); }
  if(wD>0.5){ if(dir.length) terreo.push(...faixa(cxA+colw, yA, W, yA+Da, empilha ? dir.slice().reverse() : dir, 'x')); else terreo.push(sala('deposito', cxA+colw, yA, W, yA+Da)); }
  let escRect = null;
  if(temEscada){
    const ey0 = yA + (Da - esc.L)/2;
    escRect = {x0:r2(cxA+C), y0:r2(ey0), x1:r2(cxA+COL), y1:r2(ey0+esc.L)};
    terreo.push(sala('hall', cxA, yA, cxA+C, yA+Da));
    terreo.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {sobe: true, esc}));
    if(escRect.y0 - yA > 0.3) terreo.push(sala('rouparia', cxA+C, yA, cxA+COL, escRect.y0, {nome:'Armário'}));
    if(yA+Da - escRect.y1 > 0.3) terreo.push(sala('rouparia', cxA+C, escRect.y1, cxA+COL, yA+Da, {nome:'Armário'}));
  } else if(colw > 0) terreo.push(sala('hall', cxA, yA, cxA+colw, yA+Da));

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
    // ---------- sobrado: o que ficou no térreo + superior por seções ----------
    const secoes = secoesEscolhidas(q, modo==='L' ? 'L' : 'bloco');
    const modsT = P.mods.slice();
    if(!modsT.length && modo==='L' && secoes.fundo) modsT.push(moduloFiller(q));
    let Dt0 = yI;
    if(modsT.length){
      if(empilha) throw new Error('empilhado sem corredor no térreo');
      const tirasT = (modo==='L' ? [{x0:0, x1:cxA, lado:'x1'}] : [{x0:0, x1:cxA, lado:'x1'}, {x0:cxA+C, x1:W, lado:'x0'}]).filter(t => t.x1-t.x0 >= 2.6);
      const fiT = faixaIntima(modsT, tirasT, yI, 0);
      terreo.push(...fiT.salas);
      terreo.push(sala('circ', cxA, yI, cxA+C, yI+fiT.Li));
      for(const t of (modo==='L' ? [] : [{x0:0,x1:cxA}])) if(t.x1-t.x0 > 0.05 && t.x1-t.x0 < 2.6) terreo.push(sala('rouparia', t.x0, yI, t.x1, yI+fiT.Li, {nome:'Armários'}));
      if(!(modo==='L') && cxA+C < W && (W-(cxA+C)) < 2.6) terreo.push(sala('rouparia', cxA+C, yI, W, yI+fiT.Li, {nome:'Armários'}));
      Dt0 = yI + fiT.Li;
    }
    const wing = modo==='L' ? cxA + C : W;                 // largura da parte de trás (ala do L)
    // faixas do superior
    const comElev = q.elevador && !empilha;
    const circX0 = empilha ? 1.0 : cxA, circX1 = empilha ? cw : cxA + C;
    const ladoX0 = empilha ? null : (cxA >= 2.6 && !comElev ? {x0:0, x1:cxA} : null);
    const ladoX1 = {x0: empilha ? cw : cxA + COL, x1: W};
    let ys0 = secoes.frente ? 0 : yA, ys1 = secoes.fundo ? Dt0 : yI;
    if(!P.sup.length) av.push('Nada foi marcado para o pavimento superior; ele ficou só com a circulação.');
    // superior correspondente: se os quartos pedirem mais comprimento, o térreo ganha varanda de fundos
    if(secoes.corresp){
      const est = faixaIntima(P.sup.length ? P.sup : [moduloFiller(q)], [ladoX0, ladoX1].filter(Boolean).map(t => Object.assign({lado:'x0'}, t)).filter(t => t.x1-t.x0 >= 2.6), 0, Math.max(Dt0, (escRect||celNucleo[0]).y1 + 1.0));
      ys1 = Math.max(Dt0, est.Li);
    }
    const tiras = [];
    const yLim = modo==='L' ? yI : ys1;                    // no L, o lado direito só existe na frente
    if(ladoX0) tiras.push({x0:ladoX0.x0, x1:ladoX0.x1, y0:ys0, y1:ys1, lado:'x1', o:'v'});
    if(ladoX1.x1 - ladoX1.x0 >= 2.6){
      if(modo==='L'){ if(yLim - ys0 > 1.0) tiras.push({x0:ladoX1.x0, x1:ladoX1.x1, y0:ys0, y1:yLim, lado:'x0', o:'v'}); }
      else tiras.push({x0:ladoX1.x0, x1:ladoX1.x1, y0:ys0, y1:ys1, lado:'x0', o:'v'});
    }
    if(!tiras.length) throw new Error('sem faixa para o superior');
    const sup = superiorTiras(P.sup, tiras, av);
    // circulação do superior
    if(empilha){
      const e = celNucleo.find(c => c.tipo==='escada'), el = celNucleo.find(c => c.tipo==='elevador');
      sup.push(sala('escada', e.x0, e.y0, e.x1, e.y1, {desce:true, esc, nucleo:true}));
      if(e.y0 - ys0 > 0.3) sup.push(sala('rouparia', 0, ys0, 1.0, e.y0, {nome:'Armário'}));
      if(ys1 - e.y1 > 0.3) sup.push(sala('rouparia', 0, e.y1, 1.0, ys1, {nome:'Armário'}));
      if(el){ sup.push(sala('elevador', el.x0, el.y0, el.x1, el.y1, {nucleo:true}));
        if(el.y0 - ys0 > 0.3) sup.push(sala('circ', 1.0, ys0, cw, el.y0, {nome:'Hall íntimo'}));
        if(ys1 - el.y1 > 0.3) sup.push(sala('circ', 1.0, el.y1, cw, ys1, {nome:'Hall íntimo'})); }
      else sup.push(sala('circ', 1.0, ys0, cw, ys1, {nome:'Hall íntimo'}));
    } else {
      sup.push(sala('circ', cxA, ys0, cxA+C, ys1, {nome:'Hall íntimo'}));
      sup.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {desce:true, esc}));
      const yCol = modo==='L' ? Math.min(ys1, yI) : ys1;
      // acima e abaixo da escada a coluna vira corredor, para os quartos do outro lado terem porta
      if(escRect.y0 - ys0 > 0.3) sup.push(sala('circ', cxA+C, ys0, cxA+COL, escRect.y0, {nome:'Hall íntimo'}));
      if(yCol - escRect.y1 > 0.3) sup.push(sala('circ', cxA+C, escRect.y1, cxA+COL, yCol, {nome:'Hall íntimo'}));
      // faixas estreitas demais para quartos viram terraço corrido ao longo do comprimento
      const estreita = (a, b, y1) => sup.push(b - a >= 1.2 ? sala('terraco', a, ys0, b, y1, {nome:'Terraço'}) : sala('rouparia', a, ys0, b, y1, {nome:'Armários'}));
      if(!ladoX0 && cxA > 0.05 && !comElev) estreita(0, cxA, ys1);
      if(ladoX1.x1 - ladoX1.x0 > 0.05 && ladoX1.x1 - ladoX1.x0 < 2.6) estreita(ladoX1.x0, ladoX1.x1, yLim);
      if(comElev){
        for(const c of celNucleo.filter(c => c.tipo!=='escada')) sup.push(sala(c.tipo, c.x0, c.y0, c.x1, c.y1, {nucleo:true}));
        const e = celNucleo.find(c => c.tipo==='escada');
        sup.push(sala('rouparia', e.x0, e.y0, e.x1, e.y1, {nome:'Vazio da escada'}));
        const ny0 = Math.min(...celNucleo.map(c=>c.y0)), ny1 = Math.max(...celNucleo.map(c=>c.y1));
        if(ny0 - ys0 > 0.3) sup.push(sala('rouparia', 0, ys0, cw, ny0, {nome:'Armários'}));
        if(ys1 - ny1 > 0.3) sup.push(sala('rouparia', 0, ny1, cw, ys1, {nome:'Armários'}));
      }
    }
    // térreo: completa sob o superior, se ele for mais comprido
    Dt = Dt0; var Dter = Dt0, Lsup = ys1;
    if(ys1 > Dt + 0.05){
      terreo.push(q.gourmet ? sala('gourmet', 0, Dt, wing, ys1) : sala('varanda', 0, Dt, wing, ys1, {nome:'Varanda de fundos'}));
      Dt = ys1;
    } else if(q.gourmet){
      const gD = clamp(alvo('gourmet',q)/wing, 2.5, 4.0);
      terreo.push(sala('gourmet', 0, Dt, wing, Dt+gD)); Dt += gD;
    }
    // lajes (cobertura do térreo sem superior em cima)
    if(ys0 > 0.3) sup.push(sala('terraco', 0, 0, W, ys0, {nome:'Laje'}));
    if(Dt - ys1 > 0.3) sup.push(sala('terraco', 0, ys1, wing, Dt, {nome:'Laje'}));
    pav.push({nome:'Térreo', salas: terreo});
    pav.push({nome:'Superior', salas: sup, secoes});
  }
  if(q.subsolo) pav.unshift(subsolo(q, W, Dt, celNucleo, av));
  return {tipologia: modo==='duplo'?'Bloco único, corredor central':modo==='simples'?'Bloco único, corredor lateral':'Em L',
    W:r2(W), D:r2(Dt), pav, avisos:av, escada:esc, garagemDentro:vagasDentro, Dter: typeof Dter!=='undefined'?Dter:null, Lsup: typeof Lsup!=='undefined'?Lsup:null,
    cotasY:[0, yS, yA, yI, Dt].filter((v,i,a)=>a.indexOf(v)===i)};
}

/* ---------- Tipologia em H: ala íntima | pátio + ligação (cozinha e serviço) | ala social ---------- */
function emH(q, P, W){
  const av = [];
  const lq = larguraQuartoPedida(q) ? clamp(larguraQuartoPedida(q) - 0.6, 2.6, 6.0) : clamp(Math.sqrt(alvo('suite',q)*1.25), 3.2, 4.6);
  const ws = r2(lq+0.6), wi = ws + C;
  let wsoc = 5.5;
  let vagasDentro = 0;
  if(q.garagem==='coberta' && q.vagasT>0){ vagasDentro = Math.min(q.vagasT, 2); wsoc = Math.max(wsoc, vagasDentro*VAGA_L); if(vagasDentro<q.vagasT) av.push(`Só ${vagasDentro} vagas cabem cobertas na ala social; as demais ficam no recuo frontal.`); }
  const wp = W - wi - wsoc;
  if(wp < 4.0) return null;
  const salas = [];
  // ala íntima, tira única com corredor do lado do pátio
  const escH = (q.subsolo || q.rooftop) ? escada(q) : null;
  const celNucleoH = escH ? nucleo(0, 0, ws, escH.L, q, {desce:q.subsolo, sobe:q.rooftop}) : null;
  if(celNucleoH) salas.push(...celNucleoH);
  const fi = faixaIntima(P.mods, [{x0:0, x1:ws, lado:'x1'}], escH ? escH.L : 0, 0);
  salas.push(...fi.salas);
  if(escH) fi.Li += escH.L;
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
  const pavH = [{nome:'Térreo', salas}];
  if(q.subsolo) pavH.unshift(subsolo(q, W, D, celNucleoH, av));
  return {tipologia:'Em H', W:r2(W), D:r2(D), pav:pavH, avisos:av, escada:escH, garagemDentro:vagasDentro,
    cotasY:[0, yb, yb+C+Db, D], patios:[{x0:wi, y0:0, x1:xs, y1:yb}, {x0:wi, y0:yb+C+Db, x1:xs, y1:D}]};
}

/* ---------- Tipologia em U: faixa social na frente; ala íntima e ala de apoio em volta de um pátio aberto para o fundo ---------- */
function emU(q, P, W){
  const av = [];
  const lq = larguraQuartoPedida(q) ? clamp(larguraQuartoPedida(q) - 0.6, 2.6, 6.0) : clamp(Math.sqrt(alvo('suite',q)*1.25), 3.2, 4.6);
  const ws = r2(lq+0.6), wi = ws + C;
  const apoio = [];
  for(const t of P.apoioDir) if(t!=='cozinha') apoio.push({tipo:t, a:alvo(t,q)});
  for(const t of P.apoioEsq) apoio.push({tipo:t, a:alvo(t,q)});
  const wa = 3.2;
  // faixa social: escritório, TV, estar, jantar, cozinha e garagem coberta no fim (lado do apoio)
  let vagasDentro = 0, Wg = 0;
  if(q.garagem==='coberta' && q.vagasT>0){
    vagasDentro = q.vagasT; while(vagasDentro>0 && W - vagasDentro*VAGA_L < 9) vagasDentro--;
    Wg = vagasDentro*VAGA_L;
    if(vagasDentro < q.vagasT) av.push(`Só ${vagasDentro} de ${q.vagasT} vagas cabem cobertas na faixa da frente; as demais ficam no recuo frontal.`);
  }
  const xR = W - Wg, xa = xR - wa, xg = xa - C;   // ala de apoio (sob a cozinha, ao lado da garagem) e sua galeria
  if(xg - wi < 3.0) return null;
  const itens = P.social.map(t => ({tipo:t, a:alvo(t,q)})).concat([{tipo:'cozinha', a:alvo('cozinha',q)}]);
  const aS = itens.reduce((t,i)=>t+i.a,0);
  const Dv = q.varanda ? 2.0 : 0;
  let Ds = clamp(aS/(W-Wg), 3.6, 6.5);
  if(Wg>0) Ds = Math.max(Ds, VAGA_P - Dv);
  const sobradoU = q.tipo==='sobrado', secU = secoesEscolhidas(q, 'U');
  if(sobradoU && secU.frente) Ds = Math.max(Ds, 4.0 + C);   // quartos sobre a frente + corredor
  const yb = Dv + Ds;
  const salas = [];
  const vLU = Dv>0 && q.varandaForma==='L' ? Dv : 0;
  if(Dv>0) salas.push(sala('varanda', 0, 0, W-Wg, Dv));
  if(vLU) salas.push(sala('varanda', 0, Dv, vLU, yb, {nome:'Varanda'}));
  salas.push(...faixa(vLU, Dv, W-Wg, yb, itens, 'x'));
  if(Wg>0) salas.push(sala('garagem', W-Wg, 0, W, yb, {vagas:vagasDentro}));
  // ala íntima à esquerda, corredor do lado do pátio; com subsolo, o núcleo abre a ala
  const temNucU = q.subsolo || sobradoU || q.rooftop;
  const esc = temNucU ? escada(q) : null;
  const celNucleo = temNucU ? nucleo(0, yb, ws, esc.L, q, {desce:q.subsolo, sobe:sobradoU || q.rooftop}) : null;
  if(celNucleo) salas.push(...celNucleo);
  const y0i = yb + (esc ? esc.L : 0);
  const modsU = P.mods.length ? P.mods : (sobradoU ? [moduloFiller(q)] : P.mods);
  const fi = faixaIntima(modsU, [{x0:0, x1:ws, lado:'x1'}], y0i, 0);
  salas.push(...fi.salas);
  salas.push(sala('circ', ws, yb, wi, y0i+fi.Li));
  fi.Li += y0i - yb;
  // ala de apoio à direita, com galeria do lado do pátio
  let La = 0;
  // um ambiente por linha, todos encostados na galeria
  for(const it of apoio){ const L = Math.max(TIPOS[it.tipo].lado||1.2, it.a/wa); salas.push(sala(it.tipo, xa, yb+La, xR, yb+La+L)); La += L; }
  if(q.gourmet){ const gL = clamp(alvo('gourmet',q)/wa, 3.0, 5.0); salas.push(sala('gourmet', xa, yb+La, xR, yb+La+gL)); La += gL; }
  if(La > 0) salas.push(sala('galeria', xg, yb, xa, yb+La));
  const D = yb + Math.max(fi.Li, La);
  const pavU = [{nome:'Térreo', salas}];
  if(sobradoU){
    const sup = [];
    for(const c of celNucleo) sup.push(c.tipo==='escada' ? sala('escada', c.x0, c.y0, c.x1, c.y1, {desce:true, esc, nucleo:true}) : sala(c.tipo, c.x0, c.y0, c.x1, c.y1, {nucleo:true}));
    const yNe = yb + esc.L, yE1 = yb + fi.Li;
    const tiras = [];
    if(!secU.frente && !secU.alaE) secU.alaE = true;
    if(secU.frente){ sup.push(sala('circ', 0, yb - C, W, yb, {nome:'Hall íntimo'})); tiras.push({x0:0, x1:W, y0:Dv, y1:yb - C, lado:'y1', o:'h'}); }
    else sup.push(sala('terraco', 0, Dv, W, yb, {nome:'Laje'}));
    if(secU.alaE){ sup.push(sala('circ', ws, yb, wi, yE1, {nome:'Hall íntimo'})); if(yE1 - yNe > 1.0) tiras.push({x0:0, x1:ws, y0:yNe, y1:yE1, lado:'x1', o:'v'}); }
    else { sup.push(sala('terraco', ws, yb, wi, yE1, {nome:'Laje'})); if(yE1 - yNe > 0.3) sup.push(sala('terraco', 0, yNe, ws, yE1, {nome:'Laje'})); }
    if(La > 0){ if(secU.alaD){ sup.push(sala('circ', xg, yb, xa, yb+La, {nome:'Galeria'})); tiras.push({x0:xa, x1:xR, y0:yb, y1:yb+La, lado:'x0', o:'v'}); }
      else sup.push(sala('terraco', xg, yb, xR, yb+La, {nome:'Laje'})); }
    if(!P.sup.length) av.push('Nada foi marcado para o pavimento superior; ele ficou só com a circulação.');
    sup.push(...superiorTiras(P.sup, tiras, av));
    pavU.push({nome:'Superior', salas:sup, secoes:secU});
  }
  if(q.subsolo) pavU.unshift(subsolo(q, W, D, celNucleo, av));
  return {tipologia:'Em U', W:r2(W), D:r2(D), pav:pavU, avisos:av, escada:esc, garagemDentro:vagasDentro,
    cotasY:[0, Dv, yb, D].filter((v,i,a)=>a.indexOf(v)===i), patios:[{x0:wi, y0:yb, x1:La>0?xg:xa, y1:D}]};
}

/* ---------- Anexos no quintal: edícula, varanda gourmet destacada e piscina ---------- */
function edicula(q){
  const dois = q.edicula==='2';
  const esc = dois ? escada(q) : null;
  const De = r2(dois ? Math.max(4.5, esc.L + 0.4) : 4.0);
  const wDep = q.edDeposito ? 1.8 : 0, wBan = q.edBanho ? 1.6 : 0, wGou = q.edGourmet ? Math.max(3.6, r2(16/De)) : 0;
  const wQua = (!dois && q.edQuarto) ? 3.2 : 0, wEsc = dois ? 1.0 : 0;
  const ter = [], sup = [], pT = [], pS = [], jT = [], jS = [], vT = [], vS = [];
  let x = 0;
  const col = {};
  const ordem = dois ? ['dep','ban','gou','esc'] : ['dep','gou','ban','qua'];
  const larg = {dep:wDep, ban:wBan, gou:wGou, qua:wQua, esc:wEsc};
  for(const k of ordem){ if(larg[k] > 0){ col[k] = [x, x+larg[k]]; x += larg[k]; } }
  const W = r2(x);
  if(W <= 0) return null;
  const S = (t, k, extra) => sala(t, col[k][0], 0, col[k][1], De, extra);
  if(col.dep) ter.push(S('deposito', 'dep', {nome:'Depósito / lavanderia'}));
  if(col.gou) ter.push(S('gourmet', 'gou', {nome:'Gourmet'}));
  if(col.ban) ter.push(S('banhoSocial', 'ban', {nome:'Banho'}));
  if(col.qua) ter.push(S('quarto', 'qua', {nome:'Quarto / estúdio'}));
  let escRect = null;
  if(dois){
    const e0 = col.esc[0], ey0 = r2((De - esc.L)/2);
    escRect = {x0:r2(e0), y0:ey0, x1:r2(e0+1.0), y1:r2(ey0+esc.L)};
    ter.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {sobe:true, esc}));
    if(escRect.y0 > 0.3) ter.push(sala('rouparia', e0, 0, e0+1.0, escRect.y0, {nome:'Armário'}));
    if(De - escRect.y1 > 0.3) ter.push(sala('rouparia', e0, escRect.y1, e0+1.0, De, {nome:'Armário'}));
    // superior: quarto sobre a gourmet, banho exatamente sobre o banho de baixo, terraço sobre o depósito
    if(col.dep) sup.push(sala('terraco', col.dep[0], 0, col.dep[1], De, {nome:'Terraço'}));
    if(col.ban) sup.push(sala('banhoSocial', col.ban[0], 0, col.ban[1], De, {nome:'Banho'}));
    sup.push(sala('quarto', col.gou[0], 0, col.gou[1], De, {nome:'Quarto de hóspedes'}));
    sup.push(sala('escada', escRect.x0, escRect.y0, escRect.x1, escRect.y1, {desce:true, esc}));
    if(escRect.y0 > 0.3) sup.push(sala('rouparia', e0, 0, e0+1.0, escRect.y0, {nome:'Armário'}));
    if(De - escRect.y1 > 0.3) sup.push(sala('rouparia', e0, escRect.y1, e0+1.0, De, {nome:'Armário'}));
  }
  // portas, vãos e janelas explícitos (frente da edícula em y = 0, voltada para a casa)
  const find = (L, t) => L.find(o => o.tipo===t);
  const ext = (sl, t0, w) => ({o:'h', c:0, t0:r2(t0), t1:r2(t0+w), sala:sl.id, dentro:1});
  const lig = (L, a, b, w, P) => { const sa = find(L,a), sb = find(L,b); if(sa && sb){ const sh = compartilhado(sa, sb); if(sh) P.push(porta(sa, sb, sh, w)); } };
  const tDep = find(ter,'deposito'), tGou = find(ter,'gourmet'), tBan = find(ter,'banhoSocial'), tQua = find(ter,'quarto');
  if(tDep) pT.push(ext(tDep, tDep.x0 + 0.4, 0.8));
  if(tBan && tGou) lig(ter, 'banhoSocial', 'gourmet', 0.7, pT); else if(tBan) pT.push(ext(tBan, tBan.x0+0.4, 0.7));
  if(tBan && tQua) lig(ter, 'banhoSocial', 'quarto', 0.7, pT);
  if(tQua) pT.push(ext(tQua, tQua.x1 - 1.1, 0.8));
  const jan = (sl, lado, alta, w) => { const hz = lado[0]==='y'; const L = hz ? sl.x1-sl.x0 : sl.y1-sl.y0; w = Math.min(w, L-0.3); const m = hz ? (sl.x0+sl.x1)/2 : (sl.y0+sl.y1)/2;
    return {o: hz ? 'h' : 'v', c: sl[lado], t0:r2(m-w/2), t1:r2(m+w/2), alta}; };
  if(tBan) jT.push(jan(tBan, 'y1', true, 0.6));
  if(tDep) jT.push(jan(tDep, 'y1', true, 0.8));
  if(tQua) jT.push(jan(tQua, 'y1', false, 1.5));
  if(dois){
    // a escada se abre direto para a gourmet e, em cima, para o quarto
    const eT = find(ter,'escada'); if(eT && tGou){ const sh = compartilhado(eT, tGou); if(sh) vT.push({o:sh.o, c:sh.c, t0:sh.t0, t1:sh.t1, livre:true, a:eT.id, b:tGou.id}); }
    const sBan = find(sup,'banhoSocial'), sQua = find(sup,'quarto'), eS = find(sup,'escada');
    if(sBan && sQua) lig(sup, 'banhoSocial', 'quarto', 0.7, pS);
    if(eS && sQua){ const sh = compartilhado(eS, sQua); if(sh) vS.push({o:sh.o, c:sh.c, t0:sh.t0, t1:sh.t1, livre:true, a:eS.id, b:sQua.id}); }
    if(sBan) jS.push(jan(sBan, 'y1', true, 0.6));           // mesma prumada da janela do banho de baixo
    jS.push(jan(sQua, 'y0', false, 1.8)); jS.push(jan(sQua, 'y1', false, 1.2));
  }
  const pav = [{nome:'Edícula térreo', anexo:true, fixo:true, W, D:De, salas:ter, portas:pT, janelas:jT, vaos:vT}];
  if(dois) pav.push({nome:'Edícula superior', anexo:true, fixo:true, W, D:De, salas:sup, portas:pS, janelas:jS, vaos:vS});
  return {W, D:De, pav, dois};
}

function comAnexos(v, q){
  const B = q.frente - q.recX0 - q.recX1;
  v.x0 = r2(q.recX0 + (B - v.W)/2); v.y0 = q.recFrente;
  v.pav = v.pav.filter(p => !p.anexo);
  v.avisos = (v.avisosBase = v.avisosBase || (v.avisos||[]).slice()).slice();
  // o espelho vira os anexos dentro desta faixa
  v.faixaAnexos = {x0:q.recX0, x1:r2(q.frente - q.recX1)};
  const itens = []; v.anexos = itens; v.anexoFalta = 0; v.anexoProf = 0; v.anexoLarg = 0;
  const quer = q.piscina || q.gourmetDest || q.edicula!=='nenhuma';
  if(!quer) return v;
  const sub = v.pav.find(p => p.nome==='Subsolo');
  const xq0 = q.recX0, xq1 = q.frente - q.recX1, yq0 = Math.max(v.y0 + v.D + q.afastAnexo, sub ? v.y0 + sub.dim.y0 + sub.dim.D + 2.5 : 0);
  const yq1 = q.fundo - (q.anexoFundo ? 0 : q.recFundo);
  const ed = q.edicula!=='nenhuma' ? edicula(q) : null;
  if(ed) v.pav.push(...ed.pav);
  // linha próxima da casa: piscina (com deck) e gourmet destacada
  const linha = [];
  if(q.piscina){ const pr = q.pisPrainha ? 1.5 : 0, deck = 1.2; linha.push({tipo:'piscina', w: q.pisC + pr + 2*deck, h: q.pisL + 2*deck, deck, pr}); }
  if(q.gourmetDest) linha.push({tipo:'gourmetDest', w:4.4, h:4.0});
  const Wq = xq1 - xq0;
  let y = yq0, hl = 0, x = xq0;
  const fila = [];
  for(const it of linha){
    if(x + it.w > xq1 + 0.01 && x > xq0){ y += hl + 1.5; hl = 0; x = xq0; }
    fila.push(Object.assign(it, {x0:r2(x), y0:r2(y), x1:r2(x+it.w), y1:r2(y+it.h)}));
    if(it.w > Wq + 0.01){ v.anexoLarg = (v.anexoLarg||0) + it.w - Wq; } if(it.w > Wq + 0.01) v.avisos.push(`O ${it.tipo==='piscina'?'conjunto de piscina e deck':'gourmet destacado'} (${f2(it.w)} m) é mais largo que o quintal (${f2(Wq)} m).`);
    x += it.w + 1.5; hl = Math.max(hl, it.h);
  }
  let fim = fila.length ? y + hl : yq0;
  let nec = fim;                                   // profundidade mínima necessária, com tudo encostado
  if(ed){
    nec = (fila.length ? fim + 1.5 : yq0) + ed.D;
    const ey0 = Math.max(fila.length ? fim + 1.5 : yq0, yq1 - ed.D);
    itens.push({tipo:'edicula', x0:r2(xq1 - ed.W), y0:r2(ey0), x1:r2(xq1), y1:r2(ey0+ed.D), dois:ed.dois});
    if(ed.W > Wq + 0.01){ v.anexoLarg = (v.anexoLarg||0) + ed.W - Wq; } if(ed.W > Wq + 0.01) v.avisos.push(`A edícula (${f2(ed.W)} m) é mais larga que o quintal (${f2(Wq)} m).`);
    fim = ey0 + ed.D;
  }
  for(const it of fila) itens.push(it);
  const pi = itens.find(i => i.tipo==='piscina');
  if(pi){
    pi.forma = q.pisForma; pi.C = q.pisC; pi.L = q.pisL; pi.P = q.pisP;
    const lam = q.pisForma==='oval' ? Math.PI*q.pisC*q.pisL/4 : q.pisForma==='L' ? q.pisC*q.pisL - (q.pisC*0.4)*(q.pisL*0.45) : q.pisC*q.pisL;
    pi.lamina = r2(lam + pi.pr*q.pisL); pi.volume = r2(lam*q.pisP + pi.pr*q.pisL*0.3);
  }
  v.anexoProf = r2(nec - (v.y0 + v.D));
  if(nec > yq1 + 0.01){ v.anexoFalta = r2(nec - yq1); v.avisos.push(`Os anexos precisam de ${f2(v.anexoProf)} m atrás da casa; o quintal tem ${f2(Math.max(0, yq1 - v.y0 - v.D))} m.`); }
  return v;
}

/* ---------- Núcleo vertical lateral: escada (encostada na parede), elevador opcional e hall ---------- */
const ELEV = 1.60;
function larguraNucleo(q){ return q.elevador ? 2.6 : 2.2; }
function nucleo(x0, y0, w, L, q, flags){
  const out = [], esc = escada(q);
  out.push(sala('escada', x0, y0, x0+1.0, y0+L, Object.assign({esc, nucleo:true}, flags||{})));
  if(q.elevador){
    const ye = y0 + L - ELEV;
    out.push(sala('hall', x0+1.0, y0, x0+w, ye, {nucleo:true}));
    out.push(sala('elevador', x0+1.0, ye, x0+1.0+ELEV, y0+L, {nucleo:true}));
    if(w - (1.0+ELEV) > 0.5) out.push(sala('hall', x0+1.0+ELEV, ye, x0+w, y0+L, {nucleo:true}));
  } else out.push(sala('hall', x0+1.0, y0, x0+w, y0+L, {nucleo:true}));
  return out;
}
/* Copia as células do núcleo para outro pavimento (mesma posição), com outro sentido de escada. */
function copiaNucleo(cel, flags){
  return cel.map(c => sala(c.tipo, c.x0, c.y0, c.x1, c.y1, Object.assign({esc:c.esc, nucleo:true}, c.tipo==='escada' ? flags : {})));
}

/* ---------- Subsolo: manobra contínua, núcleo na lateral, rampa do lado oposto, jardim de inverno no fundo ---------- */
function subsolo(q, W0, D0, cel0, av){
  // quanto o subsolo avança sobre os recuos, conforme a opção escolhida
  const B = q.frente - q.recX0 - q.recX1, lat = q.subRecuos!=='nenhum', fundoLivre = q.subRecuos!=='nenhum';
  const xL = lat ? r2(q.recX0 + (B - W0)/2) : 0, xR = lat ? r2(q.frente - (q.recX0 + (B - W0)/2) - W0) : 0;
  const yF = q.subRecuos==='todos' ? q.recFrente : 0;
  let W = r2(W0 + xL + xR); const D = r2(D0 + yF);
  let cel = cel0.map(c => Object.assign({}, c, {x0:c.x0+xL, x1:c.x1+xL, y0:c.y0+yF, y1:c.y1+yF}));
  // o subsolo começa no núcleo (parede lateral da casa) e só cresce até onde as vagas pedidas exigem
  const X0 = r2(Math.min(...cel.map(c => c.x0)));
  cel = cel.map(c => Object.assign({}, c, {x0:r2(c.x0-X0), x1:r2(c.x1-X0)}));
  const Wfull = r2(W - X0); W = Wfull;
  const recuoEsq = r2(q.recX0 + (B - W0)/2);                    // faixa livre entre a parede da casa e a divisa
  if(lat) av.push(q.subRecuos==='todos' ? 'Subsolo ocupa todos os recuos: vai da frente ao fundo do lote e de divisa a divisa.' : 'Subsolo ocupa os recuos laterais e de fundo (de divisa a divisa).');
  const salas = [];
  const h = q.subNivel==='meio' ? 1.40 : q.peDireito + 0.20;
  const Lr = r2(h / (q.inclinacao/100));
  const Lin = q.subGaragem ? Math.max(0, r2(Lr - (q.recFrente - yF))) : 0;
  if(q.subNivel==='meio') av.push('Subsolo semienterrado: o térreo fica 1,40 m acima da rua, com escada ou rampa de acesso na frente.');
  const nx0 = Math.min(...cel.map(c => c.x0)), nx1 = Math.max(...cel.map(c => c.x1)), ny0 = Math.min(...cel.map(c => c.y0)), ny1 = Math.max(...cel.map(c => c.y1));
  const nucleoEsq = true;
  let rx0, rx1;                                                  // rampa no lado oposto ao núcleo
  const fixaLargura = wt => { W = wt; rx0 = W - RAMPA_L; rx1 = W; };
  fixaLargura(Wfull);
  salas.push(...copiaNucleo(cel, {sobe:true}));
  // ---------- garagem: o máximo de vagas de 3,00 × 5,00 m, manobra contínua e sem depósito ----------
  const VW = 3.0, VP = 5.0;
  const limLote = yF + q.fundo - q.recFrente - (fundoLivre ? 2.0 : Math.max(q.recFundo, 2.0));   // fundo do lote menos jardim (ou recuo de fundo)
  // no cálculo do terreno mínimo (subMin) o subsolo fica sob a casa; no projeto ocupa o que o lote permite
  const limite = q.subMin ? Math.min(limLote, Math.max(D, ny1)) : limLote;
  const obsN = {x0:nx0, y0:ny0, x1:nx1, y1:ny1};
  const obsRf = () => Lin > 0 ? {x0:rx0, y0:0, x1:rx1, y1:Lin} : null;
  let obsR = obsRf();
  const corta = ex => {                                         // intervalos livres em x
    let iv = [[0, W]];
    for(const [a,b] of ex) iv = iv.flatMap(([m,n]) => { const o = []; if(a > m) o.push([m, Math.min(n,a)]); if(b < n) o.push([Math.max(m,b), n]); return o.filter(([u,w]) => w-u > 0.3); });
    return iv;
  };
  // monta o plano de faixas para uma posição da primeira manobra
  function plano(yl, nB){
    const f = [];
    if(yl >= VP - 0.01){ if(yl - VP > 0.3) f.push({y0:0, y1:yl-VP, t:'livre'}); f.push({y0:yl-VP, y1:yl, t:'vagas', face:yl}); }
    else if(yl > 0.3) f.push({y0:0, y1:yl, t:'livre'});
    f.push({y0:yl, y1:yl+MANOBRA, t:'manobra'});
    let y = yl + MANOBRA;
    f.push({y0:y, y1:y+VP, t:'vagas', face:y}); y += VP;
    const lim = Math.max(limite, y);
    let corredor = null, blocos = 0;
    while(blocos < nB && lim - y >= VP + MANOBRA - 0.01){ blocos++;                      // fileira de costas + nova manobra (+ fileira do outro lado)
      f.push({y0:y, y1:y+VP, t:'vagas', face:y+VP}); y += VP;
      f.push({y0:y, y1:y+MANOBRA, t:'manobra'});
      corredor = {x0:rx0, x1:rx1, y0:yl+MANOBRA, y1:y};
      y += MANOBRA;
      if(lim - y >= VP - 0.01){ f.push({y0:y, y1:y+VP, t:'vagas', face:y}); y += VP; }
    }
    const fim = Math.max(y, ny1);
    if(fim - y > 0.3) f.push({y0:y, y1:fim, t:'livre'});
    const acesso = q.subGaragem && Lin > 0 && yl > Lin + 0.3 ? {x0:rx0, x1:rx1, y0:Lin, y1:yl} : null;
    return {f, fim, corredor, blocos, acesso};
  }
  const obstaculos = pl => [obsN].concat(obsRf() ? [obsRf()] : [], pl.corredor ? [pl.corredor] : [], pl.acesso ? [pl.acesso] : []);
  const contaVagas = pl => pl.f.filter(b => b.t==='vagas').reduce((t,b) => t + corta(obstaculos(pl).filter(o => o.y0 < b.y1-0.001 && o.y1 > b.y0+0.001).map(o => [o.x0, o.x1])).reduce((u,[m,n]) => u + Math.floor((n-m+0.001)/VW), 0), 0);
  // vagas perpendiculares ao comprimento do lote: corredor de manobra de 5 m ao longo do lote, no prumo da rampa,
  // com uma fileira de vagas (carro no sentido da frente) junto ao núcleo e, se couber, outra do lado da rampa
  const teto = q.subVagasMax || 0;
  function planoLongo(cols){
    const ax0 = VP, ax1 = 2*VP, y0 = r2(Math.max(Lin, 0)), vagas = [];
    const colunas = [{x0:0, x1:VP, face:ax0}].concat(cols===2 ? [{x0:ax1, x1:ax1 + VP, face:ax1}] : []);
    for(const cl of colunas){
      let y = y0;
      while(y + VW <= limite + 0.001){
        if(cl.x0 < nx1 - 0.001 && ny0 < y + VW - 0.001 && ny1 > y + 0.001){ y = r2(Math.max(y + 0.01, ny1)); continue; }
        vagas.push({x0:cl.x0, x1:cl.x1, y0:r2(y), y1:r2(y + VW), face:cl.face}); y += VW;
      }
    }
    if(teto && vagas.length > teto){ vagas.sort((a,b) => a.y0 - b.y0 || a.x0 - b.x0); vagas.length = teto; }
    const fim = r2(Math.max(ny1, y0 + VW, ...vagas.map(v => v.y1)));
    return {vagas, fim, y0, ax0, ax1, rx0:r2(ax1 - RAMPA_L), rx1:ax1};
  }
  // retângulos livres de um retângulo 0..Wr × 0..Hr, tirados os ocupados (faixas em y, unidas quando iguais)
  function sobras(Wr, Hr, ocup){
    const ys = [...new Set([0, Hr, ...ocup.flatMap(o => [o.y0, o.y1]).filter(y => y > 0 && y < Hr)])].sort((a,b) => a-b), out = [];
    let abertos = [];
    for(let i=0;i<ys.length-1;i++){ const a = ys[i], b = ys[i+1]; if(b - a < 0.001) continue;
      let iv = [[0, Wr]];
      for(const o of ocup.filter(o => o.y0 < b - 0.001 && o.y1 > a + 0.001)) iv = iv.flatMap(([m,n]) => { const r = []; if(o.x0 > m) r.push([m, Math.min(n, o.x0)]); if(o.x1 < n) r.push([Math.max(m, o.x1), n]); return r.filter(([u,w]) => w-u > 0.001); });
      const prox = [];
      for(const [m,n] of iv){ const c = abertos.find(r => Math.abs(r.x0-m) < 0.001 && Math.abs(r.x1-n) < 0.001); if(c){ c.y1 = b; prox.push(c); } else { const r = {x0:m, x1:n, y0:a, y1:b}; out.push(r); prox.push(r); } }
      abertos = prox;
    }
    return out.filter(r => r.x1 - r.x0 > 0.3 && r.y1 - r.y0 > 0.3);
  }
  let yl = null, pl = null, longo = null;
  if(q.subGaragem){
    const cands = [];
    if(ny0 - MANOBRA >= Lin - 0.001) cands.push(r2(ny0 - MANOBRA));      // núcleo no começo da fileira de vagas
    cands.push(r2(Math.max(Lin, ny1)));                                     // manobra logo depois do núcleo
    const larguras = [], passoL = Wfull - Math.max(nx1 + RAMPA_L, 6) > 10 ? 1 : 0.5; for(let w = Math.max(nx1 + RAMPA_L, 6); w < Wfull - 0.01; w += passoL) larguras.push(r2(w)); larguras.push(Wfull);
    // regra de 05/10/2026: com subsolo vale o máximo de vagas que cabe (o campo de vagas não conta);
    // empate: vagas perpendiculares ao comprimento do lote e, depois, o menor subsolo
    const melhorQue = (a, b) => a.cabe !== b.cabe ? a.cabe : a.n !== b.n ? a.n > b.n : !!a.longo !== !!b.longo ? !!a.longo : a.custo < b.custo - 0.01;
    let melhor = null;
    for(const wt of larguras){ fixaLargura(wt);
      for(const c of cands) for(let nB = 0; nB <= 4; nB++){
        const p0 = plano(c, nB), n = contaVagas(p0), cabe = p0.fim <= limite + 0.01;
        const cand = {wt, c, nB, p0, n: teto ? Math.min(n, teto) : n, cabe, custo: wt * p0.fim};
        if(!melhor || melhorQue(cand, melhor)) melhor = cand;
        if(p0.blocos < nB) break;                                  // mais blocos não cabem: as próximas tentativas repetiriam esta
      }
    }
    for(const cols of [1, 2]){ const wt = r2(VP*(cols + 1)); if(wt > Wfull + 0.01) continue;
      const lg = planoLongo(cols), cand = {wt, longo:lg, n:lg.vagas.length, cabe: lg.fim <= limite + 0.01, custo: wt * lg.fim};
      if(cand.n && melhorQue(cand, melhor)) melhor = cand; }
    if(melhor.longo){
      const lg = melhor.longo; W = melhor.wt; rx0 = lg.rx0; rx1 = lg.rx1; obsR = obsRf(); longo = lg;
      pl = {f:[], fim:lg.fim, corredor:null}; yl = lg.y0;
    } else {
      fixaLargura(melhor.wt); obsR = obsRf(); melhor.p0 = plano(melhor.c, melhor.nB);
      yl = melhor.c; pl = melhor.p0;
    }
    if(!melhor.cabe) av.push(`Subsolo: a garagem precisa de ${f2(pl.fim - yF + 2.0)} m a partir do recuo frontal, mais do que o lote permite com os recuos escolhidos.`);
  } else { fixaLargura(Math.min(Wfull, Math.max(nx1, 3))); obsR = null; pl = {f:[], fim:ny1, corredor:null}; }
  if(obsR) salas.push(sala('rampa', rx0, 0, rx1, Lin, {inclinacao:q.inclinacao}));
  if(pl.corredor) salas.push(sala('manobra', pl.corredor.x0, pl.corredor.y0, pl.corredor.x1, pl.corredor.y1, {nome:'Corredor de manobra'}));
  if(pl.acesso) salas.push(sala('manobra', pl.acesso.x0, pl.acesso.y0, pl.acesso.x1, pl.acesso.y1, {nome:'Acesso à manobra'}));
  const livres = [];
  let vagasOk = 0;
  let Dsub = pl.fim;
  if(Dsub > D + 0.01) av.push(`Subsolo avança ${f2(Dsub - D)} m além da projeção da casa, sob o quintal, para caber as vagas.`);
  const obsT = obstaculos(pl);
  if(longo){
    salas.push(sala('manobra', longo.ax0, longo.y0, longo.ax1, Dsub));
    for(const g of longo.vagas){ vagasOk++; salas.push(sala('garagem', g.x0, g.y0, g.x1, g.y1, {nome:'Vaga '+vagasOk, vaga:1, face:g.face})); }
    const ocup = [obsN, {x0:longo.ax0, y0:longo.y0, x1:longo.ax1, y1:Dsub}].concat(obsR ? [obsR] : [], longo.vagas);
    livres.push(...sobras(W, Dsub, ocup));
  }
  for(const b of pl.f){
    if(b.t==='manobra'){ salas.push(sala('manobra', 0, b.y0, W, b.y1)); continue; }
    const toca = obsT.filter(o => o.y0 < b.y1-0.001 && o.y1 > b.y0+0.001);
    if(b.t==='vagas'){
      // obstáculos tirados na altura toda da fileira; sobras acima/abaixo deles viram área técnica
      for(const o of toca){ if(o === pl.corredor) continue; if(o.y0 - b.y0 > 0.3) livres.push({x0:o.x0, y0:b.y0, x1:o.x1, y1:o.y0}); if(b.y1 - o.y1 > 0.3) livres.push({x0:o.x0, y0:o.y1, x1:o.x1, y1:b.y1}); }
      for(const [a,c] of corta(toca.map(o => [o.x0, o.x1]))){
        const n = Math.floor((c-a+0.001)/VW), sobra = (c-a) - n*VW;
        let x = a;                                               // centraliza as vagas quando a sobra dá dois pedaços úteis
        if(sobra > 0.6){ x = a + sobra/2; livres.push({x0:a, y0:b.y0, x1:a+sobra/2, y1:b.y1}); livres.push({x0:c-sobra/2, y0:b.y0, x1:c, y1:b.y1}); }
        else if(sobra > 0.3) livres.push({x0:a + n*VW, y0:b.y0, x1:c, y1:b.y1});
        for(let i=0;i<n;i++){
          if(teto && vagasOk >= teto){ livres.push({x0:x, y0:b.y0, x1:a + n*VW + (sobra > 0.6 ? sobra/2 : 0), y1:b.y1}); break; }
          salas.push(sala('garagem', x, b.y0, x+VW, b.y1, {nome:'Vaga '+(vagasOk+1), vaga:1, face:b.face})); x += VW; vagasOk++; }
      }
      continue;
    }
    // faixa livre: corta nos limites dos obstáculos
    const ys = [b.y0, b.y1]; for(const o of toca){ for(const y of [o.y0, o.y1]) if(y > b.y0+0.001 && y < b.y1-0.001) ys.push(y); }
    ys.sort((m,n) => m-n);
    for(let i=0;i<ys.length-1;i++){ const a = ys[i], c = ys[i+1]; if(c - a < 0.3) continue;
      const cobre = toca.filter(o => o.y0 <= a+0.001 && o.y1 >= c-0.001);
      for(const [m,n] of corta(cobre.map(o => [o.x0, o.x1]))) livres.push({x0:m, y0:a, x1:n, y1:c}); }
  }
  if(yl !== null) av.push(`Subsolo com ${vagasOk} vagas de 3,00 × 5,00 m, ${teto ? `limitado a ${teto} pelo teto pedido` : 'o máximo que cabe'}${longo ? ', perpendiculares ao comprimento do lote, dos dois lados de um corredor de manobra' : ''}: ${f2(W)} × ${f2(Dsub)} m.`.replace(', dos dois lados de um corredor', longo && longo.vagas.some(g => g.x0 > 0) ? ', dos dois lados de um corredor' : ', ao lado de um corredor'));
  // jardim de inverno sempre a céu aberto: no fundo, se o subsolo passa da casa; senão no recuo lateral
  let ladoJardim;
  if(Dsub < D - 0.01 && recuoEsq < 1.2){
    livres.push({x0:0, y0:Dsub, x1:W, y1:D});
    av.push('Subsolo estendido até o fundo da casa: o recuo lateral é estreito demais para o jardim de inverno.');
    Dsub = D;
  }
  if(Dsub >= D - 0.01){ salas.push(sala('jardim', 0, Dsub, W, Dsub + 2.0)); ladoJardim = 'y1'; }
  else { const jw = Math.min(2.0, recuoEsq); salas.push(sala('jardim', -jw, 0, 0, Dsub)); ladoJardim = 'x0'; }
  for(const rr of livres) salas.push(sala('manobra', rr.x0, rr.y0, rr.x1, rr.y1, {nome:'Circulação', livre:1}));
  const pocos = [];
  av.push(q.subNivel==='inteiro' ? 'Subsolo enterrado: luz e ventilação cruzada entre a boca da rampa e o jardim de inverno.' : 'Subsolo semienterrado: janelas altas nas faces externas e jardim de inverno oposto à rampa.');
  // pilares: perímetro e linhas entre vagas, nunca nas faixas de manobra nem no corredor
  const pil = [], vao = q.vaoMax || 10;
  const addPil = (x, y) => { if(!pil.some(p => Math.abs(p.x-x)<0.3 && Math.abs(p.y-y)<0.3)) pil.push({x:r2(x), y:r2(y)}); };
  const ao = (a, b, n) => { const k = Math.max(1, Math.ceil((b-a)/n)); return Array.from({length:k+1}, (_,i) => a + (b-a)*i/k); };
  for(const x of ao(0, W, vao)){ addPil(x, 0); addPil(x, Dsub); }
  for(const y of ao(0, Dsub, vao)){ addPil(0, y); addPil(W, y); }
  const linhasY = [];
  const manobras = pl.f.filter(b => b.t==='manobra').concat(pl.corredor ? [Object.assign({t:'corredor'}, pl.corredor)] : [], longo ? [{t:'corredor', x0:longo.ax0, x1:longo.ax1, y0:longo.y0, y1:Dsub}] : []);
  const dentroDe = (c, x, y) => c && x > c.x0 - 0.2 && x < c.x1 + 0.2 && y > c.y0 && y < c.y1;
  const noCorredor = (x, y) => dentroDe(pl.corredor, x, y) || dentroDe(pl.acesso, x, y);
  const naRampa = (x, y) => obsR && x > rx0 + 0.2 && x < rx1 - 0.2 && y < Lin;
  if(longo){
    // vagas perpendiculares: pilares na face de cada fileira voltada para o corredor, a cada duas vagas (6 m); o corredor e a rampa ficam livres
    for(let i = pil.length - 1; i >= 0; i--) if(pil[i].x > longo.ax0 + 0.2 && pil[i].x < longo.ax1 - 0.2) pil.splice(i, 1);
    for(const fx of [...new Set(longo.vagas.map(g => g.face))]){
      const x = fx === longo.ax0 ? fx - 0.15 : fx + 0.15, ys = [...new Set(longo.vagas.filter(g => g.face === fx).flatMap(g => [g.y0, g.y1]))].sort((m,n) => m-n);
      let ult = -99; for(const y of ys) if(y - ult >= 5.9 || y === ys[ys.length-1]){ addPil(x, y); ult = y; }
    }
  }
  if(yl !== null && !longo){
    // em cada fileira, pilares na frente voltada para a manobra, entre vagas (a cada duas vagas, 6 m)
    const vg = salas.filter(s => s.vaga);
    for(const b of pl.f.filter(b => b.t==='vagas')){
      const y = Math.abs(b.face - b.y0) < 0.01 ? b.y0 + 0.15 : b.y1 - 0.15;
      const xs = new Set(); for(const s of vg.filter(s => s.y0 >= b.y0 - 0.01 && s.y1 <= b.y1 + 0.01)){ xs.add(s.x0); xs.add(s.x1); }
      const ord = [...xs].sort((m,n)=>m-n); let ult = -99;
      for(const x of ord){ if((x - ult >= 5.9 || x===ord[ord.length-1]) && !noCorredor(x, y)){ addPil(x, y); ult = x; } }
      if(ord.length) linhasY.push(r2(y));
    }
    if(yl > 1.0 && !pl.f.some(b => b.t==='vagas' && b.y1 <= yl + 0.01)){
      for(const x of [...ao(0, W, 5), nx0, nx1]) if(!naRampa(x, yl - 0.15)) addPil(x, yl - 0.15);
      linhasY.push(yl - 0.15);
    }
  }
  // completa linhas onde o vão passar do máximo, fora das manobras e do miolo das vagas
  const proib = pl.f.filter(b => b.t==='manobra').map(b => [b.y0 - 0.1, b.y1 + 0.1]).concat(pl.f.filter(b => b.t==='vagas').map(b => [b.y0 + 0.3, b.y1 - 0.3]));
  const bordas = pl.f.filter(b => b.t==='vagas').flatMap(b => [b.y0 + 0.15, b.y1 - 0.15]);
  for(let guarda = 0; guarda < (longo ? 0 : 10); guarda++){
    const ys0 = [0, ...linhasY, Dsub].sort((a,b)=>a-b); let mexeu = false;
    for(let i=0;i<ys0.length-1;i++){ const a = ys0[i], b = ys0[i+1]; if(b - a <= vao + 0.01) continue;
      const ok = y => y > a + 0.5 && y < b - 0.5 && !proib.some(([m,n]) => y > m && y < n);
      const cands = [(a+b)/2, ...bordas].filter(ok);
      if(!cands.length) continue;
      cands.sort((m,n) => Math.abs(m-(a+b)/2) - Math.abs(n-(a+b)/2));
      const y = cands[0];
      for(const x of ao(0, W, 5)) if(!naRampa(x, y) && !noCorredor(x, y)) addPil(x, y);
      linhasY.push(r2(y)); mexeu = true; break; }
    if(!mexeu) break;
  }
  const ys = [0, ...linhasY, Dsub].sort((a,b)=>a-b);
  let maior = 0; for(let i=0;i<ys.length-1;i++) maior = Math.max(maior, ys[i+1]-ys[i]);
  if(!longo && maior > vao + 0.01) av.push(`Subsolo: vão de ${f2(maior)} m entre linhas de pilares; prever laje protendida ou viga de transição para manter a manobra livre.`);
  // volta para as coordenadas da casa
  const dx = xL - X0;
  const mv = o => { o.x0 = r2(o.x0 - dx); o.x1 = r2(o.x1 - dx); o.y0 = r2(o.y0 - yF); o.y1 = r2(o.y1 - yF); return o; };
  salas.forEach(mv); pocos.forEach(mv); for(const pp of pil){ pp.x = r2(pp.x - dx); pp.y = r2(pp.y - yF); }
  const externos = ['x0','y0'].concat(!lat && W >= Wfull - 0.01 ? ['x1'] : [], Dsub >= D - 0.01 ? ['y1'] : []);
  const rampaFora = (q.subGaragem && Lin < Lr) ? mv({x0:rx0, x1:rx1, y0:-(Lr - Lin), y1:0}) : null;
  const manobrasCasa = manobras.map(m => mv({x0: m.x0 !== undefined ? m.x0 : 0, x1: m.x1 !== undefined ? m.x1 : W, y0:m.y0, y1:m.y1}));
  return {nome:'Subsolo', salas, dim:{x0:r2(-dx), y0:-yF, W, D:Dsub}, externos, ladoJardim, rampaFora, recuos:q.subRecuos, pocos, pilares:pil, manobra: yl===null ? null : Object.assign({y0:r2(yl-yF), y1:r2((longo ? Dsub : yl+MANOBRA)-yF)}, longo ? {x0:r2(longo.ax0 - dx), x1:r2(longo.ax1 - dx)} : {}), arranjo: longo ? 'perpendicular' : yl===null ? null : 'faixas', manobras: manobrasCasa,
    nucleo:mv({x0:nx0, y0:ny0, x1:nx1, y1:ny1}), rampa:{desnivel:h, L:Lr, Lin, Lout:r2(Lr-Lin), largura:RAMPA_L, inclinacao:q.inclinacao, x0:r2(rx0 - dx)}, vagas:vagasOk};
}

/* ---------- Rooftop: cobertura usável sobre o último pavimento, com acesso pela escada empilhada ---------- */
/* ---------- Rooftop (etapa E2.1, 06/10/2026) ----------
   A extensão parte da caixa de escada: centralizado (só o necessário para os itens), até a fachada frontal ou até a de fundo.
   Os itens são marcados (área técnica, varanda gourmet, varanda coberta, banho, spa); as áreas saem da geometria.
   Regra do usuário: o rooftop nunca se abre para o poente. A opção cuja fachada fica a oeste é recusada; toda borda aberta
   voltada para oeste recebe fechamento (parede ou brise), e banho e área técnica ficam do lado do poente quando há um.
   Medidas de referência (PREFERÊNCIA de projeto, sem norma): gourmet 12 m², varanda 10 m², banho 3 m², área técnica 4 m²,
   terraço mínimo 10 m², spa de 2,40 m com 0,30 m de folga em volta. */
const RT = {gourmet:12, varanda:10, banho:3.0, tecnica:4.0, terracoMin:10, spa:2.4, spaFolga:0.3};
function rooftopOpcoes(q){
  const F = RUMOS[q.orientacao];
  return [{valor:'centro', rotulo:'Centralizado', face:null}, {valor:'frente', rotulo:'Até a fachada frontal', face:'y0'}, {valor:'fundo', rotulo:'Até a fachada de fundo', face:'y1'}]
    .map(o => { if(F === undefined || !o.face) return Object.assign(o, {rumo:null, proibido:false, tarde:false});
      const az = rumoFace(o.face, F, false), c = classeSol(az); return Object.assign(o, {rumo:rumoDe(az), proibido:c === 3, tarde:c === 2}); });
}
function comRooftop(v, q){
  if(!q.rooftop) return v;
  const casa = v.pav.filter(p => !p.anexo && p.nome!=='Subsolo');
  const topo = casa[casa.length-1];
  const E = topo.salas.find(s => s.tipo==='escada' && s.desce && !s.sobe && topo.nome!=='Térreo') || topo.salas.find(s => s.tipo==='escada');
  if(!E){ v.avisos.push('Rooftop: não há escada no último pavimento para chegar à cobertura.'); return v; }
  E.sobe = true;
  const F = RUMOS[q.orientacao];
  // faixa do pavimento de baixo: largura toda dos cômodos fechados na altura da escada
  const fech = topo.salas.filter(s => !TIPOS[s.tipo].aberto);
  const by0 = E.y0, by1 = E.y1, Hb = by1 - by0, yc = (by0 + by1)/2;
  const naLinha = fech.filter(s => s.y0 <= yc && s.y1 >= yc);
  const x0 = Math.min(...naLinha.map(s => s.x0)), x1 = Math.max(...naLinha.map(s => s.x1));
  const col = fech.filter(s => s.x0 < x1 - 0.01 && s.x1 > x0 + 0.01);
  const ymin = Math.min(...col.map(s => s.y0)), ymax = Math.max(...col.map(s => s.y1)), Wr = x1 - x0;
  // posição pedida; a fachada a oeste é recusada
  const ops = rooftopOpcoes(q);
  let pos = ops.some(o => o.valor === q.rtPos) ? q.rtPos : 'centro';
  const op = ops.find(o => o.valor === pos);
  if(op.proibido){ v.avisos.push(`Rooftop: a fachada ${pos === 'frente' ? 'frontal' : 'de fundo'} fica a oeste (poente); o rooftop foi centralizado.`); pos = 'centro'; }
  else if(op.tarde) v.avisos.push(`Rooftop ${op.rotulo.toLowerCase()} (${NOMES_RUMO[op.rumo].toLowerCase()}): sol da tarde em parte do ano; prever brise nessa borda.`);
  // linha da escada: escada + elevador encostado + hall (a caixa de escada sempre tem hall, para as portas do banho e da área técnica)
  const fechados = [];
  if(q.rtTecnica) fechados.push({tipo:'deposito', a:RT.tecnica, extra:{nome:'Área técnica / caixa d’água'}});
  if(q.rtBanho) fechados.push({tipo:'banhoSocial', a:RT.banho, extra:{nome:'Banho'}});
  const el = topo.salas.find(s => s.tipo==='elevador' && compartilhado(s, E) && s.y0 >= by0 - 0.01 && s.y1 <= by1 + 0.01);
  const ocupadoE = el ? [Math.min(E.x0, el.x0), Math.max(E.x1, el.x1)] : [E.x0, E.x1];
  // lado do poente (sem espelho): banho e área técnica vão para ele; senão para o lado mais largo
  const oeste = F === undefined ? null : ['x0','x1'].find(l => classeSol(rumoFace(l, F, false)) === 3);
  const livreE = ocupadoE[0] - x0, livreD = x1 - ocupadoE[1];
  const ladoItens = oeste === 'x0' && livreE >= 1.2 ? -1 : oeste === 'x1' && livreD >= 1.2 ? 1 : livreD >= livreE ? 1 : -1;
  const salas = [sala('escada', E.x0, by0, E.x1, by1, {desce:true, esc:E.esc, nucleo:E.nucleo})];
  if(el) salas.push(sala('elevador', el.x0, el.y0, el.x1, el.y1, {nucleo:true}));
  const wHall = 1.2, wCol = fechados.length ? Math.max(1.5, fechados.reduce((t, i) => t + i.a, 0)/Hb) : 0;
  let hx0, hx1, cx0, cx1;
  if(ladoItens > 0){ hx0 = ocupadoE[1]; hx1 = Math.min(x1, hx0 + wHall); cx0 = hx1; cx1 = Math.min(x1, cx0 + wCol); }
  else { hx1 = ocupadoE[0]; hx0 = Math.max(x0, hx1 - wHall); cx1 = hx0; cx0 = Math.max(x0, cx1 - wCol); }
  if(hx1 - hx0 > 0.6) salas.push(sala('hall', hx0, by0, hx1, by1, {nome:'Caixa de escada'}));
  if(fechados.length){
    if(cx1 - cx0 >= 1.2 - 0.01) salas.push(...faixa(cx0, by0, cx1, by1, fechados, 'y'));
    else for(const it of fechados) v.avisos.push(`Rooftop: sem espaço para ${it.extra.nome.toLowerCase()} ao lado da caixa de escada.`);
  }
  // o resto da linha da escada vira terraço
  const usados = salas.map(s => [s.x0, s.x1]).sort((a, b) => a[0] - b[0]);
  let x = x0; for(const [a, b] of usados){ if(a - x > 0.3) salas.push(sala('terraco', x, by0, a, by1, {nome:'Terraço'})); x = Math.max(x, b); }
  if(x1 - x > 0.3) salas.push(sala('terraco', x, by0, x1, by1, {nome:'Terraço'}));
  // faixas abertas: uma faixa coberta encostada na linha da escada (gourmet em bloco na ponta longe do banho, varanda no resto)
  // e o terraço por fora, com o spa. Centralizado: cobertas de um lado da escada e terraço do outro.
  const ladoSpa = RT.spa + 2*RT.spaFolga;
  const dtMin = Math.max(RT.terracoMin/Wr, q.rtSpa ? ladoSpa : 0);
  let gourmet = q.rtGourmet, varanda = q.rtVaranda;
  const dcDe = () => (gourmet || varanda) ? Math.max(gourmet ? TIPOS.gourmet.lado : 2.0, ((gourmet ? RT.gourmet : 0) + (varanda ? RT.varanda : 0))/Wr) : 0;
  const dispA = by0 - ymin, dispB = ymax - by1;           // A: para a frente; B: para o fundo
  // tira itens cobertos (varanda primeiro) até a faixa coberta e o terraço mínimo caberem em `cap`
  const cabe = cap => { while((gourmet || varanda) && dcDe() + dtMin > cap + 0.01){ const n = varanda ? 'varanda coberta' : 'varanda gourmet'; if(varanda) varanda = false; else gourmet = false;
    v.avisos.push(`Rooftop: sem espaço para a ${n} (a laje nesta posição tem ${f2(cap)} m de profundidade além da escada).`); } };
  let ladoCob = null, ladoTer = null;                     // {s: −1 frente | +1 fundo, d}
  if(pos !== 'centro'){ const s = pos === 'frente' ? -1 : 1, disp = s < 0 ? dispA : dispB; cabe(disp); ladoCob = {s, d:dcDe()}; ladoTer = {s, d:disp - dcDe(), depois:true}; }
  else {
    const dc0 = dcDe();
    if(dispA >= dc0 - 0.01 && dispB >= dtMin - 0.01){ ladoCob = {s:-1, d:dc0}; ladoTer = {s:1, d:dtMin}; }
    else if(dispB >= dc0 - 0.01 && dispA >= dtMin - 0.01){ ladoCob = {s:1, d:dc0}; ladoTer = {s:-1, d:dtMin}; }
    else { const s = dispA >= dispB ? -1 : 1, disp = Math.max(dispA, dispB); cabe(disp); ladoCob = {s, d:dcDe()}; ladoTer = {s, d:Math.min(disp - dcDe(), dtMin), depois:true}; }
  }
  const tira = (s, ini, d, tipo, nome, xa, xb) => { const a = s > 0 ? ini : ini - d, b = s > 0 ? ini + d : ini; salas.push(sala(tipo, xa, a, xb, b, {nome})); };
  if(ladoCob.d > 0.3){
    const yIni = ladoCob.s < 0 ? by0 : by1, dc = ladoCob.d;
    // a gourmet fica na ponta oposta ao banho e à área técnica
    const wg = gourmet ? Math.min(Wr, Math.max(TIPOS.gourmet.lado, RT.gourmet/dc)) : 0, gEsq = ladoItens > 0;
    const gx0 = gEsq ? x0 : x1 - wg, gx1 = gEsq ? x0 + wg : x1;
    if(gourmet) tira(ladoCob.s, yIni, dc, 'gourmet', 'Varanda gourmet', gx0, gx1);
    const rx0 = gourmet ? (gEsq ? gx1 : x0) : x0, rx1 = gourmet ? (gEsq ? x1 : gx0) : x1;
    if(rx1 - rx0 > 0.3) tira(ladoCob.s, yIni, dc, varanda ? 'varanda' : 'terraco', varanda ? 'Varanda coberta' : 'Terraço', rx0, rx1);
  }
  if(ladoTer.d > 0.3){
    const ini = ladoTer.depois ? (ladoTer.s < 0 ? by0 - ladoCob.d : by1 + ladoCob.d) : (ladoTer.s < 0 ? by0 : by1);
    tira(ladoTer.s, ini, ladoTer.d, 'terraco', 'Terraço', x0, x1);
  }
  const pav = {nome:'Rooftop', salas, area:r2(salas.reduce((t, s) => t + area(s), 0)), posicao:pos,
    base: topo.salas.map(s => ({tipo:s.tipo, zona:s.zona, x0:s.x0, y0:s.y0, x1:s.x1, y1:s.y1}))};   // pavimento de baixo, esmaecido no desenho
  // spa: no maior terraço com 3,00 m nos dois lados
  if(q.rtSpa){
    const deck = salas.filter(s => s.tipo==='terraco' && s.x1 - s.x0 >= ladoSpa - 0.01 && s.y1 - s.y0 >= ladoSpa - 0.01).sort((a, b) => area(b) - area(a))[0];
    if(deck) pav.spa = {x:r2((deck.x0 + deck.x1)/2), y:r2((deck.y0 + deck.y1)/2), r:RT.spa/2, lado:RT.spa};
    else v.avisos.push(`Rooftop: o spa precisa de um terraço de ${f2(ladoSpa)} × ${f2(ladoSpa)} m; escolha "até a fachada" ou desmarque a varanda coberta.`);
  }
  // fechamento a oeste: bordas abertas voltadas para o poente, na planta normal e na espelhada
  pav.fechamentos = {normal:[], espelhada:[]};
  for(const s of salas.filter(s => TIPOS[s.tipo].aberto))
    for(const e of trechosExternos(s, salas)) for(const [k, esp] of [['normal', false], ['espelhada', true]])
      if(classeSol(rumoFace(e.lado, F, esp)) === 3 || distDivisa(q, v.W, e.lado, e.c, esp) < DIVISA_JANELA - 0.001) pav.fechamentos[k].push({o:e.o, c:r2(e.c), t0:r2(e.t0), t1:r2(e.t1), motivo: classeSol(rumoFace(e.lado, F, esp)) === 3 ? 'poente' : 'divisa'});
  v.pav.push(pav);
  return v;
}

/* ---------- Portas, vãos e janelas ---------- */
const PREF = {
  quarto:['circ','hall'], suite:['circ','hall'], master:['circ','hall'],
  banhoSocial:['circ','hall','galeria','estar','jantar','tv','escritorio','terraco','gourmet'], lavabo:['hall','galeria','estar','jantar','circ','tv'],
  escritorio:['estar','hall','galeria','circ','tv','jantar','garagem'], tv:['estar','jantar','hall','circ','galeria'],
  cozinha:['jantar','hall','galeria','estar'], servico:['cozinha','hall','galeria','garagem','circ'], despensa:['cozinha','servico','hall','galeria'],
  garagem:['hall','servico','cozinha','estar','galeria','escritorio'], rouparia:['circ','hall'], deposito:['hall','circ','manobra','galeria','servico','garagem','lazer','cozinha','jardim','rampa','terraco','gourmet'],
  lazer:['hall','manobra','garagem','deposito','jardim'], gourmet:['cozinha','jantar','servico','estar','galeria'],
  salaIntima:['circ','hall'], hall:[], circ:[], galeria:[], escada:[], elevador:[], jardim:[], manobra:['hall'], rampa:[], varanda:[], terraco:['circ','hall'],
};
const ABERTOS = [['varanda','terraco'],['varanda','hall'],['varanda','gourmet'],['terraco','terraco'],['circ','circ'],['gourmet','terraco'],['gourmet','hall'],['hall','terraco'],['hall','hall'],['hall','elevador'],['circ','elevador'],['circ','estar'],['circ','jantar'],['circ','tv'],['estar','jantar'],['estar','tv'],['hall','estar'],['hall','jantar'],['hall','tv'],['hall','circ'],['galeria','circ'],['circ','cozinha'],['galeria','jantar'],['galeria','estar'],['galeria','cozinha'],['manobra','garagem'],['manobra','rampa'],['hall','manobra']];

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

/* Subsolo: aberturas altas (semienterrado) ou voltadas para pátios ingleses (enterrado), com ventilação cruzada obrigatória. */
function janelasSubsolo(pav, q, S, av, Wc, espelho){
  const janelas = [];
  const X0 = pav.dim.x0 || 0, Y0 = pav.dim.y0 || 0, W = pav.dim.W, D = pav.dim.D, semi = q.subNivel==='meio', pocos = pav.pocos || [];
  const E = 0.01;
  const ladoDe = e => e.o==='v' ? (Math.abs(e.c-X0)<E ? 'x0' : Math.abs(e.c-X0-W)<E ? 'x1' : null) : (Math.abs(e.c-Y0)<E ? 'y0' : Math.abs(e.c-Y0-D)<E ? 'y1' : null);
  // trecho de parede que dá para um pátio inglês (enterrado) ou para fora (semienterrado)
  const ext = pav.externos || ['x0','x1','y0','y1'];
  const trecho = (e, lado) => {
    if(lado === pav.ladoJardim) return [e.t0, e.t1];
    if(semi && ext.includes(lado)) return [e.t0, e.t1];
    if(!semi) return null;
    const p = pocos.find(p => lado==='x0' ? Math.abs(p.x1-X0)<E : lado==='x1' ? Math.abs(p.x0-X0-W)<E : lado==='y0' ? Math.abs(p.y1-Y0)<E : Math.abs(p.y0-Y0-D)<E);
    if(!p) return null;
    const a = e.o==='v' ? Math.max(e.t0, p.y0) : Math.max(e.t0, p.x0), b = e.o==='v' ? Math.min(e.t1, p.y1) : Math.min(e.t1, p.x1);
    return b - a > 0.8 ? [a, b] : null;
  };
  const lados = new Set();
  if(q.subGaragem){ lados.add('y0'); lados.add('x1'); }   // boca da rampa, no canto oposto ao núcleo
  const h = semi ? 0.6 : 1.2;
  for(const s of S){
    if(['escada','rampa','jardim','elevador'].includes(s.tipo)) continue;
    const hab = s.tipo==='lazer', A = area(s);
    const exig = hab ? A/8 : A/20;
    let obt = 0;
    const ext = trechosExternos(s, S.filter(o => !TIPOS[o.tipo].aberto)).map(e => { const l = ladoDe(e); const t = l && trecho(e, l); return t ? {o:e.o, c:e.c, t0:t[0], t1:t[1], lado:l} : null; })
      .filter(Boolean).filter(e => Wc === undefined || distDivisa(q, Wc, e.lado, e.c, espelho) >= DIVISA_JANELA - 0.001).sort((a,b) => (lados.has(a.lado)?1:0)-(lados.has(b.lado)?1:0) || (b.t1-b.t0)-(a.t1-a.t0));
    for(const e of ext){
      if(obt >= exig && lados.has(e.lado)) continue;
      const L = e.t1-e.t0;
      if(L - 0.3 < 0.8) continue;                     // trecho curto: a janela mínima de 0,80 m passaria do fim da parede
      const w = clamp(Math.max(1.0, (exig-obt)/h), 0.8, semi ? L-0.3 : Math.min(4.0, L-0.3));
      const m = (e.t0+e.t1)/2;
      janelas.push({o:e.o, c:e.c, t0:r2(m-w/2), t1:r2(m+w/2), alta:semi, h});
      obt += w*h; lados.add(e.lado);
    }
    if(hab){ s.ilum = {exig:r2(exig), obt:r2(obt)}; if(obt < exig-0.01) av.push(`Subsolo: ${rotulo(s)} com ${f2(obt)} m² de abertura; a iluminação pede ${f2(exig)} m² (1/8 do piso).`); }
  }
  pav.ladosAbertos = [...lados];
  pav.cruzada = (lados.has('x0') && lados.has('x1')) || (lados.has('y0') && lados.has('y1'));
  if(!pav.cruzada) av.push('Subsolo sem ventilação cruzada: faltam aberturas em lados opostos.');
  return {janelas};
}

/* Código Civil (Lei 10.406/2002), art. 1.301: "É defeso abrir janelas, ou fazer eirado, terraço ou varanda, a menos de metro e
   meio do terreno vizinho" (texto conferido em fonte secundária em 06/10/2026; o Planalto não respondeu: confirmar na fonte oficial).
   Distância de uma face da casa (lado e coordenada no sistema da casa, sem espelho) até a divisa vizinha; a frente dá para a rua.
   A casa fica centrada na faixa edificável e o espelho a vira no lugar: a face x0 passa para o lado direito do lote. */
const DIVISA_JANELA = 1.5;
function distDivisa(q, W, lado, c, espelho){
  if(q.recX0 === undefined || lado === 'y0') return Infinity;
  const g = (q.frente - q.recX0 - q.recX1 - W)/2;
  if(lado === 'y1') return q.fundo - q.recFrente - c;
  const recuo = (lado === 'x0') !== !!espelho ? q.recX0 : q.recX1;
  return recuo + g + (lado === 'x0' ? c : W - c);
}
function aberturas(pav, q, ehTerreo, espelho, W){
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
      if(sh){ portas.push(porta(s, c2, sh, q.acessivel ? 0.9 : 0.7)); continue; }
    }
    if(S.some(o => o!==s && aberto(s,o) && compartilhado(s,o))) continue;
    const pref = PREF[s.tipo] || [];
    let feito = false;
    for(const t of pref){
      const viz = S.filter(o => o!==s && o.tipo===t).map(o => ({o, sh:compartilhado(s,o)})).filter(v => v.sh && v.sh.t1-v.sh.t0 >= 0.85)
        .sort((a,b) => (b.sh.t1-b.sh.t0)-(a.sh.t1-a.sh.t0));
      if(viz.length){ const o = viz[0].o;
        // uma porta só por par de cômodos (garagem ↔ serviço gerava duas no mesmo ponto)
        if(!portas.some(p => (p.sala===s.id && p.viz===o.id) || (p.sala===o.id && p.viz===s.id))) portas.push(porta(s, o, viz[0].sh, q.acessivel ? Math.max(0.9, larguraPorta(s)) : larguraPorta(s)));
        feito = true; break; }
    }
    // suíte sem parede na circulação (a escada ocupou o trecho do corredor): entra pelo closet do módulo, se ele encosta no hall
    if(!feito && (s.tipo==='suite' || s.tipo==='master')){
      const cl = S.find(o => o.mod===s.mod && (o.tipo==='closet' || o.tipo==='closetMaster') && compartilhado(o, s));
      const viz = cl && S.filter(o => ['circ','hall'].includes(o.tipo)).map(o => ({o, sh:compartilhado(cl, o)})).filter(z => z.sh && z.sh.t1 - z.sh.t0 >= 0.85).sort((a,b) => (b.sh.t1-b.sh.t0)-(a.sh.t1-a.sh.t0))[0];
      if(viz){ portas.push(porta(cl, viz.o, viz.sh, q.acessivel ? 0.9 : 0.8)); feito = true; av.push(`${pav.nome}: ${rotulo(s)} com entrada pelo closet (a escada ocupa o trecho do corredor).`); }
    }
    if(!feito && s.tipo!=='estar' && pref.length && !['garagem','gourmet'].includes(s.tipo) && s.nome!=='Área técnica' && !(s.tipo==='rouparia' && area(s) < 1.5)) av.push(`${pav.nome}: ${rotulo(s)} sem acesso por ${pref.slice(0,3).map(t=>TIPOS[t].nome.toLowerCase()).join(', ')}.`);
  }
  // zoneamento invertido (E2.8): entrada pela ponta do corredor dos quartos, na fachada da frente
  if(ehTerreo && pav.entradaFrente){ const c = S.find(s => s.entrada && s.tipo==='circ');
    if(c){ const w = Math.min(1.0, c.x1 - c.x0 - 0.2), m = (c.x0 + c.x1)/2; portas.push({o:'h', c:c.y0, t0:r2(m - w/2), t1:r2(m + w/2), sala:c.id, dentro:1, entrada:true}); } }
  // entrada principal: estar → varanda ou fachada frontal
  if(ehTerreo && !portas.some(p => p.entrada)){
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
  // saída de fundos: na face mais oposta à entrada, por cozinha, serviço, jantar ou gourmet
  if(ehTerreo){
    const ent = portas.find(p => p.entrada);
    if(ent){
      const fE = faceDe(ent, S), oposto = {y0:'y1', y1:'y0', x0:'x1', x1:'x0'}[fE];
      const cands = S.filter(s => ['servico','cozinha','jantar','gourmet'].includes(s.tipo))
        .flatMap(s => trechosExternos(s, S).filter(t => t.t1 - t.t0 >= 1.2).map(t => ({s, t, f: faceDe({o:t.o, c:t.c, t0:t.t0, t1:t.t1}, S)})));
      cands.sort((a,b) => (a.f===oposto?0:a.f===fE?2:1) - (b.f===oposto?0:b.f===fE?2:1) || (b.t.t1-b.t.t0) - (a.t.t1-a.t.t0));
      const c = cands[0];
      if(c && c.f !== fE){ const m = (c.t.t0 + c.t.t1)/2; portas.push({o:c.t.o, c:c.t.c, t0:r2(m-0.45), t1:r2(m+0.45), sala:c.s.id, dentro:dentro(c.s, c.t), saida:true}); }
    }
  }
  // conectividade: a partir da entrada (térreo) ou da escada/hall (outros pavimentos)
  const ini = ehTerreo ? (portas.find(p=>p.entrada)||{}).sala : (S.find(s=>s.tipo==='escada')||S.find(s=>s.tipo==='hall')||{}).id;
  if(ini){
    const adj = new Map(S.map(s=>[s.id,[]]));
    const liga = (a,b) => { if(adj.has(a)&&adj.has(b)){ adj.get(a).push(b); adj.get(b).push(a); } };
    portas.forEach(p => { if(p.viz) liga(p.sala, p.viz); }); vaos.forEach(v => liga(v.a, v.b));
    S.filter(s=>s.tipo==='escada'||s.tipo==='elevador').forEach(esc => S.filter(o=>o.tipo==='hall'||o.tipo==='circ').forEach(o=>{ if(compartilhado(esc,o)) liga(esc.id,o.id); }));
    S.filter(s=>s.tipo==='varanda'||s.tipo==='garagem'||s.tipo==='rampa'||s.tipo==='terraco').forEach(s=>{ if(ehTerreo || s.tipo==='rampa') liga(s.id, ini); });
    if(!ehTerreo){
      // no subsolo, rampa, manobra e vagas formam uma área contínua, ligada ao hall da escada quando encostam nele
      const gar = S.filter(o => ['manobra','garagem','rampa','hall','escada'].includes(o.tipo));
      for(let i=0;i<gar.length;i++) for(let j=i+1;j<gar.length;j++) if(compartilhado(gar[i], gar[j])) liga(gar[i].id, gar[j].id);
    }
    const vis = new Set([ini]), fila=[ini];
    while(fila.length){ const x=fila.shift(); for(const y of adj.get(x)||[]) if(!vis.has(y)){ vis.add(y); fila.push(y); } }
    // cômodo isolado: abre porta para um vizinho já ligado, pela preferência de portas de um dos dois (ex.: a cozinha fechada que
    // só tinha passagem aberta para o corredor ganha a porta do jantar). Repete até nada mudar.
    const percorre = x0 => { const f = [x0]; vis.add(x0); while(f.length){ const x = f.shift(); for(const y of adj.get(x)||[]) if(!vis.has(y)){ vis.add(y); f.push(y); } } };
    for(let mudou = true; mudou;){ mudou = false;
      for(const s of S){ if(vis.has(s.id) || ['rouparia','deposito','terraco','jardim'].includes(s.tipo) || s.vaga || TIPOS[s.tipo].aberto) continue;
        const z = S.filter(o => o !== s && vis.has(o.id) && !TIPOS[o.tipo].aberto && ((PREF[s.tipo]||[]).includes(o.tipo) || (PREF[o.tipo]||[]).includes(s.tipo)))
          .map(o => ({o, sh:compartilhado(s, o)})).filter(z => z.sh && z.sh.t1 - z.sh.t0 >= 0.85).sort((a, b) => (b.sh.t1-b.sh.t0) - (a.sh.t1-a.sh.t0))[0];
        if(!z) continue;
        portas.push(porta(s, z.o, z.sh, q.acessivel ? 0.9 : larguraPorta(s))); liga(s.id, z.o.id); percorre(s.id); mudou = true; }
    }
    for(const s of S) if(!vis.has(s.id) && !['rouparia','deposito','terraco','jardim'].includes(s.tipo) && !s.vaga) av.push(`${pav.nome}: ${rotulo(s)} não se liga ao resto da casa.`);
  }
  // janelas: área mínima de iluminação = 1/8 da área do piso (ventilação 1/16 = metade de uma janela de correr)
  const fechados = S.filter(o => !TIPOS[o.tipo].aberto);
  if(pav.nome==='Subsolo') return Object.assign({portas, vaos, avisos:av}, janelasSubsolo(pav, q, S, av, W, espelho));
  for(const s of S){
    if(TIPOS[s.tipo].aberto) continue;
    const t = TIPOS[s.tipo];
    if(!(t.hab || t.mol || s.tipo==='circ' || s.tipo==='galeria' || s.tipo==='hall' || s.tipo==='closetMaster')) continue;
    let ext = trechosExternos(s, fechados).filter(e => e.t1-e.t0 >= 0.8).sort((a,b) => (b.t1-b.t0)-(a.t1-a.t0));
    // art. 1.301: nada de janela a menos de 1,50 m da divisa
    if(W !== undefined){ const n0 = ext.length; ext = ext.filter(e => distDivisa(q, W, e.lado, e.c, espelho) >= DIVISA_JANELA - 0.001);
      if(n0 && !ext.length && t.hab) av.push(`${pav.nome}: ${rotulo(s)} só tem paredes a menos de 1,50 m da divisa (Código Civil, art. 1.301).`); }
    if(QUARTOS.includes(s.tipo) && RUMOS[q.orientacao] !== undefined){
      // quarto: nada de janela a oeste se houver outra face; as faces a nascente vêm primeiro
      const nota = e => classeSol(rumoFace(e.lado, RUMOS[q.orientacao], espelho));
      const semPoente = ext.filter(e => nota(e) < 3); if(semPoente.length) ext = semPoente;
      ext.sort((a,b) => nota(a) - nota(b) || (b.t1-b.t0)-(a.t1-a.t0));
    }
    const A = area(s);
    const exig = (t.hab || t.mol) ? A/8 : 0;
    if(!ext.length){
      if(t.hab) av.push(`${pav.nome}: ${rotulo(s)} sem janela para fora.`);
      else if(t.mol) av.push(`${pav.nome}: ${rotulo(s)} sem janela; prever exaustão mecânica.`);
      if(exig) s.ilum = {exig:r2(exig), obt:0};
      continue;
    }
    const alta = !!t.mol || s.tipo==='closetMaster';
    const vidro = s.tipo==='galeria';
    const h = vidro ? 2.1 : alta ? 0.6 : 1.2;
    let falta = exig, obt = 0;
    // premissa (05/10/2026): sempre que possível, janelas em pontos distantes entre si, para a ventilação cruzada.
    // 1) escolhe as faces e as larguras; um cômodo de permanência com duas faces externas sempre ganha janela na segunda face
    const cruzada = !!t.hab && !alta && !vidro, sel = [];
    // trecho livre de cada face: o maior pedaço fora das portas dessa parede (com 0,20 m de folga; auditoria G07)
    const livre = e => { let seg = [[e.t0, e.t1]];
      for(const p of portas.filter(p => p.o===e.o && Math.abs(p.c-e.c)<0.001)) seg = seg.flatMap(([a,b]) => [[a, Math.min(b, p.t0-0.2)], [Math.max(a, p.t1+0.2), b]]).filter(([a,b]) => b-a > 0.05);
      const m = seg.sort((x,y) => (y[1]-y[0]) - (x[1]-x[0]))[0]; return m ? Object.assign({}, e, {t0:m[0], t1:m[1]}) : null; };
    ext.forEach((e0, i) => {
      const e = livre(e0); if(!e) return;
      // a janela extra de ventilação não vai para face de sol da tarde (SO, O, NO) num quarto
      const tarde = QUARTOS.includes(s.tipo) && RUMOS[q.orientacao] !== undefined && classeSol(rumoFace(e.lado, RUMOS[q.orientacao], espelho)) >= 2;
      const outraFace = cruzada && sel.length === 1 && !sel.some(x => x.e.lado === e.lado) && !tarde;
      if(i > 0 && falta <= 0.01 && !outraFace && !(s.tipo==='circ' && i===1 && e.t1-e.t0 >= 2.0)) return;
      if(cruzada && sel.some(x => x.e.lado === e.lado) && falta <= 0.01) return;
      const L = e.t1-e.t0;
      const wmin = alta ? 0.6 : vidro ? L-0.6 : 1.0;
      const w = vidro ? L-0.6 : clamp(Math.max(wmin, falta/h), wmin, Math.min(alta ? 1.6 : 3.0, L-0.3));
      if(w < 0.5) return;
      sel.push({e, e0, w}); obt += w*h; falta = exig - obt;
    });
    // 2) posição: em faces vizinhas, cada janela na ponta longe do canto comum; em faces opostas, em pontas contrárias;
    //    com uma janela só, na ponta longe da porta do cômodo; sempre 0,30 m de boneca
    const pontas = (e, w) => [e.t0 + Math.min(0.3, (e.t1-e.t0-w)/2) + w/2, e.t1 - Math.min(0.3, (e.t1-e.t0-w)/2) - w/2];
    const ponto = (e, t) => e.o === 'h' ? [t, e.c] : [e.c, t];
    const dist = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
    const centros = sel.map(({e, w}) => (e.t0+e.t1)/2);
    if(cruzada && sel.length >= 2){
      const [A, B] = sel, pa = pontas(A.e, A.w), pb = pontas(B.e, B.w);
      let melhor = null;
      for(const ta of pa) for(const tb of pb){ const d = dist(ponto(A.e, ta), ponto(B.e, tb)); if(!melhor || d > melhor.d + 0.001) melhor = {d, ta, tb}; }
      centros[0] = melhor.ta; centros[1] = melhor.tb;
    } else if(cruzada && sel.length === 1){
      const dp = portas.find(p => (p.sala === s.id || p.viz === s.id) && !p.entrada);
      if(dp){ const pd = ponto(dp, (dp.t0+dp.t1)/2), pa = pontas(sel[0].e, sel[0].w);
        centros[0] = dist(ponto(sel[0].e, pa[0]), pd) >= dist(ponto(sel[0].e, pa[1]), pd) ? pa[0] : pa[1]; }
    }
    obt = 0;
    sel.forEach(({e, w}, i) => {
      let mm = centros[i];
      // não sobrepor porta de entrada
      const pe = portas.find(p => p.o===e.o && Math.abs(p.c-e.c)<0.001 && p.t1>mm-w/2 && p.t0<mm+w/2);
      if(pe){ if(pe.t1 + 0.3 + w <= e.t1) mm = pe.t1+0.3+w/2; else if(pe.t0 - 0.3 - w >= e.t0) mm = pe.t0-0.3-w/2; else { w = Math.max(0, Math.max(e.t1-pe.t1, pe.t0-e.t0) - 0.4); mm = e.t1-pe.t1 > pe.t0-e.t0 ? pe.t1+0.2+w/2 : pe.t0-0.2-w/2; } }
      w = Math.min(w, e.t1 - e.t0); mm = clamp(mm, e.t0 + w/2, e.t1 - w/2);      // nunca passa do fim da face
      if(w < 0.5) return;
      janelas.push({o:e.o, c:e.c, t0:r2(mm-w/2), t1:r2(mm+w/2), alta, vidro, h});
      obt += w*h;
    });
    falta = exig - obt;
    // 3) se a porta de entrada encurtou alguma janela, completa a área nas faces que sobraram (centradas)
    for(const e of ext){
      if(falta <= 0.01 || sel.some(x => x.e0 === e)) continue;
      const L = e.t1-e.t0, w = clamp(Math.max(alta ? 0.6 : 1.0, falta/h), alta ? 0.6 : 1.0, Math.min(alta ? 1.6 : 3.0, L-0.3)), m = (e.t0+e.t1)/2;
      if(w < 0.5 || portas.some(p => p.o===e.o && Math.abs(p.c-e.c)<0.001 && p.t1>m-w/2-0.2 && p.t0<m+w/2+0.2)) continue;
      janelas.push({o:e.o, c:e.c, t0:r2(m-w/2), t1:r2(m+w/2), alta, vidro, h}); obt += w*h; falta = exig - obt;
    }
    if(exig){
      s.ilum = {exig:r2(exig), obt:r2(obt)};
      if(obt < exig - 0.01){
        if(t.hab) av.push(`${pav.nome}: ${rotulo(s)} com ${f2(obt)} m² de janela; a iluminação pede ${f2(exig)} m² (1/8 do piso).`);
        else av.push(`${pav.nome}: ${rotulo(s)} com janela menor que 1/8 do piso; complementar com exaustão mecânica.`);
      }
    }
  }
  return {portas, vaos, janelas, avisos:av};

  function larguraPorta(s){ return ['banhoSocial','lavabo','closet','despensa','rouparia','banhoSuite'].includes(s.tipo) ? 0.7 : s.tipo==='garagem' ? 0.9 : 0.8; }
}
function faceDe(e, S){
  const m = (e.t0 + e.t1)/2, dentro = (x, y) => S.some(o => !TIPOS[o.tipo].aberto && x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1);
  if(e.o==='h') return dentro(m, e.c - 0.05) ? 'y1' : 'y0';
  return dentro(e.c - 0.05, m) ? 'x1' : 'x0';
}
/* Sol nos quartos (regra do usuário): nunca janela de quarto voltada para o poente (face O); SO e NO só em parte do ano;
   prioridade ao nascente (NE, L, SE). Em Fortaleza o sol se põe entre 247° e 293° de azimute ao longo do ano. */
const QUARTOS = ['quarto', 'suite', 'master'];
function classeSol(az){ const dO = difAng(az, 270); if(dO <= 22.5) return 3; if(dO <= 67.5) return 2; return difAng(az, 90) <= 67.5 ? 0 : 1; }
const rumoDe = az => Object.keys(RUMOS).find(k => RUMOS[k] === ((az % 360) + 360) % 360);
function ladoDaJanela(j, s){
  const E = 0.001;
  if(j.o === 'v'){ if(j.t0 < s.y0 - E || j.t1 > s.y1 + E) return null; return Math.abs(j.c - s.x0) < E ? 'x0' : Math.abs(j.c - s.x1) < E ? 'x1' : null; }
  if(j.t0 < s.x0 - E || j.t1 > s.x1 + E) return null; return Math.abs(j.c - s.y0) < E ? 'y0' : Math.abs(j.c - s.y1) < E ? 'y1' : null;
}
/* Quartos com alguma parede de fachada voltada para oeste (poente), com ou sem janela nela. */
function quartosNoPoente(v, q, espelho){
  const F = RUMOS[q.orientacao]; if(F === undefined) return [];
  const out = [];
  for(const p of v.pav){
    if(p.anexo || p.nome === 'Subsolo' || p.nome === 'Rooftop') continue;
    const fech = p.salas.filter(s => !TIPOS[s.tipo].aberto);
    for(const s of p.salas.filter(x => QUARTOS.includes(x.tipo)))
      if(trechosExternos(s, fech).some(e => classeSol(rumoFace(e.lado, F, espelho)) === 3)) out.push(`${p.nome}: ${rotulo(s)}`);
  }
  return out;
}
function avaliaSol(v, q, espelho){
  const F = RUMOS[q.orientacao]; if(F === undefined) return {pen:0, av:[]};
  let pen = 0; const av = [];
  v.quartosPoente = 0;
  for(const p of v.pav){
    if(p.nome === 'Subsolo' || p.nome === 'Rooftop') continue;
    for(const s of p.salas.filter(x => QUARTOS.includes(x.tipo))){
      const azs = (p.janelas || []).map(j => ladoDaJanela(j, s)).filter(Boolean).map(l => rumoFace(l, F, espelho));
      if(!azs.length) continue;
      const cls = azs.map(classeSol), nome = `${p.nome}: ${rotulo(s)}`;
      if(cls.includes(3)){ pen += 25; v.quartosPoente = (v.quartosPoente || 0) + 1; av.push(`${nome} com janela voltada para o poente (oeste): sol forte da tarde o ano todo.`); }
      else if(cls.includes(2)){ const az = azs[cls.indexOf(2)]; pen += 6; av.push(`${nome} com janela voltada para ${NOMES_RUMO[rumoDe(az)].toLowerCase()}: sol da tarde em parte do ano.`); }
      if(!cls.includes(0)) pen += 3;   // prioridade ao nascente
    }
  }
  return {pen, av};
}

/* Ventilação cruzada pelo vento de L/SE: aberturas a barlavento e a sotavento em cada pavimento. */
function avaliaVento(v, q, espelho){
  const F = RUMOS[q.orientacao] !== undefined ? RUMOS[q.orientacao] : 0;
  let pen = 0; const av = [];
  for(const p of v.pav){
    if(p.anexo || p.nome==='Subsolo' || p.nome==='Rooftop') continue;
    let bar = 0, sot = 0;
    for(const e of (p.janelas||[]).concat((p.portas||[]).filter(d => d.entrada || d.saida))){
      const ang = rumoFace(faceDe(e, p.salas), F, espelho), d = difAng(ang, VENTO);
      if(d <= 67.5) bar++; else if(d >= 112.5) sot++;
    }
    if(!bar){ pen += 8; av.push(`${p.nome}: sem aberturas na face que recebe o vento de leste/sudeste.`); }
    if(!sot){ pen += 8; av.push(`${p.nome}: sem aberturas na face oposta ao vento; o ar não atravessa a casa.`); }
  }
  return {pen, av};
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

/* ---------- Acessibilidade (NBR 9050:2020), opcional ----------
   Itens: portas com vão livre de 0,80 m (folha de 0,90 m); um banho acessível (≥ 2,40 × 2,50 m pelo eixo: giro de 1,50 m,
   transferência lateral à bacia e boxe de 0,90 × 0,95 m) em cada pavimento com quarto; quartos com lado ≥ 2,80 m (giro ao lado
   da cama); corredores com ≥ 1,20 m; rota sem degraus (semienterrado ou sobrado sem elevador pedem rampa, plataforma ou
   quarto e banho acessíveis no térreo). Marca s.acessivel no banho escolhido (o desenho mostra o giro). */
function verificaAcessibilidade(v, q){
  const itens = [], av = []; let pen = 0;
  const falha = (item, txt, p) => { itens.push({item, ok:false, detalhe:txt}); av.push(`Acessibilidade: ${txt}`); pen += p; };
  const passa = (item, txt) => itens.push({item, ok:true, detalhe:txt});
  const casa = v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo' && p.nome !== 'Rooftop');
  const ehBanho = s => ['banhoSocial','banhoSuite','banhoMaster'].includes(s.tipo);
  const lados = s => [Math.min(s.x1-s.x0, s.y1-s.y0), Math.max(s.x1-s.x0, s.y1-s.y0)];
  // portas
  const estreitas = casa.filter(p => p.nome === 'Térreo' || q.elevador).flatMap(p => (p.portas || []).filter(d => !d.saida && d.t1 - d.t0 < 0.9 - 0.01));
  if(estreitas.length) falha('Portas', `${estreitas.length} porta(s) com folha menor que 0,90 m (vão livre abaixo de 0,80 m).`, 2*estreitas.length);
  else passa('Portas', 'Folhas de 0,90 m (vão livre de 0,80 m) em todo o percurso.');
  // banho acessível por pavimento com quarto
  const comQuarto = casa.filter(p => p.salas.some(s => QUARTOS.includes(s.tipo)));
  const semBanho = [];
  for(const p of comQuarto){
    const cands = p.salas.filter(s => ehBanho(s) && lados(s)[0] >= BANHO_ACESSIVEL.lado - 0.01 && lados(s)[1] >= BANHO_ACESSIVEL.comp - 0.01)
      .sort((a, b) => (a.tipo === 'banhoSocial' ? 0 : 1) - (b.tipo === 'banhoSocial' ? 0 : 1) || area(b) - area(a));
    if(cands.length) cands[0].acessivel = true; else semBanho.push(p.nome.toLowerCase());
  }
  if(semBanho.length) falha('Banho acessível', `falta banho de 2,40 × 2,50 m (giro de 1,50 m, transferência e boxe) no ${semBanho.join(' e no ')}.`, 8*semBanho.length);
  else passa('Banho acessível', 'Banho de 2,40 × 2,50 m ou maior em cada pavimento com quarto, com giro de 1,50 m, transferência lateral e boxe de 0,90 × 0,95 m.');
  // quartos
  const apertados = casa.flatMap(p => p.salas.filter(s => QUARTOS.includes(s.tipo) && lados(s)[0] < 2.8 - 0.01));
  if(apertados.length) falha('Quartos', `${apertados.length} quarto(s) com lado menor que 2,80 m: o giro de 1,50 m não cabe ao lado da cama de casal.`, 3*apertados.length);
  else passa('Quartos', 'Lado de 2,80 m ou mais: giro de 1,50 m ao lado da cama.');
  // corredores
  // corredores da rota acessível: o térreo e, com elevador, os demais pavimentos
  const corr = casa.filter(p => p.nome === 'Térreo' || q.elevador).flatMap(p => p.salas.filter(s => s.tipo === 'circ' && lados(s)[0] < 1.2 - 0.01));
  if(corr.length) falha('Corredores', 'corredor com menos de 1,20 m.', 3*corr.length); else passa('Corredores', 'Corredores de 1,20 m ou mais.');
  // rota sem degraus
  if(q.subsolo && q.subNivel === 'meio' && !q.elevador)
    falha('Rota sem degraus', 'o térreo fica 1,40 m acima da rua (subsolo semienterrado): prever rampa de 8,33 % (cerca de 16,80 m) ou plataforma elevatória.', 8);
  else if(q.tipo === 'sobrado' && !q.elevador){
    const t = casa.find(p => p.nome === 'Térreo');
    const ok = t && t.salas.some(s => QUARTOS.includes(s.tipo)) && t.salas.some(s => s.acessivel);
    if(ok) passa('Rota sem degraus', 'Sobrado sem elevador, com quarto e banho acessíveis no térreo.');
    else falha('Rota sem degraus', 'sobrado sem elevador: deixe um quarto e um banho acessível no térreo ou preveja elevador.', 8);
  } else passa('Rota sem degraus', q.elevador ? 'Elevador entre os pavimentos.' : 'Casa térrea no nível da rua.');
  return {itens, av, pen};
}

/* ---------- Avaliação ---------- */
function avalia(v, q){
  let pen = 0; const av = [];
  for(const p of v.pav) for(const s of p.salas){
    const t = TIPOS[s.tipo];
    if(s.nucleo) continue;
    if(p.anexo && (s.tipo==='rouparia'||s.tipo==='hall')) continue; const w = s.x1-s.x0, h = s.y1-s.y0, a = w*h, lmin = Math.min(w,h), lmax = Math.max(w,h);
    if(t.min && !s.vaga && s.nome!=='Área técnica'){
      if(a < t.min - 0.01){ pen += 6*(t.min-a); av.push(`${p.nome}: ${rotulo(s)} com ${f2(a)} m², abaixo do mínimo de ${f2(t.min)} m².`); }
      if(lmin < t.lado - 0.01){ pen += 12*(t.lado-lmin); av.push(`${p.nome}: ${rotulo(s)} com lado de ${f2(lmin)} m, abaixo de ${f2(t.lado)} m.`); }
      const ra = a / (t.alvo || a);
      if(ra > 1.8 && p.nome!=='Subsolo' && s.tipo!=='deposito' && !s.integra) pen += (ra-1.8)*4;
    }
    if(!['circ','hall','galeria','rampa','manobra','escada','rouparia','varanda','terraco','garagem','deposito','jardim'].includes(s.tipo) && lmax/lmin > 2.6) pen += 2*(lmax/lmin-2.6);
  }
  // dimensões pedidas: penaliza a diferença e avisa uma vez por tipo de cômodo
  const avisados = new Set();
  for(const p of v.pav) for(const s of p.salas){
    const d = q.dims && q.dims[s.tipo==='banhoMaster' ? '' : s.tipo]; if(!d || s.nucleo) continue;
    const w = s.x1-s.x0, h = s.y1-s.y0, a = w*h, mn = Math.min(w,h), mx = Math.max(w,h);
    let dif = 0, txt = '';
    if(d.w){ dif = Math.abs(mn - d.w) + Math.abs(mx - d.l); txt = `${f2(mn)} × ${f2(mx)} m (pedido ${f2(d.w)} × ${f2(d.l)} m)`; if(dif > 0.5) pen += 2*dif; }
    else { const rel = Math.abs(a - d.a)/d.a; dif = rel; txt = `${f2(a)} m² (pedido ${f2(d.a)} m²)`; if(rel > 0.2) pen += 10*rel; }
    if((d.w ? dif > 0.5 : dif > 0.2) && !avisados.has(s.tipo)){ avisados.add(s.tipo); av.push(`${p.nome}: ${rotulo(s)} ficou com ${txt}.`); }
  }
  // as aberturas dependem da orientação (sol nos quartos, divisa a menos de 1,50 m com recuos diferentes): guarda as duas,
  // em coordenadas sem espelho, para a vista normal e a espelhada usarem cada uma o seu conjunto (espelharCasa, semEspelho)
  const abrir = esp => { const avs = []; for(const p of v.pav){ if(p.fixo) continue; const ab = aberturas(p, q, p.nome==='Térreo', esp, v.W); p.portas = ab.portas; p.vaos = ab.vaos; p.janelas = ab.janelas;
    p.aberturasPor = Object.assign(p.aberturasPor || {}, {[esp ? 'espelhada' : 'normal']: {portas:ab.portas, vaos:ab.vaos, janelas:ab.janelas}}); avs.push(...ab.avisos); } return avs; };
  for(const p of v.pav) delete p.aberturasPor;
  let ori = null;
  if(RUMOS[q.orientacao] === undefined){
    // sem orientação, o sol não conta; com recuos iguais as janelas não dependem do espelho: abre uma vez e compara só o vento
    const avAb = abrir(false), vn = avaliaVento(v, q, false), ve = avaliaVento(v, q, true), sl = {pen:0, av:[]};
    ori = ve.pen < vn.pen ? {esp:true, avAb, vt:ve, sl} : {esp:false, avAb, vt:vn, sl};
    if(q.recX0 !== q.recX1){ const avE = abrir(true); if(ori.esp) ori.avAb = avE; else abrir(false); }
    else for(const p of v.pav) if(p.aberturasPor) p.aberturasPor.espelhada = p.aberturasPor.normal;
  } else {
    for(const esp of [false, true]){
      const avAb = abrir(esp), vt = avaliaVento(v, q, esp), sl = avaliaSol(v, q, esp), pn = 6*avAb.length + vt.pen + sl.pen + 25*quartosNoPoente(v, q, esp).length;
      if(!ori || pn < ori.pn) ori = {esp, avAb, vt, sl, pn};
    }
    if(!ori.esp){ abrir(false); avaliaSol(v, q, false); }   // a última rodada foi a espelhada: refaz a escolhida
  }   // a última rodada foi a espelhada: refaz as aberturas da escolhida
  av.push(...ori.avAb); pen += 6*ori.avAb.length;
  // íntimo nunca no poente: quarto encostado numa fachada a oeste perde pontos e só aparece se nenhuma variante escapar
  const noPoente = quartosNoPoente(v, q, ori.esp); v.intimoPoente = noPoente.length;
  if(noPoente.length){ pen += 8*noPoente.length; av.push(`${noPoente.join(', ')} encostado(s) na fachada a oeste (poente).`); }
  // terreno
  const B = q.frente - q.recX0 - q.recX1, Dmax = q.fundo - q.recFrente - q.recFundo;
  if(v.W > B + 0.01){ pen += 40*(v.W-B); av.push(`A casa (${f2(v.W)} m) é mais larga que a área edificável (${f2(B)} m).`); }
  if(v.D > Dmax + 0.01){ pen += 25*(v.D-Dmax); av.push(`A casa precisa de ${f2(v.D)} m de profundidade; o terreno permite ${f2(Dmax)} m.`); }
  // anexos estão em coordenadas do lote; aqui passam para as da casa
  const anexosCasa = (v.anexos||[]).map(a => ({tipo:a.tipo, x0:a.x0 - v.x0, y0:a.y0 - v.y0, x1:a.x1 - v.x0, y1:a.y1 - v.y0}));
  const proj = uniao(cobertura(v).concat(anexosCasa.filter(a => a.tipo!=='piscina')));
  if(v.anexoFalta) pen += 25*v.anexoFalta;
  const subA = v.pav.find(p => p.nome==='Subsolo');
  if(subA && q.subGaragem && subA.vagas < q.vagas) pen += 10*(q.vagas - subA.vagas);
  if(q.permeab > 0){
    // impermeável (união, sem contar duas vezes o que se sobrepõe): térreo, anexos (inclusive piscina), laje do subsolo,
    // rampa no recuo e os pisos de acesso (faixa de veículos, vagas descobertas e caminho de pedestres; auditoria M05)
    const imp = impermeaveis(v, q, anexosCasa, subA);
    const lote = q.frente*q.fundo, perm = Math.max(0, lote - uniao(imp)), pct = 100*perm/lote;
    v.permeavel = r2(pct);
    if(pct < q.permeab - 0.01){ pen += 2*(q.permeab - pct); av.push(`Área permeável de ${f2(pct)} % do lote, abaixo do mínimo de ${f2(q.permeab)} % (descontados a casa, os anexos, o subsolo e os pisos de acesso).`); }
  }
  for(const p of v.pav){ if(p.anexo || p.nome==='Subsolo' || p.nome==='Rooftop') continue;   // o rooftop já fecha essas bordas
    const perto = p.salas.filter(s => TIPOS[s.tipo].aberto && trechosExternos(s, p.salas).some(e => distDivisa(q, v.W, e.lado, e.c, ori.esp) < DIVISA_JANELA - 0.001));
    if(perto.length) av.push(`${p.nome}: ${[...new Set(perto.map(rotulo))].join(', ')} a menos de 1,50 m da divisa; feche essa face com parede (Código Civil, art. 1.301).`); }
  if(subA){ const fimSub = q.recFrente + subA.dim.y0 + subA.dim.D + 2.0; if(fimSub > q.fundo + 0.01){ pen += 25*(fimSub - q.fundo); av.push(`O subsolo com o jardim de inverno vai até ${f2(fimSub)} m; o lote tem ${f2(q.fundo)} m.`); } }
  if(v.anexoLarg) pen += 25*v.anexoLarg;
  const taxa = 100*proj/(q.frente*q.fundo);
  if(taxa > q.taxa + 0.01){ pen += 2*(taxa-q.taxa); av.push(`Ocupação de ${f2(taxa)} %, acima do máximo de ${f2(q.taxa)} %.`); }
  // acessibilidade (NBR 9050), só com a opção marcada
  if(q.acessivel){ const ac = verificaAcessibilidade(v, q); pen += ac.pen; av.push(...ac.av); v.acessibilidade = ac.itens; }
  // circulação
  const tot = v.pav.reduce((s,p)=>s+p.salas.filter(x=>!TIPOS[x.tipo].aberto).reduce((t,x)=>t+area(x),0),0);
  const circ = v.pav.reduce((s,p)=>s+p.salas.filter(x=>['circ','hall','galeria'].includes(x.tipo)).reduce((t,x)=>t+area(x),0),0);
  if(circ/tot > 0.14) pen += 60*(circ/tot-0.14);
  // vento de L/SE: compara a planta normal com a espelhada e sugere a melhor
  v.espelharVento = ori.esp;
  pen += ori.vt.pen + ori.sl.pen; av.push(...ori.vt.av, ...ori.sl.av);
  if(v.espelharVento) av.push(RUMOS[q.orientacao] !== undefined ? 'A versão espelhada recebe melhor o vento de leste/sudeste e o sol; ela já aparece espelhada.' : 'A versão espelhada recebe melhor o vento de leste/sudeste; ela já aparece espelhada.');
  v.score = Math.max(0, Math.round(100 - pen));
  v.avisos = (v.avisos||[]).concat(av);
  v.invalida = invalidez(v, q, av);
  v.ocupacao = r2(taxa); v.projecao = r2(proj); v.circPct = r2(100*circ/tot);
  return v;
}

/* Área exata da união de retângulos {x0,y0,x1,y1} (varredura pelas coordenadas x). */
function uniao(rs){
  rs = rs.filter(r => r.x1 - r.x0 > 1e-6 && r.y1 - r.y0 > 1e-6);
  const xs = [...new Set(rs.flatMap(r => [r.x0, r.x1]))].sort((a, b) => a - b);
  let A = 0;
  for(let i = 0; i < xs.length - 1; i++){
    const xm = (xs[i] + xs[i+1]) / 2, iv = rs.filter(r => r.x0 < xm && r.x1 > xm).map(r => [r.y0, r.y1]).sort((a, b) => a[0] - b[0]);
    let tot = 0, a = null, b = null;
    for(const [p, q] of iv){ if(a === null || p > b){ if(a !== null) tot += b - a; a = p; b = q; } else b = Math.max(b, q); }
    if(a !== null) tot += b - a;
    A += tot * (xs[i+1] - xs[i]);
  }
  return A;
}
/* Cobertura da casa: térreo (com varandas cobertas, sem terraço descoberto) unido aos pavimentos de cima
   (o superior inteiro, inclusive balanços e terraços sobre o térreo; o rooftop sem o terraço descoberto). */
function cobertura(v){
  const out = [];
  for(const p of v.pav){
    if(p.anexo || p.nome==='Subsolo') continue;
    out.push(...p.salas.filter(s => p.nome==='Superior' || (s.tipo!=='terraco' && s.tipo!=='jardim')));
  }
  return out;
}
function projecao(v){ return uniao(cobertura(v)); }
/* Motivos que tornam a variante inválida (etapa E1): ela sai do ranking em vez de só perder pontos.
   Cômodo fora do lote; cômodo nos recuos (o subsolo pode ocupá-los com a opção, e o jardim e a rampa sempre);
   cômodo sem ligação com o resto da casa (inclusive no rooftop). */
function invalidez(v, q, av){
  const E = 0.011, m = [];
  const lote = {x0:-v.x0, y0:-v.y0, x1:q.frente - v.x0, y1:q.fundo - v.y0};
  const edif = {x0:q.recX0 - v.x0, y0:q.recFrente - v.y0, x1:q.frente - q.recX1 - v.x0, y1:q.fundo - q.recFundo - v.y0};
  const dentro = (s, r) => s.x0 >= r.x0 - E && s.x1 <= r.x1 + E && s.y0 >= r.y0 - E && s.y1 <= r.y1 + E;
  for(const p of v.pav){
    if(p.anexo) continue;
    const sub = p.nome==='Subsolo', livre = sub && q.subRecuos !== 'nenhum';
    const fora = p.salas.filter(s => !dentro(s, lote)), recuo = p.salas.filter(s => dentro(s, lote) && !dentro(s, edif) && !(sub && (livre || s.tipo==='jardim' || s.tipo==='rampa')));
    // nomes agrupados com contagem: "3 × suíte, 3 × banho"
    const lista = L => { const c = new Map(); for(const s of L) c.set(rotulo(s), (c.get(rotulo(s)) || 0) + 1); return [...c].map(([n, k]) => k > 1 ? `${k} × ${n}` : n).join(', '); };
    if(fora.length) m.push(`${p.nome}: ${lista(fora)} fora do lote`);
    if(recuo.length) m.push(`${p.nome}: ${lista(recuo)} nos recuos`);
  }
  for(const a of av) if(/não se liga ao resto da casa/.test(a)) m.push(a.replace(/.$/, ''));
  return m;
}
/* Retângulos impermeáveis no sistema da casa. */
function impermeaveis(v, q, anexosCasa, subA){
  const ter = v.pav.find(p => p.nome==='Térreo'), out = ter.salas.filter(s => s.tipo!=='terraco' && s.tipo!=='jardim').concat(anexosCasa);
  if(subA){ const d = subA.dim; out.push({x0:d.x0, y0:d.y0, x1:d.x0 + d.W, y1:d.y0 + d.D}); if(subA.rampaFora && q.subGaragem) out.push(subA.rampaFora); }
  const ac = acessos(v, q);
  if(ac){
    out.push(...ac.vias, ...ac.vagasFora);
    if(ac.caminho) for(let i = 0; i < ac.caminho.pontos.length - 1; i++){ const [a, b] = [ac.caminho.pontos[i], ac.caminho.pontos[i+1]], m = ac.caminho.largura/2;
      out.push(a[0]===b[0] ? {x0:a[0]-m, x1:a[0]+m, y0:Math.min(a[1], b[1]), y1:Math.max(a[1], b[1])} : {x0:Math.min(a[0], b[0]), x1:Math.max(a[0], b[0]), y0:a[1]-m, y1:a[1]+m}); }
  }
  return out;
}

function quadro(v){
  const linhas = [];
  for(const p of v.pav){
    const fech = p.salas.filter(s => !TIPOS[s.tipo].aberto);
    const abertas = p.salas.filter(s => TIPOS[s.tipo].aberto);
    linhas.push({pav:p.nome, salas: p.salas.map(s => ({nome:s.nome, tipo:s.tipo, zona:s.zona, w:r2(s.x1-s.x0), h:r2(s.y1-s.y0), a:r2(area(s)), ilum:s.ilum||null})),
      fechada:r2(fech.reduce((t,s)=>t+area(s),0)), aberta:r2(abertas.reduce((t,s)=>t+area(s),0))});
  }
  const fechada = r2(linhas.reduce((t,l)=>t+l.fechada,0)), aberta = r2(linhas.reduce((t,l)=>t+l.aberta,0));
  return {pavimentos:linhas, fechada, aberta, total:r2(fechada+aberta)};
}

const f2 = n => (Math.round(n*100)/100).toFixed(2).replace('.', ',');

/* ---------- Acessos ----------
   Faixas de veículos (da rua até a garagem, a rampa e as vagas descobertas), portões e caminho de pedestres até a entrada.
   Coordenadas da casa (x da esquerda da casa, y da fachada frontal); a divisa frontal fica em y = −recFrente.
   Portão de veículos: une as faixas vizinhas. Portão social: 1,00 m, alinhado à porta de entrada, longe do portão de
   veículos (folga de 0,60 m) e do mesmo lado da porta, para o caminho não cruzar a faixa dos carros. */
const PORTAO_SOCIAL = 1.0, CAMINHO = 1.2, FOLGA_PORTOES = 0.6, VAGA_FORA = 2.5;
function acessos(v, q){
  const ter = v.pav.find(p => p.nome==='Térreo');
  if(!ter || v.x0 === undefined) return null;
  const yF = r2(-v.y0), xL = r2(-v.x0), xR = r2(q.frente - v.x0), vias = [], vagasFora = [];
  // garagem coberta: faixa até a face aberta para a frente
  for(const g of ter.salas.filter(x => x.tipo==='garagem')){
    const e = trechosExternos(g, ter.salas).filter(t => t.lado==='y0' && t.t1-t.t0 >= 2.4).sort((a,b) => (b.t1-b.t0)-(a.t1-a.t0))[0];
    if(e) vias.push({tipo:'garagem', x0:r2(e.t0), x1:r2(e.t1), y0:yF, y1:r2(e.c)});
  }
  // rampa do subsolo: faixa até o início da rampa
  const sub = v.pav.find(p => p.nome==='Subsolo');
  if(sub && q.subGaragem){
    const rp = sub.rampaFora || sub.salas.find(x => x.tipo==='rampa');
    if(rp) vias.push({tipo:'rampa', x0:r2(rp.x0), x1:r2(rp.x1), y0:yF, y1:r2(Math.max(yF, rp.y0))});
  }
  // porta de entrada e o ponto de chegada do caminho
  const ent = (ter.portas||[]).find(d => d.entrada);
  let alvo = null;
  if(ent){
    if(ent.o==='h'){ const dx = (ent.t0 + ent.t1)/2, sobre = ter.salas.filter(x => x.x0 <= dx + 0.001 && x.x1 >= dx - 0.001);
      alvo = {x:r2(dx), y:r2(sobre.length ? Math.min(...sobre.map(x => x.y0)) : 0), o:'h'}; }
    else alvo = {x:r2(ent.c - (ent.dentro || 1)*0.6), y:r2((ent.t0 + ent.t1)/2), o:'v'};
  }
  // vagas descobertas no recuo frontal, encostadas na faixa existente e longe da porta
  const nFora = q.garagem==='nenhuma' ? 0 : Math.max(0, (q.vagasT||0) - (v.garagemDentro||0));
  if(nFora > 0 && q.recFrente >= 2.5){
    const prof = r2(Math.min(5, q.recFrente - 0.2)), ref = alvo ? alvo.x : (xL + xR)/2;
    const bloco = vias.length ? {x0:Math.min(...vias.map(a => a.x0)), x1:Math.max(...vias.map(a => a.x1))} : null;
    // frentes de trabalho: a partir do bloco de faixas (ou da divisa mais longe da porta), primeiro o lado oposto à porta
    const lados = bloco ? (ref > (bloco.x0 + bloco.x1)/2 ? [[-1, bloco.x0], [1, bloco.x1]] : [[1, bloco.x1], [-1, bloco.x0]])
      : (ref > (xL + xR)/2 ? [[1, xL + 0.3], [-1, xR - 0.3]] : [[-1, xR - 0.3], [1, xL + 0.3]]);
    // com folga, deixa um corredor de 2,40 m alinhado à porta para o caminho passar entre os carros
    const colocar = corr => { const out = [];
      for(const [dir, x0] of lados){ let x = x0;
        while(out.length < nFora){
          let a = dir > 0 ? x : x - VAGA_FORA, b = a + VAGA_FORA;
          if(corr && a < corr[1] && b > corr[0]){ x = dir > 0 ? corr[1] : corr[0]; a = dir > 0 ? x : x - VAGA_FORA; b = a + VAGA_FORA; }
          if(a < xL + 0.2 - 0.001 || b > xR - 0.2 + 0.001 || out.some(g => g.x0 < b - 0.001 && g.x1 > a + 0.001)) break;
          out.push({x0:r2(a), x1:r2(b), y0:yF, y1:r2(yF + prof)}); x = dir > 0 ? b : a;
        }
      }
      return out.sort((a,b) => a.x0 - b.x0); };
    const comCorredor = alvo ? colocar([alvo.x - 1.2, alvo.x + 1.2]) : [], semCorredor = colocar(null);
    vagasFora.push(...(comCorredor.length >= semCorredor.length ? comCorredor : semCorredor));
  }
  // portões de veículos: faixas e vagas vizinhas (folga < 0,6 m) viram um portão só
  const iv = vias.map(a => [a.x0, a.x1]).concat(vagasFora.map(a => [a.x0, a.x1])).sort((a,b) => a[0]-b[0]), portoes = [];
  for(const [a,b] of iv){ const u = portoes[portoes.length-1]; if(u && a <= u.x1 + FOLGA_PORTOES) u.x1 = r2(Math.max(u.x1, b)); else portoes.push({tipo:'veiculos', x0:r2(a), x1:r2(b), y:yF}); }
  portoes.forEach(p => p.largura = r2(p.x1 - p.x0));
  // portão social: o mais perto possível do alinhamento da porta, fora dos portões de veículos e do mesmo lado da porta
  let caminho = null;
  if(alvo && alvo.o==='h'){
    const ocup = vias.concat(vagasFora).map(a => [a.x0 - CAMINHO/2 - 0.3, a.x1 + CAMINHO/2 + 0.3]);
    if(ocup.some(([a,b]) => alvo.x > a && alvo.x < b)){
      const fach = ter.salas.filter(x => x.y0 <= alvo.y + 0.01), x0f = Math.min(...fach.map(x => x.x0)) + 0.6, x1f = Math.max(...fach.map(x => x.x1)) - 0.6;
      const op = ocup.flat().filter(x => x >= x0f && x <= x1f && !ocup.some(([a,b]) => x > a + 0.001 && x < b - 0.001)).sort((a,b) => Math.abs(a - alvo.x) - Math.abs(b - alvo.x));
      if(op.length){ const nx = op[0], sobre = ter.salas.filter(x => x.x0 <= nx + 0.001 && x.x1 >= nx - 0.001);
        alvo = {x:r2(nx), y:r2(sobre.length ? Math.min(...sobre.map(x => x.y0)) : alvo.y), o:'h'}; }
    }
  }
  if(alvo){
    const meia = PORTAO_SOCIAL/2, lim0 = xL + 0.3 + meia, lim1 = xR - 0.3 - meia;
    const proib = portoes.map(p => [p.x0 - FOLGA_PORTOES - meia, p.x1 + FOLGA_PORTOES + meia]);
    const livre = x => x >= lim0 - 0.001 && x <= lim1 + 0.001 && !proib.some(([a,b]) => x > a + 0.001 && x < b - 0.001);
    const cruza = x => portoes.some(p => (p.x0 < Math.max(x, alvo.x) && p.x1 > Math.min(x, alvo.x)));
    const cands = [clamp(alvo.x, lim0, lim1), ...proib.flat()].map(r2).filter(livre);
    cands.sort((a,b) => (cruza(a) - cruza(b)) || Math.abs(a - alvo.x) - Math.abs(b - alvo.x));
    const gx = cands.length ? cands[0] : clamp(alvo.x, lim0, lim1);
    portoes.push(Object.assign({tipo:'pedestres', x0:r2(gx - meia), x1:r2(gx + meia), y:yF, largura:PORTAO_SOCIAL}, cands.length ? {} : {junto:true}));
    // pequeno desvio: chega reto pela fachada, se ela existe nesse alinhamento
    if(alvo.o==='h' && Math.abs(gx - alvo.x) <= 1.0){ const sobre = ter.salas.filter(x => x.x0 <= gx - 0.3 && x.x1 >= gx + 0.3);
      if(sobre.length) alvo = {x:gx, y:r2(Math.min(...sobre.map(x => x.y0))), o:'h'}; }
    let pts;
    if(Math.abs(gx - alvo.x) < 0.05) pts = [[gx, yF], [gx, alvo.y]];
    else if(alvo.o==='h'){ const yc = r2(Math.max(yF + 0.7, alvo.y - 0.9)); pts = [[gx, yF], [gx, yc], [alvo.x, yc], [alvo.x, alvo.y]]; }
    else pts = [[gx, yF], [gx, alvo.y], [alvo.x, alvo.y]];
    caminho = {largura:CAMINHO, pontos: pts.map(([x,y]) => [r2(x), r2(y)])};
  }
  const faltam = Math.max(0, nFora - vagasFora.length);
  return {yF, xL, xR, vias, vagasFora, portoes, caminho, faltam};
}

/* ---------- Geração ---------- */
/* ---------- Torre de ar (dossiê em torre/index.html) ----------
   Na ZB8 o vento manda; a chaminé pura rende pouco (ΔT de 1 a 3 K). Recomendação por tipologia:
   térrea → coroamento de sucção sobre o estar; sobrado → híbrida sobre a escada; rooftop → combinado na caixa de escada;
   casa em H → captador na ala a barlavento com shed no núcleo. */
const TORRES = {
  chamine:   {nome:'Chaminé (efeito chaminé)', curto:'chaminé', dCp:0.3, dT:2, ec:0, aviso:'exaustão do ar quente por efeito chaminé, com saídas altas nas quatro faces.'},
  succao:    {nome:'Coroamento de sucção', curto:'sucção', dCp:0.6, dT:2, ec:0, aviso:'o vento passa sobre o coroamento e cria sucção que puxa o ar de dentro (solução de Lelé); a saída fica a sotavento.'},
  solar:     {nome:'Chaminé solar', curto:'chaminé solar', dCp:0.3, dT:5, ec:0, aviso:'face a norte envidraçada e massa escura aquecem o ar da torre e reforçam a tiragem nas horas de sol.'},
  captador:  {nome:'Captador de vento', curto:'captador', dCp:1.0, dT:0, ec:0, aviso:'boca voltada para leste/sudeste capta o vento predominante e o desce para os ambientes; a saída é pelas janelas a sotavento.'},
  combinado: {nome:'Captador e exaustão combinados', curto:'combinado', dCp:1.0, dT:2, ec:0, aviso:'metade da torre capta o vento de leste/sudeste e a outra metade, a sotavento, exaure o ar quente.'},
  hibrida:   {nome:'Híbrida: sucção, chaminé solar e exaustor EC', curto:'híbrida', dCp:0.6, dT:5, ec:1500, aviso:'coroamento de sucção com chaminé solar e um exaustor EC de baixo consumo para as horas sem vento.'},
  shed:      {nome:'Captador com shed', curto:'shed', dCp:0.8, dT:2, ec:0, aviso:'captador na ala a barlavento e shed (aberturas altas a sotavento) no núcleo, para a ventilação cruzada entre as alas.'},
};
function torreRecomendada(v, q){
  if(q.rooftop) return 'combinado';
  if(q.tipo === 'sobrado') return 'hibrida';
  if(/em H/i.test(v.tipologia || "")) return "shed";
  return 'succao';
}
function comTorre(v, q){
  if(q.torreTipo === 'nenhuma') return v;
  const tipo = q.torreTipo === 'auto' ? torreRecomendada(v, q) : q.torreTipo, T = TORRES[tipo];
  const casa = v.pav.filter(p => !p.anexo && p.nome!=='Subsolo' && p.nome!=='Rooftop');
  const topo = casa[casa.length-1];
  const esc = topo.salas.find(s => s.tipo==='escada');
  const estar = casa[0].salas.find(s => s.tipo==='estar') || casa[0].salas.find(s => s.tipo==='jantar');
  const base = esc && (casa.length > 1 || q.rooftop) ? esc : estar;
  if(!base) return v;
  const cx = (base.x0+base.x1)/2, cy = (base.y0+base.y1)/2, t = 1.5;
  v.torre = {x0:r2(cx-t/2), y0:r2(cy-t/2), x1:r2(cx+t/2), y1:r2(cy+t/2), sobre: base===esc ? 'escada' : 'estar', tipo, nome:T.nome, curto:T.curto,
    auto: q.torreTipo === 'auto', recomendada: torreRecomendada(v, q), pavimentos: casa.length};
  v.avisos.push(`Torre de ar (${T.nome.toLowerCase()}) sobre ${base===esc ? 'a escada' : 'o estar'}: ${T.aviso}`);
  return v;
}

/* ---------- Circulação enxuta (05/10/2026) ----------
   O trecho final de um corredor que serve só a um quarto passa a fazer parte dele, e o hall de apoio
   encostado na cozinha (sem escada nem elevador) é integrado à cozinha. Só quando o resultado continua retangular
   e todos os vizinhos mantêm acesso. */
const ABSORVE = ['quarto','suite','master','salaIntima','closet','closetMaster'];
const DO_MODULO = ['banhoSuite','banhoMaster','closet','closetMaster'];
function enxuga(v, q){
  // íntimo nunca no poente (E2.8): com laterais a leste e oeste (frente norte ou sul), o fim de corredor encostado numa lateral
  // não vira parte do quarto, senão o quarto ganharia parede na fachada a oeste depois do espelho
  const F = q ? RUMOS[q.orientacao] : undefined;
  const lateralPoente = F !== undefined && ['x0','x1'].some(l => [false, true].some(e => classeSol(rumoFace(l, F, e)) === 3));
  for(const p of v.pav){
    if(p.nome==='Subsolo') continue;
    const S = p.salas;
    // hall de apoio → cozinha
    for(const h of S.filter(s => s.tipo==='hall' && !s.nucleo && s.nome===TIPOS.hall.nome)){
      if(S.some(o => (o.tipo==='escada' || o.tipo==='elevador') && compartilhado(o, h))) continue;
      const k = S.find(o => o.tipo==='cozinha' && compartilhado(o, h) && (compartilhado(o, h).o==='v' ? Math.abs(o.y0-h.y0)<0.001 && Math.abs(o.y1-h.y1)<0.001 : Math.abs(o.x0-h.x0)<0.001 && Math.abs(o.x1-h.x1)<0.001));
      if(!k) continue;
      const livre = ['circ','galeria','jantar','estar','tv','varanda','cozinha'];
      const semAcesso = S.filter(o => o!==h && o!==k && compartilhado(o, h) && !livre.includes(o.tipo)).some(o => {
        const pref = PREF[o.tipo] || [];
        if(pref.includes('cozinha') && compartilhado(o, k)) return false;
        return !S.some(x => x!==h && x!==o && pref.includes(x.tipo) && compartilhado(o, x) && compartilhado(o, x).t1 - compartilhado(o, x).t0 >= 0.85);
      });
      if(semAcesso) continue;
      k.x0 = Math.min(k.x0, h.x0); k.x1 = Math.max(k.x1, h.x1); k.y0 = Math.min(k.y0, h.y0); k.y1 = Math.max(k.y1, h.y1);
      k.integra = 1; S.splice(S.indexOf(h), 1);
    }
    // ponta do corredor → quarto do fim
    for(const c of S.filter(s => s.tipo==='circ' && !s.entrada)){
      const vert = (c.y1-c.y0) >= (c.x1-c.x0), a0 = vert ? 'y0' : 'x0', a1 = vert ? 'y1' : 'x1', b0 = vert ? 'x0' : 'y0', b1 = vert ? 'x1' : 'y1';
      for(const fim of [a1, a0]){
        const E = c[fim], pos = fim===a1;
        const viz = S.filter(o => o!==c && compartilhado(o, c)).map(o => ({o, sh:compartilhado(o, c)}));
        const naPonta = viz.filter(z => z.sh.o === (vert ? 'h' : 'v') && Math.abs(z.sh.c - E) < 0.001);
        if(naPonta.length) continue;                                  // a ponta encosta em outro cômodo: não é um fim de corredor
        const lado = viz.filter(z => z.sh.o === (vert ? 'v' : 'h'));
        const fins = lado.filter(z => ABSORVE.includes(z.o.tipo) && Math.abs(z.o[fim] - E) < 0.001);
        if(fins.length !== 1) continue;                               // a ponta serve a dois cômodos (ou a nenhum)
        const R = fins[0].o, corte = pos ? R[a0] : R[a1];
        if(Math.abs((pos ? corte - c[a0] : c[a1] - corte)) < 1.2) continue;
        const ok = lado.filter(z => z.o!==R && !(DO_MODULO.includes(z.o.tipo) && z.o.mod && z.o.mod===R.mod))
          .every(z => (pos ? Math.min(z.sh.t1, corte) - z.sh.t0 : z.sh.t1 - Math.max(z.sh.t0, corte)) >= 1.0 - 0.001);
        if(!ok) continue;
        if(lateralPoente){ const xs = S.map(x => [x.x0, x.x1]).flat(), xa = Math.min(...xs), xb = Math.max(...xs); if(c.x0 <= xa + 0.01 || c.x1 >= xb - 0.01) continue; }
        if(Math.abs(R[b1] - c[b0]) < 0.001) R[b1] = c[b1]; else R[b0] = c[b0];
        c[fim] = r2(corte); R.integra = 1;
      }
    }
  }
  return v;
}

/* Íntimo nunca no poente (E2.8, decisão de 06/10/2026). Com o fundo voltado para oeste (frente para leste), o gerador cria
   também variantes com o zoneamento invertido: quartos na frente, voltados para o nascente; salas e varanda no fundo; entrada
   pela ponta do corredor dos quartos. A garagem coberta não cabe na frente junto com os quartos: as vagas ficam descobertas
   no recuo. Por ora só na casa térrea sem subsolo (no sobrado e com subsolo, escada e rampa precisam ficar no lugar). */
function fundoNoPoente(q){ const F = RUMOS[q.orientacao]; return F !== undefined && classeSol(rumoFace('y1', F, false)) === 3; }
function inverteFrenteFundo(v, q){
  const D = v.D, fy = y => r2(D - y);
  for(const p of v.pav) for(const s of p.salas){ const a = fy(s.y1), b = fy(s.y0); s.y0 = a; s.y1 = b; }
  v.cotasY = (v.cotasY || []).map(fy).reverse();
  const ter = v.pav.find(p => p.nome==='Térreo');
  const c = ter && ter.salas.filter(s => s.tipo==='circ' && s.y0 < 0.01).sort((a, b) => (b.x1-b.x0) - (a.x1-a.x0))[0];
  if(!c) return null;                                     // sem corredor na frente não há por onde entrar
  c.entrada = true; c.nome = 'Hall de entrada e circulação'; ter.entradaFrente = true;
  v.zoneamento = 'invertido'; v.tipologia += ', íntimo na frente';
  v.avisos.push('Com o fundo voltado para o poente (oeste), os quartos foram para a frente, voltados para o nascente; salas e varanda ficam no fundo, e a entrada é pelo corredor dos quartos.');
  if(q.garagem==='coberta' && q.vagasT > 0) v.avisos.push('Nesta variante as vagas ficam descobertas no recuo frontal: a garagem coberta não cabe na frente junto com os quartos.');
  return v;
}

function geraTodas(q, P, Ws){
  const out = [];
  const push0 = out.push.bind(out);
  out.push = (...vs) => push0(...vs.map(v => comTorre(comRooftop(enxuga(v, q), q), q)));
  for(const W of Ws){
    const modos = [], f = q.formato, quer = x => f==='auto' || f===x;
    const larguraCol = (q.tipo==='sobrado'||q.subsolo) ? COL : C;
    if(quer('bloco') && W >= 2*TIPOS.suite.lado + larguraCol - 0.01) modos.push('duplo');
    if(quer('bloco') && (W <= 7.6 || (f==='bloco' && W < 2*TIPOS.suite.lado + larguraCol))) modos.push('simples');
    if(quer('L') && W >= 9) modos.push('L');
    for(const m of modos){ try{
      let v = linear(q, P, W, m);
      // no sobrado, se o superior for bem mais longo, aumenta as faixas do térreo (até 30 %) antes de criar varanda
      if(q.tipo==='sobrado' && v.Lsup && v.Lsup > v.Dter + 1.0){ const k = Math.min(1.3, 1 + (v.Lsup - v.Dter)/Math.max(1, v.Dter - (q.varanda?2:0))); v = linear(q, P, W, m, {cresce:k}); }
      out.push(v);
    }catch(e){ /* combinação inviável */ }
      if(fundoNoPoente(q) && q.tipo==='terrea' && !q.subsolo) try{
        const qi = q.garagem==='coberta' ? Object.assign({}, q, {garagem:'descoberta'}) : q;
        const vi = inverteFrenteFundo(linear(qi, P, W, m), q); if(vi) out.push(vi);
      }catch(e){ /* inviável */ }
      if(q.tipo==='sobrado' && (q.subsolo || q.elevador)) try{ let ve = linear(q, P, W, m, {empilha:true});
        if(ve.Lsup && ve.Lsup > ve.Dter + 1.0){ const k = Math.min(1.3, 1 + (ve.Lsup - ve.Dter)/Math.max(1, ve.Dter - (q.varanda?2:0))); ve = linear(q, P, W, m, {empilha:true, cresce:k}); }
        out.push(ve); }catch(e){ /* inviável */ }
    }
    const soTerrea = q.tipo==='terrea';
    if(quer('H') && W >= 15 && soTerrea){ const h = emH(q, P, W); if(h) out.push(h); }
    if(quer('U') && W >= 12){ try{ const u = emU(q, P, W); if(u) out.push(u); }catch(e){ /* inviável */ } }
  }
  return out;
}

/* Inversões pedidas (E2.3): estar ↔ jantar na faixa social e cozinha ↔ serviço na coluna de apoio. Devolve outro programa. */
function invertido(P, q){
  const troca = (arr, a, b) => { const i = arr.indexOf(a), j = arr.indexOf(b); if(i < 0 || j < 0) return false; arr[i] = b; arr[j] = a; return true; };
  const Pi = Object.assign({}, P, {social:P.social.slice(), apoioDir:P.apoioDir.slice()}), feitas = [];
  if(q.invEstarJantar && troca(Pi.social, 'estar', 'jantar')) feitas.push('estar e jantar');
  if(q.invCozinhaServico && troca(Pi.apoioDir, 'cozinha', 'servico')) feitas.push('cozinha e serviço');
  return {Pi, feitas};
}
/* Com cozinha aberta, a cozinha precisa continuar encostada no jantar (ao menos 1,00 m de parede comum). */
function cozinhaNoJantar(v){
  const t = v.pav.find(p => p.nome==='Térreo'); if(!t) return true;
  const k = t.salas.find(s => s.tipo==='cozinha'), j = t.salas.find(s => s.tipo==='jantar'); if(!k || !j) return true;
  const sh = compartilhado(k, j); return !!sh && sh.t1 - sh.t0 >= 1.0;
}

function gerar(entrada, opts){
  const q = normaliza(entrada);
  let P = programa(q);
  const B = r2(q.frente - q.recX0 - q.recX1), Dmax = r2(q.fundo - q.recFrente - q.recFundo);
  const avisos = [];
  if(!q.orientacao) avisos.push('Informe para onde a frente do terreno está voltada (rosa dos ventos no bloco Terreno). Sem isso, a rosa das plantas não mostra a orientação real.');
  if(B < 5) avisos.push(`A área edificável tem só ${f2(B)} m de largura.`);
  const Ws = [];
  // larguras testadas: de 0,5 em 0,5 m nos 6 m mais largos e, em lote grande, de 1 em 1 m até 8 m (antes só os 6 m mais largos:
  // num lote de 40 m toda casa saía com 31 m ou mais)
  for(let w = Math.floor(B*2)/2; w >= Math.max(6, B-6); w -= (B > 20 ? 1 : 0.5)) Ws.push(r2(w));
  for(let w = Math.floor(B-6) - 1; w >= 8; w -= (w > 16 ? 2 : 1)) Ws.push(r2(w));
  if(!Ws.length) Ws.push(B);
  const NOMES = {bloco:'bloco único', L:'em L', U:'em U', H:'em H'};
  if(q.formato==='H' && q.tipo==='sobrado') avisos.push('O formato em H está disponível só para casa térrea (com ou sem subsolo).');
  // opts.posAvalia: avaliações extras (estrutura etc.), aplicadas antes da ordenação; sem elas o resultado não muda
  const monta = P0 => geraTodas(q, P0, Ws).map(v => avalia(comAnexos(v, q), q)).map(v => { for(const fn of ((opts && opts.posAvalia) || [])) fn(v, q); return v; });
  let todas;
  if(q.invEstarJantar || q.invCozinhaServico){
    const {Pi, feitas} = invertido(P, q);
    if(!feitas.length) avisos.push('Inversão pedida sem efeito: o programa não tem os dois cômodos de cada par.');
    const inv = feitas.length ? monta(Pi).map(v => Object.assign(v, {invertido:feitas})) : [];
    const ok = v => q.cozinha!=='aberta' || cozinhaNoJantar(v);          // cozinha aberta continua encostada no jantar
    if(inv.some(v => ok(v) && !v.invalida.length)){ todas = inv.filter(ok); P = Pi; }
    else { todas = monta(P); if(feitas.length) avisos.push(`A inversão de ${feitas.join(' e de ')} não coube neste terreno${q.cozinha==='aberta' ? ' com a cozinha aberta encostada no jantar' : ''}; as variantes mostram a ordem normal.`); }
  } else todas = monta(P);
  if(!todas.length && q.formato!=='auto') avisos.push(`O formato ${NOMES[q.formato]} não cabe na área edificável de ${f2(B)} m de largura. Veja o terreno mínimo para este formato ou escolha outro.`);
  todas.sort((a,b) => b.score-a.score || a.W*a.D-b.W*b.D);
  // até 3 variantes, preferindo tipologias diferentes
  const escolhidas = [];
  // quarto voltado para o poente nunca: essas variantes só aparecem se nenhuma outra escapar
  // variantes inválidas (fora do lote, nos recuos, cômodo sem ligação) não entram no ranking
  const validas = todas.filter(v => !v.invalida.length);
  if(todas.length && !validas.length){ const m = todas[0].invalida; avisos.push(`Nenhuma variante cabe neste terreno com este programa. A mais próxima tem: ${m.slice(0, 3).join('; ')}${m.length > 3 ? '…' : ''}. Veja o terreno mínimo ou reduza o programa.`); }
  const semIntimo = validas.filter(v => !v.quartosPoente && !v.intimoPoente);
  const semPoente = semIntimo.length ? semIntimo : validas.filter(v => !v.quartosPoente), elegiveis0 = semPoente.length ? semPoente : validas;
  if(validas.length && !semIntimo.length && validas.some(v => v.intimoPoente)) avisos.push(`Nenhuma variante tirou todos os quartos da fachada a oeste (poente) neste terreno${q.subsolo || q.tipo==='sobrado' ? ' (com subsolo ou sobrado, o íntimo ainda não vai para a frente)' : ''}; veja os pontos de atenção.`);
  // variantes com nota 0 só aparecem se nenhuma outra montar
  const comNota = elegiveis0.filter(v => v.score > 0), elegiveis = comNota.length ? comNota : elegiveis0;
  if(!semPoente.length && validas.length) avisos.push('Nenhuma variante deixou todos os quartos fora do poente (oeste) neste terreno; veja os pontos de atenção.');
  for(const v of elegiveis){ if(escolhidas.length>=3) break; if(!escolhidas.some(e => e.tipologia===v.tipologia)) escolhidas.push(v); }
  for(const v of elegiveis){ if(escolhidas.length>=3) break; if(!escolhidas.includes(v) && !escolhidas.some(e => e.tipologia===v.tipologia && Math.abs(e.W-v.W)<1)) escolhidas.push(v); }
  escolhidas.forEach((v,i) => { v.nome = 'Variante ' + String.fromCharCode(65+i); v.quadro = quadro(v); v.loteFrente = q.frente; v.rumo = q.orientacao; v.lote = {frente:q.frente, fundo:q.fundo, recFrente:q.recFrente, recX0:q.recX0, recX1:q.recX1, recFundo:q.recFundo}; v.acessos = acessos(v, q);
    // acessos da versão espelhada: a casa vira no lugar e o lote não (com recuos diferentes, espelhar os acessos em torno do lote erraria)
    const ve = espelharCasa(v); v.acessosEsp = acessos(ve, q);
    if(v.acessos && v.acessos.portoes.some(p => p.junto)) v.avisos.push('A frente do lote não comporta portão social separado do portão de veículos; os dois ficam juntos.');
    if(v.acessos && v.acessos.faltam) v.avisos.push(`Só ${v.acessos.vagasFora.length} vaga(s) descoberta(s) cabem no recuo frontal; faltam ${v.acessos.faltam}.`); });
  const lm = loteMinimo(q, P);
  if(escolhidas.length && escolhidas[0].score < 60) avisos.push('O programa não cabe bem neste terreno. Veja o terreno mínimo sugerido.');
  return {entrada:q, B, Dmax, variantes:escolhidas, loteMinimo:lm, avisos, escada: (q.tipo==='sobrado'||q.subsolo) ? escada(q) : null};
}

/* Espelha a casa no lugar (x → W − x): pavimentos, aberturas, poços, pilares, núcleo, spa, fechamentos do rooftop e o subsolo.
   A casa não muda de posição no lote (fica centrada na faixa edificável); acessos e anexos são tratados por quem chama.
   Usado pelo desenho (Desenho.espelha) e por gerar(), que calcula os acessos da versão espelhada (v.acessosEsp). */
function espelharCasa(v){
  const W = v.W, c = JSON.parse(JSON.stringify(v));
  // aberturas calculadas para a vista espelhada (ainda em coordenadas sem espelho); depois tudo vira
  for(const p of c.pav) if(p.aberturasPor && p.aberturasPor.espelhada){ Object.assign(p, p.aberturasPor.espelhada); delete p.aberturasPor; }
  const fx = x => +(W - x).toFixed(2), vira = r => { const a = fx(r.x1), b = fx(r.x0); r.x0 = a; r.x1 = b; };
  for(const p of c.pav){
    if(p.anexo) continue;
    if(p.pocos) p.pocos.forEach(vira);
    if(p.pilares) for(const pl of p.pilares) pl.x = fx(pl.x);
    if(p.nucleo) vira(p.nucleo);
    if(p.spa) p.spa.x = fx(p.spa.x);
    if(p.fechamentos) for(const k of ['normal', 'espelhada']) for(const e of p.fechamentos[k]){ if(e.o==='v') e.c = fx(e.c); else { const a = fx(e.t1), b = fx(e.t0); e.t0 = a; e.t1 = b; } }
    if(p.dim && p.dim.x0 !== undefined) p.dim.x0 = +(W - p.dim.x0 - p.dim.W).toFixed(2);
    if(p.rampa && p.rampa.x0 !== undefined) p.rampa.x0 = +(W - p.rampa.x0 - p.rampa.largura).toFixed(2);
    if(p.rampaFora) vira(p.rampaFora);
    if(p.manobra && p.manobra.x0 !== undefined) vira(p.manobra);
    for(const m of (p.manobras || [])) if(m.x0 !== undefined) vira(m);
    p.salas.forEach(vira);
    for(const k of ['portas','vaos','janelas']) for(const e of (p[k]||[])){
      if(e.o==='v'){ e.c = fx(e.c); if(e.dentro) e.dentro *= -1; }
      else { const a = fx(e.t1), b = fx(e.t0); e.t0 = a; e.t1 = b; e.dobra = !e.dobra; }
    }
  }
  if(c.patios) c.patios.forEach(vira);
  if(c.torre) vira(c.torre);
  c.espelhada = true;
  return c;
}

/* A variante na vista normal (sem espelho), com as aberturas calculadas para ela. */
function semEspelho(v){
  if(!v.pav.some(p => p.aberturasPor)) return v;
  const c = JSON.parse(JSON.stringify(v));
  for(const p of c.pav) if(p.aberturasPor && p.aberturasPor.normal){ Object.assign(p, p.aberturasPor.normal); delete p.aberturasPor; }
  return c;
}

/* Profundidade necessária atrás da casa: recuo, anexos e o subsolo (com o jardim de inverno). */
function atrasDe(v, q){
  let t = Math.max(q.recFundo, q.anexoFundo ? v.anexoProf : v.anexoProf + q.recFundo);
  const sub = v.pav.find(p => p.nome==='Subsolo');
  if(sub) t = Math.max(t, sub.dim.y0 + sub.dim.D + 2.0 - v.D);
  return t;
}

/* Menor terreno (frente × fundo) em que a melhor variante cabe sem violações de terreno. */
function loteMinimo(q0, P){
  const q = Object.assign({}, q0, {subMin:true});            // aqui o subsolo fica sob a casa: o máximo de vagas depende do lote real
  let best = null;
  for(let W = 6; W <= 24; W += 0.5){
    const vs = geraTodas(q, P, [W]);
    for(const v of vs){
      const fr = r2(W + q.recX0 + q.recX1);
      comAnexos(v, Object.assign({}, q, {frente:fr, fundo:999}));
      const atras = atrasDe(v, q);
      let fu = Math.ceil((v.D + q.recFrente + atras)*2)/2;
      const q2 = Object.assign({}, q, {frente:fr, fundo:fu});
      avalia(comAnexos(v, q2), q2);
      const proj = v.projecao;
      if(100*proj/(fr*fu) > q.taxa) fu = r2(Math.ceil(proj/(q.taxa/100)/fr*2)/2);
      if(v.score < 70 || v.invalida.length) continue;
      const a = fr*fu;
      if(!best || a < best.area - 0.01) best = {frente:fr, fundo:fu, area:r2(a), tipologia:v.tipologia, W:v.W, D:v.D};
    }
  }
  // fundo mínimo mantendo a frente informada
  let comFrente = null;
  const q9 = Object.assign({}, q, {fundo: 999});
  const vs = geraTodas(q, P, [r2(q.frente - q.recX0 - q.recX1)]).map(v => avalia(comAnexos(v, q9), q9));
  const fundoDe = v => v.D + atrasDe(v, q);
  const bons = vs.filter(v => v.score >= 70 && !v.invalida.length);
  (bons.length ? bons : vs).sort((a,b) => bons.length ? fundoDe(a)-fundoDe(b) : b.score-a.score);
  if(vs.length){ const v = (bons.length ? bons : vs)[0]; const atras = atrasDe(v, q);
    comFrente = {frente:q.frente, fundo:r2(Math.ceil((v.D + q.recFrente + atras)*2)/2), tipologia:v.tipologia}; }
  return {minimo:best, comFrente};
}

// versão do motor (gravada nos arquivos de projeto): ano.mês.dia da última mudança de regra
const VERSAO = '2026.10.06';

return {VERSAO, gerar, espelharCasa, semEspelho, rooftopOpcoes, RT, acessos, edicula, normaliza, BANHO_ACESSIVEL, verificaAcessibilidade, TORRES, torreRecomendada, ladoDaJanela, rumoFace, DIMENSIONAVEIS, RUMOS, NOMES_RUMO, programa, escada, TIPOS, PADRAO, f2, area, _interno:{linear, emH, faixa, faixaIntima, compartilhado, trechosExternos, avalia, uniao, cobertura}};
});
