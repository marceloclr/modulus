/* Sistema estrutural (funções puras): catálogo a partir de dados/custos.json, verificação de parede sobre parede na
   alvenaria estrutural (sobrado), vão das salas contra o vão econômico ou máximo do sistema e balanço pedido.
   Entra no motor pelo gancho Motor.gerar(entrada, {posAvalia:[...]}), antes da ordenação das variantes. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(require('./motor.js')); else root.Estrutura = factory(root.Motor);
})(this, function(Motor){
'use strict';
const PADRAO = {estSistema:'concretoArmado', estVaos:'padrao', estBalanco:0};
const TOL = 0.15;                       // desvio aceito entre a parede de cima e a de baixo (meia parede)
const APOIO_MIN = 0.85;                 // abaixo disso a variante é penalizada
const r2 = n => Math.round(n*100)/100, f2 = Motor.f2;

function sistemas(dados){ return Object.entries(dados.fatores.estrutural).map(([id, s]) => Object.assign({id}, s)); }

/* Paredes de um pavimento: bordas dos cômodos fechados, fundidas por linha (mesma orientação e coordenada). */
function paredes(pav){
  const T = Motor.TIPOS, porLinha = new Map();
  for(const s of pav.salas){
    if(!T[s.tipo] || T[s.tipo].aberto || s.vaga) continue;
    for(const e of [{o:'h', c:s.y0, t0:s.x0, t1:s.x1}, {o:'h', c:s.y1, t0:s.x0, t1:s.x1}, {o:'v', c:s.x0, t0:s.y0, t1:s.y1}, {o:'v', c:s.x1, t0:s.y0, t1:s.y1}]){
      const k = e.o + r2(e.c); if(!porLinha.has(k)) porLinha.set(k, []); porLinha.get(k).push([e.t0, e.t1]);
    }
  }
  const out = [];
  for(const [k, iv] of porLinha){
    iv.sort((a, b) => a[0] - b[0]);
    const m = []; for(const [a, b] of iv){ const u = m[m.length-1]; if(u && a <= u[1] + 0.001) u[1] = Math.max(u[1], b); else m.push([a, b]); }
    for(const [a, b] of m) if(b - a > 0.05) out.push({o:k[0], c:+k.slice(1), t0:r2(a), t1:r2(b)});
  }
  return out;
}

/* Quanto das paredes de cima se apoia em paredes de baixo (mesma orientação, até TOL de desvio). */
function paredeSobreParede(sup, ter){
  const cima = paredes(sup), baixo = paredes(ter);
  let total = 0, apoiado = 0; const soltos = [];
  for(const w of cima){
    const L = w.t1 - w.t0; total += L;
    const ivs = baixo.filter(b => b.o === w.o && Math.abs(b.c - w.c) <= TOL + 0.001).map(b => [Math.max(w.t0, b.t0), Math.min(w.t1, b.t1)]).filter(([a, b]) => b - a > 0.01).sort((a, b) => a[0] - b[0]);
    let cob = 0, fim = w.t0, buracos = [];
    for(const [a, b] of ivs){ if(a > fim + 0.01) buracos.push([fim, a]); if(b > fim){ cob += b - Math.max(a, fim); fim = b; } }
    if(fim < w.t1 - 0.01) buracos.push([fim, w.t1]);
    apoiado += cob;
    for(const [a, b] of buracos) if(b - a >= 0.3) soltos.push({o:w.o, c:w.c, t0:r2(a), t1:r2(b)});
  }
  return {total:r2(total), apoiado:r2(apoiado), pct: total ? r2(100*apoiado/total) : 100, soltos};
}

/* Avaliação estrutural de uma variante (gancho posAvalia): avisos, penalidade e resumo em v.estrutura. */
function avaliar(v, q, dados){
  const id = q.estSistema || PADRAO.estSistema, s = dados.fatores.estrutural[id];
  if(!s) return v;
  const res = {sistema:id, nome:s.nome, norma:s.norma, vaoEcon:s.vaoEcon, vaoMax:s.vaoMax, balanco:s.balanco, vaosMaiores: q.estVaos === 'maiores', avisos:[], pen:0};
  const limite = res.vaosMaiores ? s.vaoMax : s.vaoEcon[1];
  // vão: o menor lado de cada cômodo fechado é o vão que a laje ou a viga vence sem apoio intermediário
  let maior = null;
  for(const p of v.pav){ if(p.nome === 'Subsolo') continue;
    for(const x of p.salas){ const t = Motor.TIPOS[x.tipo]; if(!t || t.aberto || x.vaga || x.tipo === 'manobra') continue;
      const vao = Math.min(x.x1 - x.x0, x.y1 - x.y0); if(!maior || vao > maior.vao) maior = {vao:r2(vao), sala:(x.nome || t.nome), pav:p.nome}; } }
  res.vaoMaior = maior;
  if(maior && maior.vao > limite + 0.01){
    res.avisos.push(res.vaosMaiores
      ? `${maior.pav}: ${maior.sala.toLowerCase()} com vão de ${f2(maior.vao)} m, acima do vão máximo de ${f2(s.vaoMax)} m em ${s.nome.toLowerCase()}: prever pilar intermediário ou outro sistema.`
      : `${maior.pav}: ${maior.sala.toLowerCase()} com vão de ${f2(maior.vao)} m, acima do vão econômico de ${f2(s.vaoEcon[1])} m em ${s.nome.toLowerCase()}: marque "vãos maiores" (viga mais alta, custo maior) ou preveja pilar intermediário.`);
    res.pen += res.vaosMaiores ? 6 : 2;
  }
  if((+q.estBalanco || 0) > s.balanco + 0.01){ res.avisos.push(`Balanço de ${f2(+q.estBalanco)} m acima do usual para ${s.nome.toLowerCase()} (até ${f2(s.balanco)} m).`); res.pen += 4; }
  // alvenaria estrutural no sobrado: parede sobre parede
  const ter = v.pav.find(p => p.nome === 'Térreo'), sup = v.pav.find(p => p.nome === 'Superior');
  if(id === 'alvenariaEstrutural' && ter && sup){
    const pp = paredeSobreParede(sup, ter); res.paredeSobreParede = pp;
    if(pp.pct < APOIO_MIN*100 - 0.01){
      const soltoM = r2(pp.soltos.reduce((t, x) => t + x.t1 - x.t0, 0));
      res.avisos.push(`Alvenaria estrutural: só ${f2(pp.pct)} % das paredes do superior se apoiam em paredes do térreo; ${f2(soltoM)} m pedem viga de transição ou outro sistema.`);
      res.pen += Math.round((APOIO_MIN*100 - pp.pct) * 0.6);
    }
  }
  v.estrutura = res;
  v.avisos = (v.avisos || []).concat(res.avisos);
  v.score = Math.max(0, v.score - res.pen);
  return v;
}

return {PADRAO, sistemas, paredes, paredeSobreParede, avaliar};
});
