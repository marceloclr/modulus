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

// ---------- acessos (motor) ----------
t('acessos: portões no lote, portão social longe dos veículos e caminho saindo dele', () => {
  const {TODOS} = require('./golden.js'), E = 0.011, erros = [];
  const extras = {'descoberta 3': {garagem:'descoberta', vagas:3}, 'ambos': {subsolo:true, garagemLocal:'ambos', vagas:2, vagasTerreo:1}, 'L 3 vagas': {frente:16, fundo:34, formato:'L', vagas:3}};
  for(const [nome, c] of Object.entries(Object.assign({}, TODOS, extras))){
    for(const v of M.gerar(c).variantes){
      const a = v.acessos; if(!a){ erros.push(`${nome}: sem acessos`); continue; }
      const ped = a.portoes.filter(p => p.tipo==='pedestres'), vei = a.portoes.filter(p => p.tipo==='veiculos');
      if(ped.length !== 1) erros.push(`${nome}/${v.nome}: ${ped.length} portões sociais`);
      for(const p of a.portoes) if(p.x0 < a.xL - E || p.x1 > a.xR + E || Math.abs(p.y - a.yF) > E) erros.push(`${nome}/${v.nome}: portão fora da divisa frontal`);
      for(const p of ped.filter(p => !p.junto)) for(const w of vei) if(p.x0 < w.x1 + 0.6 - E && p.x1 > w.x0 - 0.6 + E) erros.push(`${nome}/${v.nome}: portão social a menos de 0,60 m do de veículos`);
      for(const g of a.vagasFora) if(g.x0 < a.xL - E || g.x1 > a.xR + E) erros.push(`${nome}/${v.nome}: vaga descoberta fora do lote`);
      if(a.caminho && ped[0]){ const [x, y] = a.caminho.pontos[0]; if(Math.abs(x - (ped[0].x0 + ped[0].x1)/2) > E || Math.abs(y - a.yF) > E) erros.push(`${nome}/${v.nome}: caminho não sai do portão social`); }
      const ter = v.pav.find(p => p.nome==='Térreo');
      if(ter.salas.some(s => s.tipo==='garagem') && !a.vias.some(r => r.tipo==='garagem')) erros.push(`${nome}/${v.nome}: garagem sem faixa até a rua`);
      if(v.pav.some(p => p.nome==='Subsolo' && p.salas.some(s => s.tipo==='rampa')) && !a.vias.some(r => r.tipo==='rampa')) erros.push(`${nome}/${v.nome}: rampa sem faixa até a rua`);
    }
  }
  ok(!erros.length, erros.slice(0, 4).join('; '));
});

// ---------- dados de custo ----------
const VS = require('../tools/valida-schema.js'), DADOS = require('../dados/custos.json'), HIST = require('../dados/custos-historico.json');
t('dados: custos.json e custos-historico.json seguem os esquemas', () => {
  const e1 = VS.validar(DADOS, require('../dados/custos.schema.json')), e2 = VS.validar(HIST, require('../dados/custos-historico.schema.json'));
  ok(!e1.length && !e2.length, e1.concat(e2).slice(0, 4).join('; '));
  const ruim = JSON.parse(JSON.stringify(DADOS)); ruim.cub.onerado['R1-N'] = 'caro'; delete ruim.fatores.marinho.ate500; ruim.cub.mesRef = '2026-13';
  igual(VS.validar(ruim, require('../dados/custos.schema.json')).length, 3, 'o validador acusa os três erros plantados:');
});
t('dados: faixas coerentes (mín ≤ méd ≤ máx), padrões existentes e série histórica fechando com o CUB vigente', () => {
  const erros = [];
  (function varre(o, cam){ if(!o || typeof o !== 'object') return;
    if(typeof o.min === 'number' && typeof o.med === 'number' && typeof o.max === 'number' && !(o.min <= o.med && o.med <= o.max)) erros.push(cam);
    for(const [k, v] of Object.entries(o)) varre(v, cam + '.' + k); })(DADOS, '$');
  for(const p of Object.values(DADOS.padroes)) if(!(p.cub in DADOS.cub.onerado) || !(p.cub in DADOS.cub.desonerado)) erros.push('padrão ' + p.cub);
  const ult = HIST.serie[HIST.serie.length - 1];
  if(ult.mesRef !== DADOS.cub.mesRef) erros.push('série termina em ' + ult.mesRef);
  for(const k of ['R1-B','R1-N','R1-A']) if(ult.onerado[k] !== DADOS.cub.onerado[k] || ult.desonerado[k] !== DADOS.cub.desonerado[k]) erros.push('série ≠ CUB em ' + k);
  for(let i = 1; i < HIST.serie.length; i++) for(const k of ['R1-B','R1-N','R1-A']){ const v = 100*(HIST.serie[i].onerado[k]/HIST.serie[i-1].onerado[k] - 1); if(Math.abs(v) > 5) erros.push(`variação de ${v.toFixed(2)} % em ${k} (${HIST.serie[i].mesRef})`); }
  for(const k of ['R1-B','R1-N','R1-A']){ const c = DADOS.cub.composicao[k], s = c.materiais + c.maoDeObra + c.administracao + c.equipamentos; if(Math.abs(s - DADOS.cub.onerado[k]) > 0.02) erros.push('composição ≠ total em ' + k); }
  ok(!erros.length, erros.join('; '));
});

