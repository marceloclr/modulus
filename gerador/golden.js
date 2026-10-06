/* Testes de caracterização ("golden"): grava a saída atual do motor e o hash dos desenhos e compara depois de cada mudança.
   Roda junto com node gerador/testes.js. Para regravar de propósito: node gerador/testes.js --atualizar-golden (e justificar no commit). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const M = require('./motor.js'), D = require('./desenho.js');
const {CASOS} = require('./testes.js');

const ARQ = path.join(__dirname, 'golden', 'saida.json');
const LIMITE_MS = 150;

// casos extras: subsolo nos dois tipos e em cada formato, orientações, edícula de 1 pavimento, programa mínimo e o padrão da página
const EXTRAS = {
  'Padrão da página': {},
  'Térrea em bloco com subsolo, 12 × 30': {frente:12, fundo:30, formato:'bloco', quartos:3, suites:2, subsolo:true, vagas:2},
  'Térrea em L com subsolo semienterrado, 16 × 34': {frente:16, fundo:34, formato:'L', quartos:3, suites:2, subsolo:true, subNivel:'meio', vagas:2},
  'Sobrado em L com subsolo, 16 × 34': {frente:16, fundo:34, tipo:'sobrado', formato:'L', quartos:4, suites:3, subsolo:true, vagas:2},
  'Sobrado em U com subsolo, 22 × 34': {frente:22, fundo:34, tipo:'sobrado', formato:'U', quartos:4, suites:3, subsolo:true, vagas:3},
  'Sobrado em bloco, subsolo enterrado e vagas nos dois, 12 × 32': {frente:12, fundo:32, tipo:'sobrado', formato:'bloco', quartos:3, suites:2, subsolo:true, subNivel:'inteiro', garagemLocal:'ambos', vagas:2, vagasTerreo:1},
  'Frente para oeste, 12 × 30': {frente:12, fundo:30, quartos:3, suites:2, orientacao:'O'},
  'Frente para nordeste com varanda em L, 14 × 30': {frente:14, fundo:30, quartos:3, suites:2, orientacao:'NE', varandaForma:'L'},
  'Edícula de 1 pavimento, 14 × 40': {frente:14, fundo:40, quartos:3, suites:1, edicula:'1'},
  'Programa mínimo, 8 × 20': {frente:8, fundo:20, quartos:1, suites:0, master:false, banhosSociais:1, vagas:0, garagem:'nenhuma', varanda:false},
};
const TODOS = Object.assign({}, CASOS, EXTRAS);

// JSON canônico: chaves ordenadas e números arredondados (4 casas), para o hash não depender da ordem de criação
function canon(x){
  if(typeof x === 'number') return Number.isFinite(x) ? Math.round(x*1e4)/1e4 : String(x);
  if(Array.isArray(x)) return x.map(canon);
  if(x && typeof x === 'object'){ const o = {}; for(const k of Object.keys(x).sort()) if(x[k] !== undefined && typeof x[k] !== 'function') o[k] = canon(x[k]); return o; }
  return x;
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

function caso(c){
  const r = M.gerar(c);
  const motor = sha(JSON.stringify(canon(r)));
  const resumo = r.variantes.map(v => `${v.nome}: ${v.tipologia}, ${M.f2(v.W)} × ${M.f2(v.D)} m, ${M.f2(v.quadro.fechada)} m², nota ${v.score}`);
  const svg = {};
  for(const v of r.variantes){
    v.pav.forEach((p, i) => { svg[`${v.nome}/${p.nome}`] = sha(D.planta(v, i)); });
    // planta humanizada (etapa F1); os ids dos padrões têm um contador por desenho, neutralizado aqui
    v.pav.forEach((p, i) => { svg[`${v.nome}/humanizada/${p.nome}`] = sha(D.planta(v, i, {estilo:'humanizada'}).replace(/hz\d+_/g, 'hz_')); });
    const ter = Math.max(0, v.pav.findIndex(p => p.nome==='Térreo'));
    svg[`${v.nome}/espelhada/${v.pav[ter].nome}`] = sha(D.planta(D.espelha(v), ter));
    svg[`${v.nome}/lote`] = sha(D.lote(v, r.entrada, r));
  }
  return {motor, resumo, svg};
}

function calcular(){ const o = {}; for(const [nome, c] of Object.entries(TODOS)) o[nome] = caso(c); return o; }

function gravar(){
  const o = calcular();
  fs.mkdirSync(path.dirname(ARQ), {recursive:true});
  fs.writeFileSync(ARQ, JSON.stringify(o, null, 1) + '\n');
  return {falhas:0, linhas:[`golden regravado: ${Object.keys(o).length} casos em gerador/golden/saida.json (justifique no commit)`]};
}

function verificar(){
  if(!fs.existsSync(ARQ)) return {falhas:1, linhas:['FALHA golden: gerador/golden/saida.json não existe (rode com --atualizar-golden)']};
  const ref = JSON.parse(fs.readFileSync(ARQ, 'utf8')), atual = calcular(), linhas = [];
  let falhas = 0;
  for(const nome of new Set([...Object.keys(ref), ...Object.keys(atual)])){
    const a = ref[nome], b = atual[nome], difs = [];
    if(!a){ difs.push('caso novo, sem referência gravada'); }
    else if(!b){ difs.push('caso gravado não existe mais'); }
    else {
      if(a.motor !== b.motor){ difs.push('saída do motor mudou');
        a.resumo.forEach((s, i) => { if(s !== b.resumo[i]) difs.push(`antes  ${s}`, `depois ${b.resumo[i] || '(sem variante)'}`); });
        b.resumo.slice(a.resumo.length).forEach(s => difs.push(`nova   ${s}`)); }
      for(const k of new Set([...Object.keys(a.svg), ...Object.keys(b.svg)])) if(a.svg[k] !== b.svg[k]) difs.push(`desenho mudou: ${k}`);
    }
    if(difs.length){ falhas++; linhas.push(`FALHA golden ${nome}`); difs.slice(0, 10).forEach(d => linhas.push('      - ' + d)); }
  }
  linhas.push(falhas ? `golden: ${falhas} caso(s) diferentes da saída gravada` : `golden: ${Object.keys(atual).length} casos idênticos à saída gravada`);
  return {falhas, linhas};
}

// tempo de geração (mediana de 3) por caso; acima do limite só avisa, porque depende da máquina
function tempos(){
  const res = [];
  for(const [nome, c] of Object.entries(TODOS)){
    const t = [];
    for(let i = 0; i < 3; i++){ const t0 = process.hrtime.bigint(); M.gerar(c); t.push(Number(process.hrtime.bigint() - t0) / 1e6); }
    t.sort((x, y) => x - y); res.push({nome, ms: t[1]});
  }
  res.sort((x, y) => y.ms - x.ms);
  const lentos = res.filter(r => r.ms > LIMITE_MS);
  const linhas = [`tempo de geração: máx. ${res[0].ms.toFixed(1)} ms (${res[0].nome}); mediana ${res[Math.floor(res.length/2)].ms.toFixed(1)} ms; limite ${LIMITE_MS} ms`];
  lentos.forEach(r => linhas.push(`AVISO lento: ${r.nome} → ${r.ms.toFixed(1)} ms`));
  return {res, lentos, linhas};
}

module.exports = {TODOS, EXTRAS, canon, caso, calcular, gravar, verificar, tempos, LIMITE_MS};
