/* Auditoria geométrica e matemática das variantes (etapa D, 06/10/2026).
   Confere cada variante gerada contra regras que se verificam pela geometria, sem confiar nos avisos do próprio motor:
   sobreposição, lote e área edificável, portas, janelas, corredores, circulação, escadas, garagem, mobiliário e somatórios.
   Uso: node gerador/auditoria.js            → resumo por regra
        node gerador/auditoria.js --detalhe  → cada violação
   Também é usado por gerador/testes-unidades.js (as regras firmes não podem ter violação). */
'use strict';
const M = require('./motor.js');
const {compartilhado, trechosExternos} = M._interno;
const E = 0.011;
const area = s => (s.x1 - s.x0) * (s.y1 - s.y0);
const f2 = M.f2;
const ABERTO = s => !!(M.TIPOS[s.tipo] && M.TIPOS[s.tipo].aberto);
const Mob = require('./mobilia.js');

/* Regras: id, nome e limite. Limite 0 = regra firme (nenhuma violação). Limite > 0 = defeito conhecido em 06/10/2026:
   o teste é uma catraca (a contagem não pode subir); ao corrigir, baixe o limite até 0. */
const REGRAS = {
  G01: {nome:'Ambientes sobrepostos', limite:0},
  G02: {nome:'Área nula ou negativa', limite:0},
  G03: {nome:'Ambiente fora do lote', limite:0},
  G04: {nome:'Ambiente fora da área edificável (recuos)', limite:0},
  G05: {nome:'Porta fora de uma parede real', limite:0},
  G06: {nome:'Porta sem espaço para abrir', limite:0},
  G07: {nome:'Portas ou porta e janela sobrepostas', limite:0},
  G08: {nome:'Janela em parede inexistente (interna ou atravessando cômodos)', limite:0},
  G09: {nome:'Corredor estreito (< 0,90 m)', limite:0},
  G10: {nome:'Corredor abaixo de 1,20 m', limite:82},
  G11: {nome:'Circulação interrompida (cômodo sem ligação)', limite:0},
  G12: {nome:'Escada que não cabe no espaço', limite:0},
  G13: {nome:'Escada fora da faixa de Blondel (0,63–0,65 m)', limite:0},
  G14: {nome:'Garagem sem largura ou profundidade para os carros', limite:0},
  G15: {nome:'Vaga do subsolo sem acesso à manobra', limite:0},
  G16: {nome:'Mobiliário sobreposto ou fora do cômodo', limite:1},
  G17: {nome:'Rooftop aberto para o poente sem fechamento', limite:0},
  G18: {nome:'Janela a menos de 1,50 m da divisa (Código Civil, art. 1.301)', limite:0},
  G19: {nome:'Quarto encostado em fachada a oeste (íntimo nunca no poente)', limite:11},
  M01: {nome:'Quadro de áreas: parcela diferente de largura × comprimento', limite:0},
  M02: {nome:'Quadro de áreas: somatórios', limite:0},
  M03: {nome:'Projeção diferente da recalculada (térreo ∪ pavimentos de cima)', limite:0},
  M04: {nome:'Ocupação diferente da recalculada', limite:0},
  M05: {nome:'Permeabilidade diferente da recalculada (com pisos de acesso)', limite:0},
  M06: {nome:'Iluminação: área de janela declarada diferente da desenhada', limite:0},
  M07: {nome:'Largura ou profundidade da casa diferente do desenho', limite:0},
  M08: {nome:'Móvel da planta humanizada fora do cômodo (descontada a espessura da parede)', limite:0},
  M09: {nome:'Móvel na abertura de porta (arco da folha ou 0,60 m em frente ao vão)', limite:0},
};

