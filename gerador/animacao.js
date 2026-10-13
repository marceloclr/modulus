/* Card "Sol e vento ao longo do ano": animação da incidência solar sobre a planta e do vento do mês. Só no navegador.
   Usa Motor, Desenho, Brises, Insolacao e Vento. Planos: docs/planos/2026-10-05-sol-vento-animacao.md (primeira versão) e
   docs/planos/2026-10-13-retomada-visual.md (V2: protótipo aprovado em https://claude.ai/artifact/Mtxj5tp2NLonLdp7ZPG5Ci).

   V2, sol: régua única de mês e hora com a curva da altura do sol; transições contínuas (o exibido persegue o pedido);
   véu de cor da hora; sombras suaves (penumbra que cresce com o comprimento, opacidade pela altura do sol); anel do
   horizonte em volta do lote com o arco do dia, as horas, o nascente e o poente; feixes e manchas de sol pelas janelas;
   mapa de horas de sol no lote (opcional). A camada fica no sistema da casa (gira com a planta); os textos recebem o
   giro inverso para ficarem de pé. */
(function(root){
'use strict';
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const f1 = n => (Math.round(n*10)/10).toFixed(1).replace('.', ','), f0 = n => Math.round(n).toLocaleString('pt-BR');
const hhmm = h => { let H = Math.floor(h), m = Math.round((h - H) * 60); if(m === 60){ H++; m = 0; } return `${String(H).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const reduz = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rad = g => g * Math.PI / 180;
const ajuda = (t, a, r) => root.plantasAjuda ? root.plantasAjuda(t, a, r) : '';
const H0 = 5.5, H1 = 18.5;

const E = {el:null, raiz:'../', aba:'sol', mes:new Date().getMonth() + 1, hora:9, mesV:null, horaV:null, v:null, q:null, pi:0, est:null, vento:null,
  dia:false, ano:false, mapa:false, mapaChave:'', rodando:false, ultimo:0, visivel:true, chave:'', painelChave:''};

function casca(){
  return `<div class="card res sv" style="--c:var(--card-torre)">
  <div class="res-head"><h3>Sol e vento ao longo do ano <button type="button" class="ajuda" id="svAjuda" data-ajuda="" data-manual="sol-vento" aria-label="Ajuda: sol e vento" aria-expanded="false">?</button></h3></div>
  <div class="sv-top">
    <div class="sv-seg" role="group" aria-label="O que animar">
      <button type="button" class="btn" data-aba="sol" aria-pressed="true">Sol e sombras</button><button type="button" class="btn" data-aba="vento" aria-pressed="false">Vento</button>
    </div>
    <div class="sv-acoes">
      <button type="button" class="btn" id="svMapa" aria-pressed="false" data-so="sol">Mapa de horas de sol</button>
      <button type="button" class="btn" id="svAno" aria-pressed="false">Percorrer o ano</button>
    </div>
  </div>
  <div class="sv-corpo"><div class="sv-planta" id="svPlanta"></div><div class="sv-painel" id="svPainel" aria-live="polite"></div></div>
  <div class="sv-regua2">
    <div class="sv-meses" role="group" aria-label="Mês">${CURTO.map((c, i) => `<button type="button" class="sv-mes" data-mes="${i+1}" aria-label="${MESES[i]}">${c}</button>`).join('')}</div>
    <div class="sv-horas2" data-so="sol">
      <button type="button" class="btn sv-play" id="svPlay" aria-label="Animar o dia" aria-pressed="false">▶</button>
      <div class="sv-trilho2"><svg id="svCurva" viewBox="0 0 600 46" preserveAspectRatio="none" aria-hidden="true"></svg>
        <input type="range" id="svHora" min="${H0}" max="${H1}" step="0.05" aria-label="Hora solar"></div>
    </div>
  </div>
</div>`;
}

function iniciar(el, opc){
  E.el = el; E.raiz = (opc && opc.raiz) || '../';
  el.innerHTML = casca();
  const hora = el.querySelector('#svHora'); hora.value = E.hora;
  hora.addEventListener('input', () => { E.hora = +hora.value; E.dia = false; botoes(); acorda(); });
  el.addEventListener('click', e => {
    const m = e.target.closest('[data-mes]'); if(m){ E.mes = +m.dataset.mes; E.ano = false; botoes(); acorda(); return; }
    const a = e.target.closest('[data-aba]'); if(a){ E.aba = a.dataset.aba; E.chave = ''; desenhar(true); return; }
    if(e.target.closest('#svPlay')){ E.dia = !E.dia; botoes(); acorda(); return; }
    if(e.target.closest('#svAno')){ E.ano = !E.ano; botoes(); acorda(); return; }
    if(e.target.closest('#svMapa')){ E.mapa = !E.mapa; E.mapaChave = ''; botoes(); desenhar(false); }
  });
  if(root.IntersectionObserver) new IntersectionObserver(es => { E.visivel = es[0].isIntersecting; if(E.visivel) acorda(); }).observe(el);
  fetch(E.raiz + 'dados/vento.json').then(r => r.json()).then(d => { E.vento = d; if(E.aba === 'vento') desenhar(true); }).catch(() => { E.vento = {erro:true}; });
  if(reduz()){ el.querySelector('#svPlay').hidden = true; el.querySelector('#svAno').hidden = true; }
  botoes();
}
function botoes(){
  if(!E.el) return;
  const bp = E.el.querySelector('#svPlay'); bp.textContent = E.dia ? '❚❚' : '▶'; bp.setAttribute('aria-pressed', E.dia); bp.setAttribute('aria-label', E.dia ? 'Pausar o dia' : 'Animar o dia');
  E.el.querySelector('#svAno').setAttribute('aria-pressed', E.ano);
  E.el.querySelector('#svMapa').setAttribute('aria-pressed', E.mapa);
}

/* Variante, entrada e pavimento escolhidos na página (chamado a cada render do gerador). */
function atualizar(v, q, pi, est){
  E.v = v; E.q = q; E.est = est;
  E.pi = v && v.pav[pi] && !v.pav[pi].anexo && v.pav[pi].nome !== 'Subsolo' ? pi : Math.max(0, v ? v.pav.findIndex(p => p.nome === 'Térreo') : 0);
  E.mapaChave = ''; E.painelChave = '';
  if(E.el) desenhar(true);
}

// ---------- laço: o exibido (mesV, horaV) persegue o pedido (mes, hora); para quando chega e nada está tocando ----------
function acorda(){ if(!E.rodando && E.el){ E.rodando = true; E.ultimo = 0; requestAnimationFrame(passo); } }
function passo(t){
  if(!E.visivel || document.hidden){ E.rodando = false; return; }
  const dt = E.ultimo ? Math.min(0.06, (t - E.ultimo) / 1000) : 0; E.ultimo = t;
  if(E.dia){ E.hora += dt * 1.6; if(E.hora > H1){ E.hora = H0; E.horaV = H0; } E.el.querySelector('#svHora').value = E.hora; }
  if(E.ano){ E.mes += dt * 0.5; if(E.mes >= 13) E.mes -= 12; }
  const f = reduz() ? 1 : Math.min(1, dt * 7);
  if(E.mesV === null){ E.mesV = E.mes; E.horaV = E.hora; }
  let dm = E.mes - E.mesV; if(dm > 6) dm -= 12; if(dm < -6) dm += 12;
  E.mesV = E.ano ? E.mes : E.mesV + dm * f; if(E.mesV >= 13) E.mesV -= 12; if(E.mesV < 1) E.mesV += 12;
  E.horaV = E.dia ? E.hora : E.horaV + (E.hora - E.horaV) * f;
  desenhar(false);
  const parado = !E.dia && !E.ano && Math.abs(dm) < 0.002 && Math.abs(E.hora - E.horaV) < 0.002;
  if(parado){ E.mesV = E.mes; E.horaV = E.hora; desenhar(false); E.rodando = false; return; }
  requestAnimationFrame(passo);
}
// dia do ano contínuo entre os dias 21 de cada mês
function diaDe(mesF){ const D = Brises.DIAS, i = Math.floor(mesF - 1) % 12, j = (i + 1) % 12, fr = mesF - Math.floor(mesF); let a = D[i], b = D[j]; if(b < a) b += 365; return a + (b - a) * fr; }
const mesInt = mesF => ((Math.round(mesF) - 1) % 12 + 12) % 12 + 1;

// ---------- geometria da camada (coordenadas da casa → px: X = ox + m·k) ----------
function caixaLote(v){ const L = v.lote; return L && v.x0 !== undefined ? {x0:-v.x0, y0:-v.y0, x1:L.frente - v.x0, y1:L.fundo - v.y0} : {x0:0, y0:0, x1:v.W, y1:v.D}; }
// anel do horizonte: elipse inscrita no lote; o sol fica na direção verdadeira do azimute, a cos(h) do anel
function anel(c){ const cx = (c.x0 + c.x1)/2, cy = (c.y0 + c.y1)/2, rx = (c.x1 - c.x0)/2 - 0.35, ry = (c.y1 - c.y0)/2 - 0.35;
  return {cx, cy, rx, ry, em(d, fr){ const r = 1 / Math.sqrt((d.x/rx)**2 + (d.y/ry)**2); return [cx + d.x * r * fr, cy + d.y * r * fr]; }}; }
function nascePoe(dia){ let tn = null, tp = null; for(let t = 4; t <= 20; t += 0.02){ const h = Brises.sol(dia, t).h; if(h > 0 && tn === null) tn = t; if(h > 0) tp = t; } return [tn, tp]; }
function ceu(s, hora){
  if(s.h <= 0) return ['#14203C', 0.26];
  const f = Math.max(0, 1 - s.h / 28);                                   // perto do horizonte, luz quente
  return hora > 12 ? ['#F07828', 0.20 * f] : ['#FABE46', 0.16 * f];
}

function camadaSol(T, dia, hora){
  const v = E.v, q = E.q, F = Motor.RUMOS[q.orientacao] || 0, k = T.k;
  const X = m => (T.ox + m*k).toFixed(1), Y = m => (T.oy + m*k).toFixed(1), pts = a => a.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
  const s = Brises.sol(dia, hora), c = caixaLote(v), A = anel(c), d = Insolacao.direcao(s.az, F);
  let o = `<defs><filter id="svPen" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(k * Math.min(0.9, 0.12 + (s.h > 1 ? 0.035 * 3 / Math.tan(rad(s.h)) : 0))).toFixed(2)}"/></filter>
    <filter id="svBrilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(k*0.12).toFixed(2)}"/></filter>
    <clipPath id="svLote"><rect x="${X(c.x0)}" y="${Y(c.y0)}" width="${((c.x1-c.x0)*k).toFixed(1)}" height="${((c.y1-c.y0)*k).toFixed(1)}"/></clipPath>
    <radialGradient id="svHalo"><stop offset="0" stop-color="#FFE2A0"/><stop offset=".35" stop-color="#FFC85A" stop-opacity=".55"/><stop offset="1" stop-color="#FFC85A" stop-opacity="0"/></radialGradient></defs>`;
  // véu da hora sobre o lote
  const [cor, alfa] = ceu(s, hora);
  if(alfa > 0.004) o += `<rect x="${X(c.x0)}" y="${Y(c.y0)}" width="${((c.x1-c.x0)*k).toFixed(1)}" height="${((c.y1-c.y0)*k).toFixed(1)}" fill="${cor}" opacity="${alfa.toFixed(3)}"/>`;
  // mapa de horas de sol (grupo à parte, refeito só quando muda o mês)
  o += `<g id="svMapaG">${E.mapa ? mapaHoras(T) : ''}</g>`;
  // sombras suaves, fora da casa
  if(s.h > 0.5){
    const sb = Insolacao.sombras(v, q, s), op = 0.10 + 0.22 * Math.pow(Math.sin(rad(s.h)), 0.6);
    o += `<g clip-path="url(#svLote)"><g mask="url(#svMascara)"><g filter="url(#svPen)" opacity="${(op * 0.75).toFixed(3)}">${sb.map(x => `<polygon points="${pts(x.pts)}" fill="#1E293B"/>`).join('')}</g>`;
    o += `<g opacity="${(op * 0.55).toFixed(3)}">${sb.map(x => `<polygon points="${pts(x.pts)}" fill="#1E293B"/>`).join('')}</g></g></g>`;
  }
  // fachadas e janelas
  const p = v.pav[E.pi], L = s.h > 0.5 && p && !p.anexo ? Insolacao.luzPavimento(v, q, p, s, E.est) : {manchas:[], fachadas:[]};
  for(const fc of L.fachadas){ const [x0, y0, x1, y1] = fc.o === 'h' ? [fc.t0, fc.c, fc.t1, fc.c] : [fc.c, fc.t0, fc.c, fc.t1], a = fc.intensidade;
    o += `<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="#F59E0B" stroke-opacity="${(0.25 + 0.65*a).toFixed(2)}" stroke-width="${(3 + 5*a).toFixed(1)}" stroke-linecap="round" filter="url(#svBrilho)"/>`;
    o += `<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="#F59E0B" stroke-opacity="${(0.35 + 0.6*a).toFixed(2)}" stroke-width="2.4" stroke-linecap="round"/>`; }
  L.manchas.forEach((m, i) => { const a = m.intensidade, jm = [(m.janela[0] + m.janela[2])/2, (m.janela[1] + m.janela[3])/2], fu = m.pts.reduce((s, p) => [s[0] + p[0]/m.pts.length, s[1] + p[1]/m.pts.length], [0, 0]);
    if(m.feixe && m.feixe.length >= 3) o += `<defs><linearGradient id="svF${i}" gradientUnits="userSpaceOnUse" x1="${X(jm[0])}" y1="${Y(jm[1])}" x2="${X(fu[0])}" y2="${Y(fu[1])}"><stop offset="0" stop-color="#FFD678" stop-opacity="${(0.55*a).toFixed(2)}"/><stop offset="1" stop-color="#FFD678" stop-opacity="0"/></linearGradient></defs><polygon points="${pts(m.feixe)}" fill="url(#svF${i})"/>`;
    o += `<polygon points="${pts(m.pts)}" fill="#FDE68A" fill-opacity="${(0.45 + 0.4*a).toFixed(2)}" stroke="#F59E0B" stroke-width="1" filter="url(#svBrilho)"/><polygon points="${pts(m.pts)}" fill="#FEF3C7" fill-opacity="${(0.35 + 0.4*a).toFixed(2)}" stroke="#D97706" stroke-width=".7"/>`; });
  const pos = ss => A.em(Insolacao.direcao(ss.az, F), Math.cos(rad(Math.max(0, ss.h))));
  // o sol: raio até a casa, halo e disco
  if(s.h > 0){ const pp = pos(s);
    o += `<line x1="${X(pp[0])}" y1="${Y(pp[1])}" x2="${X(v.W/2)}" y2="${Y(v.D/2)}" stroke="#F59E0B" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="3 4"/>`;
    o += `<circle cx="${X(pp[0])}" cy="${Y(pp[1])}" r="30" fill="url(#svHalo)"/><circle cx="${X(pp[0])}" cy="${Y(pp[1])}" r="9" fill="#FFE2A0" stroke="#D97706" stroke-width="2"/>`; }
  return {svg:o, s, L};
}
// máscara das sombras: só fora da casa (a sombra sobre a cobertura não interessa); fica fixa por variante
function mascara(T){
  const X = m => (T.ox + m*T.k).toFixed(1), Y = m => (T.oy + m*T.k).toFixed(1);
  const casa = E.v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo').flatMap(p => p.salas);
  return `<mask id="svMascara" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000"><rect x="-5000" y="-5000" width="10000" height="10000" fill="#fff"/>${casa.map(r => `<rect x="${X(r.x0)}" y="${Y(r.y0)}" width="${((r.x1-r.x0)*T.k).toFixed(1)}" height="${((r.y1-r.y0)*T.k).toFixed(1)}" fill="#000"/>`).join('')}</mask>`;
}
// escala de horas de sol: azul-acinzentado (pouco sol) → areia → âmbar (sol o dia todo)
const RAMPA = [[0x6B, 0x83, 0xA8], [0xE9, 0xD8, 0xA6], [0xF5, 0xB0, 0x2E]];
function rampa(f){ const i = f < 0.5 ? 0 : 1, u = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5, a = RAMPA[i], b = RAMPA[i + 1]; return `rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * u)).join(',')})`; }
function mapaHoras(T){
  const m = mesInt(E.mesV), chave = [E.v.nome, E.v.espelhada, E.v.W, E.v.D, E.q.orientacao, m].join('|');
  if(E.mapaChave !== chave){ E.mapaChave = chave;
    const H = Insolacao.horasNoLote(E.v, E.q, m, 0.5), k = T.k, X = x => (T.ox + x*k).toFixed(1), Y = y => (T.oy + y*k).toFixed(1); let o = '';
    for(let iy = 0; iy < H.ny; iy++) for(let ix = 0; ix < H.nx; ix++){ const h = H.horas[iy*H.nx + ix]; if(h === null) continue;
      o += `<rect x="${X(H.x0 + ix*H.passo)}" y="${Y(H.y0 + iy*H.passo)}" width="${(H.passo*k + 0.6).toFixed(1)}" height="${(H.passo*k + 0.6).toFixed(1)}" fill="${rampa(Math.min(1, h / 12))}"/>`; }
    E.mapaSvg = `<g opacity=".62">${o}</g>`; E.mapaMax = H.max;
  }
  return E.mapaSvg;
}

// ---------- mostrador do sol: o centro é o zênite, a borda é o horizonte; norte para cima ----------
function mostrador(dia, hora){
  const c = 84, R = 62, P = (az, h) => { const r = R * Math.cos(rad(Math.max(0, h))); return [c + r * Math.sin(rad(az)), c - r * Math.cos(rad(az))]; };
  const tx = (x, y, t, cl) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="${cl || ''}">${t}</text>`;
  let o = `<circle cx="${c}" cy="${c}" r="${R}" class="sv-d-hor"/><circle cx="${c}" cy="${c}" r="${(R*Math.cos(rad(60))).toFixed(1)}" class="sv-d-alt"/><circle cx="${c}" cy="${c}" r="${(R*Math.cos(rad(30))).toFixed(1)}" class="sv-d-alt"/>`;
  for(const [k, a] of [['N', 0], ['L', 90], ['S', 180], ['O', 270]]){ const [x, y] = P(a, -1); o += tx(c + (x - c) * 1.2, c + (y - c) * 1.2, k, k === 'N' ? 'sv-d-n' : 'sv-d-r'); }
  const [tn, tp] = nascePoe(dia);
  if(tn !== null){
    const arco = []; for(let t = tn; t <= tp + 1e-6; t += 0.1) arco.push(P(Brises.sol(dia, Math.min(t, tp)).az, Brises.sol(dia, Math.min(t, tp)).h));
    o += `<polyline points="${arco.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" class="sv-d-arco"/>`;
    for(const hh of [9, 12, 15]){ const s = Brises.sol(dia, hh); if(s.h < 0) continue; const [x, y] = P(s.az, s.h), dx = x - c, dy = y - c, L = Math.hypot(dx, dy) || 1;
      o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" class="sv-d-ponto"/>` + tx(x + (L > 8 ? dx / L : 0) * 11, y + (L > 8 ? dy / L : -1) * 11, hh + 'h', 'sv-d-h'); }
    for(const [t, cl] of [[tn, 'sv-d-nasc'], [tp, 'sv-d-poe']]){ const s = Brises.sol(dia, t), [x, y] = P(s.az, 0); o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="${cl}"/>`; }
  }
  const s = Brises.sol(dia, hora);
  if(s.h > 0){ const [x, y] = P(s.az, s.h); o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="url(#svDHalo)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" class="sv-d-sol"/>`; }
  return {svg: `<defs><radialGradient id="svDHalo"><stop offset="0" stop-color="#FFE2A0"/><stop offset="1" stop-color="#FFC85A" stop-opacity="0"/></radialGradient></defs>` + o, tn, tp};
}

