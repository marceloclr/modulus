/* Estimativa paramétrica de custo (funções puras). Não é orçamento.
   Custo = área equivalente (NBR 12721) × CUB-CE do padrão × fator local × fator estrutural × fator de estilo + adicionais,
   mais projetos e taxas e, na empreitada, BDI. Faixa mínima–máxima: todos os mínimos e todos os máximos combinados.
   Cada parcela traz a fórmula com os números usados, para a dica da interface. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(require('./motor.js')); else root.Custos = factory(root.Motor);
})(this, function(Motor){
'use strict';
const PADRAO = {municipio:'fortaleza', condominio:false, distMar:'acima2000', padrao:'intermediario', cubTipo:'onerado', empreitada:false, custoIncc:false};
const NIVEIS = ['min', 'med', 'max'];
const r2 = n => Math.round(n*100)/100, f2 = Motor.f2;
const brl = n => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const tri = f => ({min:f('min'), med:f('med'), max:f('max')});

/* Áreas por categoria de equivalência (m² reais). */
function areas(v){
  const T = Motor.TIPOS, a = {principal:0, garagem:0, varanda:0, terraco:0, areaTecnica:0, jardim:0, subsolo:0};
  for(const p of v.pav){
    if(p.nome === 'Subsolo'){ a.subsolo += p.dim ? p.dim.W * p.dim.D : p.salas.reduce((t, s) => t + Motor.area(s), 0); continue; }
    for(const s of p.salas){
      const A = Motor.area(s), t = T[s.tipo] || {};
      if(s.tipo === 'garagem') a.garagem += A;
      else if(s.tipo === 'varanda' || s.tipo === 'gourmet') a.varanda += A;
      else if(s.tipo === 'terraco') a.terraco += A;
      else if(s.tipo === 'jardim') a.jardim += A;
      else if(s.nome === 'Área técnica') a.areaTecnica += A;
      else if(!t.aberto) a.principal += A;
    }
  }
  for(const x of (v.anexos || [])) if(x.tipo === 'gourmetDest') a.varanda += (x.x1 - x.x0) * (x.y1 - x.y0);
  for(const k in a) a[k] = r2(a[k]);
  return a;
}

/* INCC-M acumulado desde o mês do CUB (projeção estimada). */
function inccAcumulado(dados){
  const s = (dados.referencias.incc && dados.referencias.incc.serie) || {}, base = dados.cub.mesRef;
  const meses = Object.keys(s).filter(m => m > base).sort();
  return {fator: meses.reduce((f, m) => f * (1 + s[m]/100), 1), meses};
}

