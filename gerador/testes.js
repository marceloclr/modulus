/* Testes do motor: node gerador/testes.js  (também roda em testes.html) */
(function(root){
'use strict';
const M = (typeof module==='object' && module.exports) ? require('./motor.js') : root.Motor;
const CASOS = {
  'Térrea 10 × 30, 2 quartos': {frente:10, fundo:30, quartos:2, suites:1, vagas:1},
  'Térrea 12 × 30, 3 suítes, 2 vagas': {frente:12, fundo:30, quartos:3, suites:3, vagas:2},
  'Casa em H, 22 × 30': {frente:22, fundo:30, quartos:3, suites:3, escritorio:true, vagas:2, gourmet:true, formato:'H'},
  'Sobrado 10 × 25, 4 quartos, subsolo 2 vagas': {frente:10, fundo:25, tipo:'sobrado', quartos:4, suites:2, subsolo:true, vagas:2},
  'Térrea com subsolo, 15 × 30': {frente:15, fundo:30, quartos:3, suites:2, subsolo:true, subLazer:true, vagas:3},
  'Em U, 22 × 30': {frente:22, fundo:30, quartos:3, suites:3, escritorio:true, vagas:2, gourmet:true, lavabo:true, formato:'U'},
  'Edícula 2 pav. e piscina, 16 × 42': {frente:16, fundo:42, quartos:3, suites:2, edicula:'2', piscina:true, pisPrainha:true, pisForma:'L', gourmetDest:true},
  'Subsolo enterrado, 12 × 32': {frente:12, fundo:32, quartos:3, suites:2, subsolo:true, subNivel:'inteiro', subLazer:true, vagas:2},
  'Sobrado em L, só a frente sobe, 16 × 32': {frente:16, fundo:32, tipo:'sobrado', formato:'L', quartos:4, suites:3, supModo:'parcial', secFrente:true, secFundo:false, supQuartos:3},
  'Sobrado em U, frente e ala esquerda, 22 × 30': {frente:22, fundo:30, tipo:'sobrado', formato:'U', quartos:4, suites:3, supModo:'parcial', secFrente:true, secAlaE:true, secAlaD:false},
  'Sobrado correspondente com TV e escritório em cima, 12 × 30': {frente:12, fundo:30, tipo:'sobrado', quartos:3, suites:2, tv:true, escritorio:true, supTv:true, supEscritorio:true},
  'Térrea com rooftop e spa, 14 × 30': {frente:14, fundo:30, quartos:3, suites:2, rooftop:true, rtArea:60, rtSpa:true},
  'Sobrado com rooftop, 12 × 30': {frente:12, fundo:30, tipo:'sobrado', quartos:3, suites:2, rooftop:true, rtArea:50},
  'Subsolo com elevador e sobrado, 12 × 32': {frente:12, fundo:32, tipo:'sobrado', quartos:3, suites:2, subsolo:true, elevador:true, vagas:2},
  'U com subsolo, 22 × 34': {frente:22, fundo:34, formato:'U', quartos:3, suites:3, subsolo:true, vagas:3},
  'H com subsolo, 22 × 34': {frente:22, fundo:34, formato:'H', quartos:3, suites:3, subsolo:true, vagas:3},
  'L com subsolo, 16 × 34': {frente:16, fundo:34, formato:'L', quartos:3, suites:2, subsolo:true, vagas:2},
  'Subsolo nos recuos laterais e de fundo, 10 × 25': {frente:10, fundo:25, tipo:'sobrado', quartos:4, suites:2, subsolo:true, vagas:2, subRecuos:'lateraisFundo'},
  'Subsolo em todos os recuos, 12 × 30': {frente:12, fundo:30, quartos:3, suites:2, subsolo:true, vagas:3, subRecuos:'todos', subLazer:true},
  'Frente para o sul, torre de calor e rooftop no fundo, 12 × 30': {frente:12, fundo:30, tipo:'sobrado', quartos:3, suites:2, orientacao:'S', torreCalor:true, rooftop:true, rtPos:'fundo', rtTerracoA:30, rtVarandaA:12},
  'Programa grande demais, 8 × 20': {frente:8, fundo:20, quartos:6, suites:6, tv:true, escritorio:true, vagas:3},
};
const E = 0.011;
function sobrepoe(a, b){ return a.x0 < b.x1-E && b.x0 < a.x1-E && a.y0 < b.y1-E && b.y0 < a.y1-E; }
function rodar(){
  const out = []; let falhas = 0;
  for(const [nome, c] of Object.entries(CASOS)){
    const r = M.gerar(c), erros = [];
    if(!r.variantes.length) erros.push('nenhuma variante');
    for(const v of r.variantes){
      let esc = null;
      for(const p of v.pav){
        const S = p.salas;
        const Wp = p.W || v.W, Xp0 = (p.dim && p.dim.x0) || 0, Xp1 = p.dim ? Xp0 + p.dim.W : Wp;
        for(let i=0;i<S.length;i++){
          const s = S[i];
          if(s.x1-s.x0 < 0.3 || s.y1-s.y0 < 0.3) erros.push(`${v.nome}/${p.nome}: ${s.nome} degenerado`);
          if(s.tipo!=='jardim' && (s.x0 < Xp0-E || s.x1 > Xp1+E)) erros.push(`${v.nome}/${p.nome}: ${s.nome} fora da largura`);
          for(let j=i+1;j<S.length;j++) if(sobrepoe(s, S[j])) erros.push(`${v.nome}/${p.nome}: ${s.nome} sobrepõe ${S[j].nome}`);
        }
        // cada par de andares vizinhos precisa de um lance de escada em comum (mesma posição nos dois)
        if(!p.anexo){ const es = S.filter(s => s.tipo==='escada');
          if(esc && !es.some(a => esc.some(b => Math.abs(a.x0-b.x0)<E && Math.abs(a.y0-b.y0)<E && Math.abs(a.x1-b.x1)<E && Math.abs(a.y1-b.y1)<E))) erros.push(`${v.nome}: nenhum lance liga o ${p.nome} ao andar de baixo`);
          esc = es; }
        if(p.nome==='Subsolo'){
          const m = p.manobra;
          if(m){ for(const pl of (p.pilares||[])) if(pl.y > m.y0+0.2 && pl.y < m.y1-0.2 && pl.x > Xp0+0.2 && pl.x < Xp1-0.2) erros.push(`${v.nome}: pilar dentro da manobra`);
            for(const s of S) if(!['manobra','rampa','jardim'].includes(s.tipo) && s.y0 < m.y1-E && s.y1 > m.y0+E) erros.push(`${v.nome}: ${s.nome} invade a manobra`); }
          for(const mm of (p.manobras||[])) for(const pl of (p.pilares||[])) if(pl.y > mm.y0+0.2 && pl.y < mm.y1-0.2 && pl.x > mm.x0+0.2 && pl.x < mm.x1-0.2) erros.push(`${v.nome}: pilar dentro de manobra`);
          if(S.some(s => s.tipo==='deposito' && s.nome==='Depósito')) erros.push(`${v.nome}: subsolo com depósito`);
          for(const vg of S.filter(s => s.vaga)) if(Math.abs((vg.x1-vg.x0) - 3.0) > E || Math.abs((vg.y1-vg.y0) - 5.0) > E) erros.push(`${v.nome}: vaga fora de 3,00 × 5,00 m`);
          const rp = S.find(s => s.tipo==='rampa'); if(rp && Math.abs((rp.x1-rp.x0) - 3.5) > E) erros.push(`${v.nome}: rampa sem 3,50 m de largura`);
          const n = p.nucleo; if(n && !(n.x0 < E || n.x1 > v.W-E || n.x0 < Xp0+E || n.x1 > Xp1-E || n.y1 > p.dim.y0+p.dim.D-E)) erros.push(`${v.nome}: núcleo do subsolo no meio`);
        }
      }
      if(c.tipo==='sobrado' && v.pav.length < 2) erros.push(`${v.nome}: sobrado sem superior`);
      if(c.subsolo && !v.pav.some(p => p.nome==='Subsolo')) erros.push(`${v.nome}: sem subsolo`);
      if((c.tipo==='sobrado'||c.subsolo) && !v.pav.filter(p => !p.anexo).every(p => p.salas.some(s => s.tipo==='escada'))) erros.push(`${v.nome}: falta escada em algum pavimento`);
      if(c.formato && c.formato!=='auto' && !v.tipologia.includes(c.formato==='bloco' ? 'Bloco' : c.formato)) erros.push(`${v.nome}: formato ${v.tipologia} diferente do pedido`);
      if(c.edicula==='2'){
        const et = v.pav.find(p => p.nome==='Edícula térreo'), es = v.pav.find(p => p.nome==='Edícula superior');
        if(!et || !es) erros.push(`${v.nome}: edícula de 2 pavimentos incompleta`);
        else { const b1 = et.salas.find(s => s.tipo==='banhoSocial'), b2 = es.salas.find(s => s.tipo==='banhoSocial');
          if(!b1 || !b2 || Math.abs(b1.x0-b2.x0)>E || Math.abs(b1.x1-b2.x1)>E || Math.abs(b1.y0-b2.y0)>E || Math.abs(b1.y1-b2.y1)>E) erros.push(`${v.nome}: banhos da edícula não estão sobrepostos`);
          const e1 = et.salas.find(s => s.tipo==='escada'), e2 = es.salas.find(s => s.tipo==='escada');
          if(!e1 || !e2 || Math.abs(e1.x0-e2.x0)>E || Math.abs(e1.y0-e2.y0)>E) erros.push(`${v.nome}: escada da edícula desalinhada`); }
      }
      const sub = v.pav.find(p => p.nome==='Subsolo');
      if(sub && !sub.cruzada) erros.push(`${v.nome}: subsolo sem ventilação cruzada`);
      if(sub && !sub.salas.some(s => s.tipo==='jardim')) erros.push(`${v.nome}: subsolo sem jardim de inverno`);
      if(c.tipo==='sobrado' && !v.pav.some(p => p.nome==='Superior')) erros.push(`${v.nome}: sobrado sem superior`);
      if(c.supModo==='parcial'){ const sp = v.pav.find(p => p.nome==='Superior'); if(sp && !sp.salas.some(s => s.nome==='Laje' || s.nome==='Terraço')) erros.push(`${v.nome}: superior parcial sem laje`); }
      if(c.supTv){ const sp = v.pav.find(p => p.nome==='Superior'); if(!sp || !sp.salas.some(s => s.tipo==='tv')) erros.push(`${v.nome}: sala de TV não foi para cima`); }
      if(c.rooftop){ const rt = v.pav.find(p => p.nome==='Rooftop'); if(!rt) erros.push(`${v.nome}: sem rooftop`); else if(!rt.salas.some(s => s.tipo==='terraco')) erros.push(`${v.nome}: rooftop sem deck`); }
      if(c.elevador){ const els = v.pav.filter(p => !p.anexo && p.nome!=='Rooftop').map(p => p.salas.find(s => s.tipo==='elevador'));
        if(els.some(e => !e)) erros.push(`${v.nome}: falta elevador em algum pavimento`);
        else if(els.some(e => Math.abs(e.x0-els[0].x0)>E || Math.abs(e.y0-els[0].y0)>E)) erros.push(`${v.nome}: elevador fora de prumo`); }
      if(c.formato && c.formato!=='auto' && c.subsolo && !v.pav.some(p => p.nome==='Subsolo')) erros.push(`${v.nome}: formato sem subsolo`);
      if(c.subRecuos && c.subRecuos!=='nenhum' && v===r.variantes[0]){ const sb = v.pav.find(p => p.nome==='Subsolo'); if(!sb || sb.vagas < c.vagas) erros.push(`${v.nome}: subsolo com ${sb ? sb.vagas : 0} de ${c.vagas} vagas`); }
      if(c.subsolo && v===r.variantes[0]){ const sb = v.pav.find(p => p.nome==='Subsolo'); if(sb && sb.vagas > (c.vagas||2)) erros.push(`${v.nome}: subsolo com mais vagas que o pedido (custo)`); }
      if(c.torreCalor && !v.torre) erros.push(`${v.nome}: sem torre de calor`);
      const ter = v.pav.find(p => p.nome==='Térreo');
      if(ter && !ter.portas.some(d => d.entrada)) erros.push(`${v.nome}: térreo sem entrada`);
      if(c.orientacao && v===r.variantes[0] && ter && !ter.portas.some(d => d.saida)) erros.push(`${v.nome}: térreo sem saída de fundos`);
      if(c.rooftop){ const rt = v.pav.find(p => p.nome==='Rooftop'); if(rt && !rt.base) erros.push(`${v.nome}: rooftop sem o pavimento de baixo esmaecido`);
        if(rt && c.rtTerracoA && !rt.salas.some(s => s.nome==='Terraço')) erros.push(`${v.nome}: rooftop sem terraço`); }
      if(c.piscina && !(v.anexos||[]).some(a => a.tipo==='piscina')) erros.push(`${v.nome}: sem piscina`);
      for(const a of (v.anexos||[])) if(a.y0 < v.y0 + v.D - E) erros.push(`${v.nome}: anexo ${a.tipo} sobre a casa`);
      const an = (v.anexos||[]); for(let i=0;i<an.length;i++) for(let j=i+1;j<an.length;j++) if(sobrepoe(an[i], an[j])) erros.push(`${v.nome}: ${an[i].tipo} sobrepõe ${an[j].tipo}`);
    }
    if(nome.startsWith('Programa grande') && !r.avisos.length) erros.push('deveria avisar que não cabe');
    if(!r.loteMinimo.minimo) erros.push('sem terreno mínimo');
    falhas += erros.length ? 1 : 0;
    const v0 = r.variantes[0];
    out.push({nome, ok: !erros.length, erros, resumo: v0 ? `${v0.tipologia}, ${M.f2(v0.W)} × ${M.f2(v0.D)} m, nota ${v0.score}; terreno mínimo ${r.loteMinimo.minimo ? M.f2(r.loteMinimo.minimo.frente)+' × '+M.f2(r.loteMinimo.minimo.fundo) : '—'}` : '—'});
  }
  return {out, falhas};
}
if(typeof module==='object' && module.exports){
  module.exports = {CASOS, rodar};
  if(require.main === module){
    const {out, falhas} = rodar();
    for(const t of out){ console.log((t.ok?'ok   ':'FALHA ')+t.nome+' → '+t.resumo); t.erros.slice(0,8).forEach(e => console.log('      - '+e)); }
    console.log(falhas ? `${falhas} caso(s) com falha` : 'todos os casos passaram');
    // rede de segurança: saída do motor e dos desenhos comparada com a gravada (gerador/golden/)
    const G = require('./golden.js'), atualizar = process.argv.includes('--atualizar-golden');
    const g = atualizar ? G.gravar() : G.verificar();
    g.linhas.forEach(l => console.log(l));
    const tm = G.tempos();
    tm.linhas.forEach(l => console.log(l));
    const u = require('./testes-unidades.js').rodar();
    u.linhas.forEach(l => console.log(l));
    process.exitCode = (falhas || g.falhas || u.falhas) ? 1 : 0;
  }
} else root.TestesMotor = rodar;
})(this);
