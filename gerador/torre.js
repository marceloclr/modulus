/* Torre de ar: vazão estimada por efeito chaminé, por vento e pelo exaustor, para o card de conforto passivo.
   Funções puras (Node e navegador). Fórmulas do dossiê (torre/index.html):
     chaminé  Q = Cd · A · √(2 · g · H · ΔT / T)
     vento    Q = Cd · A · v · √ΔCp
   Cd = 0,6; A = área efetiva de saída; H = altura entre a entrada de ar (1 m do piso) e a saída da torre;
   T = 301 K (28 °C, média de Fortaleza); v = 4 m/s (vento médio de L/SE em Fortaleza, a 10 m). */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./motor.js'));
  else root.Torre = factory(root.Motor);
})(this, function(Motor){
'use strict';
const CD = 0.6, G = 9.81, T = 301, V = 4.0, ALTURA_TORRE = 1.5, A_SAIDA = 1.0;
const f2 = n => (Math.round(n*100)/100).toFixed(2).replace('.', ',');
const m3h = n => Math.round(n).toLocaleString('pt-BR') + ' m³/h';

function calcular(v, q){
  const t = v.torre; if(!t) return null;
  const TP = Motor.TORRES[t.tipo];
  const pd = q.peDireito || 3, pav = t.pavimentos || 1;
  const H = pav * pd + ALTURA_TORRE - 1.0;
  const qCham = TP.dT ? CD * A_SAIDA * Math.sqrt(2 * G * H * TP.dT / T) * 3600 : 0;
  const qVento = TP.dCp ? CD * A_SAIDA * V * Math.sqrt(TP.dCp) * 3600 : 0;
  const qVentoFraco = qVento / 2;                                   // vento a 2 m/s (fim de tarde, noite)
  const casa = v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo' && p.nome !== 'Rooftop');
  const area = casa.reduce((s, p) => s + p.salas.filter(x => !Motor.TIPOS[x.tipo].aberto).reduce((u, x) => u + Motor.area(x), 0), 0);
  const volume = casa.reduce((s, p) => s + p.salas.filter(x => !Motor.TIPOS[x.tipo].aberto).reduce((u, x) => u + Motor.area(x) * (x.pd || pd), 0), 0);   // E2.6: pé-direito de cada cômodo
  const total = Math.max(qCham, qVento) , minimo = Math.max(qCham, qVentoFraco, TP.ec || 0);
  return {tipo:t.tipo, nome:TP.nome, sobre:t.sobre, auto:t.auto, recomendada:t.recomendada, nomeRecomendada:Motor.TORRES[t.recomendada].nome,
    H, A:A_SAIDA, dT:TP.dT, dCp:TP.dCp, ec:TP.ec, qCham, qVento, qVentoFraco, area, volume,
    trocas: total / volume, trocasMin: minimo / volume,
    formulas:{
      cham: TP.dT ? `Q = Cd · A · √(2·g·H·ΔT/T) = 0,6 × ${f2(A_SAIDA)} m² × √(2 × 9,81 × ${f2(H)} × ${TP.dT} / ${T}) × 3600 = ${m3h(qCham)}` : 'Este tipo não depende do efeito chaminé.',
      vento: TP.dCp ? `Q = Cd · A · v · √ΔCp = 0,6 × ${f2(A_SAIDA)} m² × ${f2(V)} m/s × √${f2(TP.dCp)} × 3600 = ${m3h(qVento)}` : '',
      trocas: `trocas por hora = vazão ÷ volume = ${m3h(total)} ÷ ${f2(volume)} m³ (${f2(area)} m² × ${f2(pd)} m)`,
    }};
}
return {calcular, CD, V, T, A_SAIDA, m3h};
});
