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

// ---------- blocos (lógica pura) ----------
const U = require('./ui-blocos.js');
const INI = Estado.blocosIniciais();
t('blocos: editar o bloco 1 deixa "pronto" ou "em edição"; concluir libera o estilo', () => {
  igual(U.aposAlterar(INI, 'b1', 'frente', true).b1, 'pronto');
  igual(U.aposAlterar(INI, 'b1', 'frente', false).b1, 'em-edicao');
  igual(U.travas(INI).b4, 'bloqueado');
  const c = U.aposConcluir(INI, 'b1'); igual(c.b1, 'concluido'); igual(c.b4, 'a-definir');
  igual(U.proximo(INI, 'b1'), 'b2'); igual(U.proximo(Object.assign({}, INI, {b2:'concluido', b3:'concluido'}), 'b3'), null, 'bloco 4 travado não é o próximo');
  igual(U.proximo(c, 'b3'), 'b4');
});
t('blocos: mudar o bloco 1 manda os seguintes concluídos para "revisar"', () => {
  const tudo = {b1:'concluido', b2:'concluido', b3:'concluido', b4:'concluido'};
  igual(U.aposAlterar(tudo, 'b1', 'formato', true), {b1:'concluido', b2:'concluido', b3:'revisar', b4:'revisar'});
  igual(U.aposAlterar(tudo, 'b1', 'd_quarto_w', true), {b1:'concluido', b2:'concluido', b3:'concluido', b4:'revisar'}, 'dimensão de cômodo não mexe no solar');
  igual(U.aposAlterar(tudo, 'b1', 'quartos', true).b3, 'revisar');
  igual(U.aposAlterar(tudo, 'b1', 'frente', false), {b1:'em-edicao', b2:'concluido', b3:'revisar', b4:'bloqueado'}, 'bloco 1 inválido trava o estilo');
  igual(U.aposAlterar(tudo, 'b2', 'x', true), tudo, 'bloco 2 não invalida os outros');
});

// ---------- sol nos quartos (motor) ----------
t('sol: nenhum quarto com janela voltada para o poente, nos 8 rumos e nos formatos', () => {
  const rf = (lado, F, esp) => { let a = {y0:0, x1:90, y1:180, x0:270}[lado]; if(esp && (lado==='x0'||lado==='x1')) a = 360 - a; return (F + a) % 360; };
  const dif = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180), E = 0.001, erros = [];
  const lado = (j, s) => j.o==='v' ? (j.t0 >= s.y0-E && j.t1 <= s.y1+E ? (Math.abs(j.c-s.x0)<E ? 'x0' : Math.abs(j.c-s.x1)<E ? 'x1' : null) : null)
    : (j.t0 >= s.x0-E && j.t1 <= s.x1+E ? (Math.abs(j.c-s.y0)<E ? 'y0' : Math.abs(j.c-s.y1)<E ? 'y1' : null) : null);
  const formatos = [{}, {tipo:'sobrado', quartos:4, suites:2}, {frente:16, fundo:34, formato:'L'}, {frente:22, fundo:30, formato:'U'}, {frente:22, fundo:30, formato:'H'}];
  for(const c of formatos) for(const R of Object.keys(M.RUMOS)){
    const r = M.gerar(Object.assign({orientacao:R}, c));
    for(const v of r.variantes) for(const p of v.pav){
      if(p.nome==='Subsolo' || p.nome==='Rooftop') continue;
      for(const s of p.salas.filter(x => ['quarto','suite','master'].includes(x.tipo)))
        for(const j of (p.janelas||[])){ const l = lado(j, s); if(l && dif(rf(l, M.RUMOS[R], v.espelharVento), 270) <= 22.5) erros.push(`${JSON.stringify(c)} frente ${R} ${v.nome}/${p.nome}: ${s.nome||s.tipo}`); }
    }
  }
  ok(!erros.length, erros.slice(0, 3).join('; '));
});

function rodar(){
  const linhas = []; let falhas = 0;
  for(const {nome, fn} of testes){ try{ fn(); }catch(e){ falhas++; linhas.push(`FALHA unidade ${nome}: ${e.message}`); } }
  linhas.push(falhas ? `unidades: ${falhas} de ${testes.length} falharam` : `unidades: ${testes.length} testes passaram`);
  return {falhas, linhas};
}
module.exports = {rodar, t, igual, ok};
