/* Arquivo do projeto (.modulus.json): o usuário salva e abre onde quiser (computador, Drive, Dropbox…), sem conta.
   Leva o programa, a variante escolhida, o espelhamento, o resumo, o custo estimado com o mês de referência,
   a versão do motor e a data. Abre também os formatos antigos: o "programa.json" (só os campos) e os itens
   exportados do banco. Funções puras (Node e navegador). */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./motor.js'));
  else root.Projeto = factory(root.Motor);
})(this, function(Motor){
'use strict';
const TIPO = 'modulus-projeto', VERSAO = 1;

/* Monta o objeto do arquivo. extra: {nome, variante, espelhada, pavimento, v (variante desenhada), custo (r de Custos.calcular), mesRef} */
function criar(entrada, extra){
  const x = extra || {}, q = Motor.normaliza(entrada), v = x.v;
  return {
    tipo: TIPO, versao: VERSAO, motor: Motor.VERSAO, criadoEm: new Date().toISOString(),
    nome: x.nome || (v ? `${v.tipologia} · ${q.quartos} quartos · lote ${Motor.f2(q.frente)} × ${Motor.f2(q.fundo)}` : 'Projeto Modulus'),
    entrada: q,
    escolha: {variante: x.variante || 0, espelhada: !!x.espelhada, pavimento: x.pavimento == null ? null : x.pavimento},
    resumo: v ? {formato: v.tipologia, W: v.W, D: v.D, area: v.quadro ? v.quadro.fechada : null, quartos: q.quartos, suites: q.suites,
      pavimentos: q.tipo === 'sobrado' ? 'Sobrado' : 'Térrea', subsolo: q.subsolo, score: v.score} : null,
    custo: x.custo ? {min: Math.round(x.custo.total.min), med: Math.round(x.custo.total.med), max: Math.round(x.custo.total.max), mesRef: x.mesRef || null,
      aviso: 'Estimativa paramétrica (CUB-CE e fatores estimados); não é orçamento.'} : null,
  };
}

/* Lê o texto de um arquivo e devolve {entrada, escolha, nome, origem} ou lança erro com mensagem em português. */
function ler(texto){
  let d;
  try{ d = JSON.parse(texto); }catch(e){ throw new Error('O arquivo não é um JSON válido.'); }
  if(Array.isArray(d)){ if(!d.length) throw new Error('O arquivo está vazio.'); d = d[0]; }      // exportação do banco: abre o primeiro
  if(!d || typeof d !== 'object') throw new Error('Formato de arquivo não reconhecido.');
  if(d.tipo === TIPO){
    if(!d.entrada) throw new Error('Arquivo de projeto sem os campos do programa.');
    return {entrada: d.entrada, escolha: d.escolha || {}, nome: d.nome || '', origem: 'projeto', motor: d.motor || null};
  }
  if(d.programa && d.resumo) return {entrada: d.programa, escolha: {variante: d.variante || 0, espelhada: !!d.espelhada}, nome: d.nome || '', origem: 'banco'};
  if('frente' in d || 'quartos' in d || 'fundo' in d) return {entrada: d, escolha: {}, nome: '', origem: 'programa'};
  throw new Error('Formato de arquivo não reconhecido.');
}

/* Converte para um item do banco (localStorage plantas-banco). */
function paraBanco(arq){
  const a = typeof arq === 'string' ? ler(arq) : arq;
  const r = Motor.gerar(a.entrada), i = Math.min(a.escolha.variante || 0, Math.max(0, r.variantes.length - 1)), v = r.variantes[i], q = r.entrada;
  return {id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nome: a.nome || (v ? `${v.tipologia} · ${q.quartos} quartos` : 'Projeto'),
    data: new Date().toISOString(), programa: q, variante: i, espelhada: !!a.escolha.espelhada,
    resumo: {formato: v ? v.tipologia : '—', W: v ? v.W : 0, D: v ? v.D : 0, area: v ? v.quadro.fechada : 0, quartos: q.quartos, suites: q.suites,
      pavimentos: q.tipo === 'sobrado' ? 'Sobrado' : 'Térrea', subsolo: q.subsolo, score: v ? v.score : 0}};
}

const nomeArquivo = (nome, data) => `modulus-${String(nome || 'projeto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase().slice(0, 50).replace(/^-+|-+$/g, '')}-${(data || new Date().toISOString()).slice(0, 10)}.json`;

return {TIPO, VERSAO, criar, ler, paraBanco, nomeArquivo};
});
