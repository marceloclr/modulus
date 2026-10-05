/* Energia solar básica on-grid com bateria (funções puras). Estimativa de estudo, não projeto.
   - pacote básico: portão, luzes internas e externas, câmeras, geladeira, um ar-condicionado e ventiladores (todas críticas);
   - geração: kWp = consumo do pacote ÷ (HSP × 30 × PR), em módulos inteiros;
   - área: módulos × área do módulo, contra a cobertura × aproveitamento do tipo de telhado (provisório até o estilo);
   - bateria: carga crítica diária × autonomia ÷ (DoD × eficiência);
   - inversor híbrido: demanda simultânea das críticas, conferida com a partida do maior motor (3 a 5 vezes);
   - economia mês a mês (Lei 14.300: Fio B sobre a energia compensada) e payback simples e descontado. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(require('./motor.js')); else root.Solar = factory(root.Motor);
})(this, function(Motor){
'use strict';
const PADRAO = {solAutonomia:8};
const DIAS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const INVERSORES = [3, 3.6, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const r1 = n => Math.round(n*10)/10, r2 = n => Math.round(n*100)/100, f2 = Motor.f2;
const brl = n => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

/* Cargas aplicáveis ao programa, com quantidade, consumo e potência. */
function cargas(q, S, areaConstruida){
  const nq = Math.max(1, +q.quartos || 1);
  return S.cargas.map(c => {
    const qtd = c.porQuarto ? nq + (c.mais || 0) : 1;
    const kwh = c.kwhMesPorM2 ? c.kwhMesPorM2 * (areaConstruida || 0) : c.kwhMes * qtd;
    return {id:c.id, nome:c.nome + (qtd > 1 ? ` (${qtd})` : ''), qtd, kwhMes:r1(kwh), potenciaW:c.potenciaW * qtd, motorW: c.motor ? c.potenciaW : 0, critica:true, origem:c.origem};
  });
}

/* Cobertura disponível (provisória até o estilo): projeção do pavimento mais alto da casa, sem o terraço do rooftop e a torre. */
function cobertura(v){
  const T = Motor.TIPOS, topo = v.pav.find(p => p.nome === 'Superior') || v.pav.find(p => p.nome === 'Térreo');
  if(!topo) return {area:0, detalhe:'sem pavimento'};
  let a = topo.salas.filter(s => !['terraco', 'jardim'].includes(s.tipo) && !s.vaga).reduce((t, s) => t + Motor.area(s), 0);
  const det = [`projeção do ${topo.nome.toLowerCase()} ${f2(a)} m²`];
  const rt = v.pav.find(p => p.nome === 'Rooftop');
  if(rt){ const ab = rt.salas.filter(s => T[s.tipo] && T[s.tipo].aberto && s.tipo === 'terraco').reduce((t, s) => t + Motor.area(s), 0); a -= ab; det.push(`− terraço do rooftop ${f2(ab)} m²`); }
  if(v.torre){ const tt = (v.torre.x1 - v.torre.x0 + 2) * (v.torre.y1 - v.torre.y0 + 2); a -= tt; det.push(`− torre e sua sombra ${f2(tt)} m²`); }
  return {area:r2(Math.max(0, a)), detalhe:det.join(' ')};
}

function rsWpPara(kWp, tabela){
  const t = tabela.slice().sort((a, b) => a.kWp - b.kWp);
  if(kWp <= t[0].kWp) return t[0].valor; if(kWp >= t[t.length-1].kWp) return t[t.length-1].valor;
  for(let i = 1; i < t.length; i++) if(kWp <= t[i].kWp){ const a = t[i-1], b = t[i], k = (kWp - a.kWp)/(b.kWp - a.kWp); return a.valor + (b.valor - a.valor)*k; }
}
const pctFioB = (S, ano) => { const anos = Object.keys(S.fioB).map(Number).sort((a, b) => a - b); const k = anos.filter(x => x <= ano).pop(); return k === undefined ? 0 : S.fioB[String(k)]; };