// ---------- estrutura ----------
const EST = require('./estrutura.js');
t('estrutura: paredes fundidas e parede sobre parede (igual = 100 %, deslocada = menos)', () => {
  const sala = (tipo, x0, y0, x1, y1) => ({tipo, x0, y0, x1, y1});
  const ter = {salas:[sala('quarto', 0, 0, 4, 3), sala('quarto', 4, 0, 8, 3)]};
  const pw = EST.paredes(ter);
  igual(pw.filter(w => w.o==='h').length, 2, 'duas linhas horizontais (y=0 e y=3), cada uma fundida de 0 a 8:'); ok(pw.some(w => w.o==='h' && w.c===0 && w.t0===0 && w.t1===8));
  igual(EST.paredeSobreParede(ter, ter).pct, 100);
  const sup = {salas:[sala('quarto', 0, 0, 5, 3), sala('quarto', 5, 0, 8, 3)]};   // divisória a 1,00 m da de baixo
  const pp = EST.paredeSobreParede(sup, ter); ok(pp.pct < 100 && pp.soltos.some(s => s.o==='v' && s.c===5), 'a divisória deslocada fica sem apoio');
  const sup2 = {salas:[sala('quarto', 0, 0, 4.1, 3), sala('quarto', 4.1, 0, 8, 3)]};   // 0,10 m: dentro da tolerância
  igual(EST.paredeSobreParede(sup2, ter).pct, 100);
});
t('estrutura: gancho posAvalia só penaliza a alvenaria estrutural e não muda nada sem o gancho', () => {
  const c = {tipo:'sobrado', quartos:4, suites:2}, gancho = {posAvalia:[(v, q) => EST.avaliar(v, q, DADOS)]};
  const base = M.gerar(c), ca = M.gerar(Object.assign({estSistema:'concretoArmado'}, c), gancho), ae = M.gerar(Object.assign({estSistema:'alvenariaEstrutural'}, c), gancho);
  igual(ca.variantes.map(v => v.score), base.variantes.map(v => v.score), 'concreto armado sem penalidade:');
  ok(ae.variantes[0].estrutura.paredeSobreParede && ae.variantes[0].score <= base.variantes[0].score, 'alvenaria avalia parede sobre parede');
  ok(!('estrutura' in base.variantes[0]), 'sem gancho, a variante não ganha o campo estrutura');
});

