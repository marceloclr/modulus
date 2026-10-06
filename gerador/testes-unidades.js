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
t('solar: pacote básico conferido à mão (3 quartos)', () => {
  const v = M.gerar({}).variantes[0], r = SO.calcular(v, {quartos:3}, DADOS);
  igual(r.cargas.map(c => c.id), ['portao', 'luzInterna', 'luzExterna', 'cameras', 'geladeira', 'ar', 'ventiladores'], 'só o pacote básico:');
  perto(r.consumo, 4 + 15 + 29 + 25 + 40 + 120 + 4*15, 'consumo (4 ventiladores: 3 quartos + sala):');
  perto(r.kWpNecessario, Math.round(293 / (5.76*30*0.78) * 100)/100, 'kWp = 293 ÷ (5,76 × 30 × 0,78):');
  igual(r.modulos, Math.ceil(r.kWpNecessario*1000/610)); perto(r.kWp, r.modulos*0.61);
  perto(r.bateriaKwh, Math.ceil((293/30) * 8/24 / (0.9*0.95) / 2.5) * 2.5, 'bateria:');
  ok(r.cargas.every(c => c.critica), 'todas ficam ligadas pela bateria');
  ok(r.inversorKw >= r.kWp / 1.25 && r.inversorKw * 2000 >= r.picoW, 'inversor cobre o kit e a partida');
  ok(r.custo.min < r.custo.med && r.custo.med < r.custo.max, 'faixa do investimento');
  ok(r.paybackSimples > 0 && r.paybackDescontado >= r.paybackSimples, 'payback descontado ≥ simples');
  igual(r.meses.length, 12); ok(r.meses[9].geracao > r.meses[3].geracao, 'outubro gera mais que abril');
});
t('solar: interpolação do R$/Wp, Fio B pelo ano, cobertura insuficiente e orla', () => {
  perto(SO.rsWpPara(3, DADOS.solar.rsWp), 3.14, 'entre 2 kWp (3,62) e 4 kWp (2,66):');
  igual(SO.rsWpPara(50, DADOS.solar.rsWp), 2.02);
  const sala = (tipo, x0, y0, x1, y1) => ({tipo, x0, y0, x1, y1});
  const pequena = {pav:[{nome:'Térreo', salas:[sala('quarto', 0, 0, 2, 2)]}], quadro:{fechada:4}};
  const r = SO.calcular(pequena, {quartos:3}, DADOS);
  igual(r.modulos, Math.floor(4 * 0.6 / 2.6), 'só cabem os módulos da cobertura:'); ok(r.avisos.some(a => a.includes('comporta')));
  ok(SO.calcular(M.gerar({}).variantes[0], {municipio:'portoDasDunas'}, DADOS).avisos.some(a => a.includes('inox')), 'aviso do litoral');
});
t('cards: card solar com as três vistas, fórmulas e normas', () => {
  const r = SO.calcular(M.gerar({}).variantes[0], {}, DADOS);
  for(const vista of ['mensal', 'retorno', 'cargas']){
    const h = CA.cartaoSolar(r, {vista});
    ok(h.includes('<svg class="graf"') && (h.match(/data-tip="/g) || []).length >= 12, 'vista ' + vista);
  }
  const h = CA.cartaoSolar(r, {});
  ok(h.includes('NBR 16690') && h.includes('kWp = ') && h.includes('cobertura provisória') && h.includes('Projeção de custo'), 'normas, fórmula do kWp, cobertura provisória e título');
});

// ---------- circulação enxuta (05/10/2026) ----------
t('circulação: a ponta do corredor vai para o quarto do fim e o hall de apoio para a cozinha', () => {
  const v = M.gerar({}).variantes.find(x => x.tipologia.includes('corredor lateral')), T = v.pav[0].salas;
  const c = T.find(s => s.tipo==='circ'), m = T.find(s => s.tipo==='master'), k = T.find(s => s.tipo==='cozinha');
  ok(!T.some(s => s.tipo==='hall'), 'hall integrado à cozinha');
  igual(c.y1, m.y0, 'o corredor termina na porta da suíte:'); igual([m.x0, m.x1], [0, v.W], 'a suíte ocupa a largura toda:');
  ok(k.integra && m.integra && k.x1 === c.x1, 'cozinha encosta no corredor');
  ok(!v.avisos.some(a => /não se liga|sem acesso/.test(a)), v.avisos.join(' | '));
});

t('subsolo: sem teto cabe o máximo; com teto, o subsolo encolhe para essas vagas', () => {
  const ent = {frente:22, fundo:34, formato:'U', quartos:3, suites:3, subsolo:true};
  const sub = e => M.gerar(e).variantes[0].pav.find(p => p.nome === 'Subsolo');
  const livre = sub(ent), t3 = sub(Object.assign({}, ent, {subVagasMax:3}));
  ok(livre.vagas > 3, 'sem teto: ' + livre.vagas);
  igual(t3.vagas, 3, 'com teto 3:');
  ok(t3.dim.W * t3.dim.D < livre.dim.W * livre.dim.D, 'subsolo menor com teto');
});

t('torre de ar: recomendação por tipologia e links antigos (torreCalor)', () => {
  const tipo = e => (M.gerar(Object.assign({torreTipo:'auto'}, e)).variantes[0].torre || {}).tipo;
  igual(tipo({}), 'succao', 'térrea:'); igual(tipo({tipo:'sobrado'}), 'hibrida', 'sobrado:'); igual(tipo({tipo:'sobrado', rooftop:true}), 'combinado', 'rooftop:');
  igual(tipo({frente:22, fundo:30, formato:'H', quartos:3, suites:3}), 'shed', 'H:');
  igual(M.normaliza({torreCalor:true}).torreTipo, 'chamine', 'torreCalor antigo:'); igual(M.normaliza({}).torreTipo, 'nenhuma'); igual(M.normaliza({torreTipo:'xyz'}).torreTipo, 'nenhuma');
  ok(!M.gerar({}).variantes[0].torre, 'sem torre por padrão');
});

t('torre de ar: vazões pelas fórmulas do dossiê (conta à mão) e card', () => {
  const TO = require('./torre.js'), CA = require('./cartoes.js');
  const e = {tipo:'sobrado', torreTipo:'chamine'}, v = M.gerar(e).variantes[0], r = TO.calcular(v, M.normaliza(e));
  igual(Math.round(r.H*100)/100, 6.5, 'H = 2 × 3,0 + 1,5 − 1,0:');
  ok(Math.abs(r.qCham - 1988) < 2, 'chaminé 0,6·1·√(2·9,81·6,5·2/301)·3600 ≈ 1988: ' + r.qCham);
  ok(Math.abs(r.qVento - 0.6*4*Math.sqrt(0.3)*3600) < 1, 'vento');
  const h = CA.cartaoTorre(r); ok(h.includes('Torre de ar') && h.includes('Trocas de ar por hora') && h.includes('torre/'), 'card');
  igual(TO.calcular(M.gerar({}).variantes[0], M.normaliza({})), null, 'sem torre:');
});

t('brises: sol de Fortaleza, geometria das lâminas e estudo da variante', () => {
  const B = require('./brises.js'), CA = require('./cartoes.js'), CU = require('./custos.js');
  // ao meio-dia solar a altura é 90° − |φ − δ|: 21/jun δ ≈ 23,45° → h ≈ 62,8° ao norte; 21/dez δ ≈ −23,4° → h ≈ 70,3° ao sul
  const jun = B.sol(172, 12), dez = B.sol(355, 12);
  ok(Math.abs(jun.h - 62.8) < 0.2 && Math.abs(jun.az) < 0.5, 'junho ' + JSON.stringify(jun));
  ok(Math.abs(dez.h - 70.3) < 0.3 && Math.abs(dez.az - 180) < 0.5, 'dezembro ' + JSON.stringify(dez));
  // lâmina horizontal d/s = 1, β = 0: com VSA de 45°, tan = 1 → nenhum sol passa; com VSA de 26,57° (tan 0,5) passa a metade
  ok(B.passa(1, 0, 45) < 1e-9 && Math.abs(B.passa(1, 0, 26.565) - 0.5) < 1e-3, 'fração que passa');
  ok(Math.abs(B.vista(1, 30) - 0.5) < 1e-9, 'vista livre 1 − d/s·|sen β|');
  // faces norte e sul: brise horizontal reto e curto; leste e oeste: lâminas inclinadas ou móveis
  const n = B.otimizar('horizontal', 0), l = B.otimizar('horizontal', 90);
  ok(n.p.beta === 0 && n.r.pct > 95, 'norte ' + JSON.stringify(n.p)); ok(l.p.beta > 0 && l.vista < n.vista, 'leste ' + JSON.stringify(l.p));
  const e = {orientacao:'N', brises:true}, q = M.normaliza(e), v = M.gerar(e).variantes[0], r = B.estudar(v, q);
  ok(r.faces.length && r.faces.every(fc => fc.pct > 90 && fc.vista >= 0.4 - 1e-9), 'faces ' + r.faces.map(fc => fc.rumo + ' ' + fc.pct).join(', '));
  ok(r.faces.every(fc => !['S'].includes(fc.rumo)), 'a face sul não é crítica');
  const h = CA.cartaoBrises(r, B, DADOS); ok(h.includes('<svg class="carta"') && h.includes('Sombra anual'), 'card');
  v.brises = r; ok(CU.calcular(v, q, DADOS).parcelas.some(p => p.id === 'brises'), 'custo dos brises');
  igual(B.estudar(v, M.normaliza({})), null, 'sem brises:');
  igual(B.estudar(v, M.normaliza({brises:true})).semOrientacao, true, 'sem orientação:');
  const q2 = M.normaliza({orientacao:'N', brises:true, brisesFaces:'escolha', brisesFace_S:true});
  ok(B.estudar(M.gerar(q2).variantes[0], q2).faces.every(fc => fc.rumo === 'S'), 'escolha manual');
});

t('vento: dados/vento.json válido, 12 meses e alísios de leste/sudeste', () => {
  const VT = require('../dados/vento.json');
  igual(VS.validar(VT, require('../dados/vento.schema.json')), [], 'esquema:');
  igual(VT.meses.map(m => m.mes), [1,2,3,4,5,6,7,8,9,10,11,12]);
  for(const m of VT.meses){ ok(m.rosa.length === VT.setores && m.velHora.length === 24, 'mês ' + m.mes);
    ok(Math.abs(m.rosa.reduce((t, x) => t + x.freq, 0) + m.calmaria - 100) < 1.5, 'frequências somam 100 % no mês ' + m.mes);
    ok(m.dirPredominante >= 45 && m.dirPredominante <= 157.5, 'predomínio de NE a SSE no mês ' + m.mes); }
  const set = VT.meses[8], mar = VT.meses[2]; ok(set.velMedia > mar.velMedia, 'setembro venta mais que março');
});

t('insolação: sombra de um cubo, mancha de sol pela janela e incidência por fachada (contas à mão)', () => {
  const I = require('./insolacao.js');
  const q = {orientacao:'N', peDireito:3}, sala = {id:1, tipo:'estar', nome:'Estar', x0:0, y0:0, x1:3, y1:3};
  // frente para o norte (face y0); sol a 45° vindo do norte: a sombra do cubo de 3 m anda 3 m para o fundo (+y)
  const sb = I.sombras({pav:[{nome:'Térreo', salas:[sala]}]}, q, {h:45, az:0});
  igual(sb.length, 1); ok(Math.abs(Math.max(...sb[0].pts.map(p => p[1])) - 6) < 1e-9, 'sombra até y = 6: ' + JSON.stringify(sb[0].pts));
  // janela de 1,00 m na face norte, peitoril 1,00 m e verga 2,20 m; 21/jun ao meio-dia (h = 62,8°):
  // a mancha vai de 1,00/tan h = 0,51 m a 2,20/tan h = 1,13 m para dentro
  const p = {nome:'Térreo', salas:[sala], janelas:[{o:'h', c:0, t0:1, t1:2, h:1.2}]};
  const L = I.luzPavimento({pav:[p]}, q, p, I.solEm(6, 12));
  igual(L.manchas.length, 1); const ys = L.manchas[0].pts.map(p => p[1]);
  ok(Math.abs(Math.min(...ys) - 1/Math.tan(62.82*Math.PI/180)) < 0.01 && Math.abs(Math.max(...ys) - 2.2/Math.tan(62.82*Math.PI/180)) < 0.01, 'mancha ' + ys);
  ok(L.fachadas.some(fc => fc.lado === 'y0'), 'fachada norte iluminada em junho');
  // às 12h de dezembro o sol está ao sul: a janela norte não recebe sol
  igual(I.luzPavimento({pav:[p]}, q, p, I.solEm(12, 12)).manchas.length, 0, 'sem sol na face norte em dezembro:');
  // incidência: em dezembro a face sul recebe mais que a norte; em junho, o contrário
  const v = M.gerar({orientacao:'N'}).variantes[0], qq = M.normaliza({orientacao:'N'});
  const fx = (m, r) => (I.incidenciaFaces(v, qq, m).find(x => x.rumo === r) || {kwh:0}).kwh;
  ok(fx(12, 'S') > fx(12, 'N') && fx(6, 'N') > fx(6, 'S'), 'sazonalidade norte/sul');
  ok(I.horasSolComodos(v, qq, 3).length > 0, 'horas de sol por cômodo');
});

t('vento na variante: janelas de entrada e saída, linhas de corrente e camada da planta', () => {
  const VE = require('./vento.js'), D = require('./desenho.js'), VT = require('../dados/vento.json');
  // casa com frente para o norte e vento de leste (90°): a face x1 (leste) é entrada e a x0 (oeste) é saída
  const q = {orientacao:'N'}, sala = {id:1, tipo:'estar', x0:0, y0:0, x1:4, y1:4};
  const p = {salas:[sala], janelas:[{o:'v', c:4, t0:1, t1:2, h:1.2}, {o:'v', c:0, t0:1, t1:2, h:1.2}, {o:'h', c:0, t0:1, t1:2, h:1.2}]};
  igual(VE.janelas({}, q, p, 90).map(j => j.papel), ['entrada', 'saida', 'lateral']);
  // linhas paralelas ao vento: vento de leste corre para oeste (−x), y constante
  const ls = VE.linhas({x0:0, y0:0, x1:10, y1:20}, 90, 0, 5);
  igual(ls.length, 5); ok(ls.every(l => Math.abs(l.a[1] - l.b[1]) < 1e-9 && l.b[0] < l.a[0]), 'sentido do escoamento');
  const rs = VE.resumo(VT, 9); ok(rs.velMedia > 5 && rs.principais.length === 3 && rs.velHora.length === 24, 'resumo de setembro');
  const v = M.gerar({orientacao:'N'}).variantes[0];
  ok(/<g id="svCamada" data-ox="[0-9.-]+" data-oy="[0-9.-]+" data-k="30"/.test(D.planta(v, 0, {camadaId:'svCamada'})), 'grupo da camada animada');
  ok(!D.planta(v, 0).includes('svCamada'), 'sem a opção, a planta não muda');
});

t('janelas: quartos de canto com duas janelas distantes (ventilação cruzada)', () => {
  const casos = [{orientacao:'N'}, {orientacao:'L', tipo:'sobrado'}, {frente:22, fundo:30, formato:'U', quartos:3, suites:3, orientacao:'S'}, {frente:22, fundo:30, formato:'H', quartos:3, suites:3, orientacao:'N'}, {frente:16, fundo:34, formato:'L', orientacao:'SE'}];
  let quartosDeCanto = 0;
  for(const e of casos) for(const v of M.gerar(e).variantes) for(const p of v.pav){
    for(const sq of p.salas.filter(x => ['quarto','suite','master'].includes(x.tipo))){
      const js = (p.janelas || []).filter(j => !j.alta).map(j => ({j, lado: M.ladoDaJanela(j, sq)})).filter(x => x.lado);
      const lados = new Set(js.map(x => x.lado)); if(lados.size < 2) continue;
      quartosDeCanto++;
      const c = x => x.j.o === 'h' ? [(x.j.t0 + x.j.t1)/2, x.j.c] : [x.j.c, (x.j.t0 + x.j.t1)/2];
      let d = 0; for(const a of js) for(const b of js) if(a.lado !== b.lado) d = Math.max(d, Math.hypot(c(a)[0]-c(b)[0], c(a)[1]-c(b)[1]));
      const diag = Math.hypot(sq.x1 - sq.x0, sq.y1 - sq.y0);
      ok(d >= 0.6 * diag - 1e-9, `${JSON.stringify(e)} ${v.nome} ${p.nome} ${sq.nome}: ${d.toFixed(2)} m entre janelas, diagonal ${diag.toFixed(2)} m`);
    }
  }
  ok(quartosDeCanto >= 5, 'há quartos de canto com duas janelas: ' + quartosDeCanto);
});

t('casa simétrica: a humanizada sai do mesmo modelo da técnica (janelas e portas iguais)', () => {
  const vm = require('vm'), html = require('fs').readFileSync(require('path').join(__dirname, '../casa-simetrica/index.html'), 'utf8');
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(x => x.includes('function humDoc'));
  const ctx = {Math, document:{documentElement:{}}, window:{matchMedia:() => ({matches:false})}};
  vm.createContext(ctx); vm.runInContext(js.slice(0, js.indexOf('/* ---------- Navegação')).replace(/^\s*\(function\(\)\{/, '') + ';this.API={humDoc,hzTecnica};', ctx);
  for(const g of ['A', 'B', 'C', 'D']){
    const T = ctx.API.hzTecnica(g), h = ctx.API.humDoc(g, true);
    ok(T.win.length >= 6 && T.dr.length >= 8, g + ': aberturas lidas da técnica');
    igual((h.match(/<title>Porta/g) || []).length, T.dr.length, g + ': portas');
    igual((h.match(/stroke-width="1.4"( stroke-dasharray="4 2")?><title>/g) || []).length, T.win.length, g + ': janelas');
  }
});

t('acessibilidade (opção): portas, banho acessível, quartos, rota e nada muda sem ela', () => {
  const v = M.gerar({acessivel:true}).variantes[0], T = v.pav.find(p => p.nome === 'Térreo');
  ok(T.portas.filter(d => !d.saida).every(d => d.t1 - d.t0 >= 0.9 - 0.01), 'portas de 0,90 m no térreo');
  const b = T.salas.find(x => x.acessivel); ok(b, 'banho acessível marcado');
  ok(Math.min(b.x1-b.x0, b.y1-b.y0) >= 2.4 - 0.01 && Math.max(b.x1-b.x0, b.y1-b.y0) >= 2.5 - 0.01, 'banho com 2,40 × 2,50 m');
  ok(v.acessibilidade.every(i => i.ok), v.acessibilidade.filter(i => !i.ok).map(i => i.detalhe).join(' | '));
  const semi = M.gerar({acessivel:true, subsolo:true, subNivel:'meio'}).variantes[0];
  ok(semi.acessibilidade.some(i => i.item === 'Rota sem degraus' && !i.ok), 'semienterrado sem elevador pede rampa');
  ok(M.gerar({acessivel:true, subsolo:true, subNivel:'meio', elevador:true}).variantes[0].acessibilidade.find(i => i.item === 'Rota sem degraus').ok, 'com elevador, a rota atende');
  ok(M.gerar({acessivel:true, tipo:'sobrado'}).variantes[0].acessibilidade.some(i => i.item === 'Rota sem degraus' && !i.ok), 'sobrado sem elevador e quartos em cima');
  igual(M.normaliza({acessivel:true, banhosSociais:0}).banhosSociais, 1, 'com acessibilidade, ao menos um banho social:');
  const sem = M.gerar({}).variantes[0];
  ok(!sem.acessibilidade && !sem.pav.some(p => p.salas.some(x => x.acessivel)), 'sem a opção, nada é marcado');
  ok(require('./desenho.js').planta(v, 0).includes('Banho acessível: giro de 1,50 m'), 'giro desenhado');
});

t('lote grande: U e H com largura real, sem variante de nota 0 e rampa livre até a manobra', () => {
  const r = M.gerar({frente:40, fundo:50});
  const tip = r.variantes.map(v => v.tipologia).join(' | ');
  ok(/Em U/.test(tip) && /Em H/.test(tip), tip);
  ok(r.variantes.every(v => v.W <= 25 && v.score > 0), r.variantes.map(v => v.W + ' m, nota ' + v.score).join('; '));
  for(const e of [{frente:12, fundo:30, formato:'bloco', subsolo:true}, {frente:40, fundo:50, formato:'bloco', subsolo:true}, {frente:15, fundo:30, subsolo:true, quartos:3, suites:2}]){
    for(const v of M.gerar(e).variantes){
      const sub = v.pav.find(p => p.nome === 'Subsolo'); if(!sub || sub.arranjo !== 'faixas') continue;
      const rp = sub.salas.find(x => x.tipo === 'rampa'); if(!rp) continue;
      const faixa = {x0:rp.x0 + 0.01, x1:rp.x1 - 0.01, y0:rp.y1, y1:sub.manobra.y0};
      const bloqueia = sub.salas.filter(x => x.vaga && x.x0 < faixa.x1 && x.x1 > faixa.x0 && x.y0 < faixa.y1 - 0.01 && x.y1 > faixa.y0 + 0.01);
      ok(!bloqueia.length, JSON.stringify(e) + ' ' + v.nome + ': vaga entre a rampa e a manobra');
    }
  }
});

t('arquivo do projeto: salvar, abrir, formatos antigos e item do banco', () => {
  const P = require('./projeto.js'), CU = require('./custos.js');
  const q = M.normaliza({quartos:4, frente:14}), v = M.gerar(q).variantes[1], custo = CU.calcular(v, q, DADOS);
  const arq = P.criar(q, {v, variante:1, espelhada:true, pavimento:0, custo, mesRef:DADOS.cub.mesRef, nome:'Casa da praia'});
  igual([arq.tipo, arq.motor, arq.nome, arq.escolha.variante, arq.escolha.espelhada], ['modulus-projeto', M.VERSAO, 'Casa da praia', 1, true]);
  ok(arq.custo.med > 0 && arq.custo.min <= arq.custo.med && arq.custo.med <= arq.custo.max && arq.custo.mesRef === DADOS.cub.mesRef, 'custo com o mês de referência');
  const lido = P.ler(JSON.stringify(arq)); igual([lido.origem, lido.entrada.quartos, lido.escolha.variante], ['projeto', 4, 1]);
  igual(P.ler(JSON.stringify({frente:15, quartos:2})).origem, 'programa', 'programa.json antigo:');
  const item = P.paraBanco(arq); ok(item.programa.quartos === 4 && item.variante === 1 && item.resumo.area > 0, 'item do banco');
  igual(P.ler(JSON.stringify([item])).origem, 'banco', 'exportação do banco:');
  let erro = ''; try{ P.ler('{"x":1}'); }catch(e){ erro = e.message; } ok(/não reconhecido/.test(erro), 'formato desconhecido: ' + erro);
  igual(P.nomeArquivo('Casa · Praia', '2026-10-05T10:00:00Z'), 'modulus-casa-praia-2026-10-05.json');
});

// ---------- auditoria geométrica e matemática (etapa D) ----------
const AU = require('./auditoria.js');
t('auditoria: cada regra acusa a falha montada à mão', () => {
  const sala = (id, tipo, nome, x0, y0, x1, y1) => ({id, tipo, nome, x0, y0, x1, y1});
  // lote 10 × 20, recuos 1 / 1,5 / 2; casa de 6 × 8 a partir de x = 2, y = 2
  const q = {frente:10, fundo:20, recFrente:2, recLat:1.5, recFundo:2, permeab:0};
  const S = [sala(1, 'estar', 'Estar', 0, 0, 4, 4), sala(2, 'quarto', 'Quarto', 4, 0, 6, 4), sala(3, 'circ', 'Circulação', 0, 4, 0.8, 8),
    sala(4, 'cozinha', 'Cozinha', 0.5, 4, 6, 8), sala(5, 'quarto', 'Quarto 2', 6, 0, 7, 3)];
  const v = {x0:2, y0:2, W:6, D:8, lote:Object.assign({}, q), pav:[{nome:'Térreo', salas:S,
    portas:[{o:'v', c:4, t0:4.5, t1:5.3, sala:1, viz:2, dentro:1}, {o:'h', c:0, t0:1, t1:2, sala:1, entrada:true, dentro:1}],
    janelas:[{o:'v', c:4, t0:1, t1:2, h:1.2}, {o:'h', c:0, t0:3.5, t1:4.5, h:1.2}, {o:'h', c:0, t0:1.2, t1:1.8, h:1.2}], vaos:[]}]};
  const achou = new Set(AU.auditar(v, q).map(x => x.regra));
  for(const r of ['G01', 'G04', 'G05', 'G07', 'G08', 'G09', 'G11', 'G16', 'M07']) ok(achou.has(r), `a regra ${r} não acusou: ${[...achou].join(' ')}`);
  igual(Math.round(AU.uniao([{x0:0, y0:0, x1:2, y1:2}, {x0:1, y0:1, x1:3, y1:3}]) * 100) / 100, 7, 'união de dois quadrados de 2 m com 1 m² em comum:');
});
t('auditoria: regras firmes sem violação e defeitos conhecidos sem piorar (catraca)', () => {
  const r = AU.rodar(), ruins = Object.entries(AU.REGRAS).filter(([k, R]) => r.cont[k] > R.limite);
  ok(!ruins.length, ruins.map(([k, R]) => `${k} ${R.nome}: ${r.cont[k]} (limite ${R.limite}); ex.: ${r.ex[k][0]}`).join(' | '));
});

// ---------- rooftop a partir da escada (etapa E2.1) ----------
const rooftop = e => { const r = M.gerar(Object.assign({frente:12, fundo:30, quartos:3, suites:2, rooftop:true, orientacao:'N'}, e)); const v = r.variantes[0];
  return {r, v, rt:v && v.pav.find(p => p.nome === 'Rooftop')}; };
const areaDe = (rt, nome) => rt.salas.filter(s => s.nome === nome).reduce((t, s) => t + M.area(s), 0);
t('rooftop: posição a partir da escada muda a laje (centralizado < até a frente; até o fundo vai da escada ao fundo)', () => {
  const c = rooftop({}).rt, f = rooftop({rtPos:'frente'}).rt, b = rooftop({rtPos:'fundo'}).rt;
  ok(c.posicao === 'centro' && f.posicao === 'frente' && b.posicao === 'fundo', 'posições');
  ok(f.area > c.area + 5 && b.area > c.area + 5, `laje: centro ${c.area}, frente ${f.area}, fundo ${b.area}`);
  const esc = b.salas.find(s => s.tipo === 'escada');
  ok(b.salas.every(s => s.y0 >= esc.y0 - 0.01), 'até o fundo: nada à frente da escada');
  const escF = f.salas.find(s => s.tipo === 'escada');
  ok(f.salas.every(s => s.y1 <= escF.y1 + 0.01), 'até a frente: nada atrás da escada');
});
t('rooftop: itens marcados aparecem com as medidas de referência e ligados à caixa de escada', () => {
  const {v, rt} = rooftop({});
  ok(Math.abs(areaDe(rt, 'Varanda gourmet') - M.RT.gourmet) < 0.1, 'gourmet de 12 m²: ' + areaDe(rt, 'Varanda gourmet'));
  ok(Math.abs(areaDe(rt, 'Banho') - M.RT.banho) < 0.1 && Math.abs(areaDe(rt, 'Área técnica / caixa d’água') - M.RT.tecnica) < 0.1, 'banho 3 m² e área técnica 4 m²');
  const g = rt.salas.find(s => s.tipo === 'gourmet'); ok(Math.min(g.x1 - g.x0, g.y1 - g.y0) >= M.TIPOS.gourmet.lado - 0.01, 'gourmet com lado mínimo');
  ok(!v.avisos.some(a => /Rooftop: .*(não se liga|sem acesso)/.test(a)), v.avisos.filter(a => a.startsWith('Rooftop')).join(' | '));
  const sem = rooftop({rtGourmet:false, rtVaranda:false, rtBanho:false, rtTecnica:false}).rt;
  ok(!sem.salas.some(s => ['gourmet','varanda','banhoSocial','deposito'].includes(s.tipo)), 'desmarcados não aparecem');
});
t('rooftop: spa tem efeito (aparece no desenho e reserva terraço de 3,00 m)', () => {
  const D = require('./desenho.js');
  for(const pos of ['centro', 'fundo']){
    const {v, rt} = rooftop({rtSpa:true, rtPos:pos}); ok(rt.spa && rt.spa.lado === M.RT.spa, 'spa em ' + pos);
    const svg = D.planta(v, v.pav.indexOf(rt)); ok(/>SPA</.test(svg), 'SPA no desenho (' + pos + ')');
  }
  ok(!rooftop({}).rt.spa, 'sem spa marcado, sem spa');
});
t('rooftop: nunca aberto para o poente (opção a oeste recusada, bordas a oeste fechadas, G17 acusa)', () => {
  const ops = M.rooftopOpcoes({orientacao:'O'}); ok(ops.find(o => o.valor === 'frente').proibido && !ops.find(o => o.valor === 'fundo').proibido, 'frente a oeste proibida');
  ok(M.rooftopOpcoes({orientacao:'SE'}).find(o => o.valor === 'fundo').tarde, 'fundo a noroeste: sol da tarde');
  const {v, rt, r} = rooftop({orientacao:'O', rtPos:'frente'});
  ok(rt.posicao === 'centro' && v.avisos.some(a => /fica a oeste/.test(a)), 'recusa e centraliza');
  const l = rooftop({orientacao:'N'}); ok(l.rt.fechamentos.normal.length && l.rt.fechamentos.espelhada.length, 'lateral a oeste com fechamento nas duas plantas');
  igual(AU.auditar(l.v, M.normaliza({frente:12, fundo:30, orientacao:'N'})).filter(x => x.regra === 'G17').length, 0, 'auditoria sem G17:');
  const sem = JSON.parse(JSON.stringify(l.v)); sem.pav.find(p => p.nome === 'Rooftop').fechamentos = {normal:[], espelhada:[]};
  ok(AU.auditar(sem, M.normaliza({frente:12, fundo:30, orientacao:'N'})).some(x => x.regra === 'G17'), 'G17 acusa rooftop sem fechamento');
  const RU = require('./rooftop-ui.js'); ok(/indisponível/.test(RU.opcoes('O').find(o => o.valor === 'frente').dica) && /proibida/.test(RU.svg('O', 'centro')), 'rosa marca a opção a oeste');
});
t('rooftop: links antigos com áreas em m² continuam abrindo', () => {
  const q = M.normaliza({rooftop:true, rtGourmetA:0, rtVarandaA:8, rtTecnicaA:4, rtTerracoA:40});
  igual([q.rtGourmet, q.rtVaranda, q.rtTecnica, q.rtTerracoA], [false, true, true, undefined]);
  const q2 = M.normaliza({rooftop:true}); igual([q2.rtGourmet, q2.rtVaranda, q2.rtTecnica, q2.rtBanho, q2.rtSpa], [true, true, true, true, false]);
});

// ---------- recuos laterais diferentes (etapa E2.2) ----------
t('recuos: esquerdo e direito diferentes posicionam a casa na faixa edificável, também espelhada', () => {
  const D = require('./desenho.js');
  for(const e of [{recLatE:3, recLatD:1.5}, {recLatE:1.5, recLatD:3}, {recLatE:0, recLatD:2.5, frente:10}, {recLatE:2, recLatD:1, edicula:'1', piscina:true, fundo:45}]){
    const r = M.gerar(Object.assign({frente:14, fundo:32, quartos:3, suites:2, vagas:2, orientacao:'N'}, e)), q = r.entrada;
    ok(r.variantes.length, JSON.stringify(e) + ': sem variante');
    igual(r.B, Math.round((q.frente - q.recLatE - q.recLatD)*100)/100, 'largura edificável:');
    for(const v of r.variantes){
      ok(v.x0 >= q.recX0 - 0.01 && v.x0 + v.W <= q.frente - q.recX1 + 0.01, `${v.nome}: casa fora da faixa (${v.x0} + ${v.W})`);
      const ruins = AU.auditar(v, q).filter(x => ['G03','G04','G18'].includes(x.regra)); ok(!ruins.length, ruins.map(x => x.msg).join('; '));
      // espelhada: anexos dentro da faixa e acessos dentro do lote
      const s = D.espelha(v);
      for(const a of (s.anexos || [])) ok(a.x0 >= q.recX0 - 0.01 && a.x1 <= q.frente - q.recX1 + 0.01, `${v.nome} espelhada: ${a.tipo} invade o recuo (${a.x0}–${a.x1})`);
      for(const g of s.acessos.portoes.concat(s.acessos.vagasFora)) ok(v.x0 + g.x0 >= -0.01 && v.x0 + g.x1 <= q.frente + 0.01, `${v.nome} espelhada: ${g.tipo || 'vaga'} fora do lote`);
    }
  }
});
t('recuos: menos de 1,50 m da divisa não recebe janela (art. 1.301), e o link antigo com recLat continua valendo', () => {
  const r = M.gerar({frente:8, fundo:30, recLatE:0, recLatD:0, quartos:2, suites:1, vagas:1, orientacao:'N'});
  for(const v of r.variantes) for(const p of v.pav.filter(p => !p.anexo)) for(const j of p.janelas.filter(j => j.o === 'v')){
    const xl = v.x0 + j.c; ok(xl > 1.49 && r.entrada.frente - xl > 1.49, `${v.nome}/${p.nome}: janela lateral a ${xl.toFixed(2)} m da divisa`); }
  ok(r.variantes.some(v => v.avisos.some(a => /art\. 1\.301/.test(a))), 'aviso do art. 1.301');
  const q = M.normaliza({recLat:2.5}); igual([q.recLatE, q.recLatD, q.recX0, q.recX1, 'recLat' in q], [2.5, 2.5, 2.5, 2.5, false]);
  const ex = Estado.deHash(Estado.paraHash(Object.assign(Estado.novo(M.PADRAO), {entrada:Object.assign({}, M.PADRAO, {recLat:3})}), M.PADRAO), M.PADRAO);
  igual([M.normaliza(ex.entrada).recX0, M.normaliza(ex.entrada).recX1], [3, 3], 'link antigo expandido pelo estado:');
});

// ---------- inversões (etapa E2.3) ----------
t('inversões: estar ↔ jantar e cozinha ↔ serviço trocam de lugar; cozinha aberta fica encostada no jantar', () => {
  const base = {frente:12, fundo:30, quartos:3, suites:1, orientacao:'N'};
  const ter = v => v.pav.find(p => p.nome === 'Térreo').salas, de = (v, t) => ter(v).find(s => s.tipo === t);
  const encosta = v => { const sh = M._interno.compartilhado(de(v, 'cozinha'), de(v, 'jantar')); return !!sh && sh.t1 - sh.t0 >= 1.0; };
  const n = M.gerar(base).variantes[0];
  ok(de(n, 'estar').x0 < de(n, 'jantar').x0 && !n.invertido, 'normal: estar à esquerda do jantar');
  const ej = M.gerar(Object.assign({invEstarJantar:true}, base));
  ok(ej.variantes.length && ej.variantes.every(v => v.invertido && de(v, 'jantar').x0 < de(v, 'estar').x0 && encosta(v)), 'estar ↔ jantar: jantar à esquerda e cozinha encostada nele');
  const dois = M.gerar(Object.assign({invEstarJantar:true, invCozinhaServico:true}, base)).variantes;
  ok(dois.length && dois.every(v => v.invertido.length === 2 && de(v, 'cozinha').x0 < de(v, 'servico').x0 && encosta(v)), 'as duas inversões juntas');
  const cs = M.gerar(Object.assign({invCozinhaServico:true}, base));
  ok(cs.variantes.every(v => !v.invertido || encosta(v)) && (cs.variantes.some(v => v.invertido) || cs.avisos.some(a => /não coube/.test(a))), 'cozinha ↔ serviço com cozinha aberta: aplica ou avisa');
  const fe = M.gerar(Object.assign({invCozinhaServico:true, cozinha:'fechada'}, base)).variantes[0];
  ok(fe.invertido && de(fe, 'cozinha').x0 < de(fe, 'servico').x0, 'cozinha fechada: a troca vale');
  ok(M.gerar(Object.assign({invEstarJantar:true, jantar:false}, base)).avisos.some(a => /sem efeito/.test(a)), 'sem jantar: aviso de inversão sem efeito');
});

// ---------- íntimo nunca no poente (etapa E2.8) ----------
t('íntimo nunca no poente: frente a leste inverte o zoneamento; nos 8 rumos nenhum quarto térreo encosta a oeste', () => {
  const r = M.gerar({frente:12, fundo:30, quartos:3, suites:1, vagas:2, orientacao:'L'}), v = r.variantes[0];
  ok(v.zoneamento === 'invertido' && /íntimo na frente/.test(v.tipologia), 'frente a leste: ' + v.tipologia);
  const ter = v.pav.find(p => p.nome === 'Térreo'), ent = ter.portas.find(d => d.entrada), c = ter.salas.find(s => s.entrada);
  ok(ent && ent.o === 'h' && Math.abs(ent.c) < 0.01 && c && c.tipo === 'circ', 'entrada pela ponta do corredor, na fachada da frente');
  ok(v.acessos.caminho && v.acessos.vagasFora.length === 2 && v.avisos.some(a => /vagas ficam descobertas/.test(a)), 'vagas descobertas no recuo e caminho até a porta');
  const yq = Math.max(...ter.salas.filter(s => ['quarto','suite','master'].includes(s.tipo)).map(s => s.y1)), ys = Math.min(...ter.salas.filter(s => ['estar','jantar'].includes(s.tipo)).map(s => s.y0));
  ok(yq <= ys + 0.01, 'quartos na frente, salas no fundo');
  for(const o of Object.keys(M.RUMOS)) for(const fr of [10, 12, 15]){
    const x = M.gerar({frente:fr, fundo:32, quartos:3, suites:1, orientacao:o}).variantes[0];
    ok(x && !x.intimoPoente && !x.quartosPoente, `${o}, ${fr} m: quarto encostado a oeste (${x && x.tipologia})`);
    ok(!AU.auditar(x, M.normaliza({frente:fr, fundo:32, orientacao:o})).some(a => a.regra === 'G19'), `${o}, ${fr} m: auditoria G19`);
  }
  igual(M.gerar({frente:12, fundo:30, quartos:3, suites:1, orientacao:'O'}).variantes.some(x => x.zoneamento === 'invertido'), false, 'frente a oeste não inverte:');
  const sub = M.gerar({frente:12, fundo:30, quartos:3, suites:1, subsolo:true, orientacao:'L'});
  ok(sub.variantes.length && sub.avisos.some(a => /fachada a oeste/.test(a)), 'com subsolo: recurso com aviso');
});

// ---------- mobília da planta humanizada (etapa F1) ----------
const MOB = require('./mobilia.js');
const pavMao = (salas, portas, janelas, vaos) => ({nome:'Térreo', salas, portas:portas || [], janelas:janelas || [], vaos:vaos || []});
const cx = q => [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2];
t('mobília: cama com a cabeceira longe da porta e fora da parede da janela', () => {
  // quarto 3,5 × 3,5; porta no lado y0 (frente), janela no lado x1
  const S = [{id:1, tipo:'suite', nome:'Suíte', zona:'intimo', x0:0, y0:0, x1:3.5, y1:3.5}, {id:2, tipo:'circ', nome:'Circulação', zona:'circ', x0:0, y0:-1.2, x1:3.5, y1:0}];
  const P = pavMao(S, [{o:'h', c:0, t0:0.2, t1:1.0, sala:1, viz:2, dentro:1}], [{o:'v', c:3.5, t0:1, t1:2.5, h:1.2}]);
  const q = MOB.pavimento(P), cama = q.find(x => x.sala === 1 && x.tipo === 'cama');
  ok(cama, 'sem cama');
  ok(cama.lado === 'y1', 'cabeceira deveria ficar na parede do fundo (y1), longe da porta; ficou em ' + cama.lado);
  ok(cama.x1 - cama.x0 >= 1.6 - 1e-6, 'suíte com cama de casal de 1,60 m');
  ok(q.filter(x => x.sala === 1 && x.tipo === 'criado').length === 2, 'dois criados-mudos');
});
t('mobília: mesa de jantar centrada e cadeiras conforme a área', () => {
  const S = [{id:1, tipo:'jantar', nome:'Jantar', zona:'social', x0:0, y0:0, x1:6, y1:4.5}];   // interno 5,85 × 4,35: cabe a mesa de 8 com 0,75 m em volta
  const m = MOB.pavimento(pavMao(S)).find(x => x.tipo === 'mesa-jantar');
  ok(m, 'sem mesa'); const [a, b] = cx(m);
  ok(Math.abs(a - 3) < 0.01 && Math.abs(b - 2.25) < 0.01, 'mesa fora do centro: ' + a + ', ' + b);
  igual(m.lugares, 8, 'jantar de 27 m²:');
});
t('mobília: nenhuma peça na faixa da porta nem fora do cômodo', () => {
  const S = [{id:1, tipo:'cozinha', nome:'Cozinha', zona:'apoio', x0:0, y0:0, x1:3, y1:2.4}, {id:2, tipo:'circ', nome:'Circ', zona:'circ', x0:3, y0:0, x1:4.2, y1:2.4}];
  const P = pavMao(S, [{o:'v', c:3, t0:0.8, t1:1.6, sala:1, viz:2, dentro:-1}]);
  const q = MOB.pavimento(P).filter(x => x.sala === 1);
  ok(q.some(x => x.tipo === 'bancada-cozinha') && q.some(x => x.tipo === 'geladeira'), 'cozinha sem bancada ou geladeira');
  const zona = MOB.zonasPortas(S[0], P)[0];
  ok(zona && Math.abs(zona.x0 - 2.2) < 1e-6, 'a folha de 0,80 m abre para a cozinha: a faixa livre tem a largura da folha');
  for(const x of q){ ok(x.x0 >= 0.075 - 1e-6 && x.y0 >= 0.075 - 1e-6 && x.y1 <= 2.325 + 1e-6, x.tipo + ' fora do cômodo');
    ok(!(x.x1 > zona.x0 && x.y0 < zona.y1 && x.y1 > zona.y0), x.tipo + ' na faixa da porta'); }
});
t('mobília: subsolo sem móveis e varanda com mesa externa', () => {
  igual(MOB.pavimento({nome:'Subsolo', salas:[{id:1, tipo:'garagem', x0:0, y0:0, x1:6, y1:6}], portas:[], janelas:[], vaos:[]}).length, 0, 'subsolo:');
  ok(MOB.pavimento(pavMao([{id:1, tipo:'varanda', nome:'Varanda', zona:'varanda', x0:0, y0:0, x1:6, y1:2}])).some(x => x.tipo === 'mesa-externa'), 'varanda sem mesa');
});

t('humanizada: pisos, paredes em escala, móveis e técnica intacta', () => {
  const D = require('./desenho.js'), v = M.gerar({frente:12, fundo:30, quartos:3, suites:2}).variantes[0];
  const h = D.planta(v, 0, {estilo:'humanizada'}), tec = D.planta(v, 0);
  ok(/<pattern id="hz\d+_madeira"/.test(h) && /url\(#hz\d+_madeira\)/.test(h), 'piso de madeira nos quartos');
  ok(/stroke-width="4.5"/.test(h) && /stroke-width="3"/.test(h), 'paredes de 15 e 10 cm (4,5 e 3 px)');
  ok(/<title>Cama /.test(h) && /<title>Bacia sanitária /.test(h), 'cama e bacia desenhadas');
  ok(!/<pattern/.test(tec) && !/<title>Cama /.test(tec), 'sem a opção, a planta técnica não muda');
  const ids = [...h.matchAll(/<pattern id="(hz\d+_)/g)].map(m => m[1]), h2 = D.planta(v, 0, {estilo:'humanizada'});
  ok(ids.length && !h2.includes('id="' + ids[0] + 'madeira"'), 'cada desenho com ids próprios');
});

function rodar(){
  const linhas = []; let falhas = 0;
  for(const {nome, fn} of testes){ try{ fn(); }catch(e){ falhas++; linhas.push(`FALHA unidade ${nome}: ${e.message}`); } }
  linhas.push(falhas ? `unidades: ${falhas} de ${testes.length} falharam` : `unidades: ${testes.length} testes passaram`);
  return {falhas, linhas};
}
module.exports = {rodar, t, igual, ok};
