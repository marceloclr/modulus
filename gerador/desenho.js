/* Desenho das variantes geradas pelo motor: planta humanizada em SVG (estilo de casa-h/gerar.js) e implantação no lote. */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./motor.js')); else root.Desenho=factory(root.Motor);
})(this, function(Motor){
'use strict';
const K = 30;
const f2 = Motor.f2;
const COR = {
  intimo:['#E3EEEC','#93B3AC'], molhado:['#E1ECF2','#8FB0C4'], social:['#E7E7F0','#9C9CBD'], apoio:['#ECECE8','#ABAB9F'],
  circ:['#EEF0F4','#A9AFBD'], varanda:['#F3EBDD','#C8B08A'], garagem:['#E9E6E1','#A39C90'], patio:['#E6ECDF','#9DB08C'],
};
const PISO = '#F4F2EC', PAREDE = '#2B2F36', JAN = '#4C86C6', PORTA = '#8C6A2F';
const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');

/* Espelha a variante na horizontal (x → W − x). */
function espelha(v){
  const W = v.W, c = JSON.parse(JSON.stringify(v));
  const fx = x => +(W - x).toFixed(2);
  for(const p of c.pav){
    for(const s of p.salas){ const a = fx(s.x1), b = fx(s.x0); s.x0 = a; s.x1 = b; }
    for(const k of ['portas','vaos','janelas']) for(const e of (p[k]||[])){
      if(e.o==='v'){ e.c = fx(e.c); if(e.dentro) e.dentro *= -1; }
      else { const a = fx(e.t1), b = fx(e.t0); e.t0 = a; e.t1 = b; e.dobra = !e.dobra; }
    }
  }
  if(c.patios) for(const s of c.patios){ const a = fx(s.x1), b = fx(s.x0); s.x0 = a; s.x1 = b; }
  c.espelhada = true;
  return c;
}

function compartilhado(a, b){ return Motor._interno.compartilhado(a, b); }

function planta(v, idx, op){
  op = op || {};
  const p = v.pav[idx];
  const S = p.salas, T = Motor.TIPOS;
  const OX = 70, OY = 96;
  const X = m => +(OX + m*K).toFixed(1), Y = m => +(OY + m*K).toFixed(1);
  const W = v.W, D = Math.max(v.D, ...S.map(s => s.y1));
  const larg = OX + W*K + 40, alt = OY + D*K + 60;
  const o = [];
  const line = (x0,y0,x1,y1,st,w,ex) => o.push(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="${st}" stroke-width="${w}"${ex?' '+ex:''}/>`);
  const seg = (e, st, w, ex) => e.o==='h' ? line(e.t0, e.c, e.t1, e.c, st, w, ex) : line(e.c, e.t0, e.c, e.t1, st, w, ex);
  const aberto = s => !!T[s.tipo].aberto;

  // pátios (H)
  if(idx===v.pav.findIndex(q => q.nome==='Térreo') && v.patios) for(const pt of v.patios) if(pt.y1-pt.y0>0.5)
    o.push(`<rect x="${X(pt.x0)}" y="${Y(pt.y0)}" width="${((pt.x1-pt.x0)*K).toFixed(1)}" height="${((pt.y1-pt.y0)*K).toFixed(1)}" fill="${COR.patio[0]}" stroke="${COR.patio[1]}"><title>Pátio</title></rect>`);
  // ambientes
  for(const s of S){
    const c = COR[s.zona] || COR.apoio, a = Motor.area(s);
    o.push(`<rect x="${X(s.x0)}" y="${Y(s.y0)}" width="${((s.x1-s.x0)*K).toFixed(1)}" height="${((s.y1-s.y0)*K).toFixed(1)}" fill="${c[0]}" stroke="${c[1]}" stroke-width="1"><title>${esc(s.nome)}: ${f2(s.x1-s.x0)} × ${f2(s.y1-s.y0)} = ${f2(a)} m²</title></rect>`);
  }
  // mobiliário mínimo: carros, escadas, rampas, camas
  for(const s of S){
    const w = s.x1-s.x0, h = s.y1-s.y0;
    if(s.tipo==='garagem'){
      const n = s.vaga ? 1 : (s.vagas || Math.max(1, Math.floor(w/2.5)));
      const vert = h >= w || s.vaga;
      for(let i=0;i<n;i++){
        const cx = vert ? s.x0 + w*(i+0.5)/n : s.x0 + w/2, cy = vert ? s.y0 + h/2 : s.y0 + h*(i+0.5)/n;
        const cw = vert ? 1.8 : 4.4, chh = vert ? 4.4 : 1.8;
        o.push(`<rect x="${X(cx-cw/2)}" y="${Y(cy-chh/2)}" width="${cw*K}" height="${chh*K}" rx="9" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`);
        o.push(`<rect x="${X(cx-cw/2+ (vert?0.2:1.2))}" y="${Y(cy-chh/2+(vert?1.2:0.2))}" width="${(vert?1.4:1.6)*K}" height="${(vert?1.6:1.4)*K}" rx="4" fill="none" stroke="#B4B8BE" stroke-width=".7"/>`);
      }
    }
    if(s.tipo==='escada'){
      const n = (s.esc && s.esc.n) || 16, vert = h >= w;
      const L = vert ? h : w, passo = L/(n-1);
      for(let i=1;i<n-1;i++){ if(vert) line(s.x0, s.y0+i*passo, s.x1, s.y0+i*passo, '#8A8F98', .7); else line(s.x0+i*passo, s.y0, s.x0+i*passo, s.y1, '#8A8F98', .7); }
      const tx = (X(s.x0)+X(s.x1))/2, ty = (Y(s.y0)+Y(s.y1))/2;
      const lab = s.sobe && s.desce ? 'SOBE / DESCE' : s.sobe ? 'SOBE' : 'DESCE';
      o.push(`<text transform="translate(${tx+3},${ty}) rotate(-90)" class="rd" style="font-size:6.4px;font-weight:600">${lab}</text>`);
    }
    if(s.tipo==='rampa'){
      for(let y=s.y0+0.5;y<s.y1;y+=0.5) line(s.x0, y, s.x1, y, '#A39C90', .6);
      o.push(`<text transform="translate(${(X(s.x0)+X(s.x1))/2+3},${(Y(s.y0)+Y(s.y1))/2}) rotate(-90)" class="rd" style="font-size:7px;font-weight:600">RAMPA ${s.inclinacao||20}%</text>`);
    }
    if(['suite','master','quarto'].includes(s.tipo) && w >= 2.6 && h >= 2.6){
      const dupla = s.tipo!=='quarto', bw = dupla ? (s.tipo==='master'?1.9:1.6) : 1.0, bl = 2.0;
      // cabeceira na parede mais longa que não seja do corredor: centraliza
      const horiz = w >= h;
      const cx = (s.x0+s.x1)/2, cy = (s.y0+s.y1)/2;
      if(horiz){ o.push(`<rect x="${X(cx-bw/2)}" y="${Y(cy-bl/2)}" width="${bw*K}" height="${bl*K}" rx="2" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`); }
      else { o.push(`<rect x="${X(cx-bl/2)}" y="${Y(cy-bw/2)}" width="${bl*K}" height="${bw*K}" rx="2" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`); }
    }
  }
  // paredes internas e vãos livres
  const livres = (p.vaos||[]).filter(e => e.livre);
  for(let i=0;i<S.length;i++) for(let j=i+1;j<S.length;j++){
    const a = S[i], b = S[j], sh = compartilhado(a, b); if(!sh) continue;
    if(aberto(a) && aberto(b)) continue;
    const e = {o:sh.o, c:sh.c, t0:sh.t0, t1:sh.t1};
    if(aberto(a) || aberto(b)) { seg(e, PAREDE, 6, 'stroke-linecap="square"'); continue; }
    if(livres.some(l => l.o===e.o && Math.abs(l.c-e.c)<0.001 && l.t0<=e.t0+0.001 && l.t1>=e.t1-0.001)) { seg(e, '#B7BAC2', .8, 'stroke-dasharray="3 3"'); continue; }
    seg(e, PAREDE, 3.2, 'stroke-linecap="square"');
  }
  // fachada
  const fech = S.filter(s => !aberto(s));
  for(const s of S){
    for(const e of Motor._interno.trechosExternos(s, S)){
      if(aberto(s)) seg(e, '#C8B08A', 1.3, 'stroke-dasharray="4 3"');
      else seg(e, PAREDE, 6, 'stroke-linecap="square"');
    }
  }
  // vãos parciais (closet), portas e janelas
  for(const e of (p.vaos||[]).filter(e => !e.livre)) seg(e, PISO, 4.4);
  for(const e of (p.janelas||[])){
    seg(e, '#FFFFFF', 6.4);
    if(e.vidro){ seg(e, JAN, 4, 'stroke-opacity=".28"'); seg(e, JAN, 1.2); }
    else seg(e, JAN, 1.4, e.alta ? 'stroke-dasharray="3 2"' : '');
  }
  for(const d of (p.portas||[])){
    seg(d, d.entrada ? '#FFFFFF' : PISO, 4.6);
    const w = d.t1 - d.t0, s = d.dentro || 1;
    const h0 = d.dobra ? d.t1 : d.t0, h1 = d.dobra ? d.t0 : d.t1;   // dobradiça e batente
    if(d.o==='h'){
      line(h0, d.c, h0, d.c + s*w, PORTA, 1.6);
      const sweep = ((s>0) !== (h1>h0)) ? 0 : 1;
      o.push(`<path d="M${X(h1)},${Y(d.c)} A${w*K},${w*K} 0 0 ${sweep} ${X(h0)},${Y(d.c+s*w)}" fill="none" stroke="${PORTA}" stroke-width=".7" stroke-dasharray="2 2"/>`);
    } else {
      line(d.c, d.t0, d.c + s*w, d.t0, PORTA, 1.6);
      const sweep = s>0 ? 0 : 1;
      o.push(`<path d="M${X(d.c)},${Y(d.t1)} A${w*K},${w*K} 0 0 ${sweep} ${X(d.c+s*w)},${Y(d.t0)}" fill="none" stroke="${PORTA}" stroke-width=".7" stroke-dasharray="2 2"/>`);
    }
    if(d.entrada){ const mx = d.o==='h' ? (d.t0+d.t1)/2 : d.c, my = d.o==='h' ? d.c : (d.t0+d.t1)/2;
      o.push(`<text x="${X(mx)}" y="${Y(my) + (d.o==='h' ? -6 : 3)}" class="rn" style="font-size:6.4px;fill:${PORTA}">▼ ENTRADA</text>`); }
  }
  // rótulos
  for(const s of S){
    const w = s.x1-s.x0, h = s.y1-s.y0, a = w*h;
    if(s.tipo==='escada' || s.tipo==='rampa') continue;
    const cx = (X(s.x0)+X(s.x1))/2, cy = (Y(s.y0)+Y(s.y1))/2;
    const nome = esc((s.nome||'').toUpperCase());
    const pw = w*K, ph = h*K;
    if(['circ','galeria'].includes(s.tipo) && ph > pw*2.5){
      o.push(`<text transform="translate(${cx+2.5},${cy}) rotate(-90)" class="rn" style="font-size:6.4px">${nome} ${f2(Math.min(w,h))}</text>`); continue;
    }
    if(pw < 34 || ph < 18){ if(pw >= 22 && ph >= 12) o.push(`<text x="${cx}" y="${cy+2.5}" class="rd" style="font-size:5.6px">${f2(a)}</text>`); continue; }
    const big = pw >= 70 && ph >= 34;
    const fs = big ? 8.2 : 6.4;
    const sub = big ? `${f2(w)} × ${f2(h)} · ${f2(a)} m²` : `${f2(a)} m²`;
    const bw = Math.min(pw-4, Math.max(nome.length*fs*0.66, sub.length*(big?3.7:3.4)) + 8);
    o.push(`<rect x="${(cx-bw/2).toFixed(1)}" y="${(cy-fs-2).toFixed(1)}" width="${bw.toFixed(1)}" height="${(fs+12).toFixed(1)}" rx="2" fill="#FFFFFF" fill-opacity=".8"/>`);
    o.push(`<text x="${cx}" y="${cy}" class="rn" style="font-size:${fs}px">${nome}</text>`);
    o.push(`<text x="${cx}" y="${cy+8.5}" class="rd" style="font-size:${big?6.6:5.8}px">${sub}</text>`);
  }
  // cotas
  const cota = (a0, a1, pos, t, vert) => {
    if(!vert){ line(a0, pos, a1, pos, '#55595F', .7); for(const a of [a0,a1]) line(a, pos-.12, a, pos+.12, '#55595F', .7);
      o.push(`<text x="${((X(a0)+X(a1))/2).toFixed(1)}" y="${Y(pos)-3}" class="cota">${t}</text>`); }
    else { line(pos, a0, pos, a1, '#55595F', .7); for(const a of [a0,a1]) line(pos-.12, a, pos+.12, a, '#55595F', .7);
      o.push(`<text transform="translate(${X(pos)-3},${((Y(a0)+Y(a1))/2).toFixed(1)}) rotate(-90)" class="cota">${t}</text>`); }
  };
  cota(0, W, -0.9, f2(W));
  cota(0, D, -1.4, f2(D), true);
  const ys = (v.cotasY||[]).filter(y => y<=D+0.01);
  if(p.nome==='Térreo') for(let i=0;i<ys.length-1;i++) if(ys[i+1]-ys[i] > 0.6) cota(ys[i], ys[i+1], -0.75, f2(ys[i+1]-ys[i]), true);

  const titulo = op.titulo || `${v.nome} · ${p.nome}`;
  const sub = op.sub || `${v.tipologia} · casa ${f2(W)} × ${f2(v.D)} m · escala ${K} px/m${v.espelhada?' · espelhada':''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(larg)} ${Math.ceil(alt)}" width="${Math.ceil(larg)}" height="${Math.ceil(alt)}" role="img" aria-label="${esc(titulo)}">
<title>${esc(titulo)}</title><style>text{font-family:"IBM Plex Sans","Inter","Segoe UI",Helvetica,Arial,sans-serif;fill:#2F333A}.tt{font-size:15px;font-weight:600}.st{font-size:8.6px;fill:#5d6168}.rn{font-weight:600;text-anchor:middle;letter-spacing:.2px}.rd{text-anchor:middle;fill:#4a4e55}.cota{font-size:6.6px;text-anchor:middle;fill:#55595F}</style>
<rect width="100%" height="100%" fill="#FBFAF7"/>
<text x="${OX}" y="30" class="tt">${esc(titulo)}</text>
<text x="${OX}" y="46" class="st">${esc(sub)}</text>
${o.join('\n')}
</svg>`;
}

/* Implantação no lote: terreno, recuos, projeção da casa, vagas descobertas e rampa. */
function lote(v, q, res){
  const k = Math.min(9, 300/Math.max(q.frente, q.fundo*0.75));
  const OX = 40, OY = 34, w = q.frente*k, h = q.fundo*k;
  const X = m => +(OX + m*k).toFixed(1), Y = m => +(OY + m*k).toFixed(1);
  const o = [];
  o.push(`<rect x="${X(0)}" y="${Y(0)}" width="${w}" height="${h}" fill="#E6ECDF" stroke="#5F7350" stroke-width="1.2"/>`);
  const B = res.B, Dmax = res.Dmax;
  o.push(`<rect x="${X(q.recLat)}" y="${Y(q.recFrente)}" width="${(B*k).toFixed(1)}" height="${(Dmax*k).toFixed(1)}" fill="none" stroke="#5F7350" stroke-dasharray="4 3"><title>Área edificável ${f2(B)} × ${f2(Dmax)} m</title></rect>`);
  const ter = v.pav.find(p => p.nome==='Térreo');
  for(const s of ter.salas){ const c = COR[s.zona]||COR.apoio;
    o.push(`<rect x="${X(v.x0+s.x0)}" y="${Y(v.y0+s.y0)}" width="${((s.x1-s.x0)*k).toFixed(1)}" height="${((s.y1-s.y0)*k).toFixed(1)}" fill="${c[0]}" stroke="${c[1]}" stroke-width=".5"/>`); }
  // vagas descobertas no recuo frontal
  const fora = q.garagem==='nenhuma' || q.subGaragem ? 0 : Math.max(0, q.vagas - (v.garagemDentro||0));
  if(fora>0){
    const n = Math.min(fora, Math.floor((q.frente-0.5)/2.5)), dy = Math.min(5, q.recFrente-0.2);
    for(let i=0;i<n;i++) o.push(`<rect x="${X(0.3+i*2.5)}" y="${Y(q.recFrente-dy)}" width="${2.4*k}" height="${dy*k}" fill="#E9E6E1" stroke="#A39C90" stroke-dasharray="2 2"><title>Vaga descoberta</title></rect>`);
  }
  const sub = v.pav.find(p => p.nome==='Subsolo');
  if(sub && sub.rampa && q.subGaragem){
    const rx = v.espelhada ? v.x0 + v.W - 3 : v.x0;
    o.push(`<rect x="${X(rx)}" y="${Y(q.recFrente - sub.rampa.Lout)}" width="${3*k}" height="${(sub.rampa.Lout*k).toFixed(1)}" fill="#E9E6E1" stroke="#A39C90"><title>Rampa externa ${f2(sub.rampa.Lout)} m</title></rect>`);
  }
  o.push(`<text x="${(X(0)+X(q.frente))/2}" y="${Y(0)-8}" class="cota">rua · frente ${f2(q.frente)} m</text>`);
  o.push(`<text transform="translate(${X(0)-8},${(Y(0)+Y(q.fundo))/2}) rotate(-90)" class="cota">fundo ${f2(q.fundo)} m</text>`);
  o.push(`<text x="${(X(0)+X(q.frente))/2}" y="${Y(q.recFrente/2)+3}" class="cota">recuo ${f2(q.recFrente)}</text>`);
  o.push(`<text x="${(X(0)+X(q.frente))/2}" y="${Y(q.fundo - q.recFundo/2)+3}" class="cota">fundo ${f2(q.fundo - v.y0 - v.D)} m livres</text>`);
  const W2 = Math.ceil(w + OX + 20), H2 = Math.ceil(h + OY + 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}" role="img" aria-label="Implantação no lote"><style>text{font-family:"IBM Plex Sans","Segoe UI",Helvetica,Arial,sans-serif}.cota{font-size:8px;text-anchor:middle;fill:#55595F}</style><rect width="100%" height="100%" fill="#FBFAF7"/>${o.join('')}</svg>`;
}

return {planta, lote, espelha, COR};
});