// ---------- custos ----------
const CU = require('./custos.js');
const perto = (a, b, msg) => ok(Math.abs(a - b) < 0.05, `${msg || ''} esperado ${b}, obtido ${a}`);
t('custos: conta conferida à mão (100 m² fechados + 20 m² de varanda, térrea, Fortaleza, R1-N onerado)', () => {
  const v = {pav:[{nome:'Térreo', salas:[{tipo:'quarto', x0:0, y0:0, x1:10, y1:10}, {tipo:'varanda', x0:0, y0:10, x1:10, y1:12}]}], projecao:120, quadro:{fechada:100}};
  const r = CU.calcular(v, {}, DADOS);
  perto(r.Aeq.med, 117, 'área equivalente 100 + 20 × 0,85:'); perto(r.Aeq.min, 115); perto(r.Aeq.max, 120);
  perto(r.parcelas[0].valor.med, 117 * 2905.13, 'construção:');
  perto(r.adicionais[0].valor.med, 120 * 220, 'fundação térrea:');
  perto(r.total.med, (117 * 2905.13 + 26400) * 1.06, 'total com projetos de 6 %:');
  perto(r.total.min, (115 * 2905.13 + 120 * 180) * 1.04, 'mínimo:');
  perto(r.total.max, (120 * 2905.13 + 120 * 260) * 1.08, 'máximo:');
  perto(r.porM2.med, r.total.med / 100);
});
t('custos: fatores (Porto das Dunas, condomínio, até 500 m do mar, metálica, vãos maiores), desonerado, BDI e INCC', () => {
  const v = {pav:[{nome:'Térreo', salas:[{tipo:'quarto', x0:0, y0:0, x1:10, y1:10}]}], projecao:100, quadro:{fechada:100}};
  const q = {municipio:'portoDasDunas', condominio:true, distMar:'ate500', estSistema:'metalica', estVaos:'maiores', cubTipo:'desonerado', padrao:'alto', empreitada:true, custoIncc:true};
  const r = CU.calcular(v, q, DADOS), fl = 1.045 * 1.03 * 1.065, fe = (1.115 + 0.03) * 1.045;
  perto(r.fatores.local.med, fl, 'fator local:'); perto(r.fatores.estrutura.med, fe, 'fator estrutural com acréscimo do litoral:');
  igual(r.cub, 3275.17, 'CUB R1-A desonerado:');
  const obra = 100 * 3275.17 * fl * fe + 100 * 220, proj = obra * 0.06, bdi = (obra + proj) * 0.2212;
  perto(r.total.med, (obra + proj + bdi) * 1.0025, 'total com BDI e INCC de setembro (0,25 %):');
  ok(r.parcelas.some(p => p.id === 'incc' && p.estimado), 'projeção marcada como estimada');
});
t('custos: variante real tem fórmula em cada parcela e faixa crescente', () => {
  const v = M.gerar({tipo:'sobrado', subsolo:true, vagas:2, elevador:true}).variantes[0], r = CU.calcular(v, {elevador:true}, DADOS);
  ok(r.parcelas.every(p => p.formula && p.valor.min <= p.valor.med && p.valor.med <= p.valor.max), 'parcelas sem fórmula ou faixa invertida');
  ok(['construcao', 'fundacao', 'subsolo', 'elevador', 'projetos'].every(id => r.parcelas.some(p => p.id === id)), r.parcelas.map(p => p.id).join(','));
});

