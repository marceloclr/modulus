/* Desenho das variantes geradas pelo motor: planta humanizada em SVG (estilo de casa-h/gerar.js) e implantação no lote. */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./motor.js'), require('./mobilia.js')); else root.Desenho=factory(root.Motor, root.Mobilia);
})(this, function(Motor, Mobilia){
'use strict';
const K = 30;
const f2 = Motor.f2;
const COR = {
  intimo:['#CDE9D8','#2E7D5B'], molhado:['#CFE3F7','#2F6FB0'], social:['#E2D8F5','#6A4FB3'], apoio:['#F2E2BF','#9A6F22'],
  circ:['#E4E6EA','#6B7280'], varanda:['#F7D6C2','#B4532A'], garagem:['#D6D3CE','#57534E'], patio:['#D5E6C0','#5E7D3A'],
};
/* Subsolo: uma cor para cada parte. */
const SUB_COR = {rampa:['#F4C47C','#9A5B12','Rampa'], manobra:['#E3E7EC','#334155','Manobra e circulação'], garagem:['#CFE3F7','#2F6FB0','Vagas'],
  escada:['#E2D8F5','#6A4FB3','Escada'], elevador:['#F9D3E3','#B03A6E','Elevador'], jardim:['#D5E6C0','#5E7D3A','Jardim de inverno']};
const subCor = t => SUB_COR[t] || SUB_COR.manobra;
const PISO = '#F4F2EC', PAREDE = '#2B2F36', JAN = '#4C86C6', PORTA = '#8C6A2F';
const AC = {via:['#E2DED6','#8F877A'], vaga:['#ECE9E3','#8A8F98'], caminho:['#EAD7BC','#A9875C'], veiculos:'#3F3A35', pedestres:'#2F6FB0'};
/* Acessos (motor.acessos): faixas de veículos, vagas descobertas, caminho de pedestres e portões, em coordenadas da casa.
   tx/ty convertem para o desenho; serve à planta do térreo e à implantação. */
function desenhaAcessos(a, tx, ty, k, o, semRotulos){
  if(!a) return;
  const rect = (r, c, ex) => { const h = r.y1 - r.y0; if(h < 0.05) return; o.push(`<rect x="${tx(r.x0)}" y="${ty(r.y0)}" width="${((r.x1-r.x0)*k).toFixed(1)}" height="${(h*k).toFixed(1)}" fill="${c[0]}" stroke="${c[1]}" stroke-width=".8"${ex||''}/>`); };
  for(const r of a.vias) rect(r, AC.via, ' stroke-dasharray="4 3"');
  a.vagasFora.forEach((r, i) => { rect(r, AC.vaga, ' stroke-dasharray="2 2"');
    o.push(`<text x="${((tx(r.x0)+tx(r.x1))/2).toFixed(1)}" y="${((ty(r.y0)+ty(r.y1))/2 + 2).toFixed(1)}" class="rd" style="font-size:5.8px;font-weight:600;fill:#5B5F66">VAGA</text>`); });
  if(a.caminho){ const pts = a.caminho.pontos.map(([x,y]) => `${tx(x)},${ty(y)}`).join(' '), w = a.caminho.largura*k;
    o.push(`<polyline points="${pts}" fill="none" stroke="${AC.caminho[1]}" stroke-width="${(w + 1.4).toFixed(1)}" stroke-linejoin="miter"/>`);
    o.push(`<polyline points="${pts}" fill="none" stroke="${AC.caminho[0]}" stroke-width="${w.toFixed(1)}" stroke-linejoin="miter"><title>Caminho de pedestres ${f2(a.caminho.largura)} m</title></polyline>`); }
  for(const p of a.portoes){ const c = p.tipo==='veiculos' ? AC.veiculos : AC.pedestres, y = ty(p.y);
    o.push(`<line x1="${tx(p.x0)}" y1="${y}" x2="${tx(p.x1)}" y2="${y}" stroke="${c}" stroke-width="4" stroke-linecap="butt"><title>${p.tipo==='veiculos' ? 'Portão de veículos' : 'Portão social'} ${f2(p.largura)} m</title></line>`);
    if(!semRotulos) o.push(`<text x="${((tx(p.x0)+tx(p.x1))/2).toFixed(1)}" y="${(y - 5).toFixed(1)}" class="rd" style="font-size:5.8px;font-weight:600;fill:${c}">${p.tipo==='veiculos' ? 'PORTÃO VEÍC.' : 'PORTÃO SOCIAL'} ${f2(p.largura)}</text>`); }
}
const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');

/* Espelha a variante na horizontal. A casa vira no lugar (Motor.espelharCasa); os acessos da versão espelhada vêm do motor
   (v.acessosEsp) e os anexos viram dentro da faixa entre os recuos laterais (v.faixaAnexos), para respeitar recuos diferentes. */
function espelha(v){
  const c = Motor.espelharCasa(v);
  if(v.acessosEsp) c.acessos = JSON.parse(JSON.stringify(v.acessosEsp));
  else if(c.acessos){ const fx = x => +(v.W - x).toFixed(2), ac = c.acessos;
    for(const r of ac.vias.concat(ac.vagasFora, ac.portoes)){ const a = fx(r.x1), b = fx(r.x0); r.x0 = a; r.x1 = b; }
    if(ac.caminho) ac.caminho.pontos = ac.caminho.pontos.map(([x,y]) => [fx(x), y]);
    const xl = fx(ac.xR), xr = fx(ac.xL); ac.xL = xl; ac.xR = xr; }
  if(c.anexos && c.loteFrente){ const fa = c.faixaAnexos || {x0:0, x1:c.loteFrente};
    for(const a of c.anexos){ const x0 = +(fa.x0 + fa.x1 - a.x1).toFixed(2), x1 = +(fa.x0 + fa.x1 - a.x0).toFixed(2); a.x0 = x0; a.x1 = x1; a.espelhado = !a.espelhado; } }
  c.espelhada = true;
  return c;
}

function compartilhado(a, b){ return Motor._interno.compartilhado(a, b); }

/* Giro da planta: o desenho é feito com a rua no topo e depois girado pelo rumo da frente, para o norte ficar no alto.
   Os textos são recolocados para continuarem legíveis. */
function rumoGraus(rumo){ return rumo && Motor.RUMOS[rumo] !== undefined ? Motor.RUMOS[rumo] : 0; }
function textosLegiveis(str, F){
  if(!F) return str;
  str = str.replace(/<rect [^>]*fill="#FFFFFF" fill-opacity="\.8"\/>/g, '');
  const norm = a => { let t = ((a % 360) + 540) % 360 - 180; if(t > 90) t -= 180; if(t <= -90) t += 180; return t; };
  str = str.replace(/<text transform="translate\(([-\d.]+),([-\d.]+)\) rotate\(([-\d.]+)\)"/g, (m, a, b, rr) => `<text transform="translate(${a},${b}) rotate(${(norm(F + +rr) - F).toFixed(1)})"`);
  str = str.replace(/<text x="([-\d.]+)" y="([-\d.]+)"/g, (m, a, b) => `<text transform="rotate(${-F} ${a} ${b})" x="${a}" y="${b}"`);
  return str;
}
/* Envolve o conteúdo (caixa px0..px1 × py0..py1) num grupo girado e devolve as medidas da caixa girada. */
function girado(conteudo, F, px0, py0, px1, py1, ox, oy){
  const cx = (px0+px1)/2, cy = (py0+py1)/2, w = px1-px0, h = py1-py0, t = F*Math.PI/180;
  const Wr = Math.abs(w*Math.cos(t)) + Math.abs(h*Math.sin(t)), Hr = Math.abs(w*Math.sin(t)) + Math.abs(h*Math.cos(t));
  const tx = ox + Wr/2 - cx, ty = oy + Hr/2 - cy;
  return {g:`<g class="${F ? 'halo' : ''}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) rotate(${F} ${cx.toFixed(1)} ${cy.toFixed(1)})">${textosLegiveis(conteudo, F)}</g>`, Wr, Hr};
}

/* Setas do vento predominante de leste/sudeste (sopra de 112,5°), atravessando o desenho. */
function ventoSetas(xr, y0, H){
  const ang = (112.5 + 180) * Math.PI/180, dx = Math.sin(ang), dy = -Math.cos(ang);
  let g = '<g fill="none" stroke="#4C86C6" stroke-width="1.6" stroke-dasharray="6 4" opacity=".75">';
  for(const k of [0.3, 0.5, 0.7]){ const x1 = xr + 8, y1 = y0 + H*k + 40, x2 = x1 + dx*70, y2 = y1 + dy*70;
    g += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}"/><path d="M${(x2 - dx*8 + dy*5).toFixed(1)},${(y2 - dy*8 - dx*5).toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${(x2 - dx*8 - dy*5).toFixed(1)},${(y2 - dy*8 + dx*5).toFixed(1)}" stroke-dasharray=""/>`; }
  return g + `</g><text x="${(xr+20).toFixed(1)}" y="${(y0 + H*0.3 + 30).toFixed(1)}" style="font-size:6.6px;fill:#4C86C6;font-weight:600">vento L/SE</text>`;
}

/* Rosa dos ventos: a frente do terreno (topo do desenho) aponta para o rumo escolhido. */
function rosa(cx, cy, R, rumo){
  const conhecido = rumo && Motor.RUMOS[rumo] !== undefined;
  const giro = 0;                                         // norte sempre para cima; quem gira é a planta
  const pts = [['N',0],['NE',45],['L',90],['SE',135],['S',180],['SO',225],['O',270],['NO',315]];
  const pol = a => { const t = (a + giro - 90) * Math.PI/180; return [Math.cos(t), Math.sin(t)]; };
  let g = `<g class="rosa"><circle cx="${cx}" cy="${cy}" r="${R}" fill="#FFFFFF" fill-opacity=".85" stroke="#8A8F98" stroke-width=".8"/>`;
  for(const [n,a] of pts){
    const card = a % 90 === 0, [ux,uy] = pol(a), L = card ? R*0.82 : R*0.55, w = card ? R*0.13 : R*0.09;
    const [px,py] = [-uy, ux];
    const cor = n==='N' ? '#B4532A' : card ? '#2B2F36' : '#8A8F98';
    g += `<path d="M${(cx+ux*L).toFixed(1)},${(cy+uy*L).toFixed(1)} L${(cx+px*w).toFixed(1)},${(cy+py*w).toFixed(1)} L${cx},${cy} Z" fill="${cor}"/><path d="M${(cx+ux*L).toFixed(1)},${(cy+uy*L).toFixed(1)} L${(cx-px*w).toFixed(1)},${(cy-py*w).toFixed(1)} L${cx},${cy} Z" fill="${cor}" fill-opacity=".55"/>`;
    const T = R + (card ? 7 : 6);
    g += `<text x="${(cx+ux*T).toFixed(1)}" y="${(cy+uy*T+2.6).toFixed(1)}" text-anchor="middle" style="font-size:${card?7.4:6}px;font-weight:${card?700:500};fill:${n==='N'?'#B4532A':'#43474D'}">${n}</text>`;
  }
  g += `<text x="${cx}" y="${cy - R - 16}" text-anchor="middle" style="font-size:6.2px;fill:#5d6168">${conhecido ? 'frente para ' + Motor.NOMES_RUMO[rumo].toLowerCase() : 'orientação não informada'}</text></g>`;
  return g;
}

/* ---------- Planta humanizada (etapa F1): pisos, paredes em escala, móveis de mobilia.js, vegetação e sombra ----------
   Sai do mesmo modelo da planta técnica; muda só piso, paredes, móveis e rótulos. Ids dos padrões com sufixo por desenho
   (hzN), para várias plantas na mesma página não disputarem o mesmo id. */
let HZN = 0;
const HZ_PISO = {madeira:['quarto','suite','master','closet','closetMaster','escritorio','salaIntima','tv'],
  porcelanato:['estar','jantar','circ','hall','galeria','lazer','escada'], ceramica:['banhoSuite','banhoMaster','banhoSocial','lavabo','cozinha','servico','despensa','deposito','rouparia'],
  deck:['varanda','terraco','gourmet'], grama:['jardim'], cimento:['garagem','manobra','rampa','elevador']};
const pisoDe = tipo => Object.keys(HZ_PISO).find(k => HZ_PISO[k].includes(tipo)) || 'porcelanato';
const PAREDE_INT = 0.10 * K, PAREDE_EXT = 0.15 * K;   // 10 e 15 cm em escala (3 e 4,5 px)
function hzDefs(id){
  const p = (n, w, h, corpo, tr) => `<pattern id="${id}${n}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${tr ? ` patternTransform="${tr}"` : ''}>${corpo}</pattern>`;
  return '<defs>' +
    p('madeira', 30, 4.5, '<rect width="30" height="4.5" fill="#E9D7BC"/><path d="M0 4.3H30" stroke="#CDB592" stroke-width=".6"/><path d="M11 0V4.5" stroke="#D5BF9E" stroke-width=".5"/>') +
    p('porcelanato', 27, 27, '<rect width="27" height="27" fill="#ECEAE4"/><path d="M0 26.7H27M26.7 0V27" stroke="#D6D2C8" stroke-width=".6"/>') +
    p('ceramica', 9, 9, '<rect width="9" height="9" fill="#E6EDF0"/><path d="M0 8.8H9M8.8 0V9" stroke="#C9D4D9" stroke-width=".5"/>') +
    p('deck', 4.5, 30, '<rect width="4.5" height="30" fill="#D9BE98"/><path d="M4.3 0V30" stroke="#B89A70" stroke-width=".6"/>') +
    p('grama', 8, 8, '<rect width="8" height="8" fill="#CFE0B4"/><circle cx="2" cy="2" r=".7" fill="#A9C784"/><circle cx="6" cy="5.5" r=".6" fill="#B7D093"/>') +
    p('cimento', 12, 12, '<rect width="12" height="12" fill="#E3E1DC"/><circle cx="3" cy="4" r=".4" fill="#CBC7BF"/><circle cx="9" cy="9" r=".35" fill="#D2CEC6"/>') +
    `<filter id="${id}sombra" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>`;
}
/* Desenha as peças de mobilia.js. X e Y convertem metros em px. */
function hzMoveis(pecas, X, Y){
  const o = [], r = (x0, y0, x1, y1, at) => Math.abs(x1 - x0) < 1e-9 || Math.abs(y1 - y0) < 1e-9 ? o.push(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" ${at}/>`) : o.push(`<rect x="${X(Math.min(x0, x1))}" y="${Y(Math.min(y0, y1))}" width="${(Math.abs(x1 - x0) * K).toFixed(1)}" height="${(Math.abs(y1 - y0) * K).toFixed(1)}" ${at}/>`);
  const c = (x, y, rr, at) => o.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${(rr * K).toFixed(1)}" ${at}/>`);
  const el = (x, y, rx, ry, at) => o.push(`<ellipse cx="${X(x)}" cy="${Y(y)}" rx="${(rx * K).toFixed(1)}" ry="${(ry * K).toFixed(1)}" ${at}/>`);
  const MAD = 'fill="#E2D5BE" stroke="#8C7B5C" stroke-width=".8"', BR = 'fill="#FFFFFF" stroke="#6F6A60" stroke-width=".8"', LOU = 'fill="#FFFFFF" stroke="#7F9BB1" stroke-width=".8"', PEDRA = 'fill="#E8E4DC" stroke="#7C776D" stroke-width=".8"';
  for(const q of pecas){
    // sistema local da peça: u ao longo da parede de apoio (0..W), v da parede para dentro (0..P)
    const l = q.lado || 'y0', hz = l === 'y0' || l === 'y1', W = hz ? q.x1 - q.x0 : q.y1 - q.y0, P = hz ? q.y1 - q.y0 : q.x1 - q.x0;
    const pt = (u, v) => l === 'y0' ? [q.x0 + u, q.y0 + v] : l === 'y1' ? [q.x0 + u, q.y1 - v] : l === 'x0' ? [q.x0 + v, q.y0 + u] : [q.x1 - v, q.y0 + u];
    const R = (u0, v0, u1, v1, at) => { const [x0, y0] = pt(u0, v0), [x1, y1] = pt(u1, v1); r(x0, y0, x1, y1, at); };
    const C = (u, v, rr, at) => { const [x, y] = pt(u, v); c(x, y, rr, at); };
    const tt = `<title>${({cama:'Cama', criado:'Criado-mudo', armario:'Armário', escrivaninha:'Escrivaninha', boxe:'Boxe', bacia:'Bacia sanitária', lavatorio:'Lavatório', bancada:'Bancada', 'bancada-cozinha':'Bancada com cuba e cooktop', geladeira:'Geladeira', tanque:'Tanque', maquina:'Máquina de lavar', rack:'Rack da TV', sofa:'Sofá', 'mesa-centro':'Mesa de centro', 'mesa-jantar':'Mesa de jantar', 'mesa-externa':'Mesa externa', vaso:'Vaso com planta', churrasqueira:'Churrasqueira', prateleiras:'Prateleiras', estante:'Estante', arvore:'Árvore'})[q.tipo] || q.tipo} ${f2(W)} × ${f2(P)} m</title>`;
    o.push('<g>' + tt);
    switch(q.tipo){
      case 'cama': {
        R(0, 0, W, P, 'rx="2" ' + BR);
        R(0.04, 0.5, W - 0.04, P - 0.04, 'rx="2" fill="#D7E5E1" stroke="#9DB3AD" stroke-width=".6"');   // manta
        R(0.04, 0.5, W - 0.04, 0.8, 'fill="#F6F3EC" stroke="#9DB3AD" stroke-width=".5"');                // dobra do lençol
        const n = q.casal ? 2 : 1, pw = (W - 0.2) / n;
        for(let i = 0; i < n; i++) R(0.1 + i * pw + 0.03, 0.08, 0.1 + (i + 1) * pw - 0.03, 0.42, 'rx="3" fill="#F6F3EC" stroke="#6F6A60" stroke-width=".7"');
        break; }
      case 'criado': R(0, 0, W, P, 'rx="1" ' + MAD); C(W / 2, P / 2, 0.1, 'fill="#FFF6DD" stroke="#B59B6A" stroke-width=".6"'); break;
      case 'armario': case 'prateleiras': case 'estante': {
        R(0, 0, W, P, (q.tipo === 'armario' ? 'fill="#EDE5D6" stroke="#8C8270"' : MAD) + ' stroke-width=".9"');
        const n = Math.max(2, Math.round(W / 0.6));
        for(let i = 1; i < n; i++) R(i * W / n, 0, i * W / n, P, 'stroke="#8C8270" stroke-width=".6"');
        if(q.tipo === 'armario') R(0, P - 0.04, W, P - 0.04, 'stroke="#8C8270" stroke-width=".5"');
        break; }
      case 'escrivaninha': R(0, 0, W, P, 'rx="1" ' + MAD); R(W / 2 - 0.22, P + 0.08, W / 2 + 0.22, P + 0.5, 'rx="2" fill="#F1ECE2" stroke="#6F6A60" stroke-width=".8"'); break;
      case 'boxe': R(0, 0, W, P, 'fill="#E1EBF2" stroke="#7F9BB1" stroke-width=".9"'); C(W / 2, P / 2, 0.05, 'fill="#FFFFFF" stroke="#7F9BB1" stroke-width=".6"'); R(0, P, W, P, 'stroke="#7F9BB1" stroke-width="1.6"'); break;
      case 'bacia': { R(0.02, 0, W - 0.02, 0.18, 'rx="1" ' + LOU); const [x, y] = pt(W / 2, 0.4); el(x, y, hz ? 0.17 : 0.22, hz ? 0.22 : 0.17, LOU); break; }
      case 'lavatorio': case 'bancada': { R(0, 0, W, P, PEDRA); const n = q.tipo === 'bancada' && W >= 1.15 ? 2 : 1;
        for(let i = 0; i < n; i++){ const [x, y] = pt(W * (i + 0.5) / n, P * 0.55); el(x, y, hz ? 0.17 : 0.13, hz ? 0.13 : 0.17, LOU); } break; }
      case 'bancada-cozinha': {
        R(0, 0, W, P, PEDRA);
        const uc = Math.min(0.55, W * 0.25);   // cuba perto de uma ponta, cooktop no outro terço
        R(uc - 0.25, 0.12, uc + 0.25, 0.48, 'rx="2" ' + LOU);
        const uf = Math.max(uc + 0.7, W - 0.5);
        if(uf + 0.3 <= W) for(const [du, dv] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, 0.42], [0.15, 0.42]]) C(uf + du, dv, 0.08, 'fill="none" stroke="#3F3A35" stroke-width=".7"');
        break; }
      case 'geladeira': R(0, 0, W, P, 'rx="1.5" fill="#F4F4F2" stroke="#6F6A60" stroke-width=".9"'); R(0, P - 0.1, W, P - 0.1, 'stroke="#6F6A60" stroke-width=".5"'); break;
      case 'tanque': R(0, 0, W, P, 'rx="1.5" ' + BR); R(0.08, 0.08, W - 0.08, P - 0.12, 'rx="2" ' + LOU); break;
      case 'maquina': R(0, 0, W, P, 'rx="2" ' + BR); C(W / 2, P / 2, 0.22, 'fill="#E1EBF2" stroke="#6F6A60" stroke-width=".7"'); break;
      case 'rack': R(0, 0, W, P, 'rx="1" ' + MAD); R(W * 0.15, 0.05, W * 0.85, 0.12, 'fill="#2F333A"'); break;
      case 'sofa':
        R(0, 0, W, P, 'rx="4" fill="#C9D6CF" stroke="#6F6A60" stroke-width=".8"');
        R(0, 0, W, 0.22, 'rx="3" fill="#B3C5BB" stroke="#6F6A60" stroke-width=".6"');                        // encosto (lado da parede)
        R(0, 0, 0.2, P, 'rx="3" fill="#B3C5BB" stroke="#6F6A60" stroke-width=".6"'); R(W - 0.2, 0, W, P, 'rx="3" fill="#B3C5BB" stroke="#6F6A60" stroke-width=".6"');
        for(let i = 1; i < 3; i++) R(0.2 + i * (W - 0.4) / 3, 0.22, 0.2 + i * (W - 0.4) / 3, P, 'stroke="#9FB2A8" stroke-width=".5"');
        break;
      case 'mesa-centro': R(0, 0, W, P, 'rx="2" ' + MAD); break;
      case 'mesa-jantar': case 'mesa-externa': {
        const [cx, cy] = [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2];
        if(q.tipo === 'mesa-externa'){ c(cx, cy, 0.35, MAD); for(const s of [-1, 1]) c(q.eixo === 'x' ? cx + s * 0.6 : cx, q.eixo === 'x' ? cy : cy + s * 0.6, 0.2, BR); break; }
        const [mw, mh] = q.mesa || [1.2, 0.8], ex = q.eixo === 'x', tw = ex ? mw : mh, th = ex ? mh : mw, n = q.lugares || 4;
        const lado = n >= 8 ? 3 : 2, pontas = n > 4 ? 1 : 0;
        for(let i = 0; i < lado; i++){ const u = -mw / 2 + mw * (i + 0.5) / lado;
          for(const s of [-1, 1]){ const [x, y] = ex ? [cx + u, cy + s * (mh / 2 + 0.22)] : [cx + s * (mh / 2 + 0.22), cy + u]; r(x - (ex ? 0.2 : 0.18), y - (ex ? 0.18 : 0.2), x + (ex ? 0.2 : 0.18), y + (ex ? 0.18 : 0.2), 'rx="1.5" ' + BR); } }
        if(pontas) for(const s of [-1, 1]){ const [x, y] = ex ? [cx + s * (mw / 2 + 0.22), cy] : [cx, cy + s * (mw / 2 + 0.22)]; r(x - (ex ? 0.18 : 0.2), y - (ex ? 0.2 : 0.18), x + (ex ? 0.18 : 0.2), y + (ex ? 0.2 : 0.18), 'rx="1.5" ' + BR); }
        r(cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2, 'rx="2" fill="#E2D5BE" stroke="#8C7B5C" stroke-width=".9"');
        break; }
      case 'vaso': C(W / 2, P / 2, Math.min(W, P) * 0.42, 'fill="#C9B79C" stroke="#8C7B5C" stroke-width=".7"'); C(W / 2, P / 2, Math.min(W, P) * 0.32, 'fill="#7FA05A" fill-opacity=".9"'); break;
      case 'churrasqueira': R(0, 0, W, P, 'fill="#6B6660" stroke="#3F3A35" stroke-width=".8"'); for(let i = 1; i < 5; i++) R(0.1, i * P / 5, W - 0.1, i * P / 5, 'stroke="#B7B0A6" stroke-width=".5"'); break;
      case 'arvore': { const [cx, cy] = [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2], rr = Math.min(q.x1 - q.x0, q.y1 - q.y0) / 2;
        c(cx + 0.12, cy + 0.15, rr, 'fill="#3F5A2A" fill-opacity=".18"'); c(cx, cy, rr, 'fill="#8DB36A" stroke="#5E7D3A" stroke-width=".8"'); c(cx - rr * 0.25, cy - rr * 0.25, rr * 0.45, 'fill="#A9C987" fill-opacity=".8"'); break; }
      default: R(0, 0, W, P, 'rx="1.5" ' + BR);
    }
    o.push('</g>');
  }
  return o.join('');
}

function planta(v, idx, op){
  op = op || {};
  const p = v.pav[idx];
  const S = p.salas, T = Motor.TIPOS;
  const pocos = p.pocos || [];
  const extras = p.rampaFora ? [p.rampaFora] : [];
  // posição do pavimento no lote (casa ou edícula) para desenhar o terreno por baixo
  const L = v.lote; let lo = null;
  if(L){ const ed = p.anexo ? (v.anexos||[]).find(a => a.tipo==='edicula') : null;
    const ox = ed ? ed.x0 : v.x0, oy = ed ? ed.y0 : v.y0;
    if(ox !== undefined){ lo = {x0:-ox, y0:-oy, x1:L.frente-ox, y1:L.fundo-oy, rf:L.recFrente, rl:L.recX0 !== undefined ? L.recX0 : L.recLat, rr:L.recX1 !== undefined ? L.recX1 : L.recLat, rb:L.recFundo}; extras.push(lo); } }
  const mx0 = Math.min(0, ...pocos.map(q => q.x0), ...S.map(q => q.x0), ...extras.map(q => q.x0 - 1.6)), my0 = Math.min(0, ...pocos.map(q => q.y0), ...S.map(q => q.y0), ...extras.map(q => q.y0 - 1.2));
  const OX = 70 - mx0*K + (mx0<0 ? 12 : 0), OY = 96 - my0*K;
  const X = m => +(OX + m*K).toFixed(1), Y = m => +(OY + m*K).toFixed(1);
  const W = p.W || v.W, D = p.anexo ? p.D : Math.max(v.D, ...S.map(s => s.y1));
  const mx1 = Math.max(W, ...pocos.map(q => q.x1), ...S.map(q => q.x1), ...extras.map(q => q.x1)), my1 = Math.max(D, ...pocos.map(q => q.y1), ...S.map(q => q.y1), ...extras.map(q => q.y1));
  const larg = OX + mx1*K + 120, alt = OY + my1*K + 60 + (p.nome==='Subsolo' ? 34 : 0);
  const o = [];
  const line = (x0,y0,x1,y1,st,w,ex) => o.push(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="${st}" stroke-width="${w}"${ex?' '+ex:''}/>`);
  const seg = (e, st, w, ex) => e.o==='h' ? line(e.t0, e.c, e.t1, e.c, st, w, ex) : line(e.c, e.t0, e.c, e.t1, st, w, ex);
  const aberto = s => !!T[s.tipo].aberto;
  // no subsolo o desenho mostra só rampa, vagas, escada/elevador e jardim; o resto é piso neutro
  const ehSub = p.nome==='Subsolo', MOSTRA = new Set(['rampa','garagem','escada','elevador','jardim']);
  // humanizada: pisos com textura, paredes de 10/15 cm, móveis, vegetação e sombra; o subsolo mantém as cores técnicas
  const hum = op.estilo === 'humanizada' && !!Mobilia, hz = hum ? 'hz' + (++HZN) + '_' : '';
  const WI = hum ? PAREDE_INT : 3.2, WE = hum ? PAREDE_EXT : 6;
  if(hum) o.push(hzDefs(hz));
  const oculto = s => false;

  // terreno: lote, área edificável e rua
  if(lo){
    o.push(`<rect x="${X(lo.x0)}" y="${Y(lo.y0)}" width="${((lo.x1-lo.x0)*K).toFixed(1)}" height="${((lo.y1-lo.y0)*K).toFixed(1)}" fill="#EEF2E8" stroke="#5F7350" stroke-width="1.2"><title>Lote ${f2(L.frente)} × ${f2(L.fundo)} m</title></rect>`);
    o.push(`<rect x="${X(lo.x0+lo.rl)}" y="${Y(lo.y0+lo.rf)}" width="${((lo.x1-lo.x0-lo.rl-lo.rr)*K).toFixed(1)}" height="${((lo.y1-lo.y0-lo.rf-lo.rb)*K).toFixed(1)}" fill="none" stroke="#5F7350" stroke-width=".7" stroke-dasharray="5 4"><title>Área edificável</title></rect>`);
    o.push(`<text x="${((X(lo.x0)+X(lo.x1))/2).toFixed(1)}" y="${(Y(lo.y0)-16).toFixed(1)}" class="cota" style="font-size:7.4px;font-weight:600;fill:#5F7350">RUA</text>`);
  }
  // rooftop: pavimento de baixo esmaecido, para dar proporção
  if(p.base){ for(const b of p.base){ const c = COR[b.zona] || COR.apoio;
    o.push(`<rect x="${X(b.x0)}" y="${Y(b.y0)}" width="${((b.x1-b.x0)*K).toFixed(1)}" height="${((b.y1-b.y0)*K).toFixed(1)}" fill="${c[0]}" stroke="${c[1]}" stroke-width=".6" opacity=".25"/>`); }
    o.push(`<text x="${X(Math.min(...p.base.map(b=>b.x0)))}" y="${Y(Math.max(...p.base.map(b=>b.y1))) + 12}" style="font-size:6.6px;fill:#7B828C">pavimento de baixo (esmaecido)</text>`); }
  // pátios (H)
  if(idx===v.pav.findIndex(q => q.nome==='Térreo') && v.patios) for(const pt of v.patios) if(pt.y1-pt.y0>0.5)
    o.push(`<rect x="${X(pt.x0)}" y="${Y(pt.y0)}" width="${((pt.x1-pt.x0)*K).toFixed(1)}" height="${((pt.y1-pt.y0)*K).toFixed(1)}" fill="${hum ? `url(#${hz}grama)` : COR.patio[0]}" stroke="${COR.patio[1]}"><title>Pátio</title></rect>`);
  // acessos por cima dos pátios (no H o caminho atravessa o pátio até a entrada)
  if(lo && p.nome==='Térreo') desenhaAcessos(v.acessos, X, Y, K, o);
  // pátios ingleses do subsolo
  for(const pc of pocos){
    o.push(`<rect x="${X(pc.x0)}" y="${Y(pc.y0)}" width="${((pc.x1-pc.x0)*K).toFixed(1)}" height="${((pc.y1-pc.y0)*K).toFixed(1)}" fill="${COR.patio[0]}" stroke="${COR.patio[1]}" stroke-dasharray="4 3"><title>Pátio inglês ${f2(Math.min(pc.x1-pc.x0, pc.y1-pc.y0))} m</title></rect>`);
    const vert = (pc.y1-pc.y0) > (pc.x1-pc.x0), cx = (X(pc.x0)+X(pc.x1))/2, cy = (Y(pc.y0)+Y(pc.y1))/2;
    o.push(vert ? `<text transform="translate(${cx+2.5},${cy}) rotate(-90)" class="rd" style="font-size:6.4px;font-weight:600">PÁTIO INGLÊS</text>` : `<text x="${cx}" y="${cy+2.5}" class="rd" style="font-size:6.4px;font-weight:600">PÁTIO INGLÊS</text>`);
  }
  // ambientes
  if(hum && !ehSub){ const sb = [];
    for(const s of S.filter(x => !aberto(x))) for(const e of Motor._interno.trechosExternos(s, S)){
      const [x0, y0, x1, y1] = e.o==='h' ? [e.t0, e.c, e.t1, e.c] : [e.c, e.t0, e.c, e.t1];
      sb.push(`<line x1="${X(x0) + 3}" y1="${Y(y0) + 4}" x2="${X(x1) + 3}" y2="${Y(y1) + 4}" stroke="#2B2F36" stroke-width="10"/>`); }
    o.push(`<g filter="url(#${hz}sombra)" opacity=".28">${sb.join('')}</g>`); }
  // rampa: trecho no recuo frontal, desenhado em escala e tracejado
  if(p.rampaFora){ const rf = p.rampaFora;
    o.push(`<rect x="${X(rf.x0)}" y="${Y(rf.y0)}" width="${((rf.x1-rf.x0)*K).toFixed(1)}" height="${((rf.y1-rf.y0)*K).toFixed(1)}" fill="${SUB_COR.rampa[0]}" fill-opacity=".6" stroke="${SUB_COR.rampa[1]}" stroke-dasharray="4 3"><title>Rampa no recuo frontal: ${f2(rf.y1-rf.y0)} m</title></rect>`);
    for(let y = rf.y0 + 0.5; y < rf.y1; y += 0.5) line(rf.x0, y, rf.x1, y, SUB_COR.rampa[1], .5);
    o.push(`<text x="${(X(rf.x0)+X(rf.x1))/2}" y="${Y(rf.y0)-4}" class="rd" style="font-size:6.4px;fill:${SUB_COR.rampa[1]}">rua</text>`); }
  for(const s of S){
    if(ehSub){ const c = subCor(s.tipo);
      o.push(`<rect x="${X(s.x0)}" y="${Y(s.y0)}" width="${((s.x1-s.x0)*K).toFixed(1)}" height="${((s.y1-s.y0)*K).toFixed(1)}" fill="${c[0]}" stroke="${s.tipo==='hall' ? c[0] : c[1]}" stroke-width="${s.tipo==='rampa' ? 1.6 : 1}"${s.tipo==='manobra' ? ' stroke-dasharray="5 3"' : ''}><title>${esc(s.nome)}: ${f2(s.x1-s.x0)} × ${f2(s.y1-s.y0)} = ${f2(Motor.area(s))} m²</title></rect>`); continue; }
    if(oculto(s)){ o.push(`<rect x="${X(s.x0)}" y="${Y(s.y0)}" width="${((s.x1-s.x0)*K).toFixed(1)}" height="${((s.y1-s.y0)*K).toFixed(1)}" fill="#ECEAE5" stroke="#ECEAE5" stroke-width="1"/>`); continue; }
    const c = COR[s.zona] || COR.apoio, a = Motor.area(s);
    o.push(`<rect x="${X(s.x0)}" y="${Y(s.y0)}" width="${((s.x1-s.x0)*K).toFixed(1)}" height="${((s.y1-s.y0)*K).toFixed(1)}" fill="${hum ? `url(#${hz}${pisoDe(s.tipo)})` : c[0]}" stroke="${hum ? 'none' : c[1]}" stroke-width="1"><title>${esc(s.nome)}: ${f2(s.x1-s.x0)} × ${f2(s.y1-s.y0)} = ${f2(a)} m²</title></rect>`);
  }
  // banho acessível (opção de acessibilidade): giro de 1,50 m no centro
  for(const s of S.filter(x => x.acessivel)) o.push(`<circle cx="${X((s.x0+s.x1)/2)}" cy="${Y((s.y0+s.y1)/2)}" r="${(0.75*K).toFixed(1)}" fill="#9A5B45" fill-opacity=".06" stroke="#9A5B45" stroke-width="1" stroke-dasharray="4 3"><title>Banho acessível: giro de 1,50 m, transferência lateral à bacia e boxe de 0,90 × 0,95 m (NBR 9050)</title></circle>`);
  // mobiliário mínimo: carros, escadas, rampas, camas
  for(const s of S){
    const w = s.x1-s.x0, h = s.y1-s.y0;
    if(s.tipo==='garagem'){
      const n = s.vaga ? 1 : (s.vagas || Math.max(1, Math.floor(w/2.5)));
      // o carro fica perpendicular à face por onde entra: garagem aberta para a rua (fachada frontal) tem os carros de frente para ela
      const ext = Motor._interno.trechosExternos(s, S), abreFrente = ext.some(e => e.lado==='y0' && e.t1-e.t0 >= 2.4), abreLado = ext.some(e => (e.lado==='x0'||e.lado==='x1') && e.t1-e.t0 >= 4.5);
      const vert = s.vaga ? h >= w : abreFrente || (!abreLado && h >= w);
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
    if(s.tipo==='elevador'){
      line(s.x0+0.15, s.y0+0.15, s.x1-0.15, s.y1-0.15, '#6B7280', .8); line(s.x0+0.15, s.y1-0.15, s.x1-0.15, s.y0+0.15, '#6B7280', .8);
      o.push(`<text x="${(X(s.x0)+X(s.x1))/2}" y="${(Y(s.y0)+Y(s.y1))/2+2.5}" class="rd" style="font-size:6px;font-weight:600">ELEV.</text>`);
    }
    if(s.tipo==='rampa'){
      for(let y=s.y0+0.5;y<s.y1;y+=0.5) line(s.x0, y, s.x1, y, ehSub ? '#C08A3E' : '#A39C90', .6);
      const rp = p.rampa, y0t = p.rampaFora ? p.rampaFora.y0 : s.y0;
      o.push(`<text transform="translate(${(X(s.x0)+X(s.x1))/2+3},${(Y(y0t)+Y(s.y1))/2}) rotate(-90)" class="rd" style="font-size:7px;font-weight:600">RAMPA ${s.inclinacao||20}% · ${rp ? f2(rp.L) + ' m' : ''}${rp && rp.Lout > 0.05 ? ' (' + f2(rp.Lout) + ' no recuo)' : ''}</text>`);
    }
    if(!hum && ['suite','master','quarto'].includes(s.tipo) && w >= 2.6 - 0.005 && h >= 2.6 - 0.005){   // folga: 2,60 m chega como 2,5999…
      const dupla = s.tipo!=='quarto', bw = dupla ? (s.tipo==='master'?1.9:1.6) : 1.0, bl = 2.0;
      // cabeceira na parede mais longa que não seja do corredor: centraliza
      const horiz = w >= h;
      const cx = (s.x0+s.x1)/2, cy = (s.y0+s.y1)/2;
      if(horiz){ o.push(`<rect x="${X(cx-bw/2)}" y="${Y(cy-bl/2)}" width="${bw*K}" height="${bl*K}" rx="2" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`); }
      else { o.push(`<rect x="${X(cx-bl/2)}" y="${Y(cy-bw/2)}" width="${bl*K}" height="${bw*K}" rx="2" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`); }
    }
  }
  if(ehSub){
    const rp = S.find(s => s.tipo==='rampa'), mans = S.filter(s => s.tipo==='manobra').sort((a,b) => Motor.area(b) - Motor.area(a)), m = mans[0];
    const AZ = '#1F3A5A';
    const seta = (x0, y0, x1, y1, cor, w) => { line(x0, y0, x1, y1, cor, w, 'stroke-linecap="round"');
      const ang = Math.atan2(Y(y1) - Y(y0), X(x1) - X(x0)), L = 7, a = 0.45;
      o.push(`<path d="M${X(x1)},${Y(y1)} L${(X(x1) - L*Math.cos(ang - a)).toFixed(1)},${(Y(y1) - L*Math.sin(ang - a)).toFixed(1)} L${(X(x1) - L*Math.cos(ang + a)).toFixed(1)},${(Y(y1) - L*Math.sin(ang + a)).toFixed(1)} Z" fill="${cor}"/>`); };
    if(rp){ const cx = (rp.x0 + rp.x1)/2, y0 = p.rampaFora ? p.rampaFora.y0 + 0.4 : rp.y0 + 0.4;
      seta(cx - 0.9, y0, cx - 0.9, rp.y1 - 0.3, SUB_COR.rampa[1], 1.6);
      o.push(`<text transform="translate(${X(cx - 0.9) - 4},${(Y(y0) + Y(rp.y1))/2}) rotate(-90)" class="rd" style="font-size:6px;font-weight:600;fill:${SUB_COR.rampa[1]}">DESCE</text>`); }
    // manobra: hachura, setas de ida e volta no sentido maior de cada trecho e setas curtas entrando em cada vaga
    o.push(`<defs><pattern id="hachManobra" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9AA6B4" stroke-width="1"/></pattern></defs>`);
    for(const t of mans){
      o.push(`<rect x="${X(t.x0)}" y="${Y(t.y0)}" width="${((t.x1-t.x0)*K).toFixed(1)}" height="${((t.y1-t.y0)*K).toFixed(1)}" fill="url(#hachManobra)" fill-opacity=".55"/>`);
      const w = t.x1 - t.x0, h = t.y1 - t.y0, cx = (t.x0 + t.x1)/2, cy = (t.y0 + t.y1)/2;
      if(Math.max(w, h) < 2.4) continue;
      if(w >= h){ seta(cx, cy, t.x0 + 0.4, cy, AZ, 1.3); seta(cx, cy, t.x1 - 0.4, cy, AZ, 1.3); }
      else { seta(cx, cy, cx, t.y0 + 0.4, AZ, 1.3); seta(cx, cy, cx, t.y1 - 0.4, AZ, 1.3); }
    }
    for(const vg of S.filter(x => x.vaga)){
      const t = mans.map(x => ({x, sh: compartilhado(vg, x)})).find(z => z.sh && z.sh.t1 - z.sh.t0 >= 1.5); if(!t) continue;
      const sh = t.sh, mid = (sh.t0 + sh.t1)/2;
      if(sh.o === 'h'){ const dir = (vg.y0 + vg.y1)/2 > sh.c ? 1 : -1; seta(mid, sh.c - dir*0.9, mid, sh.c + dir*0.7, AZ, 1.3); }
      else { const dir = (vg.x0 + vg.x1)/2 > sh.c ? 1 : -1; seta(sh.c - dir*0.9, mid, sh.c + dir*0.7, mid, AZ, 1.3); }
    }
    // medidas de cada faixa: manobra, corredor, acesso da rampa e circulações (deitado nas faixas em pé)
    for(const t of mans){
      const w = t.x1 - t.x0, h = t.y1 - t.y0, deit = h > w * 1.3, comp = Math.max(w, h), larg = Math.min(w, h);
      if(comp < 1.8 || larg < 0.8) continue;
      const nome = t === m ? 'MANOBRA' : (t.nome || 'Circulação').toUpperCase(), principal = t === m || /MANOBRA/.test(nome);
      const txt = `${nome} ${f2(w)} × ${f2(h)} m`, fs = principal ? 7.4 : 6, cx = (X(t.x0) + X(t.x1))/2, cy = (Y(t.y0) + Y(t.y1))/2;
      if(txt.length * fs * 0.55 > (deit ? h : w) * K * 0.92) continue;   // não cabe: a dica do retângulo mostra a medida
      o.push(deit ? `<text transform="translate(${(cx - 5).toFixed(1)},${cy.toFixed(1)}) rotate(-90)" class="rn" style="font-size:${fs}px;fill:${AZ};paint-order:stroke;stroke:#FBFAF7;stroke-width:2.4px">${txt}</text>`
                  : `<text x="${cx.toFixed(1)}" y="${(cy - 5).toFixed(1)}" class="rn" style="font-size:${fs}px;fill:${AZ};paint-order:stroke;stroke:#FBFAF7;stroke-width:2.4px">${txt}</text>`);
    }
  }
  const pecasHum = hum && !ehSub ? Mobilia.pavimento(p) : [];
  if(pecasHum.length) o.push(hzMoveis(pecasHum, X, Y));
  // paredes internas e vãos livres
  const livres = (p.vaos||[]).filter(e => e.livre);
  for(let i=0;i<S.length;i++) for(let j=i+1;j<S.length;j++){
    const a = S[i], b = S[j], sh = compartilhado(a, b); if(!sh) continue;
    if(ehSub && !(a.tipo==='elevador' || b.tipo==='elevador')) continue;   // subsolo sem paredes internas, só o poço do elevador
    if(aberto(a) && aberto(b)) continue;
    const e = {o:sh.o, c:sh.c, t0:sh.t0, t1:sh.t1};
    if(livres.some(l => l.o===e.o && Math.abs(l.c-e.c)<0.001 && l.t0<=e.t0+0.001 && l.t1>=e.t1-0.001)) { seg(e, '#B7BAC2', .8, 'stroke-dasharray="3 3"'); continue; }
    if(aberto(a) || aberto(b)) { seg(e, PAREDE, WE, 'stroke-linecap="square"'); continue; }
    seg(e, PAREDE, WI, 'stroke-linecap="square"');
  }
  // fachada
  const fech = S.filter(s => !aberto(s));
  if(ehSub && p.dim){
    // subsolo: só o contorno externo, aberto na boca da rampa
    const d = p.dim, x0 = d.x0||0, y0 = d.y0||0, x1 = x0 + d.W, y1 = y0 + d.D;
    const rp = S.find(s => s.tipo==='rampa');
    const frente = rp ? [[x0, rp.x0], [rp.x1, x1]] : [[x0, x1]];
    for(const [a0,a1] of frente) if(a1 - a0 > 0.05) seg({o:'h', c:y0, t0:a0, t1:a1}, PAREDE, WE, 'stroke-linecap="square"');
    seg({o:'h', c:y1, t0:x0, t1:x1}, PAREDE, WE, 'stroke-linecap="square"');
    seg({o:'v', c:x0, t0:y0, t1:y1}, PAREDE, WE, 'stroke-linecap="square"');
    seg({o:'v', c:x1, t0:y0, t1:y1}, PAREDE, WE, 'stroke-linecap="square"');
    const jd = S.find(s => s.tipo==='jardim'); if(jd) for(const e of Motor._interno.trechosExternos(jd, S)) seg(e, '#5E7D3A', 1.3, 'stroke-dasharray="4 3"');
  } else for(const s of S){
    for(const e of Motor._interno.trechosExternos(s, S)){
      if(aberto(s)) seg(e, '#C8B08A', 1.3, 'stroke-dasharray="4 3"');
      else seg(e, PAREDE, WE, 'stroke-linecap="square"');
    }
  }
  if(p.nome==='Térreo' && v.acessos) for(const r of v.acessos.vias.filter(r => r.tipo==='garagem')){
    seg({o:'h', c:r.y1, t0:r.x0 + 0.15, t1:r.x1 - 0.15}, PISO, 6.6);
    seg({o:'h', c:r.y1, t0:r.x0 + 0.15, t1:r.x1 - 0.15}, AC.veiculos, 1.2, 'stroke-dasharray="5 3"');
  }
  // vãos parciais (closet), portas e janelas
  if(!ehSub) for(const e of (p.vaos||[]).filter(e => !e.livre)) seg(e, PISO, 4.4);
  for(const e of (p.janelas||[])){
    seg(e, '#FFFFFF', 6.4);
    if(e.vidro){ seg(e, JAN, 4, 'stroke-opacity=".28"'); seg(e, JAN, 1.2); }
    else seg(e, JAN, 1.4, e.alta ? 'stroke-dasharray="3 2"' : '');
  }
  // brises (op.brises, de Brises.estudar): linha tracejada 0,30 m para fora de cada janela protegida
  for(const b of (op.brises || []).filter(b => b.pav === p.nome)){
    const fora = b.lado === 'x0' || b.lado === 'y0' ? -0.3 : 0.3;
    const c = b.c + fora, a = b.t0 - 0.15, z = b.t1 + 0.15, [x0, y0, x1, y1] = b.o === 'h' ? [a, c, z, c] : [c, a, c, z];
    o.push(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="#4C6E8F" stroke-width="1.8" stroke-dasharray="4 2"><title>Brise ${esc(b.nomeTipo || '')}</title></line>`);
  }
  for(const d of (ehSub ? [] : (p.portas||[]))){
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
  // rooftop: fechamento (parede ou brise) nas bordas abertas voltadas para o poente
  const fechOeste = p.fechamentos && (v.espelhada ? p.fechamentos.espelhada : p.fechamentos.normal);
  for(const e of (fechOeste || [])){ const [ax, ay, bx, by] = e.o==='h' ? [e.t0, e.c, e.t1, e.c] : [e.c, e.t0, e.c, e.t1];
    o.push(`<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}" stroke="#9A5B45" stroke-width="5" stroke-linecap="square"><title>${e.motivo === 'divisa' ? 'Fechamento na divisa: borda aberta a menos de 1,50 m do vizinho (Código Civil, art. 1.301)' : 'Fechamento a oeste (parede ou brise): o rooftop não se abre para o poente'}</title></line>`); }
  // spa do rooftop
  if(p.spa) o.push(`<circle cx="${X(p.spa.x)}" cy="${Y(p.spa.y)}" r="${p.spa.r*K}" fill="#CFE6F2" stroke="#4C86C6" stroke-width="1.2"><title>Spa</title></circle><text x="${X(p.spa.x)}" y="${Y(p.spa.y)+2.5}" class="rd" style="font-size:6.4px;font-weight:600">SPA</text>`);
  // pilares (subsolo)
  if(!ehSub) for(const pl of (p.pilares||[])) o.push(`<rect x="${(X(pl.x)-5.5).toFixed(1)}" y="${(Y(pl.y)-5.5).toFixed(1)}" width="11" height="11" fill="#111318" stroke="#FFFFFF" stroke-width="1.2"><title>Pilar</title></rect>`);
  if(p.manobra && !ehSub) o.push(`<text x="${X(W)-6}" y="${Y(p.manobra.y0)+10}" class="rd" style="font-size:6px;text-anchor:end;fill:#57534E">faixa de manobra livre, sem pilares</text>`);
  // camada animada (sol e vento): grupo vazio no sistema da casa, preenchido por gerador/animacao.js com X = ox + m·k, Y = oy + m·k
  if(op.camadaId) o.push(`<g id="${esc(op.camadaId)}" data-ox="${OX}" data-oy="${OY}" data-k="${K}" pointer-events="none"></g>`);
  // rótulos
  for(const s of S){
    const w = s.x1-s.x0, h = s.y1-s.y0, a = w*h;
    if(s.tipo==='escada' || s.tipo==='rampa' || s.tipo==='elevador' || oculto(s)) continue;
    if(ehSub && (s.tipo==='hall' || s.tipo==='manobra')) continue;   // a manobra tem rótulo próprio, junto das setas
    let cx = (X(s.x0)+X(s.x1))/2, cy = (Y(s.y0)+Y(s.y1))/2;
    const nome = esc((s.nome||'').toUpperCase());
    const pw = w*K, ph = h*K;
    if(['circ','galeria'].includes(s.tipo) && ph > pw*2.5){
      o.push(`<text transform="translate(${cx+2.5},${cy}) rotate(-90)" class="rn" style="font-size:6.4px">${nome} ${f2(Math.min(w,h))}</text>`); continue;
    }
    if(pw < 34 || ph < 18){ if(pw >= 22 && ph >= 12) o.push(`<text x="${cx}" y="${cy+2.5}" class="rd" style="font-size:5.6px">${f2(a)}</text>`); continue; }
    const big = pw >= 70 && ph >= 34;
    const fs = big ? 8.2 : 6.4;
    const sub = big && !hum ? `${f2(w)} × ${f2(h)} · ${f2(a)} m²` : `${f2(a)} m²`;
    const bw = Math.min(pw-4, Math.max(nome.length*fs*0.66, sub.length*(big?3.7:3.4)) + 8);
    // humanizada: o rótulo procura um lugar do cômodo sem móvel (centro, depois terços), para não cobrir cama ou mesa
    if(hum){ const ps = pecasHum.filter(q => q.sala === s.id).map(q => ({x0:X(q.x0), x1:X(q.x1), y0:Y(q.y0), y1:Y(q.y1)}));
      const livre = (x, y) => x - bw/2 >= X(s.x0) + 3 && x + bw/2 <= X(s.x1) - 3 && y - fs - 2 >= Y(s.y0) + 3 && y + 10 <= Y(s.y1) - 3
        && !ps.some(r => x - bw/2 < r.x1 && x + bw/2 > r.x0 && y - fs - 2 < r.y1 && y + 10 > r.y0);
      const c0 = [cx, cy], alvo = [[0,0],[0,-.25],[0,.25],[-.25,0],[.25,0],[0,-.35],[0,.35],[-.32,0],[.32,0],[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]].map(([dx, dy]) => [c0[0] + dx*pw, c0[1] + dy*ph]).find(([x, y]) => livre(x, y));
      if(alvo){ cx = +alvo[0].toFixed(1); cy = +alvo[1].toFixed(1); } }
    o.push(`<rect x="${(cx-bw/2).toFixed(1)}" y="${(cy-fs-2).toFixed(1)}" width="${bw.toFixed(1)}" height="${(fs+12).toFixed(1)}" rx="2" fill="#FFFFFF" fill-opacity=".8"/>`);
    o.push(`<text x="${cx}" y="${cy}" class="rn" style="font-size:${fs}px">${nome}<tspan x="${cx}" dy="8.5" class="rd" style="font-size:${big?6.6:5.8}px;font-weight:400">${sub}</tspan></text>`);
  }
  // cotas
  const cota = (a0, a1, pos, t, vert) => {
    if(!vert){ line(a0, pos, a1, pos, '#55595F', .7); for(const a of [a0,a1]) line(a, pos-.12, a, pos+.12, '#55595F', .7);
      o.push(`<text x="${((X(a0)+X(a1))/2).toFixed(1)}" y="${Y(pos)-3}" class="cota">${t}</text>`); }
    else { line(pos, a0, pos, a1, '#55595F', .7); for(const a of [a0,a1]) line(pos-.12, a, pos+.12, a, '#55595F', .7);
      o.push(`<text transform="translate(${X(pos)-3},${((Y(a0)+Y(a1))/2).toFixed(1)}) rotate(-90)" class="cota">${t}</text>`); }
  };
  if(p.dim && p.dim.x0 !== undefined){ const d = p.dim; cota(d.x0, d.x0 + d.W, Math.min(-0.9, d.y0 - 0.9, p.rampaFora ? p.rampaFora.y0 - 1.3 : 0), f2(d.W)); } else cota(0, W, -0.9, f2(W));
  if(p.dim && p.dim.y0 !== undefined){ const d = p.dim; cota(d.y0, d.y0 + d.D, Math.min(-1.4, d.x0 - 1.4), f2(d.D), true); } else cota(0, D, -1.4, f2(D), true);
  const ys = (v.cotasY||[]).filter(y => y<=D+0.01);
  if(p.nome==='Térreo') for(let i=0;i<ys.length-1;i++) if(ys[i+1]-ys[i] > 0.6) cota(ys[i], ys[i+1], -0.75, f2(ys[i+1]-ys[i]), true);

  if(v.torre && !p.anexo && p.nome!=='Subsolo'){ const t = v.torre;
    o.push(`<rect x="${X(t.x0)}" y="${Y(t.y0)}" width="${((t.x1-t.x0)*K).toFixed(1)}" height="${((t.y1-t.y0)*K).toFixed(1)}" fill="#F2E3DC" fill-opacity="${p.nome==='Rooftop'?0.9:0.35}" stroke="#9A5B45" stroke-width="1.4" stroke-dasharray="${p.nome==='Rooftop'?'':'4 2'}"><title>Torre de ar: ${t.nome || 'chaminé'}</title></rect>`);
    o.push(`<text x="${((X(t.x0)+X(t.x1))/2).toFixed(1)}" y="${(Y(t.y1)+8).toFixed(1)}" class="rd" style="font-size:6px;font-weight:600;fill:#9A5B45">TORRE · ${(t.curto || 'chaminé').toUpperCase()}</text>`); }
  const fora = [];
  const legY = () => 0;
  if(ehSub){ let lx = 0, ly = 0;
    for(const t of ['rampa','manobra','garagem','escada','elevador','jardim']){ const c = SUB_COR[t];
      fora.push(`<rect x="${lx}" y="${ly-7}" width="11" height="9" rx="2" fill="${c[0]}" stroke="${c[1]}"/><text x="${lx+15}" y="${ly}" style="font-size:7px;fill:#43474D">${c[2]}</text>`); lx += 24 + c[2].length*3.9; } }
  const titulo = op.titulo || `${v.nome} · ${p.nome}`;
  const sub = op.sub || (p.anexo ? `Edícula ${f2(W)} × ${f2(D)} m · frente voltada para a casa · escala ${K} px/m` : `${v.tipologia} · casa ${f2(W)} × ${f2(v.D)} m · escala ${K} px/m${v.espelhada?' · espelhada':''}`);
  const rumoP = op.rumo !== undefined ? op.rumo : v.rumo, F = rumoGraus(rumoP);
  const px0 = X(mx0) - 6, py0 = Y(my0) - 6, px1 = OX + mx1*K + 12, py1 = OY + my1*K + 12;
  const gg = girado(o.join('\n'), F, px0, py0, px1, py1, 20, 64);
  const LW = Math.ceil(gg.Wr + 150), LH = Math.ceil(gg.Hr + 64 + 24 + (fora.length ? 26 : 0));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LW} ${LH}" width="${LW}" height="${LH}" role="img" aria-label="${esc(titulo)}">
<title>${esc(titulo)}</title><style>text{font-family:"IBM Plex Sans","Inter","Segoe UI",Helvetica,Arial,sans-serif;fill:#2F333A}.tt{font-size:15px;font-weight:600}.st{font-size:8.6px;fill:#5d6168}.rn{font-weight:600;text-anchor:middle;letter-spacing:.2px}.rd{text-anchor:middle;fill:#4a4e55}.cota{font-size:6.6px;text-anchor:middle;fill:#55595F}.halo text{paint-order:stroke;stroke:#FBFAF7;stroke-width:2.4px;stroke-linejoin:round}</style>
<rect width="100%" height="100%" fill="#FBFAF7"/>
<text x="20" y="30" class="tt">${esc(titulo)}</text>
<text x="20" y="46" class="st">${esc(sub)}${F ? ' · planta girada: norte para cima' : ''}</text>
${gg.g}
${rosa(LW - 62, 110, 26, rumoP)}
${ventoSetas(20 + gg.Wr, 64, gg.Hr)}
${fora.length ? `<g transform="translate(20,${LH - 14})">${fora.join('')}</g>` : ''}
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
  o.push(`<rect x="${X(q.recX0 !== undefined ? q.recX0 : q.recLat)}" y="${Y(q.recFrente)}" width="${(B*k).toFixed(1)}" height="${(Dmax*k).toFixed(1)}" fill="none" stroke="#5F7350" stroke-dasharray="4 3"><title>Área edificável ${f2(B)} × ${f2(Dmax)} m</title></rect>`);
  const ter = v.pav.find(p => p.nome==='Térreo');
  for(const s of ter.salas){ const c = COR[s.zona]||COR.apoio;
    o.push(`<rect x="${X(v.x0+s.x0)}" y="${Y(v.y0+s.y0)}" width="${((s.x1-s.x0)*k).toFixed(1)}" height="${((s.y1-s.y0)*k).toFixed(1)}" fill="${c[0]}" stroke="${c[1]}" stroke-width=".5"/>`); }
  // acessos: faixas de veículos, vagas descobertas, caminho e portões (coordenadas da casa → lote)
  desenhaAcessos(v.acessos, m => X(v.x0 + m), m => Y(v.y0 + m), k, o, true);
  const rt = v.pav.find(p => p.nome==='Rooftop');
  if(rt){ const xs = rt.salas.map(s => [s.x0, s.x1]).flat(), ys = rt.salas.map(s => [s.y0, s.y1]).flat();
    const a0 = Math.min(...xs), a1 = Math.max(...xs), b0 = Math.min(...ys), b1 = Math.max(...ys);
    o.push(`<rect x="${X(v.x0+a0)}" y="${Y(v.y0+b0)}" width="${((a1-a0)*k).toFixed(1)}" height="${((b1-b0)*k).toFixed(1)}" fill="none" stroke="#B4532A" stroke-width="1.4" stroke-dasharray="4 2"><title>Rooftop ${f2(rt.area)} m²</title></rect>`);
    o.push(`<text x="${X(v.x0+(a0+a1)/2)}" y="${Y(v.y0+b0)-3}" class="cota" style="fill:#B4532A">rooftop</text>`); }
  const sub = v.pav.find(p => p.nome==='Subsolo');
  if(sub) for(const pc of (sub.pocos||[])){ const ax0 = v.espelhada ? v.x0 + v.W - pc.x1 : v.x0 + pc.x0;
    o.push(`<rect x="${X(ax0)}" y="${Y(v.y0+pc.y0)}" width="${((pc.x1-pc.x0)*k).toFixed(1)}" height="${((pc.y1-pc.y0)*k).toFixed(1)}" fill="#D6E4CC" stroke="#5F7350" stroke-dasharray="2 2"><title>Pátio inglês do subsolo</title></rect>`); }
  if(sub){ const jd = sub.salas.find(s => s.tipo==='jardim'); if(jd) o.push(`<rect x="${X(v.x0+jd.x0)}" y="${Y(v.y0+jd.y0)}" width="${((jd.x1-jd.x0)*k).toFixed(1)}" height="${((jd.y1-jd.y0)*k).toFixed(1)}" fill="${COR.patio[0]}" stroke="${COR.patio[1]}"><title>Jardim de inverno do subsolo</title></rect>`); }
  if(sub && sub.dim){ const d = sub.dim;
    o.push(`<rect x="${X(v.x0+(d.x0||0))}" y="${Y(v.y0+(d.y0||0))}" width="${(d.W*k).toFixed(1)}" height="${(d.D*k).toFixed(1)}" fill="none" stroke="#44403C" stroke-width="1" stroke-dasharray="6 3"><title>Subsolo ${f2(d.W)} × ${f2(d.D)} m</title></rect>`); }
  if(sub && sub.rampa && q.subGaragem){
    const rx = v.x0 + (sub.rampa.x0 !== undefined ? sub.rampa.x0 : 0);
    o.push(`<rect x="${X(rx)}" y="${Y(q.recFrente + ((sub.dim && sub.dim.y0) || 0) - sub.rampa.Lout)}" width="${3*k}" height="${(sub.rampa.Lout*k).toFixed(1)}" fill="#E9E6E1" stroke="#A39C90"><title>Rampa externa ${f2(sub.rampa.Lout)} m</title></rect>`);
  }
  for(const a of (v.anexos||[])){
    if(a.tipo==='piscina'){
      o.push(`<rect x="${X(a.x0)}" y="${Y(a.y0)}" width="${((a.x1-a.x0)*k).toFixed(1)}" height="${((a.y1-a.y0)*k).toFixed(1)}" fill="#EDE3D1" stroke="#C8B08A" stroke-width=".6"><title>Deck</title></rect>`);
      const px0 = a.x0 + a.deck + (a.espelhado ? a.pr : 0), py0 = a.y0 + a.deck, pc = a.C, pl = a.L;
      const fill = 'fill="#CFE6F2" stroke="#4C86C6" stroke-width="1"';
      const tit = `<title>Piscina ${a.forma} ${f2(pc)} × ${f2(pl)} × ${f2(a.P)} m · lâmina ${f2(a.lamina)} m² · ${f2(a.volume)} m³</title>`;
      if(a.forma==='oval') o.push(`<ellipse cx="${X(px0+pc/2)}" cy="${Y(py0+pl/2)}" rx="${(pc/2*k).toFixed(1)}" ry="${(pl/2*k).toFixed(1)}" ${fill}>${tit}</ellipse>`);
      else if(a.forma==='L'){ const nx = pc*0.4, ny = pl*0.45;
        o.push(`<path d="M${X(px0)},${Y(py0)} H${X(px0+pc)} V${Y(py0+pl-ny)} H${X(px0+pc-nx)} V${Y(py0+pl)} H${X(px0)} Z" ${fill}>${tit}</path>`); }
      else o.push(`<rect x="${X(px0)}" y="${Y(py0)}" width="${(pc*k).toFixed(1)}" height="${(pl*k).toFixed(1)}" rx="${a.forma==='raia'?1:2}" ${fill}>${tit}</rect>`);
      if(a.pr){ const prx = a.espelhado ? px0 - a.pr : px0 + pc; o.push(`<rect x="${X(prx)}" y="${Y(py0)}" width="${(a.pr*k).toFixed(1)}" height="${(pl*k).toFixed(1)}" fill="#E4F1F8" stroke="#4C86C6" stroke-width=".7" stroke-dasharray="2 2"><title>Prainha 1,50 m</title></rect>`); }
      o.push(`<text x="${X(px0+pc/2)}" y="${Y(py0+pl/2)+3}" class="cota">piscina</text>`);
    } else {
      const c = a.tipo==='edicula' ? COR.apoio : COR.varanda;
      o.push(`<rect x="${X(a.x0)}" y="${Y(a.y0)}" width="${((a.x1-a.x0)*k).toFixed(1)}" height="${((a.y1-a.y0)*k).toFixed(1)}" fill="${c[0]}" stroke="${c[1]}" stroke-width="1"><title>${a.tipo==='edicula' ? 'Edícula' + (a.dois?' (2 pavimentos)':'') : 'Varanda gourmet destacada'}</title></rect>`);
      o.push(`<text x="${X((a.x0+a.x1)/2)}" y="${Y((a.y0+a.y1)/2)+3}" class="cota">${a.tipo==='edicula' ? 'edícula' + (a.dois?' 2 pav.':'') : 'gourmet'}</text>`);
    }
  }
  o.push(`<text x="${(X(0)+X(q.frente))/2}" y="${Y(0)-8}" class="cota">rua · frente ${f2(q.frente)} m</text>`);
  o.push(`<text transform="translate(${X(0)-8},${(Y(0)+Y(q.fundo))/2}) rotate(-90)" class="cota">fundo ${f2(q.fundo)} m</text>`);
  o.push(`<text x="${(X(0)+X(q.frente))/2}" y="${Y(q.recFrente/2)+3}" class="cota">recuo ${f2(q.recFrente)}</text>`);
  if(!(v.anexos||[]).length) o.push(`<text x="${(X(0)+X(q.frente))/2}" y="${Y(q.fundo - q.recFundo/2)+3}" class="cota">fundo ${f2(q.fundo - v.y0 - v.D)} m livres</text>`);
  const F = rumoGraus(q.orientacao);
  const gg = girado(o.join(''), F, X(0) - 30, Y(0) - 22, X(q.frente) + 8, Y(q.fundo) + 8, 14, 14);
  const W2 = Math.ceil(gg.Wr + 100), duas = W2 < 330, H2 = Math.ceil(Math.max(gg.Hr + 28, 150)) + (v.acessos ? (duas ? 30 : 18) : 0);   // legenda em duas linhas no lote estreito
  o.length = 0; o.push(gg.g, rosa(W2 - 44, 60, 24, q.orientacao));
  // legenda dos acessos (na implantação a escala é pequena para rótulos junto dos portões)
  if(v.acessos){ const pv = v.acessos.portoes.filter(p => p.tipo==='veiculos').map(p => f2(p.largura)).join(' + '), ps = v.acessos.portoes.filter(p => p.tipo==='pedestres').map(p => f2(p.largura)).join(' + ');
    o.push(`<g transform="translate(14,${H2 - (duas ? 22 : 10)})" style="font-size:7px;fill:#43474D"><line x1="0" y1="-2.5" x2="14" y2="-2.5" stroke="${AC.veiculos}" stroke-width="4"/><text x="18" y="0">portão de veículos${pv ? ' ' + pv + ' m' : ''}</text><line x1="124" y1="-2.5" x2="138" y2="-2.5" stroke="${AC.pedestres}" stroke-width="4"/><text x="142" y="0">portão social ${ps} m</text><rect x="${duas ? 0 : 214}" y="${duas ? 6 : -6}" width="14" height="7" fill="${AC.caminho[0]}" stroke="${AC.caminho[1]}" stroke-width=".8"/><text x="${duas ? 18 : 232}" y="${duas ? 12 : 0}">caminho de pedestres</text></g>`); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}" role="img" aria-label="Implantação no lote"><style>text{font-family:"IBM Plex Sans","Segoe UI",Helvetica,Arial,sans-serif}.cota{font-size:8px;text-anchor:middle;fill:#55595F}.rd{text-anchor:middle;fill:#4a4e55}.halo text{paint-order:stroke;stroke:#FBFAF7;stroke-width:2.4px}</style><rect width="100%" height="100%" fill="#FBFAF7"/>${o.join('')}</svg>`;
}

return {planta, lote, espelha, COR};
});
