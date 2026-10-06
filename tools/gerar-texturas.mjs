// Gera as texturas em imagem da planta humanizada (etapa F1.5) e grava gerador/texturas.js (data URIs JPEG).
// As texturas são procedurais (feTurbulence, sem fotos de terceiros), contínuas nas bordas (stitchTiles) e pequenas.
// Uso: node tools/gerar-texturas.mjs   (precisa do Microsoft Edge instalado; roda headless)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PXM = 120;   // resolução da textura: 120 px por metro (4 × a escala do desenho, 30 px/m)
const espera = ms => new Promise(r => setTimeout(r, ms));

// ruído contínuo: turbulência com stitchTiles, colorida por uma matriz e aplicada com opacidade
const ruido = (id, fx, fy, oct, matriz, op, tipo = 'fractalNoise', sem = 3) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="${tipo}" baseFrequency="${fx} ${fy}" numOctaves="${oct}" seed="${sem}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="${matriz}"/><feComponentTransfer><feFuncA type="linear" slope="${op}"/></feComponentTransfer></filter>`;
const cinza = (r, g, b) => `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  2.4 0 0 0 -0.95`;   // alfa a partir do canal vermelho do ruído: manchas e veios nítidos

/* Cada textura: largura e altura em metros e o SVG do ladrilho (em px, PXM px por metro). */
function madeira(){
  const W = 1.92 * PXM, H = 0.9 * PXM, fh = H / 6, tons = ['#C9A47E', '#C29D77', '#CFAD89', '#BE9771', '#D1B08B'];
  const emendas = [[0.0, 0.41, 0.78], [0.18, 0.6, 0.93], [0.09, 0.5, 0.86], [0.3, 0.68], [0.05, 0.44, 0.81], [0.23, 0.63, 0.97]];
  let s = '';
  emendas.forEach((es, f) => { const xs = es.map(e => e * W), y = f * fh;
    for(let i = 0; i < xs.length; i++){ const a = xs[i], b = i + 1 < xs.length ? xs[i + 1] : xs[0] + W;   // a última tábua continua no início (ladrilho contínuo)
      const tom = tons[(f * 2 + i) % tons.length];
      s += `<rect x="${a}" y="${y}" width="${b - a}" height="${fh}" fill="${tom}"/>`; if(b > W) s += `<rect x="${a - W}" y="${y}" width="${b - a}" height="${fh}" fill="${tom}"/>`; }
    s += xs.map(x => `<rect x="${x - 0.6}" y="${y}" width="1.2" height="${fh}" fill="#8E6B4B" opacity=".55"/>`).join('') + `<rect x="0" y="${y + fh - 0.8}" width="${W}" height="0.8" fill="#8E6B4B" opacity=".5"/>`; });
  return {w:1.92, h:0.9, svg: s + `<rect width="${W}" height="${H}" filter="url(#g)"/>`, defs: ruido('g', 0.006, 0.35, 3, cinza(0.42, 0.29, 0.18), 0.55, 'fractalNoise', 7)};
}
function porcelanato(){
  const T = 0.9 * PXM, tons = ['#E6E3DE', '#E2DED8', '#E8E5E0', '#E3E0DA'];
  let s = ''; [[0,0],[1,0],[0,1],[1,1]].forEach(([i,j], k) => s += `<rect x="${i*T}" y="${j*T}" width="${T}" height="${T}" fill="${tons[k]}"/>`);
  s += `<rect width="${2*T}" height="${2*T}" filter="url(#v)"/><rect width="${2*T}" height="${2*T}" filter="url(#g)"/>`;
  s += [0, T].map(p => `<rect x="${p}" y="0" width="1.2" height="${2*T}" fill="#CFC9C0"/><rect x="0" y="${p}" width="${2*T}" height="1.2" fill="#CFC9C0"/>`).join('');
  return {w:1.8, h:1.8, svg:s, defs: ruido('g', 0.08, 0.08, 4, cinza(0.55, 0.52, 0.48), 0.18, 'fractalNoise', 11) + ruido('v', 0.012, 0.02, 2, cinza(0.6, 0.57, 0.52), 0.22, 'turbulence', 5)};
}
function ceramica(){
  const T = 0.3 * PXM, n = 4, tons = ['#E9EDEC', '#E4E9E8', '#EDF0EF'];
  let s = ''; for(let i = 0; i < n; i++) for(let j = 0; j < n; j++) s += `<rect x="${i*T}" y="${j*T}" width="${T}" height="${T}" fill="${tons[(i + 2*j) % 3]}"/>`;
  s += `<rect width="${n*T}" height="${n*T}" filter="url(#g)"/>`;
  for(let i = 0; i < n; i++) s += `<rect x="${i*T}" y="0" width="1" height="${n*T}" fill="#C7CFCE"/><rect x="0" y="${i*T}" width="${n*T}" height="1" fill="#C7CFCE"/>`;
  return {w:1.2, h:1.2, svg:s, defs: ruido('g', 0.12, 0.12, 3, cinza(0.5, 0.55, 0.55), 0.12, 'fractalNoise', 2)};
}
function deck(){
  const W = 0.6 * PXM, H = 2.0 * PXM, b = W / 4, tons = ['#B68A61', '#AC8058', '#BF946B', '#B18660'];
  let s = ''; for(let i = 0; i < 4; i++){ s += `<rect x="${i*b}" y="0" width="${b}" height="${H}" fill="${tons[i]}"/><rect x="${i*b + b - 2}" y="0" width="2" height="${H}" fill="#6E5034"/>`;
    const e = ((i * 0.37) % 1) * H; s += `<rect x="${i*b}" y="${e}" width="${b}" height="1.5" fill="#6E5034"/>`; }
  return {w:0.6, h:2.0, svg: s + `<rect width="${W}" height="${H}" filter="url(#g)"/>`, defs: ruido('g', 0.35, 0.008, 3, cinza(0.35, 0.24, 0.14), 0.5, 'fractalNoise', 4)};
}
function grama(){
  const W = 1.0 * PXM;
  return {w:1.0, h:1.0, svg:`<rect width="${W}" height="${W}" fill="#A9C487"/><rect width="${W}" height="${W}" filter="url(#g)"/><rect width="${W}" height="${W}" filter="url(#c)"/>`,
    defs: ruido('g', 0.25, 0.25, 4, cinza(0.3, 0.45, 0.2), 0.5, 'fractalNoise', 9) + ruido('c', 0.6, 0.6, 2, cinza(0.8, 0.88, 0.6), 0.25, 'turbulence', 13)};
}
function cimento(){
  const W = 1.2 * PXM;
  return {w:1.2, h:1.2, svg:`<rect width="${W}" height="${W}" fill="#DEDBD6"/><rect width="${W}" height="${W}" filter="url(#g)"/>`, defs: ruido('g', 0.09, 0.09, 4, cinza(0.5, 0.49, 0.47), 0.3, 'fractalNoise', 6)};
}
const TEX = {madeira, porcelanato, ceramica, deck, grama, cimento};

