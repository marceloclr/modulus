/* Símbolos da planta humanizada no estilo das referências (etapa F1.5, 06/10/2026; docs/referencias/humanizada-*.jpg).
   Pisos com textura (madeira em tábuas de tamanhos variados, porcelanato grande, cerâmica, deck, grama), móveis vistos de cima
   com tecido, madeira e sombra suave, tapetes, plantas e abajures. Puro: devolve texto SVG.
   Cada peça é desenhada num sistema local em metros: u ao longo da parede de apoio (0..W), v da parede para dentro (0..P);
   peca() gira e posiciona o grupo pelo lado da parede (lado) e pela escala k (px por metro). */
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(); else root.Simbolos=factory();
})(this, function(){
'use strict';
const n2 = x => +x.toFixed(3);
const PAL = {
  parede:'#2E2D2B', madeira:['#CFAE8A','#C9A782','#D4B593','#C6A27D'], veio:'#AE8963', porc:['#E6E3DE','#E1DDD7','#E9E6E1'], rejunte:'#D3CEC6',
  cer:['#E9ECEB','#E3E7E6'], deck:['#B98D64','#AE835B','#C29A72'], grama:['#B9CF98','#AFC78C','#C3D6A4'],
  tecido:'#CFCAC2', tecido2:'#BFB9AF', almofada:'#E4E0D9', manta:'#9DAE94', manta2:'#B9A58C', lencol:'#F7F5F1', edredom:'#ECE8E2',
  mad:'#B78E66', madEsc:'#8E6A49', pedra:'#E7E4DF', pedraEsc:'#CFCAC2', loica:'#FFFFFF', vidro:'#DCE8EE', metal:'#9EA3A8',
  tapete:'#DAD5CD', tapeteBorda:'#CBC5BB', folha:['#5F7F4C','#7A9A61','#93B176'], vaso:'#C9B49A', luz:'#FFF4D6',
  sombra:'#2B2620', linha:'#6F685F',
};
/* Padrões e filtros. id: prefixo único do desenho. */
function defs(id){
  const P = (n, w, h, corpo) => `<pattern id="${id}${n}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${corpo}</pattern>`;
  // madeira: 6 fiadas de tábuas de 0,15 m (4,5 px a 30 px/m), emendas desencontradas, três tons e veios finos
  let mad = `<rect width="96" height="27" fill="${PAL.madeira[0]}"/>`;
  const emendas = [[0, 38, 71], [17, 55, 88], [9, 46, 80], [28, 63], [4, 41, 77], [22, 59, 93]];
  emendas.forEach((es, f) => { const y = f * 4.5; let x0 = 0;
    for(const [i, x] of es.concat([96]).entries()){ const tom = PAL.madeira[(f + i) % 4]; mad += `<rect x="${x0}" y="${y}" width="${x - x0}" height="4.5" fill="${tom}"/>`; x0 = x; }
    mad += `<path d="M0 ${y + 4.4}H96" stroke="${PAL.veio}" stroke-width=".35" opacity=".55"/>` + es.map(x => `<path d="M${x} ${y}V${y + 4.5}" stroke="${PAL.veio}" stroke-width=".4" opacity=".6"/>`).join('')
      + `<path d="M${(f * 13) % 90 + 3} ${y + 1.6}h${14 + f}M${(f * 29) % 80 + 8} ${y + 3}h${10 + f}" stroke="${PAL.veio}" stroke-width=".25" opacity=".35"/>`; });
  // porcelanato 90 × 90 cm (27 px), quatro peças com tons levemente diferentes
  const porc = [[0,0,0],[27,0,1],[0,27,2],[27,27,1]].map(([x,y,t]) => `<rect x="${x}" y="${y}" width="27" height="27" fill="${PAL.porc[t]}"/>`).join('')
    + `<path d="M0 26.8H54M0 53.8H54M26.8 0V54M53.8 0V54" stroke="${PAL.rejunte}" stroke-width=".5"/>`;
  const cer = [[0,0,0],[9,0,1],[0,9,1],[9,9,0]].map(([x,y,t]) => `<rect x="${x}" y="${y}" width="9" height="9" fill="${PAL.cer[t]}"/>`).join('') + `<path d="M0 8.85H18M0 17.85H18M8.85 0V18M17.85 0V18" stroke="#CBD3D2" stroke-width=".4"/>`;
  let deck = ''; for(let i = 0; i < 4; i++) deck += `<rect x="${i * 4.5}" y="0" width="4.5" height="60" fill="${PAL.deck[i % 3]}"/><path d="M${i * 4.5 + 4.35} 0V60" stroke="#8F6A47" stroke-width=".5"/><path d="M${i * 4.5} ${(i * 23) % 60}h4.5" stroke="#8F6A47" stroke-width=".4"/>`;
  let grama = `<rect width="12" height="12" fill="${PAL.grama[0]}"/>`; [[2,3,1],[7,2,2],[5,8,1],[10,10,2],[1,10,2]].forEach(([x,y,t]) => grama += `<circle cx="${x}" cy="${y}" r=".9" fill="${PAL.grama[t]}"/>`);
  return '<defs>' + P('madeira', 96, 27, mad) + P('porcelanato', 54, 54, porc) + P('ceramica', 18, 18, cer) + P('deck', 18, 60, deck) + P('grama', 12, 12, grama)
    + P('cimento', 12, 12, `<rect width="12" height="12" fill="#E2DFDA"/><circle cx="3" cy="4" r=".4" fill="#CAC5BD"/><circle cx="9" cy="9" r=".35" fill="#D1CCC4"/>`)
    + `<filter id="${id}sm" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.2" dy="1.8" stdDeviation="1.6" flood-color="${PAL.sombra}" flood-opacity=".28"/></filter>`
    + `<filter id="${id}sp" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter>`
    + `<radialGradient id="${id}luz"><stop offset="0" stop-color="#FFF8E6"/><stop offset="1" stop-color="#F3E3B8"/></radialGradient>`
    + `<linearGradient id="${id}mad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C39B73"/><stop offset="1" stop-color="#A9805A"/></linearGradient>`
    + '</defs>';
}
const PISO = {madeira:['quarto','suite','master','closet','closetMaster','escritorio','salaIntima','tv'], porcelanato:['estar','jantar','circ','hall','galeria','lazer','escada'],
  ceramica:['banhoSuite','banhoMaster','banhoSocial','lavabo','cozinha','servico','despensa','deposito','rouparia'], deck:['varanda','terraco','gourmet'], grama:['jardim'], cimento:['garagem','manobra','rampa','elevador']};
const pisoDe = tipo => Object.keys(PISO).find(k => PISO[k].includes(tipo)) || 'porcelanato';

/* Peça q = {tipo, x0, y0, x1, y1, lado, ...} em metros; X, Y: metros → px; k: px por metro; id: prefixo dos defs. */
function peca(q, X, Y, k, id){
  const l = q.lado || 'y0', hz = l === 'y0' || l === 'y1', W = hz ? q.x1 - q.x0 : q.y1 - q.y0, P = hz ? q.y1 - q.y0 : q.x1 - q.x0;
  const [ox, oy, rot] = l === 'y0' ? [q.x0, q.y0, 0] : l === 'y1' ? [q.x1, q.y1, 180] : l === 'x0' ? [q.x0, q.y1, -90] : [q.x1, q.y0, 90];
  const o = [];
  const R = (u, v, w, h, at, rx) => o.push(`<rect x="${n2(u)}" y="${n2(v)}" width="${n2(Math.max(0, w))}" height="${n2(Math.max(0, h))}"${rx ? ` rx="${rx}"` : ''} ${at}/>`);
  const C = (u, v, r, at) => o.push(`<circle cx="${n2(u)}" cy="${n2(v)}" r="${n2(r)}" ${at}/>`);
  const E = (u, v, rx, ry, at) => o.push(`<ellipse cx="${n2(u)}" cy="${n2(v)}" rx="${n2(rx)}" ry="${n2(ry)}" ${at}/>`);
  const L = (u0, v0, u1, v1, at) => o.push(`<path d="M${n2(u0)} ${n2(v0)}L${n2(u1)} ${n2(v1)}" ${at}/>`);
  const Pth = (d, at) => o.push(`<path d="${d}" ${at}/>`);
  const tr = (c, w) => `fill="${c}" stroke="${PAL.linha}" stroke-width="${w || .012}"`;
  const planta = (u, v, r) => { C(u + .04, v + .05, r * 1.02, `fill="${PAL.sombra}" opacity=".18"`);
    for(let i = 0; i < 9; i++){ const a = i * 2.4, rr = r * (.55 + (i % 3) * .15); E(u + Math.cos(a) * r * .38, v + Math.sin(a) * r * .38, rr * .55, rr * .28, `fill="${PAL.folha[i % 3]}" transform="rotate(${n2(a * 57.3)} ${n2(u + Math.cos(a) * r * .38)} ${n2(v + Math.sin(a) * r * .38)})"`); }
    C(u, v, r * .18, `fill="${PAL.folha[0]}"`); };
  const cadeira = (u, v, ang) => o.push(`<g transform="translate(${n2(u)} ${n2(v)}) rotate(${ang})"><rect x="-.22" y="-.2" width=".44" height=".42" rx=".07" ${tr(PAL.tecido2)}/><rect x="-.22" y="-.24" width=".44" height=".1" rx=".04" fill="${PAL.madEsc}"/></g>`);
  switch(q.tipo){
    case 'tapete': R(0, 0, W, P, `fill="${PAL.tapete}" stroke="${PAL.tapeteBorda}" stroke-width=".05"`, .03); R(.12, .12, W - .24, P - .24, `fill="none" stroke="${PAL.tapeteBorda}" stroke-width=".015"`); break;
    case 'cama': {
      R(0, 0, W, P, tr(PAL.lencol), .05); R(0, 0, W, .1, `fill="${PAL.madEsc}"`, .03);                       // cabeceira
      const n = q.casal ? 2 : 1, pw = (W - .2) / n;
      for(let i = 0; i < n; i++) R(.1 + i * pw + .03, .16, pw - .06, .36, tr('#FBFAF8', .01), .08);         // travesseiros
      R(.02, .62, W - .04, P - .64, `fill="${PAL.edredom}" stroke="#D6D1C9" stroke-width=".012"`, .05);     // edredom
      L(.04, .75, W - .04, .75, `stroke="#D6D1C9" stroke-width=".02"`);                                     // dobra
      R(.02, P * .72, W - .04, P * .2, `fill="${PAL.manta}" opacity=".95"`, .03);                              // manta nos pés
      for(let i = 1; i < 6; i++) L(.05, P * .72 + i * P * .033, W - .05, P * .72 + i * P * .033, `stroke="#8A9B82" stroke-width=".008"`);
      break; }
    case 'criado': R(0, 0, W, P, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".012"`, .03); C(W / 2, P / 2, .14, `fill="url(#${id}luz)" stroke="#D9C79B" stroke-width=".01"`); C(W / 2, P / 2, .04, `fill="#C9B07A"`); break;
    case 'armario': case 'prateleiras': case 'estante': {
      R(0, 0, W, P, q.tipo === 'armario' ? tr('#EDE7DD') : `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".012"`);
      const nn = Math.max(2, Math.round(W / .55)); for(let i = 1; i < nn; i++) L(i * W / nn, 0, i * W / nn, P, `stroke="${q.tipo === 'armario' ? '#BDB3A4' : PAL.madEsc}" stroke-width=".01"`);
      if(q.tipo === 'armario') for(let i = 0; i < nn; i++) L(i * W / nn + W / nn * .45, P - .05, i * W / nn + W / nn * .55, P - .05, `stroke="${PAL.metal}" stroke-width=".02"`);
      else for(let i = 0; i < nn; i++) R(i * W / nn + .05, .06, W / nn * .35, P - .12, `fill="${['#7D8C74','#B9A58C','#8E9AA6'][i % 3]}" opacity=".8"`);   // livros
      break; }
    case 'escrivaninha': R(0, 0, W, P, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".012"`, .02); R(W * .3, .08, W * .4, .05, `fill="#3B3B3B"`); cadeira(W / 2, P + .28, 180); break;
    case 'sofa': {
      R(0, 0, W, P, tr(PAL.tecido, .014), .1);
      R(0, 0, W, .22, `fill="${PAL.tecido2}"`, .08); R(0, 0, .2, P, `fill="${PAL.tecido2}"`, .08); R(W - .2, 0, .2, P, `fill="${PAL.tecido2}"`, .08);
      const nn = W > 1.9 ? 3 : 2, cw = (W - .4) / nn; for(let i = 0; i < nn; i++) R(.2 + i * cw + .02, .24, cw - .04, P - .3, `fill="${PAL.tecido}" stroke="#B5AFA5" stroke-width=".01"`, .06);
      R(.26, .26, .34, .3, `fill="${PAL.almofada}" transform="rotate(-12 .43 .41)"`, .05); R(W - .62, .26, .34, .3, `fill="${PAL.manta2}" transform="rotate(10 ${n2(W - .45)} .41)"`, .05);
      Pth(`M${n2(W * .55)} .24 q.12 ${n2(P * .5)} .02 ${n2(P - .3)} h.35 q-.05 -${n2(P * .4)} .05 -${n2(P - .3)}z`, `fill="${PAL.manta}" opacity=".9"`);   // manta
      break; }
    case 'rack': R(0, 0, W, P, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".012"`, .02); R(W * .18, .04, W * .64, .05, `fill="#1F1F1F"`); planta(W * .9, P / 2, .14); break;
    case 'mesa-centro': R(0, 0, W, P, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".012"`, .06); C(W * .3, P / 2, .09, `fill="#E9E4DA" stroke="${PAL.linha}" stroke-width=".008"`); R(W * .55, P * .3, .22, .16, `fill="#7D8C74"`); break;
    case 'mesa-jantar': case 'mesa-externa': {
      const cu = W / 2, cv = P / 2, n = q.lugares || 4;
      if(q.tipo === 'mesa-externa' || n <= 4 && W < 1.9 && P < 1.9){   // mesa redonda
        const r = q.tipo === 'mesa-externa' ? .35 : .5; for(let i = 0; i < n; i++){ const a = i * 2 * Math.PI / n + Math.PI / 4; cadeira(cu + Math.cos(a) * (r + .22), cv + Math.sin(a) * (r + .22), n2(a * 57.3 + 90)); }
        C(cu, cv, r, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".014"`); planta(cu, cv, .12); break; }
      const [mw, mh] = q.mesa || [1.6, .9], ex = W >= P, tw = ex ? mw : mh, th = ex ? mh : mw, lado = n >= 8 ? 3 : 2;
      for(let i = 0; i < lado; i++){ const s = -mw / 2 + mw * (i + .5) / lado;
        if(ex){ cadeira(cu + s, cv - mh / 2 - .2, 0); cadeira(cu + s, cv + mh / 2 + .2, 180); } else { cadeira(cu - mh / 2 - .2, cv + s, -90); cadeira(cu + mh / 2 + .2, cv + s, 90); } }
      if(n > 4){ if(ex){ cadeira(cu - mw / 2 - .2, cv, -90); cadeira(cu + mw / 2 + .2, cv, 90); } else { cadeira(cu, cv - mw / 2 - .2, 0); cadeira(cu, cv + mw / 2 + .2, 180); } }
      R(cu - tw / 2, cv - th / 2, tw, th, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".014"`, .04); planta(cu, cv, .13);
      break; }
    case 'mesa-atendimento': { const cu = W / 2, cv = P / 2; R(cu - .7, cv - .35, 1.4, .7, `fill="url(#${id}mad)" stroke="${PAL.madEsc}" stroke-width=".014"`, .03); cadeira(cu, cv - .58, 0); cadeira(cu - .33, cv + .58, 180); cadeira(cu + .33, cv + .58, 180); break; }
    case 'bancada-cozinha': {
      R(0, 0, W, P, `fill="${PAL.pedraEsc}" stroke="${PAL.linha}" stroke-width=".012"`);
      const uc = Math.min(.6, W * .25); R(uc - .27, .1, .54, .38, `fill="${PAL.loica}" stroke="${PAL.metal}" stroke-width=".015"`, .04); C(uc, .18, .025, `fill="${PAL.metal}"`);
      const uf = Math.max(uc + .8, W - .45); if(uf + .3 <= W + .01){ R(uf - .3, .08, .6, .5, `fill="#2B2B2B"`, .03); for(const [du, dv] of [[-.14,.2],[.14,.2],[-.14,.45],[.14,.45]]) C(uf + du, dv, .08, `fill="none" stroke="#777" stroke-width=".015"`); }
      break; }
    case 'geladeira': R(0, 0, W, P, tr('#F2F2F0', .014), .03); L(.04, P - .08, W - .04, P - .08, `stroke="${PAL.metal}" stroke-width=".015"`); break;
    case 'tanque': R(0, 0, W, P, tr(PAL.loica), .03); R(.06, .06, W - .12, P - .16, `fill="#EEF2F3" stroke="${PAL.metal}" stroke-width=".01"`, .03); break;
    case 'maquina': R(0, 0, W, P, tr('#F4F4F2'), .04); C(W / 2, P / 2, Math.min(W, P) * .32, `fill="${PAL.vidro}" stroke="${PAL.metal}" stroke-width=".015"`); break;
    case 'boxe': R(0, 0, W, P, `fill="#E4ECEF" stroke="${PAL.metal}" stroke-width=".012"`); C(W / 2, P / 2, .04, `fill="${PAL.metal}"`); L(0, P, W, P, `stroke="#9FB6C2" stroke-width=".03"`); break;
    case 'bacia': R(.04, 0, W - .08, .17, tr(PAL.loica, .01), .03); E(W / 2, .4, .18, .23, tr(PAL.loica, .01)); E(W / 2, .42, .1, .14, `fill="#EEF3F5"`); break;
    case 'lavatorio': case 'bancada': { R(0, 0, W, P, `fill="${PAL.pedra}" stroke="${PAL.linha}" stroke-width=".012"`); const nn = q.tipo === 'bancada' && W >= 1.15 ? 2 : 1;
      for(let i = 0; i < nn; i++){ E(W * (i + .5) / nn, P * .55, .17, .13, tr(PAL.loica, .01)); C(W * (i + .5) / nn, P * .2, .02, `fill="${PAL.metal}"`); } break; }
    case 'vaso': planta(W / 2, P / 2, Math.min(W, P) * .5); break;
    case 'churrasqueira': R(0, 0, W, P, `fill="#5E5A55" stroke="#3B3834" stroke-width=".012"`); for(let i = 1; i < 6; i++) L(.08, i * P / 6, W - .08, i * P / 6, `stroke="#A49C91" stroke-width=".01"`); break;
    case 'arvore': { const r = Math.min(W, P) / 2; C(W / 2 + .15, P / 2 + .2, r, `fill="${PAL.sombra}" opacity=".16"`); C(W / 2, P / 2, r, `fill="#7FA261"`);
      for(let i = 0; i < 7; i++){ const a = i * .9; C(W / 2 + Math.cos(a) * r * .45, P / 2 + Math.sin(a) * r * .45, r * .42, `fill="${PAL.folha[i % 3]}" opacity=".85"`); } break; }
    default: R(0, 0, W, P, tr('#FFFFFF'), .02);
  }
  const t = `<title>${q.nome || q.tipo}</title>`;
  const sombra = ['tapete', 'arvore', 'vaso'].includes(q.tipo) ? '' : ` filter="url(#${id}sm)"`;
  // a sombra fica num grupo de fora, sem escala: o desfoque do filtro é em px, não em metros
  return `<g${sombra}><g transform="translate(${n2(X(ox))} ${n2(Y(oy))}) rotate(${rot}) scale(${k})">${t}${o.join('')}</g></g>`;
}
return {defs, peca, pisoDe, PAL};
});