/* União de retângulos (área exata, por varredura das coordenadas). */
function uniao(rs){
  rs = rs.filter(r => r.x1 - r.x0 > 1e-6 && r.y1 - r.y0 > 1e-6);
  const xs = [...new Set(rs.flatMap(r => [r.x0, r.x1]))].sort((a, b) => a - b);
  let A = 0;
  for(let i = 0; i < xs.length - 1; i++){
    const xm = (xs[i] + xs[i+1]) / 2;
    const iv = rs.filter(r => r.x0 < xm && r.x1 > xm).map(r => [r.y0, r.y1]).sort((a, b) => a[0] - b[0]);
    let tot = 0, a = null, b = null;
    for(const [p, q] of iv){ if(a === null || p > b){ if(a !== null) tot += b - a; a = p; b = q; } else b = Math.max(b, q); }
    if(a !== null) tot += b - a;
    A += tot * (xs[i+1] - xs[i]);
  }
  return A;
}
const sobrepoe = (a, b) => a.x0 < b.x1 - E && b.x0 < a.x1 - E && a.y0 < b.y1 - E && b.y0 < a.y1 - E;
const contem = (seg, t0, t1) => t0 >= seg.t0 - E && t1 <= seg.t1 + E;
/* Lado da sala sobre o qual está o segmento {o, c, t0, t1}, ou null. */
function ladoDe(seg, s){
  if(seg.o === 'h'){ if(seg.t0 < s.x0 - E || seg.t1 > s.x1 + E) return null; return Math.abs(seg.c - s.y0) < E ? 'y0' : Math.abs(seg.c - s.y1) < E ? 'y1' : null; }
  if(seg.t0 < s.y0 - E || seg.t1 > s.y1 + E) return null; return Math.abs(seg.c - s.x0) < E ? 'x0' : Math.abs(seg.c - s.x1) < E ? 'x1' : null;
}
const mesmaLinha = (a, b) => a.o === b.o && Math.abs(a.c - b.c) < E && a.t0 < b.t1 - E && b.t0 < a.t1 - E;