// ---------- painel do sol (enxuto; métodos no "?") ----------
function leituraSol(s, m){ return s.h > 0 ? `21 de ${MESES[m-1]} · altura ${Math.round(s.h)}° · azimute ${Math.round(s.az)}°` : `21 de ${MESES[m-1]} · sol abaixo do horizonte`; }
function painelSol(m, s, L){
  const pa = E.el.querySelector('#svPainel'), chave = ['sol', m, E.v.nome, E.v.espelhada, E.pi, E.est ? E.est.janelas.length : 0, E.mapa].join('|');
  if(E.painelChave !== chave){ E.painelChave = chave;
    const q = E.q, inc = Insolacao.incidenciaFaces(E.v, q, m), hs = Insolacao.horasSolComodos(E.v, q, m, E.est), max = Math.max(1, ...inc.map(f => f.kwh));
    const quartos = hs.filter(a => ['quarto','suite','master'].includes(a.tipo) && a.tarde > 0);
    pa.innerHTML = `<div class="sv-cab"><div class="sv-leitura"><span class="sv-big" id="svHoraG"></span><span class="sv-sub" id="svSub"></span><span class="sv-sub" id="svNP"></span></div><svg class="sv-dial" id="svDial" viewBox="0 0 168 168" role="img" aria-label="Posição do sol no céu: o centro é o ponto mais alto, a borda é o horizonte"></svg></div>
      <h4>Sol direto nas fachadas <span class="sv-un">kWh/m² no mês</span> ${ajuda('Radiação direta em cada face no mês: soma de DNI × cos(incidência), das 7h às 17h, em kWh/m².', 'sol-vento', 'fachadas')}</h4>
      <div class="sv-barras">${inc.map(f => `<div class="sv-barra"><span>${esc(f.nome)}</span><i style="width:${(100*f.kwh/max).toFixed(0)}%"></i><em>${f0(f.kwh)}</em></div>`).join('')}</div>
      <h4>Sol dentro agora ${ajuda('Mancha de sol no piso: cada janela projetada do peitoril à verga pelo ângulo do sol, recortada no cômodo, com o fator do brise quando houver.', 'sol-vento', 'sol dentro')}</h4><ul class="sv-lista" id="svDentro"></ul>
      <h4>Horas de sol pelas janelas no dia 21 ${ajuda('Horas em que alguma janela do cômodo recebe sol direto, de 15 em 15 minutos; entre parênteses, as horas depois das 14h.', 'sol-vento', 'horas de sol')}</h4>
      <ul class="sv-lista">${hs.slice(0, 5).map(a => `<li><span>${esc(a.nome)}${E.v.pav.length > 1 ? ` <small>${esc(a.pav.toLowerCase())}</small>` : ''}</span><b>${f1(a.horas)} h${a.tarde ? ` <small>(${f1(a.tarde)} à tarde)</small>` : ''}</b></li>`).join('') || '<li><span>Nenhuma janela recebe sol direto neste dia.</span></li>'}</ul>
      ${quartos.length ? `<p class="sv-alerta">Sol da tarde em ${quartos.map(a => esc(a.nome.toLowerCase())).join(', ')} em ${MESES[m-1]}${E.est ? ', mesmo com os brises' : '; considere brises (Conforto passivo)'}.</p>` : ''}
      ${E.mapa ? `<p class="sv-leg-mapa"><span class="sv-rampa" aria-hidden="true"></span><span>0 h</span><span>12 h de sol no dia 21</span></p>` : ''}`;
  }
  pa.querySelector('#svHoraG').textContent = hhmm(E.horaV);
  pa.querySelector('#svSub').textContent = leituraSol(s, m);
  const md = mostrador(diaDe(E.mesV), E.horaV); pa.querySelector('#svDial').innerHTML = md.svg;
  pa.querySelector('#svNP').textContent = md.tn !== null ? `nascente ${hhmm(md.tn)} · poente ${hhmm(md.tp)}` : '';
  const por = new Map(); for(const x of L.manchas) por.set(x.nomeSala, (por.get(x.nomeSala) || 0) + x.area);
  const li = [...por].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, a]) => `<li><span>${esc(n)}</span><b>${f1(a)} m²</b></li>`).join('') || '<li><span>Nenhuma janela recebe sol direto agora.</span></li>';
  const ul = pa.querySelector('#svDentro'); if(ul.innerHTML !== li) ul.innerHTML = li;
}
// curva da altura do sol atrás da régua de horas
function curva(dia){
  const el = E.el.querySelector('#svCurva'), ch = Math.round(dia); if(el.dataset.d === String(ch)) return; el.dataset.d = ch;
  const p = []; for(let t = H0; t <= H1 + 1e-6; t += 0.1){ const s = Brises.sol(dia, t); p.push([(t - H0)/(H1 - H0)*600, 40 - Math.max(0, s.h)/90*34]); }
  const d = p.map(x => x[0].toFixed(1) + ',' + x[1].toFixed(1)).join(' L');
  el.innerHTML = `<defs><linearGradient id="svCg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F59E0B" stop-opacity=".45"/><stop offset="1" stop-color="#F59E0B" stop-opacity="0"/></linearGradient></defs>`
    + `<path d="M0,40 L${d} L600,40Z" fill="url(#svCg)"/><path d="M${d}" fill="none" stroke="#F59E0B" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
    + [6, 9, 12, 15, 18].map(h => `<text x="${((h - H0)/(H1 - H0)*600).toFixed(0)}" y="9" text-anchor="middle" style="font-size:9px;fill:var(--ink-3)">${h}h</text>`).join('');
}

// ---------- vento (primeira versão; a V3 reescreve) ----------
function camadaVento(T, rs){
  const X = m => (T.ox + m*T.k).toFixed(1), Y = m => (T.oy + m*T.k).toFixed(1);
  const v = E.v, q = E.q, F = Motor.RUMOS[q.orientacao] || 0, c = caixaLote(v), dur = (8 / Math.max(1, rs.velMedia)).toFixed(2);
  let o = '';
  for(const l of Vento.linhas(c, rs.dirPredominante, F, 11))
    o += `<line class="sv-fluxo" x1="${X(l.a[0])}" y1="${Y(l.a[1])}" x2="${X(l.b[0])}" y2="${Y(l.b[1])}" stroke="#2F6FB0" stroke-opacity=".55" stroke-width="2" stroke-dasharray="14 10" style="animation-duration:${dur}s" marker-end="url(#svSeta)"/>`;
  o += `<defs><marker id="svSeta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="#2F6FB0"/></marker></defs>`;
  const p = v.pav[E.pi];
  for(const j of Vento.janelas(v, q, p, rs.dirPredominante)){
    if(j.papel === 'lateral') continue;
    const [x0, y0, x1, y1] = j.o === 'h' ? [j.t0, j.c, j.t1, j.c] : [j.c, j.t0, j.c, j.t1];
    o += `<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="${j.papel === 'entrada' ? '#15803D' : '#C2410C'}" stroke-width="6" stroke-linecap="round"/>`;
  }
  return o;
}
function rosaSVG(rs, m){
  const R = 70, c = 90, maxF = Math.max(...rs.rosa.map(r => r.freq), 1), rd = g => g*Math.PI/180;
  let o = `<svg class="sv-rosa" viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Rosa dos ventos de ${MESES[m-1]}">`;
  for(const r of [0.33, 0.66, 1]) o += `<circle cx="${c}" cy="${c}" r="${(R*r).toFixed(1)}" fill="none" stroke="var(--line)"/>`;
  for(const x of rs.rosa){ if(!x.freq) continue; const r = R * x.freq / maxF, a0 = rd(x.dir - 10), a1 = rd(x.dir + 10);
    const cor = x.vel >= 6 ? '#1E40AF' : x.vel >= 4 ? '#2F6FB0' : '#7FA9D6';
    o += `<path d="M${c},${c}L${(c + r*Math.sin(a0)).toFixed(1)},${(c - r*Math.cos(a0)).toFixed(1)}L${(c + r*Math.sin(a1)).toFixed(1)},${(c - r*Math.cos(a1)).toFixed(1)}Z" fill="${cor}"><title>${x.dir}°: ${f1(x.freq)} % do tempo, ${f1(x.vel)} m/s</title></path>`; }
  for(const [kk, a] of [['N', 0], ['L', 90], ['S', 180], ['O', 270]]) o += `<text x="${(c + (R+12)*Math.sin(rd(a))).toFixed(1)}" y="${(c - (R+12)*Math.cos(rd(a)) + 3).toFixed(1)}" text-anchor="middle" style="font-size:10px;fill:var(--ink-3)">${kk}</text>`;
  return o + '</svg>';
}
function painelVento(rs, m){
  if(!rs) return `<p class="note">${E.vento && E.vento.erro ? 'Não foi possível carregar os dados de vento.' : 'Carregando os dados de vento…'}</p>`;
  const maxH = Math.max(...rs.velHora), lat = E.vento.local.lat, lon = E.vento.local.lon;
  let h = `<div class="sv-rosa-box">${rosaSVG(rs, m)}<div><p class="sv-sol"><b>${MESES[m-1]}</b> · de ${rs.nomePredominante} (${rs.dirPredominante}°)</p>
    <p>Velocidade média <b>${f1(rs.velMedia)} m/s</b> · calmaria ${f1(rs.calmaria)} %</p><p>${rs.principais.map(x => `${x.nome} ${f1(x.freq)} %`).join(' · ')}</p></div></div>`;
  h += `<h4>Velocidade ao longo do dia</h4><div class="sv-dia" role="img" aria-label="Velocidade média por hora em ${MESES[m-1]}">${rs.velHora.map((x, i) => `<i style="height:${(100*x/maxH).toFixed(0)}%" title="${i}h: ${f1(x)} m/s"></i>`).join('')}</div><p class="sv-eixo"><span>0h</span><span>12h</span><span>23h</span></p>`;
  h += `<p><span class="sv-leg" style="--c:#15803D"></span>janelas de entrada (barlavento) · <span class="sv-leg" style="--c:#C2410C"></span>janelas de saída (sotavento)</p>`;
  h += `<p><a class="btn" href="https://www.windy.com/${lat}/${lon}?wind,${lat},${lon},12" target="_blank" rel="noopener">Vento agora no Windy ↗</a></p>`;
  return h;
}

