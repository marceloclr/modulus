/* Cards de análise do gerador (HTML em string, testável no Node): estimativa de custo e sistema estrutural.
   Cor de cada card pelo mapa --card-* de base.css. Todo número calculado leva a fórmula na dica (data-tip). */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(require('./graficos.js'), require('./custos.js'), require('./motor.js'));
  else root.Cartoes = factory(root.Graficos, root.Custos, root.Motor);
})(this, function(Graficos, Custos, Motor){
'use strict';
const f2 = Motor.f2, brl = Custos.brl, esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesTxt = m => { const [a, b] = m.split('-'); return `${MESES[+b - 1]}/${a}`; };
const dataBr = d => d.split('-').reverse().join('/');
const brlCurto = n => n >= 1e6 ? 'R$ ' + (n/1e6).toFixed(2).replace('.', ',') + ' mi' : 'R$ ' + Math.round(n/1000).toLocaleString('pt-BR') + ' mil';

/* Selo de atualidade: alerta quando passam 45 dias do fim do mês de referência sem valor novo. */
function selo(dados, hoje){
  const [a, m] = dados.cub.mesRef.split('-').map(Number), fimMes = new Date(Date.UTC(a, m, 0));
  const dias = Math.floor(((hoje || new Date()) - fimMes) / 864e5), velho = dias > 45;
  return {texto:`Valores de ${mesTxt(dados.cub.mesRef)} · ${dados.cub.fonte} · coletados em ${dataBr(dados.cub.coletadoEm)}`, dias, velho,
    dica:`CUB-CE de ${mesTxt(dados.cub.mesRef)}, publicado em ${dataBr(dados.cub.publicadoEm)}. ${velho ? 'Há mais de 45 dias do fim do mês de referência: confira se já saiu valor novo.' : 'Dentro do prazo de publicação do índice seguinte.'}`};
}

const VISTAS = [['parcelas', 'Parcelas', 'Mostra o custo de cada parcela, com a faixa mínima–máxima'], ['composicao', 'Composição do CUB', 'Divide a construção em materiais, mão de obra, administração e equipamentos (sem os fatores)'],
  ['variantes', 'Variantes', 'Compara o custo total das variantes deste programa'], ['serie', 'Série do CUB', 'Evolução mensal do CUB-CE dos três padrões']];

/* r: resultado de Custos.calcular · extra: {dados, historico, porVariante:[{nome, r}], atual, vista, hoje} */
function cartaoCusto(r, extra){
  const sl = selo(extra.dados, extra.hoje), vista = extra.vista || 'parcelas';
  const tot = r.total;
  let h = `<div class="card res" style="--c:var(--card-custo)"><div class="res-head"><h3>Estimativa de custo</h3>`;
  h += `<p class="selo${sl.velho ? ' velho' : ''}" tabindex="0" data-tip="${esc(sl.dica)}">${sl.velho ? '⚠ ' : ''}${esc(sl.texto)}</p></div>`;
  h += `<div class="stats s3">`;
  h += `<div class="stat" style="--c:var(--card-custo)" tabindex="0" data-tip="${esc(r.formulaTotal)}"><div class="k">Custo estimado</div><div class="v">${brl(tot.med)}</div></div>`;
  h += `<div class="stat" style="--c:var(--card-custo)" tabindex="0" data-tip="Faixa: todos os mínimos combinados (coeficientes, fatores e adicionais) até todos os máximos"><div class="k">Faixa</div><div class="v v-menor">${brlCurto(tot.min)} a ${brlCurto(tot.max)}</div></div>`;
  h += `<div class="stat" style="--c:var(--card-custo)" tabindex="0" data-tip="${esc(r.formulaM2)}"><div class="k">Por m² construído</div><div class="v">${brl(r.porM2.med)}</div></div></div>`;
  h += `<p class="nota-custo">${esc(r.padrao.nome)} · CUB ${esc(r.padrao.cub)} ${r.cubTipo === 'desonerado' ? 'desonerado' : 'não desonerado'} <span class="calc" data-tip="CUB/m² do Sinduscon-CE para o projeto-padrão ${esc(r.padrao.cub)}, ${mesTxt(r.mesRef)}">${brl(r.cub)}/m²</span> · área equivalente <span class="calc" data-tip="${esc(r.linhasAeq.map(l => `${l.nome}: ${f2(l.area)} m² × ${f2(l.coef.med)}`).join(' + '))}">${f2(r.Aeq.med)} m²</span> · fator <span class="calc" data-tip="${esc(`Local ${f2(r.fatores.local.med)} (logística ${f2(r.fatores.logistica.med)} × condomínio ${f2(r.fatores.condominio.med)} × mar ${f2(r.fatores.marinho.med)}) × estrutura ${f2(r.fatores.estrutura.med)} (${r.fatores.sistema}) × estilo ${f2(r.fatores.estilo.med)}`)}">${f2(r.fatores.total.med)}</span></p>`;
  // referência SINAPI-CE (IBGE): valor guardado e consulta ao vivo
  const sn = extra.dados.referencias.sinapi, vivo = extra.sinapiVivo;
  h += `<p class="nota-custo">Referência <span class="calc" data-tip="${esc(sn.nota || '')}">SINAPI-CE</span> (IBGE, tabela ${sn.tabela}): ${brl(sn.valor)}/m² em ${mesTxt(sn.mesRef)}`;
  h += vivo ? (vivo.erro ? ` · <span class="aviso-vivo">consulta ao IBGE falhou (${esc(vivo.erro)})</span>` : ` · <strong>ao vivo: ${brl(vivo.valor)}/m² em ${esc(vivo.mes)}</strong>`)
    : ` · <button class="btn btn-mini" type="button" data-acao="sinapi" data-tip="Consulta agora a API do SIDRA/IBGE (tabela ${sn.tabela}, Ceará). O SINAPI mede outra cesta: serve para conferir a tendência, não substitui o CUB">Consultar o IBGE agora</button>`;
  h += `</p>`;
  if(r.entrada.custoIncc) h += `<p class="nota-custo"><strong>Projeção pelo INCC-M (estimada):</strong> o total já inclui ${f2(100*((r.parcelas.find(p => p.id === 'incc') || {valor:{med:0}}).valor.med)/r.total.med)} % de reajuste estimado desde ${mesTxt(r.mesRef)}.</p>`;
  // gráfico com troca de vista
  h += `<div class="tabs vistas" role="group" aria-label="Visualização do gráfico">${VISTAS.map(([id, nome, dica]) => `<button class="btn" type="button" data-vista="${id}" aria-pressed="${id === vista}" data-tip="${esc(dica)}">${nome}</button>`).join('')}</div>`;
  h += `<div class="graf-caixa">${grafico(r, extra, vista)}</div>`;
  // tabela (o mesmo conteúdo, sem depender do gráfico)
  h += `<details class="tabela-custo"><summary>Ver a tabela das parcelas e da área equivalente</summary><div class="tbl-wrap"><table><thead><tr><th>Parcela</th><th class="n">Mínimo</th><th class="n">Estimado</th><th class="n">Máximo</th></tr></thead><tbody>`;
  for(const p of r.parcelas) h += `<tr><td><span class="calc" data-tip="${esc(p.formula + (p.origem ? ' · ' + p.origem : ''))}">${esc(p.nome)}</span>${p.estimado ? ' <small>(estimado)</small>' : ''}</td><td class="n">${brl(p.valor.min)}</td><td class="n">${brl(p.valor.med)}</td><td class="n">${brl(p.valor.max)}</td></tr>`;
  h += `<tr class="total"><td>Total</td><td class="n">${brl(tot.min)}</td><td class="n">${brl(tot.med)}</td><td class="n">${brl(tot.max)}</td></tr></tbody></table></div>`;
  h += `<div class="tbl-wrap"><table><thead><tr><th>Área</th><th class="n">m² reais</th><th class="n">Coeficiente</th><th class="n">m² equivalentes</th></tr></thead><tbody>`;
  for(const l of r.linhasAeq) h += `<tr><td><span class="calc" data-tip="${esc(l.origem || '')}">${esc(l.nome)}</span></td><td class="n">${f2(l.area)}</td><td class="n">${f2(l.coef.med)} (${f2(l.coef.min)}–${f2(l.coef.max)})</td><td class="n">${f2(l.eq.med)}</td></tr>`;
  h += `<tr class="total"><td>Área equivalente</td><td></td><td></td><td class="n">${f2(r.Aeq.med)}</td></tr></tbody></table></div></details>`;
  h += `<p class="note">${esc(r.aviso)}</p></div>`;
  return h;
}

function grafico(r, extra, vista){
  if(vista === 'composicao'){
    if(!r.composicao.length) return '<p class="note">Composição indisponível para este padrão.</p>';
    return Graficos.barrasFaixa(r.composicao.map(c => ({nome:c.nome, min:c.valor.min, med:c.valor.med, max:c.valor.max,
      dica:`${c.nome}: ${brl(c.valor.med)} · ${f2(100*c.peso)} % do CUB ${r.padrao.cub} × área equivalente (sem fatores)`})), brlCurto, {titulo:'Composição do CUB'});
  }
  if(vista === 'variantes'){
    const pv = extra.porVariante || [];
    return Graficos.barrasFaixa(pv.map(x => ({nome:x.nome, min:x.r.total.min, med:x.r.total.med, max:x.r.total.max,
      dica:`${x.nome}: ${brl(x.r.total.med)} (${brlCurto(x.r.total.min)} a ${brlCurto(x.r.total.max)}) · ${f2(x.r.areaConstruida)} m² construídos · ${brl(x.r.porM2.med)}/m²`})), brlCurto, {titulo:'Custo por variante', destaque:extra.atual, rotulo:90});
  }
  if(vista === 'serie'){
    const hs = extra.historico && extra.historico.serie; if(!hs || !hs.length) return '<p class="note">Série histórica indisponível.</p>';
    const tipo = r.cubTipo === 'desonerado' ? 'desonerado' : 'onerado';
    const series = [['R1-B', 'Simples'], ['R1-N', 'Intermediário'], ['R1-A', 'Alto']].map(([k, nome]) => ({nome, pontos:hs.map(x => ({x:x.mesRef, y:x[tipo][k]}))}));
    return Graficos.linhas(series, v => 'R$ ' + Math.round(v).toLocaleString('pt-BR'), {titulo:'Série do CUB-CE', mes:mesTxt});
  }
  return Graficos.barrasFaixa(r.parcelas.map(p => ({nome:p.nome.replace(/ \(.*\)$/, ''), min:p.valor.min, med:p.valor.med, max:p.valor.max, dica:`${p.nome}: ${brl(p.valor.med)} (${brl(p.valor.min)} a ${brl(p.valor.max)}) · ${p.formula}`})), brlCurto, {titulo:'Parcelas do custo'});
}

/* Card do sistema estrutural (v.estrutura vem de Estrutura.avaliar). */
function cartaoEstrutura(v, dados){
  const e = v.estrutura; if(!e) return '';
  const s = dados.fatores.estrutural[e.sistema];
  let h = `<div class="card res" style="--c:var(--card-estrutura)"><div class="res-head"><h3>Sistema estrutural</h3><p class="selo">${esc(e.nome)} · ${esc(e.norma)}</p></div>`;
  h += `<div class="tbl-wrap"><table><tbody>`;
  h += `<tr><td>Fator de custo</td><td class="n"><span class="calc" data-tip="${esc(s.origem)}">${f2(s.med)} (${f2(s.min)} a ${f2(s.max)})</span>${e.vaosMaiores ? ` × <span class="calc" data-tip="${esc(dados.fatores.vaosMaiores.origem)}">${f2(dados.fatores.vaosMaiores.med)}</span> (vãos maiores)` : ''}</td></tr>`;
  h += `<tr><td>Vão econômico / máximo</td><td class="n">${f2(s.vaoEcon[0])}–${f2(s.vaoEcon[1])} m / ${f2(s.vaoMax)} m</td></tr>`;
  if(e.vaoMaior) h += `<tr><td>Maior vão desta variante</td><td class="n"><span class="calc" data-tip="Menor lado do maior cômodo fechado: é o vão que a laje ou a viga vence sem apoio intermediário">${f2(e.vaoMaior.vao)} m</span> · ${esc(e.vaoMaior.sala.toLowerCase())} (${esc(e.vaoMaior.pav.toLowerCase())})</td></tr>`;
  h += `<tr><td>Balanço usual</td><td class="n">até ${f2(s.balanco)} m</td></tr><tr><td>Prazo</td><td class="n">${esc(s.prazo)}</td></tr><tr><td>Oferta no Ceará</td><td class="n">${esc(s.oferta)}</td></tr>`;
  if(s.restricoes && s.restricoes !== '—') h += `<tr><td>Restrições</td><td class="n">${esc(s.restricoes)}</td></tr>`;
  if(e.paredeSobreParede){ const pp = e.paredeSobreParede;
    h += `<tr><td>Parede sobre parede</td><td class="n"><span class="calc" data-tip="${esc(`${f2(pp.apoiado)} m de ${f2(pp.total)} m de paredes do superior apoiadas em paredes do térreo (tolerância de 0,15 m)`)}">${f2(pp.pct)} %</span> <span class="medidor" aria-hidden="true"><i style="width:${Math.min(100, pp.pct)}%"></i></span></td></tr>`; }
  h += `</tbody></table></div>`;
  h += e.avisos.length ? `<div class="warn"><ul>${e.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : `<div class="warn ok">Sem conflito entre o sistema e esta variante.</div>`;
  h += `</div>`;
  return h;
}

/* Card de energia solar (r de Solar.calcular). */
const VISTAS_SOLAR = [['mensal', 'Geração × consumo', 'Geração estimada mês a mês (irradiação da NASA POWER) contra o consumo'], ['retorno', 'Retorno', 'Economia acumulada menos o investimento, em 25 anos'], ['cargas', 'Cargas', 'Consumo mensal estimado de cada carga; as críticas ficam ligadas na falta da rede']];
const f1 = n => (Math.round(n*10)/10).toFixed(1).replace('.', ',');
const MES_CURTO = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
function cartaoSolar(r, extra){
  const vista = (extra && extra.vista) || 'mensal', F = r.formulas, kwh = n => `${Math.round(n).toLocaleString('pt-BR')} kWh`;
  let h = `<div class="card res" style="--c:var(--card-solar)"><div class="res-head"><h3>Energia solar com bateria</h3>`;
  h += `<p class="selo">On-grid com comutação para o quadro crítico · ${esc(r.nivel)} na falta da rede${r.provisorio ? ' · <span tabindex="0" data-tip="Até o estilo ser escolhido (bloco 4), a cobertura é tratada como laje com platibanda; o tipo de telhado do estilo muda a área útil e a inclinação">cobertura provisória</span>' : ''}</p></div>`;
  h += `<div class="stats s3">`;
  h += `<div class="stat" style="--c:var(--card-solar)" tabindex="0" data-tip="${esc(F.kWp)}"><div class="k">Geração</div><div class="v">${f2(r.kWp)} kWp</div></div>`;
  h += `<div class="stat" style="--c:var(--card-solar)" tabindex="0" data-tip="${esc(F.bateria + ' · ' + F.inversor)}"><div class="k">Bateria · inversor</div><div class="v v-menor">${f2(r.bateriaKwh)} kWh · ${f2(r.inversorKw)} kW</div></div>`;
  h += `<div class="stat" style="--c:var(--card-solar)" tabindex="0" data-tip="${esc(F.custo)}"><div class="k">Investimento</div><div class="v">${brlCurto(r.custo.med)}</div></div>`;
  h += `<div class="stat" style="--c:var(--card-solar)" tabindex="0" data-tip="${esc(F.economia)}"><div class="k">Economia no 1º ano</div><div class="v v-menor">${brl(r.economiaAno)} · ${Math.round(100*r.economiaPct)} % da conta</div></div>`;
  h += `<div class="stat" style="--c:var(--card-solar)" tabindex="0" data-tip="${esc(F.payback)}"><div class="k">Retorno</div><div class="v v-menor">${r.paybackSimples === null ? '—' : f1(r.paybackSimples) + ' anos'}${r.paybackDescontado === null ? '' : ' · ' + f1(r.paybackDescontado) + ' descontado'}</div></div>`;
  h += `<div class="stat" style="--c:var(--card-solar)" tabindex="0" data-tip="${esc(F.area)}"><div class="k">Área de módulos</div><div class="v v-menor">${f2(r.areaModulos)} de ${f2(r.areaDisponivel)} m² <span class="medidor" aria-hidden="true" style="--card-estrutura:var(--card-solar)"><i style="width:${Math.min(100, r.areaDisponivel ? 100*r.areaModulos/r.areaDisponivel : 100)}%"></i></span></div></div></div>`;
  h += `<p class="nota-custo">${r.modulos} módulos de ${r.potenciaModuloW} Wp · consumo ${r.consumoInformado ? 'informado' : 'estimado'} de <span class="calc" data-tip="${esc(r.cargas.map(c => `${c.nome}: ${f2(c.kwhMes)}`).join(' · '))}">${kwh(r.consumo)}/mês</span> · críticas: <span class="calc" data-tip="${esc(r.nivelTexto)}">${kwh(r.criticoMes)}/mês</span> · tarifa com tributos <span class="calc" data-tip="Tarifa B1 da Enel CE sem tributos × fator de tributos estimado (confira na fatura)">R$ ${f2(r.tarifaComTributos)}/kWh</span> · Fio B a ${Math.round(100*r.fioBPct)} % em ${r.ano}</p>`;
  h += `<div class="tabs vistas" role="group" aria-label="Visualização do gráfico solar">${VISTAS_SOLAR.map(([id, nome, dica]) => `<button class="btn" type="button" data-vista-solar="${id}" aria-pressed="${id === vista}" data-tip="${esc(dica)}">${nome}</button>`).join('')}</div>`;
  h += `<div class="graf-caixa">`;
  if(vista === 'retorno') h += Graficos.linhaUnica(r.acumulado.map(p => ({x:p.ano, y:p.valor})), {titulo:'Retorno do investimento', fmt:brlCurto, xRot:x => x + ' a',
    dica:p => `Ano ${p.x}: ${brl(p.y)} acumulados (economia − investimento)`, marco:r.paybackSimples, marcoRotulo:r.paybackSimples === null ? '' : `retorno em ${f1(r.paybackSimples)} anos`});
  else if(vista === 'cargas') h += Graficos.barrasFaixa(r.cargas.slice().sort((a, b) => b.kwhMes - a.kwhMes).map(c => ({nome:c.nome + (c.critica ? ' ●' : ''), min:c.kwhMes, med:c.kwhMes, max:c.kwhMes,
    dica:`${c.nome}: ${f2(c.kwhMes)} kWh/mês · ${f2(c.potenciaW/1000)} kW${c.critica ? ' · crítica (fica ligada na falta da rede)' : ''}`})), v => Math.round(v) + ' kWh', {titulo:'Cargas da casa', rotulo:190});
  else h += Graficos.colunas(r.meses.map(m => m.geracao), {titulo:'Geração mensal', fmt:v => Math.round(v), rotulos:MES_CURTO, ref:r.consumo, refRotulo:`consumo ${kwh(r.consumo)}`,
    dica:i => { const m = r.meses[i]; return `${MESES[i]}: gera ${kwh(m.geracao)} · consome ${kwh(m.consumo)} · usa na hora ou da bateria ${kwh(m.autoconsumo)} · compensa ${kwh(m.compensado)} · economia ${brl(m.economia)}`; }});
  h += `</div>`;
  if(vista === 'cargas') h += `<p class="note">● carga crítica: fica ligada pela bateria quando a rede cai (nível ${esc(r.nivel)}).</p>`;
  h += `<details class="tabela-custo"><summary>Ver a tabela mês a mês</summary><div class="tbl-wrap"><table><thead><tr><th>Mês</th><th class="n">Geração</th><th class="n">Consumo</th><th class="n">Na hora/bateria</th><th class="n">Compensado</th><th class="n">Economia</th></tr></thead><tbody>`;
  r.meses.forEach((m, i) => { h += `<tr><td>${MESES[i]}</td><td class="n">${kwh(m.geracao)}</td><td class="n">${kwh(m.consumo)}</td><td class="n">${kwh(m.autoconsumo)}</td><td class="n">${kwh(m.compensado)}</td><td class="n">${brl(m.economia)}</td></tr>`; });
  h += `<tr class="total"><td>Ano</td><td class="n">${kwh(r.meses.reduce((t, m) => t + m.geracao, 0))}</td><td class="n">${kwh(r.meses.reduce((t, m) => t + m.consumo, 0))}</td><td></td><td></td><td class="n">${brl(r.economiaAno)}</td></tr></tbody></table></div>`;
  h += `<p class="note">Investimento de ${brl(r.custo.min)} a ${brl(r.custo.max)}. Irradiação: NASA POWER (2001–2020). Preços: Greener (1º sem. 2026) e estimativas de bateria e inversor a confirmar.</p></details>`;
  if(r.avisos.length) h += `<div class="warn"><ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
  h += `<p class="note">Normas: ${esc(r.normas.join('; '))}. Projeto e instalação exigem responsável técnico com ART e parecer de acesso da Enel Ceará.</p></div>`;
  return h;
}

return {selo, cartaoCusto, cartaoEstrutura, cartaoSolar, VISTAS, VISTAS_SOLAR, mesTxt};
});