/* Confere uma variante. Devolve [{regra, pav, msg}]. */
function auditar(v, q){
  const out = [], add = (regra, pav, msg) => out.push({regra, pav, msg});
  const L = v.lote || {frente:q.frente, fundo:q.fundo, recFrente:q.recFrente, recX0:q.recX0, recX1:q.recX1, recFundo:q.recFundo};
  // lote e área edificável no sistema da casa (origem no canto frontal esquerdo da casa)
  const lote = {x0:-v.x0, y0:-v.y0, x1:L.frente - v.x0, y1:L.fundo - v.y0};
  const rx0 = L.recX0 !== undefined ? L.recX0 : L.recLat, rx1 = L.recX1 !== undefined ? L.recX1 : L.recLat;
  const edif = {x0:rx0 - v.x0, y0:L.recFrente - v.y0, x1:L.frente - rx1 - v.x0, y1:L.fundo - L.recFundo - v.y0};
  const dentroDe = (s, r) => s.x0 >= r.x0 - E && s.x1 <= r.x1 + E && s.y0 >= r.y0 - E && s.y1 <= r.y1 + E;
  for(const p of v.pav){
    const S = p.salas, nome = p.nome;
    // G01, G02
    for(let i = 0; i < S.length; i++){
      const s = S[i];
      if(!(s.x1 - s.x0 > E && s.y1 - s.y0 > E)) add('G02', nome, `${s.nome}: ${f2(s.x1 - s.x0)} × ${f2(s.y1 - s.y0)} m`);
      for(let j = i + 1; j < S.length; j++) if(sobrepoe(s, S[j])) add('G01', nome, `${s.nome} sobrepõe ${S[j].nome}`);
    }
    // G03, G04 (a edícula tem coordenadas próprias: confere-se pelo anexo)
    if(!p.anexo){
      const sub = nome === 'Subsolo', recuosLivres = sub && q.subRecuos && q.subRecuos !== 'nenhum';
      for(const s of S){
        if(!dentroDe(s, lote)) add('G03', nome, `${s.nome} sai do lote`);
        else if(!dentroDe(s, edif)){
          if(sub && (recuosLivres || s.tipo === 'jardim' || s.tipo === 'rampa')) continue;   // subsolo nos recuos (opção), jardim e rampa
          add('G04', nome, `${s.nome} entra no recuo`);
        }
      }
    }
    // G05–G07: portas
    const portas = p.portas || [], janelas = p.janelas || [], porId = new Map(S.map(s => [s.id, s]));
    for(const d of portas){
      const s = porId.get(d.sala), o = d.viz !== undefined ? porId.get(d.viz) : null, w = d.t1 - d.t0;
      if(!s){ add('G05', nome, 'porta sem cômodo'); continue; }
      if(o){ const sh = compartilhado(s, o);
        if(!sh || sh.o !== d.o || Math.abs(sh.c - d.c) > E || !contem(sh, d.t0, d.t1)) add('G05', nome, `porta ${s.nome} → ${o.nome} fora da parede comum`); }
      else {
        const l = ladoDe(d, s); if(!l){ add('G05', nome, `porta externa de ${s.nome} fora das paredes dele`); continue; }
        const ext = trechosExternos(s, S.filter(x => !ABERTO(x))).filter(e => e.o === d.o && Math.abs(e.c - d.c) < E);
        const viaAberto = S.some(x => ABERTO(x) && x !== s && compartilhado(s, x) && contem(compartilhado(s, x), d.t0, d.t1));
        if(!ext.some(e => contem(e, d.t0, d.t1)) && !viaAberto) add('G05', nome, `porta externa de ${s.nome} dá para outro cômodo fechado`);
      }
      if(w < 0.6 - E) add('G06', nome, `porta de ${s.nome} com ${f2(w)} m`);
      // a folha gira para dentro da sala indicada: a sala precisa de profundidade igual à folha
      const alvo = d.dentro === undefined ? s : (o && ((d.o === 'h' ? (o.y0 >= d.c - E ? 1 : -1) : (o.x0 >= d.c - E ? 1 : -1)) === d.dentro) ? o : s);
      const prof = d.o === 'h' ? alvo.y1 - alvo.y0 : alvo.x1 - alvo.x0;
      if(prof < w - E) add('G06', nome, `folha de ${f2(w)} m da porta de ${s.nome} não cabe em ${alvo.nome} (${f2(prof)} m)`);
    }
    const onde = x => `${x.o === 'h' ? 'y' : 'x'} = ${f2(x.c)} (${f2(x.t0)}–${f2(x.t1)})`, dono = d => (porId.get(d.sala) || {}).nome;
    for(let i = 0; i < portas.length; i++) for(let j = i + 1; j < portas.length; j++) if(mesmaLinha(portas[i], portas[j])) add('G07', nome, `portas de ${dono(portas[i])} e de ${dono(portas[j])} sobrepostas em ${onde(portas[i])}`);
    for(const d of portas) for(const j of janelas) if(mesmaLinha(d, j)) add('G07', nome, `porta de ${dono(d)}${d.saida ? ' (saída de fundos)' : d.entrada ? ' (entrada)' : ''} em ${onde(d)} sob a janela ${onde(j)}`);
    // G08: janelas. Amostra a cada 10 cm, 5 cm de cada lado da parede: um lado dentro de um único cômodo fechado
    // e o outro fora (rua, quintal ou cômodo aberto). No subsolo não há paredes internas: vale o contorno do conjunto.
    const sub = nome === 'Subsolo', dentroDe1 = (x, y) => S.filter(s => (sub ? s.tipo !== 'jardim' : !ABERTO(s)) && x > s.x0 + 1e-6 && x < s.x1 - 1e-6 && y > s.y0 + 1e-6 && y < s.y1 - 1e-6);
    for(const j of janelas){
      const n = Math.max(2, Math.round((j.t1 - j.t0) / 0.1)), lados = [[], []];
      for(let i = 0; i <= n; i++){
        const t = j.t0 + 0.02 + (j.t1 - j.t0 - 0.04) * i / n;
        [-0.05, 0.05].forEach((d, k) => lados[k].push(j.o === 'h' ? dentroDe1(t, j.c + d) : dentroDe1(j.c + d, t)));
      }
      const cheio = lados.map(l => l.every(a => a.length)), vazio = lados.map(l => l.every(a => !a.length));
      const ids = k => new Set(lados[k].flatMap(a => a.map(s => s.id)));
      if(cheio[0] && cheio[1]) add('G08', nome, `janela ${onde(j)} numa parede interna (${[...new Set(lados.flat(2).map(s => s.nome))].join(' / ')})`);
      else if(!((cheio[0] && vazio[1]) || (cheio[1] && vazio[0]))) add('G08', nome, `janela ${onde(j)} passa do fim da parede`);
      else if(!sub){ const k = cheio[0] ? 0 : 1; if(ids(k).size > 1) add('G08', nome, `janela ${onde(j)} atravessa a parede entre ${[...ids(k)].map(i => porId.get(i).nome).join(' e ')}`); }
    }
    // G09, G10: corredores
    for(const s of S.filter(x => x.tipo === 'circ')){
      const l = Math.min(s.x1 - s.x0, s.y1 - s.y0);
      if(l < 0.9 - E) add('G09', nome, `${s.nome} com ${f2(l)} m`);
      else if(l < 1.2 - E) add('G10', nome, `${s.nome} com ${f2(l)} m`);
    }
    // G12, G13: escadas
    for(const s of S.filter(x => x.tipo === 'escada' && x.esc)){
      const comp = Math.max(s.x1 - s.x0, s.y1 - s.y0), larg = Math.min(s.x1 - s.x0, s.y1 - s.y0);
      if(comp < s.esc.L - E) add('G12', nome, `escada pede ${f2(s.esc.L)} m e tem ${f2(comp)} m`);
      if(larg < 0.8 - E) add('G12', nome, `escada com ${f2(larg)} m de largura`);
      if(s.esc.blondel < 0.63 - 0.001 || s.esc.blondel > 0.65 + 0.001) add('G13', nome, `2e + p = ${f2(s.esc.blondel)} m (espelho ${s.esc.espelho} m, piso ${s.esc.piso} m)`);
    }
    // G14, G16: garagem do térreo e carros desenhados (1,80 × 4,40 m, como em desenho.js)
    for(const s of S.filter(x => x.tipo === 'garagem' && !x.vaga && nome !== 'Subsolo')){
      const w = s.x1 - s.x0, h = s.y1 - s.y0, n = s.vagas || Math.max(1, Math.floor(w / 2.5));
      const ext = trechosExternos(s, S), frente = ext.some(e => e.lado === 'y0' && e.t1 - e.t0 >= 2.4), lado = ext.some(e => (e.lado === 'x0' || e.lado === 'x1') && e.t1 - e.t0 >= 4.5);
      const vert = frente || (!lado && h >= w), largura = vert ? w : h, prof = vert ? h : w;
      if(largura / n < 2.5 - E || prof < 5.0 - E) add('G14', nome, `${n} carro(s) em ${f2(w)} × ${f2(h)} m (${f2(largura / n)} m por carro, ${f2(prof)} m de fundo)`);
      if(largura / n < 1.8 || prof < 4.4) add('G16', nome, `carros desenhados não cabem na garagem (${f2(largura / n)} × ${f2(prof)} m por carro)`);
    }
    for(const s of S.filter(x => ['suite','master','quarto'].includes(x.tipo))){
      const w = s.x1 - s.x0, h = s.y1 - s.y0;
      if(w < 2.6 - 0.005 || h < 2.6 - 0.005) add('G16', nome, `${s.nome} de ${f2(w)} × ${f2(h)} m sem cama desenhada`);
    }
    // G15: vagas do subsolo encostadas numa manobra (ou numa vaga, em fila)
    if(nome === 'Subsolo'){
      const man = S.filter(x => x.tipo === 'manobra' || x.tipo === 'rampa');
      for(const s of S.filter(x => x.vaga)) if(!man.some(m => compartilhado(s, m) && compartilhado(s, m).t1 - compartilhado(s, m).t0 >= 2.4)) add('G15', nome, `${s.nome} sem lado de 2,40 m na manobra`);
    }
    // G11: circulação (grafo próprio, sem os avisos do motor)
    if(!p.anexo){
      const adj = new Map(S.map(s => [s.id, new Set()])), liga = (a, b) => { if(adj.has(a) && adj.has(b)){ adj.get(a).add(b); adj.get(b).add(a); } };
      const FORA = -1; adj.set(FORA, new Set());
      for(const d of portas){ if(d.viz !== undefined) liga(d.sala, d.viz); else liga(d.sala, FORA); }
      for(const vo of (p.vaos || [])) liga(vo.a, vo.b);
      for(const s of S) if(ABERTO(s) && trechosExternos(s, S).length) liga(s.id, FORA);
      for(const s of S) for(const o of S) if(s !== o && ABERTO(s) && ABERTO(o) && compartilhado(s, o)) liga(s.id, o.id);
      for(const s of S.filter(x => ['escada','elevador'].includes(x.tipo))) for(const o of S) if(['hall','circ','galeria'].includes(o.tipo) && compartilhado(s, o)) liga(s.id, o.id);
      if(nome === 'Subsolo'){ const g = S.filter(x => ['manobra','garagem','rampa','hall','escada','jardim'].includes(x.tipo)); for(const a of g) for(const b of g) if(a !== b && compartilhado(a, b)) liga(a.id, b.id); liga((S.find(x => x.tipo === 'rampa') || {}).id, FORA); }
      if(nome === 'Térreo') for(const s of S.filter(x => x.tipo === 'garagem')) liga(s.id, FORA);
      const ini = nome === 'Térreo' ? FORA : (S.find(x => x.tipo === 'escada') || {}).id;
      if(ini !== undefined){
        if(nome !== 'Térreo') for(const s of S.filter(x => x.tipo === 'escada' || x.tipo === 'elevador')) liga(s.id, ini);
        const vis = new Set([ini]), fila = [ini];
        while(fila.length){ const x = fila.shift(); for(const y of adj.get(x) || []) if(!vis.has(y)){ vis.add(y); fila.push(y); } }
        for(const s of S) if(!vis.has(s.id) && !['rouparia','deposito','jardim'].includes(s.tipo) && !(s.tipo === 'terraco' && nome !== 'Térreo')) add('G11', nome, `${s.nome} sem ligação com ${nome === 'Térreo' ? 'a rua' : 'a escada'}`);
      }
    }
    // G17: rooftop — toda borda aberta voltada para oeste tem fechamento, na planta normal e na espelhada
    if(nome === 'Rooftop' && M.RUMOS[q.orientacao] !== undefined){
      const F = M.RUMOS[q.orientacao], oeste = az => { const d = Math.abs(((az - 270) % 360 + 540) % 360 - 180); return d <= 22.5; };
      for(const [k, esp] of [['normal', false], ['espelhada', true]]){
        const fc = (p.fechamentos || {})[k] || [];
        for(const s of S.filter(ABERTO)) for(const e of trechosExternos(s, S)) if(oeste(M.rumoFace(e.lado, F, esp)) && !fc.some(f => f.o === e.o && Math.abs(f.c - e.c) < E && f.t0 <= e.t0 + E && f.t1 >= e.t1 - E))
          add('G17', nome, `${s.nome} aberto para o poente em ${e.o === 'h' ? 'y' : 'x'} = ${f2(e.c)} (planta ${k})`);
      }
    }
    // M06: iluminação declarada × janelas desenhadas
    for(const s of S.filter(x => x.ilum && nome !== 'Subsolo')){
      const obt = janelas.filter(j => ladoDe(j, s)).reduce((t, j) => t + (j.t1 - j.t0) * (j.h || 1.2), 0);
      if(Math.abs(obt - s.ilum.obt) > 0.02) add('M06', nome, `${s.nome}: declarada ${f2(s.ilum.obt)} m², desenhada ${f2(obt)} m²`);
    }
  }
  // M01, M02: quadro de áreas
  const Q = v.quadro;
  if(Q){
    let fT = 0, aT = 0;
    Q.pavimentos.forEach((l, i) => {
      const p = v.pav[i];
      l.salas.forEach((x, k) => { const s = p.salas[k]; if(Math.abs(x.a - area(s)) > 0.006) add('M01', l.pav, `${x.nome}: ${f2(x.a)} × ${f2(area(s))} m²`);
        if(Math.abs(x.a - x.w * x.h) > 0.02) add('M01', l.pav, `${x.nome}: ${f2(x.w)} × ${f2(x.h)} ≠ ${f2(x.a)} m²`); });
      const f = p.salas.filter(s => !ABERTO(s)).reduce((t, s) => t + area(s), 0), a = p.salas.filter(ABERTO).reduce((t, s) => t + area(s), 0);
      if(Math.abs(f - l.fechada) > 0.006 || Math.abs(a - l.aberta) > 0.006) add('M02', l.pav, `fechada ${f2(l.fechada)} (recalculada ${f2(f)}), aberta ${f2(l.aberta)} (${f2(a)})`);
      fT += l.fechada; aT += l.aberta;
    });
    if(Math.abs(fT - Q.fechada) > 0.011 || Math.abs(aT - Q.aberta) > 0.011 || Math.abs(Q.fechada + Q.aberta - Q.total) > 0.011) add('M02', 'Total', `fechada ${f2(Q.fechada)}, aberta ${f2(Q.aberta)}, total ${f2(Q.total)}`);
  }
  // G18: janelas a menos de 1,50 m da divisa lateral ou de fundo, na planta normal e na espelhada (a casa vira no lugar).
  // A janela olha para o lado oposto ao do cômodo; a distância é medida no lote até a divisa para a qual ela olha.
  if(L.recX0 !== undefined) for(const w of [M.semEspelho(v), M.espelharCasa(v)]) for(const p of w.pav){
    if(p.anexo) continue;
    const fechadosP = p.salas.filter(s => p.nome === 'Subsolo' ? s.tipo !== 'jardim' : !ABERTO(s));
    const ocupa = (x, y) => fechadosP.some(s => x > s.x0 + 1e-6 && x < s.x1 - 1e-6 && y > s.y0 + 1e-6 && y < s.y1 - 1e-6);
    for(const j of (p.janelas || [])){
      const m = (j.t0 + j.t1)/2;
      let d = Infinity;
      if(j.o === 'v'){ const xl = v.x0 + j.c; d = ocupa(j.c - 0.05, m) && !ocupa(j.c + 0.05, m) ? L.frente - xl : ocupa(j.c + 0.05, m) && !ocupa(j.c - 0.05, m) ? xl : Infinity; }
      else if(ocupa(m, j.c - 0.05) && !ocupa(m, j.c + 0.05)) d = L.fundo - (v.y0 + j.c);
      if(d < 1.5 - 0.011) add('G18', p.nome, `janela ${j.o === 'h' ? 'y' : 'x'} = ${f2(j.c)} a ${f2(d)} m da divisa${w.espelhada ? ' (planta espelhada)' : ''}`);
    }
  }
  // G19: na orientação recomendada, nenhum quarto encosta numa fachada a oeste (o motor só mostra isso quando nada escapa)
  if(M.RUMOS[q.orientacao] !== undefined){ const F = M.RUMOS[q.orientacao], w = v.espelharVento ? M.espelharCasa(v) : M.semEspelho(v);
    for(const p of w.pav){ if(p.anexo || p.nome === 'Subsolo' || p.nome === 'Rooftop') continue; const fe = p.salas.filter(s => !ABERTO(s));
      for(const s of p.salas.filter(x => ['quarto','suite','master'].includes(x.tipo))) if(trechosExternos(s, fe).some(e => { const d = Math.abs(((M.rumoFace(e.lado, F, false) - 270) % 360 + 540) % 360 - 180); return d <= 22.5; })) add('G19', p.nome, s.nome + ' encostado na fachada a oeste'); } }
  // M03, M04: projeção e ocupação recalculadas (térreo ∪ superior ∪ rooftop coberto, sem o subsolo e sem a edícula)
  const ter = v.pav.find(p => p.nome === 'Térreo'), loteA = L.frente * L.fundo;
  const anexosCasa = (v.anexos || []).map(a => ({tipo:a.tipo, x0:a.x0 - v.x0, y0:a.y0 - v.y0, x1:a.x1 - v.x0, y1:a.y1 - v.y0}));
  if(ter){
    const cob = s => s.tipo !== 'terraco' && s.tipo !== 'jardim';
    const altos = v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo' && p.nome !== 'Térreo');
    const projReal = uniao(ter.salas.filter(cob).concat(...altos.map(p => p.salas.filter(s => p.nome === 'Superior' || cob(s)))));
    // a projeção do motor inclui os anexos cobertos (edícula, gourmet destacada), sem a piscina
    const anexos = anexosCasa.filter(a => a.tipo !== 'piscina').reduce((t, a) => t + (a.x1 - a.x0) * (a.y1 - a.y0), 0);
    if(Math.abs(projReal + anexos - v.projecao) > 0.05) add('M03', 'Projeção', `motor ${f2(v.projecao)} m², recalculada ${f2(projReal + anexos)} m² (térreo ${f2(uniao(ter.salas.filter(cob)))} m², anexos ${f2(anexos)} m²)`);
    const ocup = 100 * (projReal + anexos) / loteA;
    if(Math.abs(ocup - v.ocupacao) > 0.05) add('M04', 'Ocupação', `motor ${f2(v.ocupacao)} %, recalculada ${f2(ocup)} %`);
  }
  // M05: permeabilidade recalculada (lote menos a união de térreo, anexos, laje do subsolo, rampa no recuo e pisos de acesso)
  if(ter && v.permeavel !== undefined && v.acessos){
    const A = v.acessos, imp = ter.salas.filter(s => s.tipo !== 'terraco' && s.tipo !== 'jardim').concat(anexosCasa, A.vias, A.vagasFora);
    const sub = v.pav.find(p => p.nome === 'Subsolo');
    if(sub){ imp.push({x0:sub.dim.x0, y0:sub.dim.y0, x1:sub.dim.x0 + sub.dim.W, y1:sub.dim.y0 + sub.dim.D}); if(sub.rampaFora && q.subGaragem) imp.push(sub.rampaFora); }
    if(A.caminho) for(let i = 0; i < A.caminho.pontos.length - 1; i++){ const [a, b] = [A.caminho.pontos[i], A.caminho.pontos[i+1]], m = A.caminho.largura / 2;
      imp.push({x0:Math.min(a[0], b[0]) - (a[0] === b[0] ? m : 0), x1:Math.max(a[0], b[0]) + (a[0] === b[0] ? m : 0), y0:Math.min(a[1], b[1]) - (a[0] === b[0] ? 0 : m), y1:Math.max(a[1], b[1]) + (a[0] === b[0] ? 0 : m)}); }
    const pct = 100 * Math.max(0, loteA - uniao(imp)) / loteA;
    if(Math.abs(pct - v.permeavel) > 0.02) add('M05', 'Permeabilidade', `motor ${f2(v.permeavel)} %, recalculada com os pisos de acesso ${f2(pct)} %`);
  }
  // M07: W e D declarados × desenho (pavimentos da casa, sem subsolo e sem edícula)
  const casa = v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo');
  const W = Math.max(...casa.flatMap(p => p.salas.map(s => s.x1))) - Math.min(...casa.flatMap(p => p.salas.map(s => s.x0)));
  const D = Math.max(...casa.flatMap(p => p.salas.map(s => s.y1))) - Math.min(...casa.flatMap(p => p.salas.map(s => s.y0)));
  if(Math.abs(W - v.W) > 0.02 || Math.abs(D - v.D) > 0.02) add('M07', 'Casa', `declarada ${f2(v.W)} × ${f2(v.D)} m, desenhada ${f2(W)} × ${f2(D)} m`);
  // M08, M09: mobília da planta humanizada (gerador/mobilia.js), conferida com a geometria das paredes e portas
  for(const p of v.pav){
    const fech = p.salas.filter(s => !ABERTO(s));
    for(const q of Mob.pavimento(p)){
      const s = p.salas.find(x => x.id === q.sala); if(!s) continue;
      // meia parede: 0,075 m no lado com trecho externo, 0,05 m nos internos; cômodo aberto não tem parede
      const ext = ABERTO(s) ? [] : trechosExternos(s, fech);
      const meia = l => ABERTO(s) ? 0 : ext.some(e => ladoDe(e, s) === l || (e.o === (l[0] === 'y' ? 'h' : 'v') && Math.abs(e.c - s[l]) < E)) ? 0.075 : 0.05;
      const R = {x0:s.x0 + meia('x0'), x1:s.x1 - meia('x1'), y0:s.y0 + meia('y0'), y1:s.y1 - meia('y1')};
      if(!dentroDe(q, R)) add('M08', p.nome, `${q.tipo} em ${s.nome}: ${f2(q.x0)}–${f2(q.x1)} × ${f2(q.y0)}–${f2(q.y1)} fora de ${f2(R.x0)}–${f2(R.x1)} × ${f2(R.y0)}–${f2(R.y1)}`);
      for(const d of (p.portas || []).concat((p.vaos || []).filter(x => !x.livre))){
        const l = d.o === 'h' ? (Math.abs(d.c - s.y0) < E ? 'y0' : Math.abs(d.c - s.y1) < E ? 'y1' : null) : (Math.abs(d.c - s.x0) < E ? 'x0' : Math.abs(d.c - s.x1) < E ? 'x1' : null);
        if(!l) continue;
        const t0 = Math.max(d.t0, d.o === 'h' ? s.x0 : s.y0), t1 = Math.min(d.t1, d.o === 'h' ? s.x1 : s.y1); if(t1 - t0 < E) continue;
        const w = d.t1 - d.t0, sg = d.dentro || 1, folha = d.sala !== undefined && ((l === 'x0' || l === 'y0') ? sg > 0 : sg < 0);
        const p0 = Math.max(0.6, folha ? w : 0);
        const Z = l === 'y0' ? {x0:t0, x1:t1, y0:s.y0, y1:s.y0 + p0} : l === 'y1' ? {x0:t0, x1:t1, y0:s.y1 - p0, y1:s.y1} : l === 'x0' ? {y0:t0, y1:t1, x0:s.x0, x1:s.x0 + p0} : {y0:t0, y1:t1, x0:s.x1 - p0, x1:s.x1};
        if(sobrepoe(q, Z)) add('M09', p.nome, `${q.tipo} em ${s.nome} na abertura da porta (${f2(t0)}–${f2(t1)} no lado ${l})`);
      }
    }
  }
  return out;
}