// ---------- cards ----------
const CA = require('./cartoes.js');
t('cards: selo de atualidade (alerta acima de 45 dias do fim do mês) e card com fórmulas e quatro vistas', () => {
  igual(CA.selo(DADOS, new Date(Date.UTC(2026, 9, 5))).velho, false, 'em 05/10/2026, agosto ainda vale:');
  igual(CA.selo(DADOS, new Date(Date.UTC(2026, 9, 20))).velho, true, 'em 20/10/2026, sem setembro, alerta:');
  const vs = M.gerar({}).variantes, pv = vs.map(x => ({nome:x.nome, r:CU.calcular(x, {}, DADOS)}));
  for(const vista of ['parcelas', 'composicao', 'variantes', 'serie']){
    const h = CA.cartaoCusto(pv[0].r, {dados:DADOS, historico:HIST, porVariante:pv, atual:0, vista, hoje:new Date(Date.UTC(2026, 9, 5))});
    ok(h.includes('<svg class="graf"'), 'vista ' + vista + ' sem gráfico');
    ok((h.match(/data-tip="/g) || []).length >= 8, 'poucas dicas na vista ' + vista);
  }
  const h = CA.cartaoCusto(pv[0].r, {dados:DADOS, historico:HIST, porVariante:pv, atual:0});
  ok(h.includes('Total = construção') && h.includes('não é orçamento'), 'fórmula do total e aviso');
  const ve = EST.avaliar(M.gerar({}).variantes[0], {estSistema:'protendido'}, DADOS);
  ok(CA.cartaoEstrutura(ve, DADOS).includes('Concreto protendido'), 'card da estrutura');
});

// ---------- valores (camadas) ----------
const VA = require('./valores.js');
t('valores: ajustes sobre os oficiais (mín e máx acompanham), diferenças e editáveis válidos', () => {
  const ef = VA.aplicarAjustes(DADOS, {'cub.onerado.R1-N': 3000, 'fatores.logistica.eusebio.med': 1.04, 'fatores.logistica.fortaleza.med': 1.01, 'x.y': 3});
  igual(ef.cub.onerado['R1-N'], 3000); igual(DADOS.cub.onerado['R1-N'], 2905.13, 'o oficial não muda:');
  perto(ef.fatores.logistica.eusebio.min, 1.01 * 1.04 / 1.02, 'mín acompanha:'); perto(ef.fatores.logistica.eusebio.max, 1.03 * 1.04 / 1.02, 'máx acompanha:');
  igual([ef.fatores.logistica.fortaleza.min, ef.fatores.logistica.fortaleza.max], [1.01, 1.01], 'faixa de ponto único acompanha o valor:');
  const dif = VA.diferencas(DADOS, ef).map(d => d.caminho);
  ok(dif.includes('cub.onerado.R1-N') && dif.includes('fatores.logistica.eusebio.med'), dif.join(','));
  igual(VA.diferencas(DADOS, JSON.parse(JSON.stringify(DADOS))).length, 0);
  const ed = VA.editaveis(DADOS); ok(ed.length >= 30 && ed.every(([cam]) => typeof cam.split('.').reduce((o, k) => o[k], DADOS) === 'number'), 'editável sem número');
  igual(VS.validar(ef, require('../dados/custos.schema.json')).length, 0, 'valores ajustados continuam válidos:');
});

// ---------- solar ----------
const SO = require('./solar.js');
t('solar: dimensionamento conferido à mão (600 kWh/mês informados, N2)', () => {
  const v = M.gerar({}).variantes[0], r = SO.calcular(v, {solConsumo:600, solNivel:'N2'}, DADOS);
  perto(r.kWpNecessario, 3.71, 'kWp = (600 − 100) ÷ (5,76 × 30 × 0,78):');
  igual(r.modulosNecessarios, 7, 'módulos de 610 Wp:'); perto(r.kWp, 4.27);
  perto(r.areaModulos, 18.2, 'área 7 × 2,6:');
  const critDia = r.criticoMes / 30; perto(r.bateriaKwh, Math.ceil(critDia * 8/24 / (0.9*0.95) / 2.5) * 2.5, 'bateria:');
  ok(r.criticoMes === r.cargas.filter(c => c.critica).reduce((t, c) => t + c.kwhMes, 0), 'carga crítica = soma das críticas');
  ok(r.cargas.filter(c => c.critica).every(c => ['N1', 'N2'].includes(c.nivel)), 'N2 só leva N1 e N2');
  ok(r.inversorKw >= r.kWp / 1.25 && r.inversorKw * 2000 >= r.picoW, 'inversor cobre o kit e a partida');
  ok(r.paybackSimples > 0 && r.paybackDescontado >= r.paybackSimples, 'payback descontado ≥ simples');
  igual(r.meses.length, 12); ok(r.meses[9].geracao > r.meses[3].geracao, 'outubro gera mais que abril');
});
t('solar: interpolação do R$/Wp, Fio B pelo ano, cobertura insuficiente e cargas condicionais', () => {
  perto(SO.rsWpPara(3, DADOS.solar.rsWp), 3.14, 'entre 2 kWp (3,62) e 4 kWp (2,66):');
  igual(SO.rsWpPara(50, DADOS.solar.rsWp), 2.02);
  const sala = (tipo, x0, y0, x1, y1) => ({tipo, x0, y0, x1, y1});
  const pequena = {pav:[{nome:'Térreo', salas:[sala('quarto', 0, 0, 4, 4)]}], quadro:{fechada:16}};
  const r = SO.calcular(pequena, {solConsumo:900}, DADOS);
  igual(r.modulos, Math.floor(16 * 0.6 / 2.6), 'só cabem os módulos da cobertura:'); ok(r.avisos.some(a => a.includes('comporta')));
  const ids = q => SO.cargas(q, DADOS.solar, 100).map(c => c.id);
  ok(!ids({}).includes('piscina') && ids({piscina:true}).includes('piscina') && ids({solVE:true}).includes('ve'), 'cargas condicionais');
  ok(SO.calcular(M.gerar({}).variantes[0], {municipio:'portoDasDunas'}, DADOS).avisos.some(a => a.includes('inox')), 'aviso do litoral');
});

function rodar(){
  const linhas = []; let falhas = 0;
  for(const {nome, fn} of testes){ try{ fn(); }catch(e){ falhas++; linhas.push(`FALHA unidade ${nome}: ${e.message}`); } }
  linhas.push(falhas ? `unidades: ${falhas} de ${testes.length} falharam` : `unidades: ${testes.length} testes passaram`);
  return {falhas, linhas};
}
module.exports = {rodar, t, igual, ok};