function calcular(v, q, dados, op){
  q = Object.assign({}, PADRAO, q || {}); op = op || {};
  const S = dados.solar, ano = op.ano || 2026;
  const areaConstruida = v.quadro ? v.quadro.fechada : 0;
  // consumo do pacote básico (todas as cargas são críticas)
  const lista = cargas(q, S, areaConstruida), criticas = lista;
  const consumo = r1(lista.reduce((t, c) => t + c.kwhMes, 0));
  const criticoMes = r1(criticas.reduce((t, c) => t + c.kwhMes, 0)), criticoDia = r2(criticoMes / 30);
  // geração
  const hsp = S.irradiacao.anual, pr = S.pr.med, alvo = consumo;   // o resto da casa já paga a disponibilidade da conta
  const kWpNec = alvo / (hsp * 30 * pr), modW = S.modulo.potenciaW;
  let nMod = Math.max(1, Math.ceil(kWpNec * 1000 / modW));
  const cob = cobertura(v), telhado = q.solTelhado || 'laje', aprov = S.aproveitamento[telhado] || S.aproveitamento.laje;
  const areaDisp = r2(cob.area * aprov), cabem = Math.floor(areaDisp / S.modulo.areaM2), avisos = [];
  const nNec = nMod;
  if(nMod > cabem){ avisos.push(`A cobertura comporta ${cabem} módulo${cabem === 1 ? '' : 's'} (${f2(areaDisp)} m² úteis); o consumo pediria ${nNec}. A geração cobre só parte do consumo.`); nMod = Math.max(0, cabem); }
  const kWp = r2(nMod * modW / 1000), areaMod = r2(nMod * S.modulo.areaM2);
  // bateria e inversor
  const horas = Math.max(1, +q.solAutonomia || 8), bat = S.bateria;
  const bateriaKwh = Math.ceil((criticoDia * horas/24) / (bat.dod * bat.eficiencia) / 2.5) * 2.5;
  const demandaW = criticas.reduce((t, c) => t + c.potenciaW, 0) * 0.6, motorMax = Math.max(0, ...criticas.map(c => c.motorW));
  const pico = demandaW + motorMax * (S.partida.max - 1);
  let invKw = INVERSORES.find(k => k >= Math.max(kWp / 1.25, demandaW / 1000, pico / 2000)) || INVERSORES[INVERSORES.length-1];
  // custo (faixa: preço do kit ± 10 %, inversor, bateria e quadro com as próprias faixas)
  const rs = rsWpPara(kWp, S.rsWp), fv = kWp * 1000 * rs * (1 - S.parteInversorNoKit);
  const custo = {}; for(const n of ['min', 'med', 'max']){ const kf = {min:0.9, med:1, max:1.1}[n];
    custo[n] = fv * kf + invKw * S.inversorHibridoRsKw[n] + bateriaKwh * S.bateriaRsKwh[n] + S.quadroCritico[n]; }
  // economia mês a mês (ano 1)
  const T = S.tarifaB1SemTributos * S.tributos.med, fioB = S.fioBIntegralRsKwh.med * pctFioB(S, ano), utilDia = bateriaKwh * bat.dod * 0.5;
  const meses = S.irradiacao.mensal.map((h, i) => {
    const g = kWp * h * DIAS[i] * pr, c = consumo * DIAS[i] / 30.42;
    const auto = Math.min(g, c) * S.simultaneidade, desl = Math.min(utilDia * DIAS[i], Math.max(0, g - auto), Math.max(0, c - auto));
    const injetado = Math.max(0, g - auto - desl), compensavel = Math.max(0, c - auto - desl), compensado = Math.min(injetado, compensavel);
    const antes = c * T, depois = (c - auto - desl - compensado) * T + compensado * fioB;
    return {mes:i, geracao:r1(g), consumo:r1(c), autoconsumo:r1(auto + desl), compensado:r1(compensado), antes, depois, economia:antes - depois};
  });
  const economiaAno = meses.reduce((t, m) => t + m.economia, 0), contaAntes = meses.reduce((t, m) => t + m.antes, 0);
  // payback: simples e descontado (reajuste da tarifa, degradação, Fio B pelo ano)
  const F = S.financeiro, inv = custo.med, acumulado = [{ano:0, valor:-inv}];
  let acum = -inv, acumVp = -inv, pbDesc = null, pbSimples = economiaAno > 0 ? inv / economiaAno : null;
  for(let k = 1; k <= F.vidaUtil; k++){
    const fb = S.fioBIntegralRsKwh.med * pctFioB(S, ano + k - 1) * Math.pow(1 + F.reajusteTarifa, k - 1);
    const eco = meses.reduce((t, m) => { const g = Math.pow(1 - F.degradacao, k - 1), Tk = T * Math.pow(1 + F.reajusteTarifa, k - 1);
      return t + (m.autoconsumo * g + m.compensado * g) * Tk - m.compensado * g * fb; }, 0);
    acum += eco; const vp = eco / Math.pow(1 + F.taxaDesconto, k), antesVp = acumVp; acumVp += vp;
    if(pbDesc === null && acumVp >= 0) pbDesc = r1(k - 1 + (-antesVp) / vp);
    acumulado.push({ano:k, valor:acum});
  }
  const litoral = q.municipio === 'portoDasDunas' || q.distMar === 'ate500';
  if(litoral) avisos.push(S.litoral);
  return {
    pacote:S.pacote, cargas:lista, consumo, criticoMes, criticoDia,
    hsp, pr, kWpNecessario:r2(kWpNec), modulos:nMod, modulosNecessarios:nNec, kWp, potenciaModuloW:modW, areaModulos:areaMod, cobertura:cob, telhado, aproveitamento:aprov, areaDisponivel:areaDisp,
    bateriaKwh, autonomiaH:horas, inversorKw:invKw, demandaW:Math.round(demandaW), motorMaxW:motorMax, picoW:Math.round(pico),
    rsWp:r2(rs), custo, meses, economiaAno, contaAntes, economiaPct: contaAntes ? economiaAno / contaAntes : 0,
    paybackSimples: pbSimples === null ? null : r1(pbSimples), paybackDescontado:pbDesc, acumulado, fioBPct:pctFioB(S, ano), ano,
    tarifaComTributos:r2(T), litoral, avisos, normas:S.normas, provisorio: !q.solTelhado,
    formulas:{
      kWp:`kWp = ${f2(consumo)} kWh/mês do pacote ÷ (HSP ${f2(hsp)} × 30 × PR ${f2(pr)}) = ${f2(kWpNec)} kWp → ${nNec} módulos de ${modW} Wp`,
      area:`${nMod} módulos × ${f2(S.modulo.areaM2)} m² = ${f2(areaMod)} m²; disponível: ${cob.detalhe} × aproveitamento ${f2(aprov)} (${telhado}) = ${f2(areaDisp)} m²`,
      bateria:`${f2(criticoDia)} kWh/dia críticos × ${horas} h ÷ 24 ÷ (DoD ${f2(bat.dod)} × eficiência ${f2(bat.eficiencia)}) = ${f2(criticoDia*horas/24/(bat.dod*bat.eficiencia))} kWh → ${f2(bateriaKwh)} kWh (múltiplos de 2,5)`,
      inversor:`demanda simultânea ${f2(demandaW/1000)} kW (60 % das cargas do pacote); partida do maior motor (${f2(motorMax/1000)} kW × ${S.partida.max}) leva o pico a ${f2(pico/1000)} kW, que o inversor suporta por segundos até o dobro da nominal → ${f2(invKw)} kW`,
      custo:`kit ${f2(kWp)} kWp × R$ ${f2(rs)}/Wp sem o inversor comum (${f2(100*S.parteInversorNoKit)} %) + inversor híbrido ${f2(invKw)} kW + bateria ${f2(bateriaKwh)} kWh + quadro crítico`,
      economia:`tarifa com tributos R$ ${f2(T)}/kWh; autoconsumo e bateria valem a tarifa cheia; a energia compensada paga o Fio B (${f2(100*pctFioB(S, ano))} % em ${ano}, ≈ R$ ${f2(fioB)}/kWh)`,
      payback:`simples: investimento ÷ economia do 1º ano; descontado: taxa ${f2(100*F.taxaDesconto)} % a.a., tarifa +${f2(100*F.reajusteTarifa)} % a.a., degradação ${f2(100*F.degradacao)} % a.a.`
    }
  };
}

return {PADRAO, cargas, cobertura, rsWpPara, calcular, brl};
});
