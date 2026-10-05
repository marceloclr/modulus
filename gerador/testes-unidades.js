/* Testes unitários dos módulos da interface e das análises (estado, blocos…). Roda dentro de node gerador/testes.js. */
'use strict';
const M = require('./motor.js'), Estado = require('./estado.js');

const testes = [];
const t = (nome, fn) => testes.push({nome, fn});
function igual(a, b, msg){ const x = JSON.stringify(a), y = JSON.stringify(b); if(x !== y) throw new Error(`${msg||''} esperado ${y}, obtido ${x}`); }
function ok(v, msg){ if(!v) throw new Error(msg || 'condição falsa'); }

// ---------- estado ----------
const P = M.PADRAO;
t('estado: ida e volta pela URL com acentos, blocos e ui', () => {
  const e = Estado.novo(P);
  Object.assign(e.entrada, {frente:15, tipo:'sobrado', orientacao:'SE', d_quarto_w:3.2, notaLivre:'Varanda à direita'});
  Object.assign(e.ui, {variante:2, pavimento:1, espelho:true, abertos:['b1']});
  e.ui.blocos.b1 = 'concluido'; e.ui.blocos.b4 = 'a-definir';
  const h = Estado.paraHash(e, P);
  ok(h.startsWith('#s=') && !/[+/=]/.test(h.slice(3)), 'hash em base64url');
  const r = Estado.deHash(h, P);
  igual(r.entrada.frente, 15); igual(r.entrada.tipo, 'sobrado'); igual(r.entrada.notaLivre, 'Varanda à direita'); igual(r.entrada.fundo, P.fundo);
  igual(r.ui, {blocos:{b1:'concluido', b2:'a-definir', b3:'a-definir', b4:'a-definir'}, abertos:['b1'], variante:2, pavimento:1, espelho:true});
});
t('estado: só as diferenças do padrão vão para o link', () => {
  igual(Estado.diferencas(Object.assign({}, P, {quartos:4}), P), {quartos:4});
  igual(Estado.diferencas(Object.assign({}, P, {d_sala_a:NaN}), P), {});
});
t('estado: link antigo #q=…&v=…&e=… continua abrindo', () => {
  const ent = M.normaliza({frente:11, quartos:2, orientacao:'L'});
  const antigo = '#q=' + Buffer.from(JSON.stringify(ent), 'utf8').toString('base64') + '&v=1&e=1';
  const r = Estado.deHash(antigo, P);
  igual(r.entrada.frente, 11); igual(r.entrada.orientacao, 'L'); igual(r.ui.variante, 1); igual(r.ui.espelho, true);
  igual(Estado.deHash('#q=' + Buffer.from(JSON.stringify(ent)).toString('base64') + '&v=0', P).ui.espelho, null, 'sem &e= o espelho fica a decidir');
});
t('estado: hash inválido ou ausente devolve null', () => {
  igual(Estado.deHash('', P), null); igual(Estado.deHash('#s=%%%', P), null); igual(Estado.deHash('#q=bm9wZQ', P), null);
});
t('estado: navegador (localStorage) ida e volta e repositório com assinatura', () => {
  const s = Estado.criar(P); let avisos = 0; s.assinar(() => avisos++);
  ok(s.escrever('entrada.frente', 20)); ok(!s.escrever('entrada.frente', 20), 'mesmo valor não avisa'); s.escrever('ui.blocos.b2', 'revisar');
  igual(avisos, 2);
  const r = Estado.deLocal(s.paraLocal(), P); igual(r.entrada.frente, 20); igual(r.ui.blocos.b2, 'revisar');
  igual(Estado.deLocal('lixo', P), null);
});

function rodar(){
  const linhas = []; let falhas = 0;
  for(const {nome, fn} of testes){ try{ fn(); }catch(e){ falhas++; linhas.push(`FALHA unidade ${nome}: ${e.message}`); } }
  linhas.push(falhas ? `unidades: ${falhas} de ${testes.length} falharam` : `unidades: ${testes.length} testes passaram`);
  return {falhas, linhas};
}
module.exports = {rodar, t, igual, ok};