/* Casos: os 21 casos de regras + uma grade de lotes, programas, rumos e opções. */
function casos(){
  const T = require('./testes.js').CASOS, c = Object.assign({}, T);
  const rumos = ['N','NE','L','SE','S','SO','O','NO'];
  let k = 0;
  for(const [fr, fu] of [[8,25],[10,25],[12,30],[15,30],[20,40],[30,50]])
    for(const tipo of ['terrea','sobrado'])
      for(const [qu, su] of [[2,1],[3,2],[4,3]]){
        const o = rumos[k++ % 8];
        c[`Grade ${fr} × ${fu}, ${tipo}, ${qu}q/${su}s, frente ${o}`] = {frente:fr, fundo:fu, tipo, quartos:qu, suites:su, vagas:2, orientacao:o};
      }
  Object.assign(c, {
    'Acessível, térrea 12 × 30': {frente:12, fundo:30, quartos:3, suites:2, acessivel:true, orientacao:'N'},
    'Acessível, sobrado com elevador 12 × 30': {frente:12, fundo:30, tipo:'sobrado', quartos:3, suites:2, acessivel:true, elevador:true, orientacao:'SE'},
    'Cozinha fechada e lavabo, 12 × 30': {frente:12, fundo:30, quartos:3, suites:1, cozinha:'fechada', lavabo:true, orientacao:'L'},
    'Varanda de fundos parcial, 12 × 34': {frente:12, fundo:34, quartos:3, suites:2, varandaFundos:true, varandaFundosL:4, varandaFundosP:2.5, orientacao:'N'},
    'Em U com varanda de fundos, 22 × 32': {frente:22, fundo:32, quartos:3, suites:2, formato:'U', varandaFundos:true, orientacao:'SE'},
    'Garagem descoberta, 3 vagas, 12 × 30': {frente:12, fundo:30, quartos:3, suites:2, garagem:'descoberta', vagas:3, orientacao:'NE'},
    'Subsolo em lote largo, 30 × 50': {frente:30, fundo:50, quartos:4, suites:4, subsolo:true, orientacao:'S'},
    'Inversões estar/jantar e cozinha/serviço, 12 × 30': {frente:12, fundo:30, quartos:3, suites:1, invEstarJantar:true, invCozinhaServico:true, orientacao:'L'},
    'Cozinha fechada invertida com o serviço, 14 × 30': {frente:14, fundo:30, quartos:3, suites:2, cozinha:'fechada', invCozinhaServico:true, orientacao:'SE'},
    'Sobrado com pé-direito de 2,70 m, 12 × 30': {frente:12, fundo:30, tipo:'sobrado', quartos:3, suites:2, peDireito:2.7, orientacao:'NO'},
    'Sobrado com pé-direito de 4,50 m, 12 × 30': {frente:12, fundo:30, tipo:'sobrado', quartos:3, suites:2, peDireito:4.5, orientacao:'N'},
  });
  return c;
}