function calcular(v, q, dados){
  q = Object.assign({}, PADRAO, q || {});
  const C = dados.coeficientes, F = dados.fatores, AD = dados.adicionais;
  const pad = dados.padroes[q.padrao] || dados.padroes.intermediario, tabela = q.cubTipo === 'desonerado' ? dados.cub.desonerado : dados.cub.onerado;
  const cub = tabela[pad.cub];
  // área equivalente
  const A = areas(v);
  const cat = [['principal', 'Área principal fechada', {min:1, med:1, max:1, origem:'Área real'}], ['garagem', C.garagem.nome, C.garagem], ['varanda', C.varanda.nome, C.varanda],
    ['terraco', C.terraco.nome, C.terraco], ['areaTecnica', C.areaTecnica.nome, C.areaTecnica], ['jardim', C.jardim.nome, C.jardim], ['subsolo', 'Subsolo (garagem)', C.garagem]];
  const linhasAeq = cat.filter(([k]) => A[k] > 0).map(([k, nome, c]) => ({id:k, nome, area:A[k], coef:{min:c.min, med:c.med, max:c.max}, eq:tri(n => r2(A[k] * c[n])), origem:c.origem}));
  const Aeq = tri(n => r2(linhasAeq.reduce((t, l) => t + l.eq[n], 0)));
  // fatores
  const um = {min:1, med:1, max:1};
  const fLog = F.logistica[q.municipio] || um, fCond = q.condominio ? (F.condominio[q.municipio] || um) : um, fMar = F.marinho[q.distMar] || um;
  const local = tri(n => fLog[n] * fCond[n] * fMar[n]);
  const sis = F.estrutural[q.estSistema || 'concretoArmado'] || F.estrutural.concretoArmado;
  const litoral = sis.acrescimoLitoral && q.distMar === 'ate500' ? sis.acrescimoLitoral : 0;
  const vm = q.estVaos === 'maiores' ? F.vaosMaiores : um;
  const estr = tri(n => (sis[n] + litoral) * vm[n]);
  const est = q.estilo && F.estilo[q.estilo] ? F.estilo[q.estilo] : um;
  const fatorTotal = tri(n => local[n] * estr[n] * est[n]);
  // construção (CUB)
  const base = tri(n => Aeq[n] * cub), construcao = tri(n => base[n] * fatorTotal[n]);
  const comp = dados.cub.composicao && dados.cub.composicao[pad.cub];
  const composicao = comp ? Object.entries(comp).map(([k, val]) => ({id:k, nome:{materiais:'Materiais', maoDeObra:'Mão de obra', administracao:'Administração', equipamentos:'Equipamentos'}[k] || k, peso:val/dados.cub.onerado[pad.cub], valor:tri(n => base[n] * val/dados.cub.onerado[pad.cub])})) : [];
  // adicionais fora do CUB
  const ad = [];
  const sobrado = v.pav.some(p => p.nome === 'Superior'), proj = v.projecao || 0;
  const fund = sobrado ? AD.fundacaoSobrado : AD.fundacaoTerrea;
  ad.push({id:'fundacao', nome:fund.nome, valor:tri(n => proj * fund[n]), formula:`${f2(proj)} m² de projeção × ${brl(fund.med)}/m² (${brl(fund.min)} a ${brl(fund.max)})`, origem:fund.origem});
  if(A.subsolo > 0) ad.push({id:'subsolo', nome:AD.subsolo.nome, valor:tri(n => A.subsolo * AD.subsolo[n]), formula:`${f2(A.subsolo)} m² de subsolo × ${brl(AD.subsolo.med)}/m²`, origem:AD.subsolo.origem});
  if(q.elevador) ad.push({id:'elevador', nome:AD.elevador.nome, valor:tri(n => AD.elevador[n]), formula:`1 elevador: ${brl(AD.elevador.min)} a ${brl(AD.elevador.max)}`, origem:AD.elevador.origem});
  const pis = (v.anexos || []).find(x => x.tipo === 'piscina');
  if(pis){ ad.push({id:'piscina', nome:'Piscina', valor:tri(n => pis.lamina * AD.piscinaLamina[n] + AD.piscinaEquipamentos[n]),
    formula:`${f2(pis.lamina)} m² de lâmina × ${brl(AD.piscinaLamina.med)}/m² + equipamentos ${brl(AD.piscinaEquipamentos.med)}`, origem:AD.piscinaLamina.origem}); }
  const obra = tri(n => construcao[n] + ad.reduce((t, x) => t + x.valor[n], 0));
  const projetos = tri(n => obra[n] * AD.projetosTaxas[n]/100);
  const bdi = q.empreitada ? tri(n => (obra[n] + projetos[n]) * AD.bdi[n]/100) : null;
  let total = tri(n => obra[n] + projetos[n] + (bdi ? bdi[n] : 0));
  // projeção INCC-M (estimada)
  let incc = null;
  if(q.custoIncc){ const ia = inccAcumulado(dados); incc = {fator:ia.fator, meses:ia.meses}; total = tri(n => total[n] * ia.fator); }
  const areaConstruida = v.quadro ? v.quadro.fechada : A.principal;
  const parcelas = [
    {id:'construcao', nome:'Construção (CUB × área equivalente × fatores)', valor:construcao,
      formula:`${f2(Aeq.med)} m² equivalentes × CUB ${pad.cub} ${brl(cub)}/m² × fator ${f2(fatorTotal.med)} (local ${f2(local.med)} · estrutura ${f2(estr.med)} · estilo ${f2(est.med)})`},
    ...ad,
    {id:'projetos', nome:AD.projetosTaxas.nome, valor:projetos, formula:`${f2(AD.projetosTaxas.med)} % de ${brl(obra.med)} (${f2(AD.projetosTaxas.min)} a ${f2(AD.projetosTaxas.max)} %)`, origem:AD.projetosTaxas.origem}];
  if(bdi) parcelas.push({id:'bdi', nome:AD.bdi.nome, valor:bdi, formula:`${f2(AD.bdi.med)} % (quartis ${f2(AD.bdi.min)} a ${f2(AD.bdi.max)} %)`, origem:AD.bdi.origem});
  if(incc) parcelas.push({id:'incc', nome:'Projeção INCC-M (estimada)', valor:tri(n => total[n] - total[n]/incc.fator), formula:`× ${f2(incc.fator)} (${incc.meses.join(', ') || 'sem meses novos'})`, estimado:true});
  return {
    entrada:q, padrao:pad, cubTipo:q.cubTipo, cub, mesRef:dados.cub.mesRef, fonte:dados.cub.fonte,
    areas:A, linhasAeq, Aeq, fatores:{local, logistica:fLog, condominio:fCond, marinho:fMar, estrutura:estr, sistema:sis.nome, estilo:est, total:fatorTotal},
    composicao, adicionais:ad, parcelas, total, areaConstruida,
    porM2: tri(n => areaConstruida ? total[n]/areaConstruida : 0),
    formulaTotal:`Total = construção ${brl(construcao.med)} + adicionais ${brl(obra.med - construcao.med)} + projetos ${brl(projetos.med)}${bdi ? ' + BDI ' + brl(bdi.med) : ''}${incc ? ' × INCC ' + f2(incc.fator) : ''}`,
    formulaM2:`Total ÷ ${f2(areaConstruida)} m² construídos (área fechada)`,
    aviso:dados.aviso
  };
}

return {PADRAO, NIVEIS, areas, calcular, inccAcumulado, brl};
});