// ---------- desenho ----------
function desenhar(tudo){
  if(!E.el) return;
  const el = E.el, v = E.v, q = E.q;
  if(E.mesV === null){ E.mesV = E.mes; E.horaV = E.hora; }
  const m = mesInt(E.mesV), dia = diaDe(E.mesV);
  el.querySelectorAll('.sv-mes').forEach(b => b.setAttribute('aria-current', +b.dataset.mes === mesInt(E.mes) ? 'true' : 'false'));
  el.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-pressed', b.dataset.aba === E.aba ? 'true' : 'false'));
  el.querySelectorAll('[data-so="sol"]').forEach(x => x.hidden = E.aba !== 'sol');
  const pl = el.querySelector('#svPlanta'), pa = el.querySelector('#svPainel'), aj = el.querySelector('#svAjuda');
  if(!v || !q){ pl.innerHTML = ''; pa.innerHTML = '<p class="note">Gere uma planta para ver a animação.</p>'; return; }
  if(Motor.RUMOS[q.orientacao] === undefined){ pl.innerHTML = ''; pa.innerHTML = '<p class="note">Informe para onde a frente do terreno está voltada (bloco 1, Terreno) para animar o sol e o vento sobre a casa.</p>'; return; }
  // a planta só é redesenhada quando muda a variante, o pavimento ou a aba
  const estilo = typeof window !== 'undefined' && window.plantasVistaPlanta && window.plantasVistaPlanta() === 'tecnica' ? undefined : 'humanizada';
  const chave = [v.nome, v.espelhada, E.pi, q.orientacao, E.aba, v.W, v.D, E.est ? E.est.janelas.length : 0, estilo].join('|');
  if(chave !== E.chave){ E.chave = chave; E.painelChave = ''; E.mapaChave = '';
    pl.innerHTML = Desenho.planta(v, E.pi, {estilo, camadaId:'svCamada', brises: E.aba === 'sol' && E.est ? E.est.janelas : undefined, titulo: E.aba === 'sol' ? 'Insolação' : 'Vento', sub: `${v.nome} · ${v.pav[E.pi].nome}`});
    const g0 = pl.querySelector('#svCamada'); if(g0){ const T0 = {ox:+g0.dataset.ox, oy:+g0.dataset.oy, k:+g0.dataset.k}; g0.insertAdjacentHTML('beforebegin', `<defs>${mascara(T0)}</defs>`); } }
  const g = pl.querySelector('#svCamada'); if(!g) return;
  const T = {ox:+g.dataset.ox, oy:+g.dataset.oy, k:+g.dataset.k};
  if(E.aba === 'sol'){
    const r = camadaSol(T, dia, E.horaV);
    g.innerHTML = r.svg;
    painelSol(m, r.s, r.L); curva(dia);
    aj.setAttribute('data-ajuda', 'Geometria solar de Fortaleza (3,73° S) no dia 21 de cada mês, pela hora solar, só a radiação direta. Sombras da casa no lote; laranja: fachadas ao sol; amarelo: feixes e manchas de sol pelas janelas. No mostrador, a borda é o horizonte e o centro é o ponto mais alto do céu: o sol corre no arco do dia; na planta, ele aparece na direção verdadeira, mais perto da casa quanto mais alto está.');
  } else {
    const rs = E.vento && !E.vento.erro ? Vento.resumo(E.vento, m) : null;
    if(tudo || pa.dataset.aba !== 'vento' || +pa.dataset.mes !== m){ g.innerHTML = rs ? camadaVento(T, rs) : ''; pa.innerHTML = painelVento(rs, m); pa.dataset.aba = 'vento'; pa.dataset.mes = m; E.painelChave = ''; }
    aj.setAttribute('data-ajuda', E.vento && E.vento.licenca ? `Linhas de corrente ilustrativas (não é simulação). Dados: ${E.vento.fonte}, ${E.vento.periodo.inicio.slice(0,4)}–${E.vento.periodo.fim.slice(0,4)}; ${E.vento.licenca}.` : 'Vento médio do mês.');
  }
  if(E.aba === 'sol' && pa.dataset.aba === 'vento'){ pa.dataset.aba = 'sol'; }
}

root.Animacao = {iniciar, atualizar, desenhar, _estado:E};
})(this);