function rodar(lista){
  const C = lista || casos(), cont = {}, ex = {}, porCaso = [];
  for(const k of Object.keys(REGRAS)){ cont[k] = 0; ex[k] = []; }
  for(const [nome, c] of Object.entries(C)){
    const r = M.gerar(c);
    let n = 0;
    for(const v of r.variantes) for(const x of auditar(v, r.entrada)){
      cont[x.regra]++; n++;
      if(ex[x.regra].length < 400) ex[x.regra].push(`${nome} · ${v.nome} (${v.tipologia}) · ${x.pav}: ${x.msg}`);
    }
    porCaso.push({nome, variantes:r.variantes.length, violacoes:n});
  }
  return {cont, ex, porCaso, casos:Object.keys(C).length};
}

module.exports = {REGRAS, auditar, casos, rodar, uniao};

if(require.main === module){
  const t = Date.now(), r = rodar(), det = process.argv.includes('--detalhe');
  console.log(`auditoria: ${r.casos} casos, ${r.porCaso.reduce((t, c) => t + c.variantes, 0)} variantes, ${Date.now() - t} ms`);
  for(const [k, R] of Object.entries(REGRAS)){
    console.log(`${k} ${String(r.cont[k]).padStart(5)} / ${String(R.limite).padEnd(4)} ${r.cont[k] > R.limite ? 'PIOROU' : r.cont[k] < R.limite ? 'melhorou: baixe o limite' : '      '}  ${R.nome}`);
    if(det) r.ex[k].forEach(e => console.log('        ' + e));
    else r.ex[k].slice(0, 2).forEach(e => console.log('        ' + e));
  }
  process.exitCode = Object.entries(REGRAS).some(([k, R]) => r.cont[k] > R.limite) ? 1 : 0;
}
