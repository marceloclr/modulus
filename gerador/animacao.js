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
  <div class="sv-corpo"><div class="sv-palco"><div class="sv-planta" id="svPlanta"></div><canvas class="sv-cv" id="svCv" aria-hidden="true"></canvas></div><div class="sv-painel" id="svPainel" aria-live="polite"></div></div>
  <div class="sv-regua2">
    <div class="sv-meses" role="group" aria-label="Mês">${CURTO.map((c, i) => `<button type="button" class="sv-mes" data-mes="${i+1}" aria-label="${MESES[i]}">${c}</button>`).join('')}</div>
    <div class="sv-horas2">
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
    const a = e.target.closest('[data-aba]'); if(a){ E.aba = a.dataset.aba; E.chave = ''; E.painelChave = ''; E.part = []; E.pi2 = null; desenhar(true); acorda(); return; }
    if(e.target.closest('#svPlay')){ E.dia = !E.dia; botoes(); acorda(); return; }
    if(e.target.closest('#svAno')){ E.ano = !E.ano; botoes(); acorda(); return; }
    if(e.target.closest('#svMapa')){ E.mapa = !E.mapa; E.mapaChave = ''; botoes(); desenhar(false); }
  });
  if(root.IntersectionObserver) new IntersectionObserver(es => { E.visivel = es[0].isIntersecting; if(E.visivel) acorda(); }).observe(el);
  if(root.ResizeObserver) new ResizeObserver(() => { E.cvOk = false; }).observe(el.querySelector('.sv-palco'));
  fetch(E.raiz + 'dados/vento.json').then(r => r.json()).then(d => { E.vento = d; if(E.aba === 'vento'){ desenhar(true); acorda(); } }).catch(() => { E.vento = {erro:true}; });
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
  E.dt = dt; E.tempo = (E.tempo || 0) + dt;
  const parado = !E.dia && !E.ano && Math.abs(dm) < 0.002 && Math.abs(E.hora - E.horaV) < 0.002 && (E.aba !== 'vento' || reduz());
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