async function main(){
  const dir = mkdtempSync(join(tmpdir(), 'tex-edge-')), porta = 9351;
  const proc = spawn(EDGE, ['--headless', `--remote-debugging-port=${porta}`, `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let alvos; for(let i = 0; i < 60; i++){ try{ alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); if(alvos.find(a => a.type === 'page')) break; }catch{} await espera(200); }
  const ws = new WebSocket(alvos.find(a => a.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', m => { const d = JSON.parse(m.data); if(d.id && pend.has(d.id)){ pend.get(d.id)(d.result); pend.delete(d.id); } });
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Page.enable');
  const out = {};
  for(const [nome, fn] of Object.entries(TEX)){
    const t = fn(), w = Math.round(t.w * PXM), h = Math.round(t.h * PXM);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${t.defs}</defs>${t.svg}</svg>`;
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') }); await espera(500);
    const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    out[nome] = { w: t.w, h: t.h, src: 'data:image/jpeg;base64,' + r.data };
    console.log(nome, `${w}×${h} px`, Math.round(r.data.length * 0.75 / 1024) + ' kB');
  }
  try{ await cmd('Browser.close'); }catch{} proc.kill();
  const js = `/* Texturas da planta humanizada (etapa F1.5), geradas por tools/gerar-texturas.mjs: procedurais, contínuas nas bordas,
   ${PXM} px por metro. w e h: tamanho do ladrilho em metros; src: JPEG em data URI (vai junto no SVG baixado). Não edite à mão. */
(function(root, factory){ if(typeof module==='object'&&module.exports) module.exports=factory(); else root.Texturas=factory(); })(this, function(){
'use strict';
return ${JSON.stringify(out)};
});
`;
  writeFileSync(join(RAIZ, 'gerador', 'texturas.js'), js);
  console.log('gerador/texturas.js', Math.round(js.length / 1024) + ' kB');
}
main();
