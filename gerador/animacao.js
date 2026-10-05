/* Card "Sol e vento ao longo do ano" (beta): régua numerada de meses, animação da incidência solar sobre a planta
   (sol, sombras no lote, fachadas iluminadas e manchas de sol pelas janelas) e do vento do mês (rosa, linhas de
   corrente, janelas de entrada e saída). Só no navegador. Usa Motor, Desenho, Brises, Insolacao e Vento.
   Plano: docs/planos/2026-10-05-sol-vento-animacao.md. */
(function(root){
'use strict';
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const f1 = n => (Math.round(n*10)/10).toFixed(1).replace('.', ','), f0 = n => Math.round(n).toLocaleString('pt-BR');
const hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const reduz = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

const E = {el:null, raiz:'../', aba:'sol', mes:new Date().getMonth() + 1, hora:9, v:null, q:null, pi:0, est:null, vento:null,
  tocandoMes:null, tocandoHora:false, ultimo:0, visivel:true, chave:''};

function casca(){
  const marcas = CURTO.map((c, i) => `<button type="button" class="sv-marca" data-mes="${i+1}" aria-label="${MESES[i]}"><b>${i+1}</b>${c}</button>`).join('');
  return `<div class="card res sv" style="--c:var(--card-torre)">
  <div class="res-head"><h3>Sol e vento ao longo do ano</h3><p class="selo">Fortaleza (3,73° S) · dia 21 de cada mês · vento: média de 2015 a 2024 (ERA5)</p></div>
  <div class="sv-abas" role="tablist" aria-label="O que animar">
    <button type="button" role="tab" class="btn" data-aba="sol" aria-selected="true">Sol</button>
    <button type="button" role="tab" class="btn" data-aba="vento" aria-selected="false">Vento</button>
  </div>
  <div class="sv-regua">
    <button type="button" class="btn sv-play" data-play="mes" aria-label="Percorrer os meses" data-tip="Percorre os 12 meses, um a cada 1,2 s">▶</button>
    <div class="sv-trilho">
      <input type="range" id="svMes" min="1" max="12" step="1" list="svMarcas" aria-label="Mês do ano">
      <datalist id="svMarcas">${CURTO.map((c, i) => `<option value="${i+1}" label="${i+1}"></option>`).join('')}</datalist>
      <div class="sv-marcas">${marcas}</div>
    </div>
  </div>
  <div class="sv-regua sv-horas" data-so="sol">
    <button type="button" class="btn sv-play" data-play="hora" aria-label="Animar o dia" data-tip="Anima o dia 21 do mês, das 6h às 18h">▶</button>
    <input type="range" id="svHora" min="6" max="18" step="0.25" aria-label="Hora solar">
    <output id="svHoraTxt" for="svHora"></output>
  </div>
  <div class="sv-corpo"><div class="sv-planta" id="svPlanta"></div><div class="sv-painel" id="svPainel" aria-live="polite"></div></div>
  <p class="note" id="svNota"></p>
</div>`;
}

function iniciar(el, opc){
  E.el = el; E.raiz = (opc && opc.raiz) || '../';
  el.innerHTML = casca();
  const mes = el.querySelector('#svMes'), hora = el.querySelector('#svHora');
  mes.value = E.mes; hora.value = E.hora;
  mes.addEventListener('input', () => { E.mes = +mes.value; pararMes(); desenhar(true); });
  hora.addEventListener('input', () => { E.hora = +hora.value; E.tocandoHora = false; botoes(); desenhar(false); });
  el.addEventListener('click', e => {
    const m = e.target.closest('[data-mes]'); if(m){ E.mes = +m.dataset.mes; pararMes(); desenhar(true); return; }
    const a = e.target.closest('[data-aba]'); if(a){ E.aba = a.dataset.aba; desenhar(true); return; }
    const p = e.target.closest('[data-play]'); if(!p) return;
    if(p.dataset.play === 'mes'){ if(E.tocandoMes) pararMes(); else { E.tocandoMes = setInterval(() => { if(!E.visivel) return; E.mes = E.mes % 12 + 1; desenhar(true); }, 1200); botoes(); } }
    else { E.tocandoHora = !E.tocandoHora; botoes(); if(E.tocandoHora){ E.ultimo = performance.now(); requestAnimationFrame(passo); } }
  });
  if(root.IntersectionObserver) new IntersectionObserver(es => { E.visivel = es[0].isIntersecting; if(E.visivel && E.tocandoHora){ E.ultimo = performance.now(); requestAnimationFrame(passo); } }).observe(el);
  fetch(E.raiz + 'dados/vento.json').then(r => r.json()).then(d => { E.vento = d; desenhar(true); }).catch(() => { E.vento = {erro:true}; desenhar(true); });
  if(reduz()) el.querySelectorAll('.sv-play').forEach(b => b.hidden = true);
}
function pararMes(){ if(E.tocandoMes){ clearInterval(E.tocandoMes); E.tocandoMes = null; } botoes(); }
function botoes(){
  if(!E.el) return;
  const bm = E.el.querySelector('[data-play=mes]'), bh = E.el.querySelector('[data-play=hora]');
  bm.textContent = E.tocandoMes ? '⏸' : '▶'; bm.setAttribute('aria-pressed', !!E.tocandoMes);
  bh.textContent = E.tocandoHora ? '⏸' : '▶'; bh.setAttribute('aria-pressed', !!E.tocandoHora);
}
function passo(t){
  if(!E.tocandoHora || !E.visivel) return;
  const dt = Math.min(0.1, (t - E.ultimo) / 1000); E.ultimo = t;
  E.hora += dt * 1.5; if(E.hora > 18) E.hora = 6;                       // o dia inteiro em 8 s
  E.el.querySelector('#svHora').value = E.hora; desenhar(false);
  requestAnimationFrame(passo);
}

/* Variante, entrada e pavimento escolhidos na página (chamado a cada render do gerador). */
function atualizar(v, q, pi, est){
  E.v = v; E.q = q; E.est = est;
  E.pi = v && v.pav[pi] && !v.pav[pi].anexo && v.pav[pi].nome !== 'Subsolo' ? pi : Math.max(0, v ? v.pav.findIndex(p => p.nome === 'Térreo') : 0);
  if(E.el) desenhar(true);
}

// ---------- camadas (coordenadas da casa → px: X = ox + m·k) ----------
function caixaLote(v){ const L = v.lote; return L && v.x0 !== undefined ? {x0:-v.x0, y0:-v.y0, x1:L.frente - v.x0, y1:L.fundo - v.y0} : {x0:0, y0:0, x1:v.W, y1:v.D}; }
function camadaSol(T, qd){
  const X = m => (T.ox + m*T.k).toFixed(1), Y = m => (T.oy + m*T.k).toFixed(1), pts = a => a.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
  let o = '';
  // sombras: um só tom (grupo com opacidade) e recortadas fora da casa (a sombra sobre a cobertura não interessa)
  const casa = E.v.pav.filter(p => !p.anexo && p.nome !== 'Subsolo').flatMap(p => p.salas);
  o += `<mask id="svMascara" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000"><rect x="-5000" y="-5000" width="10000" height="10000" fill="#fff"/>${casa.map(r => `<rect x="${X(r.x0)}" y="${Y(r.y0)}" width="${((r.x1-r.x0)*T.k).toFixed(1)}" height="${((r.y1-r.y0)*T.k).toFixed(1)}" fill="#000"/>`).join('')}</mask>`;
  o += `<g mask="url(#svMascara)" opacity=".22">${qd.sombras.map(s => `<polygon points="${pts(s.pts)}" fill="#1E293B"/>`).join('')}</g>`;
  for(const f of qd.fachadas){ const [x0, y0, x1, y1] = f.o === 'h' ? [f.t0, f.c, f.t1, f.c] : [f.c, f.t0, f.c, f.t1];
    o += `<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="#F59E0B" stroke-opacity="${(0.25 + 0.75*f.intensidade).toFixed(2)}" stroke-width="5" stroke-linecap="round"/>`; }
  for(const m of qd.manchas) o += `<polygon points="${pts(m.pts)}" fill="#FBBF24" fill-opacity="${(0.25 + 0.5*m.intensidade).toFixed(2)}" stroke="#D97706" stroke-width=".6"/>`;
  // trajetória do dia (projeção horizontal) e o sol
  const v = E.v, F = Motor.RUMOS[E.q.orientacao] || 0, c = caixaLote(v), cx = (c.x0 + c.x1)/2, cy = (c.y0 + c.y1)/2, R = Math.min(c.x1 - c.x0, c.y1 - c.y0)/2 - 0.3;   // o sol fica dentro do lote
  const pos = s => { const d = Insolacao.direcao(s.az, F), r = R * (0.35 + 0.65 * (1 - s.h/90)); return [cx + d.x*r, cy + d.y*r]; };
  const arco = []; for(let t = 6; t <= 18.001; t += 0.25){ const s = Insolacao.solEm(E.mes, t); if(s.h > 0) arco.push(pos(s)); }
  o += `<polyline points="${pts(arco)}" fill="none" stroke="#D97706" stroke-width="1.4" stroke-dasharray="3 4" stroke-opacity=".8"/>`;
  if(qd.sol.h > 0){ const [sx, sy] = pos(qd.sol);
    o += `<line x1="${X(sx)}" y1="${Y(sy)}" x2="${X(cx)}" y2="${Y(cy)}" stroke="#F59E0B" stroke-width="1" stroke-dasharray="2 3"/>`;
    o += `<circle cx="${X(sx)}" cy="${Y(sy)}" r="13" fill="#FCD34D" stroke="#D97706" stroke-width="2"/><circle cx="${X(sx)}" cy="${Y(sy)}" r="21" fill="#FCD34D" fill-opacity=".25"/>`; }
  return o;
}
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

// ---------- painéis ----------
function painelSol(qd){
  const q = E.q, inc = Insolacao.incidenciaFaces(E.v, q, E.mes), hs = Insolacao.horasSolComodos(E.v, q, E.mes, E.est);
  const max = Math.max(1, ...inc.map(f => f.kwh));
  let h = `<p class="sv-sol">${qd.sol.h > 0 ? `<b>${hhmm(E.hora)}</b> · sol a ${Math.round(qd.sol.h)}° de altura, azimute ${Math.round(qd.sol.az)}°` : `<b>${hhmm(E.hora)}</b> · sol abaixo do horizonte`}</p>`;
  h += `<h4>Sol direto nas fachadas em ${MESES[E.mes-1]}</h4><div class="sv-barras">${inc.map(f => `<div class="sv-barra" data-tip="Radiação direta na face ${esc(f.nome.toLowerCase())} em ${MESES[E.mes-1]}: soma de DNI × cos(incidência), das 7h às 17h">
    <span>${esc(f.nome)}</span><i style="width:${(100*f.kwh/max).toFixed(0)}%"></i><em>${f0(f.kwh)} kWh/m²</em></div>`).join('')}</div>`;
  const quartos = hs.filter(a => ['quarto','suite','master'].includes(a.tipo) && a.tarde > 0);
  h += `<h4>Horas de sol pelas janelas (dia 21)</h4><ul class="sv-lista">${hs.slice(0, 8).map(a => `<li><span>${esc(a.nome)}${E.v.pav.length > 1 ? ` <small>(${esc(a.pav.toLowerCase())})</small>` : ''}</span><b>${f1(a.horas)} h</b>${a.tarde ? `<small>${f1(a.tarde)} h depois das 14h</small>` : ''}</li>`).join('') || '<li>Nenhuma janela recebe sol direto neste dia.</li>'}</ul>`;
  if(quartos.length) h += `<p class="sv-alerta">Sol da tarde em ${quartos.map(a => esc(a.nome.toLowerCase())).join(', ')} em ${MESES[E.mes-1]}${E.est ? ', mesmo com os brises' : '; considere brises (Conforto passivo)'}.</p>`;
  return h;
}
function rosaSVG(rs){
  const R = 70, c = 90, maxF = Math.max(...rs.rosa.map(r => r.freq), 1), rad = g => g*Math.PI/180;
  let o = `<svg class="sv-rosa" viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Rosa dos ventos de ${MESES[E.mes-1]}">`;
  for(const r of [0.33, 0.66, 1]) o += `<circle cx="${c}" cy="${c}" r="${(R*r).toFixed(1)}" fill="none" stroke="var(--line)"/>`;
  for(const x of rs.rosa){ if(!x.freq) continue; const r = R * x.freq / maxF, a0 = rad(x.dir - 10), a1 = rad(x.dir + 10);
    const cor = x.vel >= 6 ? '#1E40AF' : x.vel >= 4 ? '#2F6FB0' : '#7FA9D6';
    o += `<path d="M${c},${c}L${(c + r*Math.sin(a0)).toFixed(1)},${(c - r*Math.cos(a0)).toFixed(1)}L${(c + r*Math.sin(a1)).toFixed(1)},${(c - r*Math.cos(a1)).toFixed(1)}Z" fill="${cor}"><title>${x.dir}°: ${f1(x.freq)} % do tempo, ${f1(x.vel)} m/s</title></path>`; }
  for(const [k, a] of [['N', 0], ['L', 90], ['S', 180], ['O', 270]]) o += `<text x="${(c + (R+12)*Math.sin(rad(a))).toFixed(1)}" y="${(c - (R+12)*Math.cos(rad(a)) + 3).toFixed(1)}" text-anchor="middle" style="font-size:10px;fill:var(--ink-3)">${k}</text>`;
  return o + '</svg>';
}
function painelVento(rs){
  if(!rs) return `<p class="note">${E.vento && E.vento.erro ? 'Não foi possível carregar os dados de vento.' : 'Carregando os dados de vento…'}</p>`;
  const maxH = Math.max(...rs.velHora), lat = E.vento.local.lat, lon = E.vento.local.lon;
  let h = `<div class="sv-rosa-box">${rosaSVG(rs)}<div><p class="sv-sol"><b>${MESES[E.mes-1]}</b> · de ${rs.nomePredominante} (${rs.dirPredominante}°)</p>
    <p>Velocidade média <b>${f1(rs.velMedia)} m/s</b> · calmaria ${f1(rs.calmaria)} %</p><p>${rs.principais.map(x => `${x.nome} ${f1(x.freq)} %`).join(' · ')}</p></div></div>`;
  h += `<h4>Velocidade ao longo do dia</h4><div class="sv-dia" role="img" aria-label="Velocidade média por hora em ${MESES[E.mes-1]}">${rs.velHora.map((x, i) => `<i style="height:${(100*x/maxH).toFixed(0)}%" title="${i}h: ${f1(x)} m/s"></i>`).join('')}</div><p class="sv-eixo"><span>0h</span><span>12h</span><span>23h</span></p>`;
  h += `<p><span class="sv-leg" style="--c:#15803D"></span>janelas de entrada (barlavento) · <span class="sv-leg" style="--c:#C2410C"></span>janelas de saída (sotavento)</p>`;
  h += `<p><a class="btn" href="https://www.windy.com/${lat}/${lon}?wind,${lat},${lon},12" target="_blank" rel="noopener">Vento agora no Windy ↗</a></p>`;
  return h;
}

function desenhar(tudo){
  if(!E.el) return;
  const el = E.el, v = E.v, q = E.q;
  el.querySelector('#svMes').value = E.mes; el.querySelector('#svMes').setAttribute('aria-valuetext', MESES[E.mes-1]);
  el.querySelectorAll('.sv-marca').forEach(b => b.setAttribute('aria-current', +b.dataset.mes === E.mes ? 'true' : 'false'));
  el.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-selected', b.dataset.aba === E.aba ? 'true' : 'false'));
  el.querySelector('.sv-horas').hidden = E.aba !== 'sol';
  el.querySelector('#svHoraTxt').textContent = hhmm(E.hora);
  const pl = el.querySelector('#svPlanta'), pa = el.querySelector('#svPainel'), nota = el.querySelector('#svNota');
  if(!v || !q){ pl.innerHTML = ''; pa.innerHTML = '<p class="note">Gere uma planta para ver a animação.</p>'; return; }
  if(Motor.RUMOS[q.orientacao] === undefined){ pl.innerHTML = ''; pa.innerHTML = '<p class="note">Informe para onde a frente do terreno está voltada (bloco 1, Terreno) para animar o sol e o vento sobre a casa.</p>'; return; }
  // a planta só é redesenhada quando muda a variante, o pavimento ou a aba
  const chave = [v.nome, v.espelhada, E.pi, q.orientacao, E.aba, v.W, v.D, E.est ? E.est.janelas.length : 0].join('|');
  if(chave !== E.chave){ E.chave = chave;
    pl.innerHTML = Desenho.planta(v, E.pi, {camadaId:'svCamada', brises: E.aba === 'sol' && E.est ? E.est.janelas : undefined, titulo: E.aba === 'sol' ? 'Insolação' : 'Vento', sub: `${v.nome} · ${v.pav[E.pi].nome}`}); }
  const g = pl.querySelector('#svCamada'); if(!g) return;
  const T = {ox:+g.dataset.ox, oy:+g.dataset.oy, k:+g.dataset.k};
  if(E.aba === 'sol'){
    const qd = Insolacao.quadro(v, q, E.pi, E.mes, E.hora, E.est);
    g.innerHTML = camadaSol(T, qd);
    if(tudo || !pa.dataset.mes || +pa.dataset.mes !== E.mes || pa.dataset.aba !== 'sol'){ pa.innerHTML = painelSol(qd); pa.dataset.mes = E.mes; pa.dataset.aba = 'sol'; }
    else pa.querySelector('.sv-sol').innerHTML = qd.sol.h > 0 ? `<b>${hhmm(E.hora)}</b> · sol a ${Math.round(qd.sol.h)}° de altura, azimute ${Math.round(qd.sol.az)}°` : `<b>${hhmm(E.hora)}</b> · sol abaixo do horizonte`;
    nota.textContent = 'Sombras e manchas de sol pela geometria solar (hora solar, só a radiação direta). Faixas laranja: fachadas ao sol; amarelo: sol entrando pelas janelas; cinza: sombra da casa no lote.';
  } else {
    const rs = E.vento && !E.vento.erro ? Vento.resumo(E.vento, E.mes) : null;
    g.innerHTML = rs ? camadaVento(T, rs) : '';
    pa.innerHTML = painelVento(rs); pa.dataset.aba = 'vento';
    nota.textContent = E.vento && E.vento.licenca ? `Linhas de corrente ilustrativas (não é simulação). Dados: ${E.vento.fonte}, ${E.vento.periodo.inicio.slice(0,4)}–${E.vento.periodo.fim.slice(0,4)}; ${E.vento.licenca}.` : '';
  }
}

root.Animacao = {iniciar, atualizar, desenhar, _estado:E};
})(this);