// ---------- vento (V3): partículas em volta da casa, ar por dentro (janelas → portas → saída ou torre) ----------
// cômodos de permanência, os que importam na lista de renovações (banhos, closets e circulação ficam de fora)
const PERMANENCIA = ["quarto", "suite", "master", "estar", "jantar", "tv", "escritorio", "cozinha", "salaIntima", "lazer", "gourmet"];
const RUMO16 = ['N','NNE','NE','ENE','L','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
const nomeRumo = d => RUMO16[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
// vento do instante: velocidade e direção da hora (interpoladas; a direção pelo menor arco)
function ventoAgora(m, hora){
  const M = E.vento.meses[m - 1], a = Math.floor(hora) % 24, b = (a + 1) % 24, fr = hora - Math.floor(hora);
  const vel = M.velHora[a] * (1 - fr) + M.velHora[b] * fr;
  let dir = M.dirPredominante; if(M.dirHora){ let da = M.dirHora[a], db = M.dirHora[b], dd = ((db - da) % 360 + 540) % 360 - 180; dir = (da + dd * fr + 360) % 360; }
  return {vel, dir};
}
// canvas: as coordenadas da casa passam pela matriz de tela da camada (a planta gira e escala)
function prepararCanvas(){
  const cv = E.el.querySelector('#svCv'), g = E.el.querySelector('#svCamada'); if(!cv || !g) return null;
  const pr = Math.min(2, root.devicePixelRatio || 1), r = cv.getBoundingClientRect();
  if(!E.cvOk || cv.width !== Math.round(r.width * pr)){ cv.width = Math.round(r.width * pr); cv.height = Math.round(r.height * pr); E.cvOk = true; E.part = []; }
  const m = g.getScreenCTM(); if(!m) return null;
  const T = {ox:+g.dataset.ox, oy:+g.dataset.oy, k:+g.dataset.k};
  const P = (x, y) => { const px = T.ox + x * T.k, py = T.oy + y * T.k; return [(m.a*px + m.c*py + m.e - r.left) * pr, (m.b*px + m.d*py + m.f - r.top) * pr]; };
  return {cv, g2: cv.getContext('2d'), P, pr, escala: Math.hypot(m.a, m.b) * T.k * pr};
}
function quadPath(g2, P, s){ const a = P(s.x0, s.y0), b = P(s.x1, s.y0), c = P(s.x1, s.y1), d = P(s.x0, s.y1); g2.moveTo(a[0], a[1]); g2.lineTo(b[0], b[1]); g2.lineTo(c[0], c[1]); g2.lineTo(d[0], d[1]); g2.closePath(); }
// nasce num ponto qualquer da área (no começo) ou na borda de onde vem o vento: sorteia um ponto e recua contra o vento até a borda
function nasce(U, caixa, todo){
  const x = caixa.x0 + Math.random()*(caixa.x1 - caixa.x0), y = caixa.y0 + Math.random()*(caixa.y1 - caixa.y0);
  if(todo) return {x, y, vida:1 + Math.random()*4};
  const tx = U.x > 1e-6 ? (x - caixa.x0) / U.x : U.x < -1e-6 ? (x - caixa.x1) / U.x : Infinity;
  const ty = U.y > 1e-6 ? (y - caixa.y0) / U.y : U.y < -1e-6 ? (y - caixa.y1) / U.y : Infinity, r = Math.max(0, Math.min(tx, ty) - 0.05);
  return {x:x - U.x*r, y:y - U.y*r, vida:3 + Math.random()*5};
}
function ptCam(c, s){ let r = s; for(let i = 1; i < c.pts.length; i++){ const a = c.pts[i-1], b = c.pts[i], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1e-6;
  if(r <= L) return {p:[a[0] + (b[0]-a[0])*r/L, a[1] + (b[1]-a[1])*r/L], v:c.vel[i-1] + (c.vel[i] - c.vel[i-1]) * r / L}; r -= L; } return null; }
function animaVento(m, hora){
  const C = prepararCanvas(); if(!C || !E.vento || E.vento.erro) return null;
  const {g2, P, pr} = C, v = E.v, q = E.q, F = Motor.RUMOS[q.orientacao] || 0, p = v.pav[E.pi], dt = E.dt || 0;
  const va = ventoAgora(m, hora), d = Vento.direcao(va.dir + 180, F), U = {x:d.x, y:d.y};
  const lote = caixaLote(v), casa = Vento.caixaCasa(v), dom = {x0:lote.x0 - 2, y0:lote.y0 - 2, x1:lote.x1 + 2, y1:lote.y1 + 2};
  const chave = [m, Math.round(hora * 4), v.nome, v.espelhada, E.pi].join('|');
  if(E.viChave !== chave){ E.viChave = chave; E.vi = Vento.interno(v, q, p, va.dir, va.vel); }
  const VI = E.vi, fechadas = p.salas.filter(s => !(Motor.TIPOS[s.tipo] || {}).aberto), estatico = reduz();
  // rastro: apaga um pouco do quadro anterior
  g2.save(); g2.globalCompositeOperation = 'destination-out'; g2.fillStyle = `rgba(0,0,0,${estatico ? 1 : 0.12})`; g2.fillRect(0, 0, C.cv.width, C.cv.height); g2.restore();
  // fora da casa: partículas que contornam o volume (recorte par-ímpar tira os cômodos)
  const N = Math.round(160 + va.vel * 45); if(!E.part) E.part = [];
  while(E.part.length < N) E.part.push(nasce(U, dom, true)); if(E.part.length > N) E.part.length = N;
  g2.save(); g2.beginPath(); g2.rect(0, 0, C.cv.width, C.cv.height); for(const s of fechadas) quadPath(g2, P, s); g2.clip('evenodd');
  g2.lineCap = 'round';
  if(estatico){
    // movimento reduzido: linhas de corrente fixas, saindo da borda de onde vem o vento, em vez de partículas
    const cxm = (dom.x0 + dom.x1)/2, cym = (dom.y0 + dom.y1)/2, R = Math.hypot(dom.x1 - dom.x0, dom.y1 - dom.y0)/2, n = 22;
    g2.strokeStyle = '#2F6FB0'; g2.globalAlpha = 0.5; g2.lineWidth = 1.3 * pr;
    for(let i = 0; i < n; i++){ const s = -R + 2*R*(i + 0.5)/n, x0 = cxm - U.y*s, y0 = cym + U.x*s;
      const tx = U.x > 1e-6 ? (x0 - dom.x0)/U.x : U.x < -1e-6 ? (x0 - dom.x1)/U.x : Infinity, ty = U.y > 1e-6 ? (y0 - dom.y0)/U.y : U.y < -1e-6 ? (y0 - dom.y1)/U.y : Infinity, r = Math.min(tx, ty);
      let x = x0 - U.x*r, y = y0 - U.y*r; if(x < dom.x0 - 0.1 || x > dom.x1 + 0.1 || y < dom.y0 - 0.1 || y > dom.y1 + 0.1) continue;
      g2.beginPath(); let a0 = P(x, y); g2.moveTo(a0[0], a0[1]);
      for(let k = 0; k < 500; k++){ const [vx0, vy0] = Vento.campo(x, y, U, casa, 0), sp0 = Math.hypot(vx0, vy0) || 1, lim = Math.min(1, 1.8/sp0); x += vx0*lim*0.25; y += vy0*lim*0.25;
        if(x < dom.x0 - 1 || x > dom.x1 + 1 || y < dom.y0 - 1 || y > dom.y1 + 1 || (x > casa.x0 && x < casa.x1 && y > casa.y0 && y < casa.y1)) break; const b = P(x, y); g2.lineTo(b[0], b[1]); }
      g2.stroke(); }
    g2.globalAlpha = 1;
  }
  const passos = estatico ? 0 : 1, h = dt;
  for(let it = 0; it < passos; it++) for(const pt of E.part){
    const [vx0, vy0] = Vento.campo(pt.x, pt.y, U, casa, E.tempo || 0), sp0 = Math.hypot(vx0, vy0), lim = Math.min(1, 1.8 / (sp0 || 1)), vx = vx0 * lim, vy = vy0 * lim, sp = sp0 * lim, nx = pt.x + vx * va.vel * 0.9 * h, ny = pt.y + vy * va.vel * 0.9 * h;
    const fora = nx < dom.x0 - 3 || nx > dom.x1 + 3 || ny < dom.y0 - 3 || ny > dom.y1 + 3, dentro = nx > casa.x0 && nx < casa.x1 && ny > casa.y0 && ny < casa.y1;
    if(fora || dentro || pt.vida <= 0){ Object.assign(pt, nasce(U, dom, false)); continue; }
    const a = P(pt.x, pt.y), b = P(nx, ny);
    g2.beginPath(); g2.moveTo(a[0], a[1]); g2.lineTo(b[0], b[1]); g2.strokeStyle = sp > 0.95 ? '#1E40AF' : '#2F6FB0';
    g2.globalAlpha = Math.min(0.6, 0.18 + sp * 0.35) * Math.min(1, pt.vida / 1.2); g2.lineWidth = (0.9 + sp * 0.7) * pr; g2.stroke();
    pt.x = nx; pt.y = ny; pt.vida -= h;
  }
  g2.restore(); g2.globalAlpha = 1;
  // dentro da casa: o ar das janelas de entrada, pelas portas, até a saída ou a torre; mais rápido nas aberturas estreitas
  if(!E.pi2 || E.pi2.chave !== E.viChave){ E.pi2 = {chave:E.viChave, l:[]}; VI.caminhos.forEach((c, i) => { for(let k = 0; k < 18; k++) E.pi2.l.push({c:i, s:Math.random() * 6}); }); }
  for(const pt of E.pi2.l){ const c = VI.caminhos[pt.c]; if(!c) continue;
    for(let it = 0; it < (estatico ? 40 : 1); it++){
      const a = ptCam(c, pt.s); if(!a){ pt.s = Math.random() * 0.3; continue; }
      const ds = (0.6 + Math.min(2.6, a.v * 1.1)) * (estatico ? 0.08 : dt), b = ptCam(c, pt.s + ds); pt.s += ds; if(!b) continue;
      const A = P(a.p[0], a.p[1]), B = P(b.p[0], b.p[1]);
      g2.beginPath(); g2.moveTo(A[0], A[1]); g2.lineTo(B[0], B[1]); g2.strokeStyle = c.tipo === 'torre' ? '#7C3AED' : (a.v > 0.8 ? '#0E7490' : '#0891B2');
      g2.globalAlpha = 0.95; g2.lineWidth = (2 + Math.min(2.4, a.v * 1.4)) * pr; g2.lineCap = 'round'; g2.stroke(); }
  }
  g2.globalAlpha = 1;
  // janelas de entrada (verde) e de saída (laranja) pulsando; a torre como anéis que sobem
  const pulso = estatico ? 1 : 0.55 + 0.45 * Math.sin((E.tempo || 0) * 3.2);
  for(const j of VI.janelas){ if(j.papel === 'lateral') continue; const jj = j.j, [x0, y0, x1, y1] = jj.o === 'h' ? [jj.t0, jj.c, jj.t1, jj.c] : [jj.c, jj.t0, jj.c, jj.t1], A = P(x0, y0), B = P(x1, y1);
    g2.beginPath(); g2.moveTo(A[0], A[1]); g2.lineTo(B[0], B[1]); g2.strokeStyle = j.papel === 'entrada' ? '#15803D' : '#C2410C'; g2.globalAlpha = pulso; g2.lineWidth = 6 * pr; g2.lineCap = 'round'; g2.stroke(); }
  if(VI.torre){ const c = P(VI.torre.pt[0], VI.torre.pt[1]), r0 = 0.5 * C.escala;
    for(let i = 0; i < 3; i++){ const fase = ((E.tempo || 0) * 0.6 + i / 3) % 1; g2.beginPath(); g2.arc(c[0], c[1], r0 * (0.4 + fase * 1.2), 0, 2*Math.PI); g2.strokeStyle = '#7C3AED'; g2.globalAlpha = (1 - fase) * 0.8; g2.lineWidth = 2 * pr; g2.stroke(); } }
  g2.globalAlpha = 1;
  return {va, VI};
}
function rosaSVG(rs, m, dirAgora){
  const R = 62, c = 80, alvo = rs.rosa.map(r => r.freq);
  if(!E.rosaV || E.rosaV.length !== alvo.length) E.rosaV = alvo.slice(); E.rosaV = E.rosaV.map((x, i) => x + (alvo[i] - x) * (reduz() ? 1 : 0.15));
  const maxF = Math.max(...E.rosaV, 1), rd = g => g*Math.PI/180;
  let o = '';
  for(const r of [0.33, 0.66, 1]) o += `<circle cx="${c}" cy="${c}" r="${(R*r).toFixed(1)}" fill="none" stroke="var(--line)"/>`;
  rs.rosa.forEach((x, i) => { const fr = E.rosaV[i]; if(fr < 0.05) return; const r = R * fr / maxF, a0 = rd(x.dir - 9), a1 = rd(x.dir + 9), cor = x.vel >= 5.5 ? '#1E40AF' : x.vel >= 4 ? '#2F6FB0' : '#7FA9D6';
    o += `<path d="M${c},${c}L${(c + r*Math.sin(a0)).toFixed(1)},${(c - r*Math.cos(a0)).toFixed(1)}A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${(c + r*Math.sin(a1)).toFixed(1)},${(c - r*Math.cos(a1)).toFixed(1)}Z" fill="${cor}"><title>${x.dir}°: ${f1(x.freq)} % do tempo, ${f1(x.vel)} m/s</title></path>`; });
  if(dirAgora !== undefined){ const a = rd(dirAgora); o += `<line x1="${(c + (R+6)*Math.sin(a)).toFixed(1)}" y1="${(c - (R+6)*Math.cos(a)).toFixed(1)}" x2="${(c + 18*Math.sin(a)).toFixed(1)}" y2="${(c - 18*Math.cos(a)).toFixed(1)}" stroke="#C2410C" stroke-width="2.4" marker-end="url(#svRSeta)"/>`; }
  for(const [kk, a] of [['N', 0], ['L', 90], ['S', 180], ['O', 270]]) o += `<text x="${(c + (R+11)*Math.sin(rd(a))).toFixed(1)}" y="${(c - (R+11)*Math.cos(rd(a)) + 3.5).toFixed(1)}" text-anchor="middle" style="font-size:10px;fill:${kk === 'N' ? 'var(--rust)' : 'var(--ink-3)'}">${kk}</text>`;
  return `<defs><marker id="svRSeta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="#C2410C"/></marker></defs>` + o;
}
function painelVento(m, hora, A){
  const pa = E.el.querySelector('#svPainel');
  if(!E.vento || E.vento.erro || !A){ pa.innerHTML = `<p class="note">${E.vento && E.vento.erro ? 'Não foi possível carregar os dados de vento.' : 'Carregando os dados de vento…'}</p>`; E.painelChave = ''; return; }
  const rs = Vento.resumo(E.vento, m), hInt = Math.floor(hora), chave = ['vento', m, hInt, E.v.nome, E.v.espelhada, E.pi].join('|');
  if(E.painelChave !== chave){ E.painelChave = chave;
    const VI = A.VI, maxH = Math.max(...rs.velHora), lat = E.vento.local.lat, lon = E.vento.local.lon;
    pa.innerHTML = `<div class="sv-cab"><div class="sv-leitura"><span class="sv-big" id="svHoraG"></span><span class="sv-sub" id="svSub"></span><span class="sv-sub">média do mês ${f1(rs.velMedia)} m/s · calmaria ${f1(rs.calmaria)} %</span></div><svg class="sv-dial" id="svRosa" viewBox="0 0 160 160" role="img" aria-label="Rosa dos ventos de ${MESES[m-1]}, com a direção da hora"></svg></div>
      <h4>Renovações de ar por hora ${ajuda('Ar que entra pelas janelas a barlavento, passa pelas portas abertas e sai a sotavento ou pela torre: Q = 0,6 · A_ef · U · √ΔCp, com as aberturas em série (BS 5925, ASHRAE); a chaminé da torre soma por √(Qv² + Qc²) (CIBSE AM10). U é o vento da hora a 10 m levado à altura das janelas, com o abrigo dos vizinhos. Faixas: forte ≥ 30/h, bom 10–30/h, fraco 3–10/h; a lista mostra os cômodos de permanência. Estimativa, não simulação.', 'sol-vento', 'renovações de ar')}</h4>
      <ul class="sv-lista">${VI.comodos.filter(x => PERMANENCIA.includes(x.tipo)).slice(0, 7).map(x => `<li><span>${esc(x.nome)}${x.umaFace ? ' <small>uma face</small>' : ''}</span><b><small>${Vento.faixa(x.ach)}</small> ${Math.round(x.ach)}/h</b></li>`).join('') || '<li><span>Nenhum cômodo com janela neste pavimento.</span></li>'}</ul>
      ${VI.torre ? `<p class="sv-torre"><span class="sv-leg" style="--c:#7C3AED"></span>${esc(VI.torre.nome)}: ${f0(VI.torre.Q * 3600)} m³/h ${VI.torre.entrada && !VI.torre.saida ? 'captados' : 'pela torre'}</p>` : ''}
      <h4>Velocidade ao longo do dia <span class="sv-un">m/s a 10 m</span></h4>
      <div class="sv-dia" role="img" aria-label="Velocidade média por hora em ${MESES[m-1]}">${rs.velHora.map((x, i) => `<i style="height:${(100*x/maxH).toFixed(0)}%"${i === hInt ? ' class="agora"' : ''} title="${i}h: ${f1(x)} m/s"></i>`).join('')}</div><p class="sv-eixo"><span>0h</span><span>12h</span><span>23h</span></p>
      <p class="sv-chips"><span><span class="sv-leg" style="--c:#15803D"></span>entrada</span><span><span class="sv-leg" style="--c:#C2410C"></span>saída</span><span><span class="sv-leg" style="--c:#0891B2"></span>ar dentro</span>${VI.torre ? '<span><span class="sv-leg" style="--c:#7C3AED"></span>torre</span>' : ''}</p>
      <p><a class="sv-link" href="https://www.windy.com/${lat}/${lon}?wind,${lat},${lon},12" target="_blank" rel="noopener">Vento agora no Windy ↗</a></p>`;
  }
  pa.querySelector('#svHoraG').textContent = hhmm(hora);
  pa.querySelector('#svSub').textContent = `21 de ${MESES[m-1]} · de ${nomeRumo(A.va.dir)} (${Math.round(A.va.dir)}°) · ${f1(A.va.vel)} m/s`;
  pa.querySelector('#svRosa').innerHTML = rosaSVG(rs, m, A.va.dir);
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
    const cv = el.querySelector('#svCv'); if(cv && cv.width) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    const r = camadaSol(T, dia, E.horaV);
    g.innerHTML = r.svg;
    painelSol(m, r.s, r.L); curva(dia);
    aj.setAttribute('data-ajuda', 'Geometria solar de Fortaleza (3,73° S) no dia 21 de cada mês, pela hora solar, só a radiação direta. Sombras da casa no lote; laranja: fachadas ao sol; amarelo: feixes e manchas de sol pelas janelas. No mostrador, a borda é o horizonte e o centro é o ponto mais alto do céu: o sol corre no arco do dia; na planta, ele aparece na direção verdadeira, mais perto da casa quanto mais alto está.');
  } else {
    if(g.innerHTML) g.innerHTML = '';
    const A = animaVento(m, E.horaV); painelVento(m, E.horaV, A); curva(dia); pa.dataset.aba = 'vento';
    aj.setAttribute('data-ajuda', E.vento && E.vento.licenca ? `Fora da casa, o vento da hora contorna o volume e forma a esteira a sotavento (ilustrativo, não é simulação). Dentro, o ar segue das janelas de entrada, pelas portas, até as de saída ou a torre. Dados: ${E.vento.fonte}, ${E.vento.periodo.inicio.slice(0,4)}–${E.vento.periodo.fim.slice(0,4)}; ${E.vento.licenca}.` : 'Vento médio do mês.');
  }
  if(E.aba === 'sol' && pa.dataset.aba === 'vento'){ pa.dataset.aba = 'sol'; }
}

root.Animacao = {iniciar, atualizar, desenhar, _estado:E};
})(this);
