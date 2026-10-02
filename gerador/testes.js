/* Testes do motor: node gerador/testes.js  (também roda em testes.html) */
(function(root){
'use strict';
const M = (typeof module==='object' && module.exports) ? require('./motor.js') : root.Motor;
const CASOS = {
  'Térrea 10 × 30, 2 quartos': {frente:10, fundo:30, quartos:2, suites:1, vagas:1},
  'Térrea 12 × 30, 3 suítes, 2 vagas': {frente:12, fundo:30, quartos:3, suites:3, vagas:2},
  'Casa em H, 22 × 30': {frente:22, fundo:30, quartos:3, suites:3, escritorio:true, vagas:2, gourmet:true},
  'Sobrado 10 × 25, 4 quartos, subsolo 2 vagas': {frente:10, fundo:25, tipo:'sobrado', quartos:4, suites:2, subsolo:true, vagas:2},
  'Térrea com subsolo, 15 × 30': {frente:15, fundo:30, quartos:3, suites:2, subsolo:true, subLazer:true, vagas:3},
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
        for(let i=0;i<S.length;i++){
          const s = S[i];
          if(s.x1-s.x0 < 0.3 || s.y1-s.y0 < 0.3) erros.push(`${v.nome}/${p.nome}: ${s.nome} degenerado`);
          if(s.x0 < -E || s.x1 > v.W+E) erros.push(`${v.nome}/${p.nome}: ${s.nome} fora da largura`);
          for(let j=i+1;j<S.length;j++) if(sobrepoe(s, S[j])) erros.push(`${v.nome}/${p.nome}: ${s.nome} sobrepõe ${S[j].nome}`);
        }
        const e = S.find(s => s.tipo==='escada');
        if(e){ if(esc && (Math.abs(esc.x0-e.x0)>E || Math.abs(esc.y0-e.y0)>E || Math.abs(esc.x1-e.x1)>E || Math.abs(esc.y1-e.y1)>E)) erros.push(`${v.nome}: escada desalinhada no ${p.nome}`); esc = esc || e; }
      }
      if(c.tipo==='sobrado' && v.pav.length < 2) erros.push(`${v.nome}: sobrado sem superior`);
      if(c.subsolo && !v.pav.some(p => p.nome==='Subsolo')) erros.push(`${v.nome}: sem subsolo`);
      if((c.tipo==='sobrado'||c.subsolo) && !v.pav.every(p => p.salas.some(s => s.tipo==='escada'))) erros.push(`${v.nome}: falta escada em algum pavimento`);
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
  const {out, falhas} = rodar();
  for(const t of out){ console.log((t.ok?'ok   ':'FALHA ')+t.nome+' → '+t.resumo); t.erros.slice(0,8).forEach(e => console.log('      - '+e)); }
  console.log(falhas ? `${falhas} caso(s) com falha` : 'todos os casos passaram');
  process.exitCode = falhas ? 1 : 0;
} else root.TestesMotor = rodar;
})(this);
