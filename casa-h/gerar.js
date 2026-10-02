// Gera a planta humanizada da casa em H (v1): node gerar.js
// Coordenadas em metros; origem no canto superior esquerdo da casa (frente para a rua no topo).
const fs = require('fs');

const K = 30;                 // px por metro
const OX = 72, OY = 118;      // origem da planta no SVG
const f2 = n => n.toFixed(2).replace('.', ',');
const X = m => +(OX + m * K).toFixed(1), Y = m => +(OY + m * K).toFixed(1);

const COR = {
  suite: ['#E3EEEC', '#93B3AC'], social: ['#E7E7F0', '#9C9CBD'], apoio: ['#ECECE8', '#ABAB9F'],
  circ: ['#EEF0F4', '#A9AFBD'], varanda: ['#F3EBDD', '#C8B08A'], patio: ['#E6ECDF', '#9DB08C'],
};

// [nome, zona, x0, y0, x1, y1, rótulo curto?]
const AMB = [
  ['Suíte 1', 'suite', 0, 0, 5, 4],
  ['Banho 1', 'suite', 0, 4, 2.6, 6],
  ['Closet 1', 'suite', 2.6, 4, 5, 6],
  ['Banho 2', 'suite', 0, 6, 2.6, 8],
  ['Closet 2', 'suite', 2.6, 6, 5, 8],
  ['Suíte 2', 'suite', 0, 8, 5, 12],
  ['Suíte master', 'suite', 0, 12, 5, 16],
  ['Banho master', 'suite', 0, 16, 2.8, 19],
  ['Closet master', 'suite', 2.8, 16, 6.2, 19],
  ['Circulação íntima', 'circ', 5, 0, 6.2, 14],
  ['Rouparia', 'apoio', 5, 14, 6.2, 16],
  ['Galeria', 'circ', 6.2, 11, 12.8, 12.2],
  ['Área de serviço', 'apoio', 6.2, 12.2, 8.8, 15.8],
  ['Cozinha', 'social', 8.8, 12.2, 12.8, 15.8],
  ['Vestíbulo', 'circ', 12.8, 0, 15, 6],
  ['Escritório', 'social', 15, 0, 18.8, 4.2],
  ['Banho social', 'apoio', 15, 4.2, 18.8, 6],
  ['Sala de estar', 'social', 12.8, 6, 18.8, 11],
  ['Sala de jantar', 'social', 12.8, 11, 18.8, 15.8],
  ['Varanda gourmet', 'varanda', 12.8, 15.8, 18.8, 19],
];
const area = a => (a[4] - a[2]) * (a[5] - a[3]);

// Paredes internas [x0,y0,x1,y1]; o contorno externo é desenhado à parte.
const PAR = [
  [0, 4, 5, 4], [2.6, 4, 2.6, 8], [0, 6, 5, 6], [0, 8, 5, 8], [0, 12, 5, 12], [0, 16, 6.2, 16],
  [2.8, 16, 2.8, 19], [5, 0, 5, 16], [5, 14, 6.2, 14],
  [6.2, 0, 6.2, 11], [6.2, 12.2, 6.2, 16], [6.2, 11, 12.8, 11], [6.2, 12.2, 12.8, 12.2], [8.8, 12.2, 8.8, 15.8],
  [6.2, 15.8, 12.8, 15.8], [12.8, 0, 12.8, 11], [12.8, 12.2, 12.8, 15.8], [15, 0, 15, 6], [15, 4.2, 18.8, 4.2],
  [12.8, 15.8, 18.8, 15.8],
];
// Contorno externo do H (fechado), sem a varanda gourmet.
const CONT = [[0, 0], [6.2, 0], [6.2, 11], [12.8, 11], [12.8, 0], [18.8, 0], [18.8, 15.8], [12.8, 15.8],
  [6.2, 15.8], [6.2, 19], [0, 19]];
// O trecho 6,2→12,8 em y=11 e y=15,8 já está em PAR (paredes da galeria e do serviço).

// Portas: [x, y, orientação ('h' na parede horizontal, 'v' na vertical), largura, sentido do giro (+1/-1), lado (+1/-1), cor do vão]
const PORTAS = [
  [5, 0.4, 'v', 0.9, 1, -1], [5, 11.0, 'v', 0.9, -1, -1], [5, 12.3, 'v', 0.9, 1, -1],     // quartos ← circulação
  [2.6, 4.8, 'v', 0.7, 1, -1], [2.6, 6.5, 'v', 0.7, 1, -1],                              // banhos ← closets
  [1.6, 16, 'h', 0.8, 1, 1],                                                              // banho master ← quarto
  [5.4, 14, 'h', 0.7, 1, 1],                                                              // rouparia
  [6.2, 15.0, 'v', 0.0, 1, 1],
  [8.8, 12.6, 'v', 0.8, 1, -1],                                                           // serviço ← cozinha
  [7.0, 15.8, 'h', 0.9, 1, 1],                                                            // serviço → quintal
  [13.4, 0, 'h', 1.0, 1, 1],                                                              // entrada principal
  [15, 1.0, 'v', 0.9, 1, 1],                                                              // escritório ← vestíbulo
  [15, 4.6, 'v', 0.8, 1, 1],                                                              // banho social ← vestíbulo
  [15.2, 4.2, 'h', 0.7, 1, 1],                                                            // banho social ← escritório
].filter(p => p[3] > 0);
// Vãos livres (sem folha): [x0,y0,x1,y1]
const VAOS = [
  [3.0, 4, 4.6, 4], [3.0, 8, 4.6, 8], [3.2, 16, 4.8, 16],          // closets abertos ao quarto
  [6.2, 11, 6.2, 12.2], [12.8, 11, 12.8, 12.2],                     // galeria
  [9.2, 12.2, 12.4, 12.2],                                           // cozinha aberta para a galeria (balcão)
  [12.8, 12.9, 12.8, 14.9],                                          // cozinha ↔ jantar
  [12.9, 6, 14.9, 6],                                                // vestíbulo → estar
];
// Janelas [x0,y0,x1,y1, alta?] e portas de vidro [.., 'vidro']
const JAN = [
  [1.2, 0, 3.8, 0], [0, 1, 0, 3], [0, 9, 0, 11], [0, 13, 0, 15],
  [0, 4.6, 0, 5.4, 1], [0, 6.6, 0, 7.4, 1], [0.8, 19, 2.0, 19, 1], [3.6, 19, 5.4, 19, 1],
  [5.2, 0, 6.0, 0, 1], [6.2, 1.0, 6.2, 3.6], [6.2, 5.0, 6.2, 10.4],
  [6.6, 11, 12.4, 11, 'vidro'], [7.4, 15.8, 8.4, 15.8, 1], [9.4, 15.8, 12.2, 15.8],
  [15.8, 0, 18.0, 0], [18.8, 1.0, 18.8, 3.2], [18.8, 4.6, 18.8, 5.6, 1],
  [12.8, 6.8, 12.8, 10.4, 'vidro'], [18.8, 6.8, 18.8, 10.2], [18.8, 11.8, 18.8, 15.0],
  [13.4, 15.8, 18.2, 15.8, 'vidro'],
];

let s = [];
const add = t => s.push(t);
const rect = (x0, y0, x1, y1, f, st, w = 1, tip = '') =>
  add(`<rect x="${X(x0)}" y="${Y(y0)}" width="${+((x1 - x0) * K).toFixed(1)}" height="${+((y1 - y0) * K).toFixed(1)}" fill="${f}" stroke="${st}" stroke-width="${w}">${tip ? `<title>${tip}</title>` : ''}</rect>`);
const line = (x0, y0, x1, y1, st, w, extra = '') =>
  add(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="${st}" stroke-width="${w}" ${extra}/>`);
const text = (x, y, cls, t, extra = '') => add(`<text x="${x}" y="${y}" class="${cls}" ${extra}>${t}</text>`);

// Terreno e pátios
rect(6.2, 0, 12.8, 11, COR.patio[0], COR.patio[1], 1, 'Pátio de entrada: 6,60 × 11,00 = 72,60 m²');
rect(6.2, 15.8, 12.8, 19, COR.patio[0], COR.patio[1], 1, 'Pátio posterior: 6,60 × 3,20 (aberto para o quintal)');

for (const a of AMB) {
  const [n, z, x0, y0, x1, y1] = a;
  rect(x0, y0, x1, y1, COR[z][0], COR[z][1], 1, `${n}: ${f2(x1 - x0)} × ${f2(y1 - y0)} = ${f2(area(a))} m²`);
}

// Mobiliário simplificado
const mob = [];
const m = (x0, y0, x1, y1, r = 2) => mob.push(`<rect x="${X(x0)}" y="${Y(y0)}" width="${+((x1 - x0) * K).toFixed(1)}" height="${+((y1 - y0) * K).toFixed(1)}" rx="${r}" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`);
const circ = (x, y, r) => mob.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${r * K}" fill="#FFFFFF" stroke="#8A8F98" stroke-width=".8"/>`);
const cama = (x0, y0, w, h, tr) => { m(x0, y0, x0 + w, y0 + h); const p = 0.45;
  if (tr) { m(x0 + 0.1, y0 + 0.15, x0 + 0.1 + p, y0 + h / 2 - 0.05); m(x0 + 0.1, y0 + h / 2 + 0.05, x0 + 0.1 + p, y0 + h - 0.15); } };
cama(0.3, 1.0, 2.0, 1.9, true); cama(0.3, 9.05, 2.0, 1.9, true); cama(0.3, 13.0, 2.1, 2.0, true);
m(2.6, 0.2, 4.4, 0.65); m(2.6, 11.35, 4.4, 11.8); m(2.8, 12.2, 4.6, 12.65);                    // cômodas/TV
m(2.7, 4.1, 4.9, 4.65, 1); m(2.7, 7.35, 4.9, 7.9, 1); m(5.6, 16.1, 6.1, 18.9, 1); m(2.9, 18.45, 5.4, 18.9, 1); // armários
for (const [bx, by] of [[0, 4], [0, 6]]) { circ(bx + 1.9, by + (by === 4 ? 1.55 : 0.45), 0.2); m(bx + 0.1, by + (by === 4 ? 0.1 : 1.1), bx + 1.1, by + (by === 4 ? 0.9 : 1.9), 1); }
circ(2.2, 18.4, 0.2); m(0.1, 16.1, 1.3, 17.3, 1); m(0.1, 18.3, 1.5, 18.9, 1);
m(17.0, 0.3, 18.6, 1.0); m(16.2, 2.4, 18.6, 3.0);                                               // escritório: mesa + estante
m(16.1, 5.4, 16.9, 5.9, 1); circ(17.3, 5.6, 0.2); m(17.75, 4.3, 18.7, 5.9, 1);                   // banho social: lavatório, vaso, box
m(17.9, 6.6, 18.6, 10.4); m(14.6, 7.1, 15.4, 9.9); m(16.0, 7.9, 17.2, 9.1);                    // estar
m(14.4, 12.4, 17.2, 14.4, 4); for (const cx of [14.9, 15.8, 16.7]) { circ(cx, 12.15, 0.2); circ(cx, 14.65, 0.2); }
m(9.0, 15.2, 12.6, 15.7, 1); m(9.8, 13.4, 11.4, 14.2, 1);          // cozinha + ilha
m(6.3, 12.3, 6.9, 15.7, 1); m(7.2, 12.3, 8.0, 12.9, 1); m(8.0, 12.3, 8.7, 12.9, 1);             // serviço
m(16.5, 16.3, 18.6, 16.9, 1); m(14.0, 17.0, 16.4, 18.2, 4);                                     // gourmet
add(mob.join(''));

// Contorno e paredes
add(`<path d="M${CONT.map(([x, y]) => X(x) + ',' + Y(y)).join(' L')} Z" fill="none" stroke="#2B2F36" stroke-width="6" stroke-linejoin="miter"/>`);
for (const [x0, y0, x1, y1] of PAR) line(x0, y0, x1, y1, '#2B2F36', 3.2, 'stroke-linecap="square"');
add(`<path d="M${X(12.8)},${Y(15.8)} L${X(12.8)},${Y(19)} L${X(18.8)},${Y(19)} L${X(18.8)},${Y(15.8)}" fill="none" stroke="#C8B08A" stroke-width="1.4" stroke-dasharray="4 3"/>`);
for (const [x0, y0, x1, y1] of VAOS) line(x0, y0, x1, y1, '#F4F2EC', 4.2);
for (const [x0, y0, x1, y1, t] of JAN) {
  line(x0, y0, x1, y1, '#FFFFFF', 6.4);
  if (t === 'vidro') { line(x0, y0, x1, y1, '#4C86C6', 1.2); line(x0, y0, x1, y1, '#4C86C6', 4, 'stroke-opacity=".25"'); }
  else line(x0, y0, x1, y1, '#4C86C6', 1.4, t ? 'stroke-dasharray="3 2"' : '');
}
for (const [x, y, o, w, g, l] of PORTAS) {
  if (o === 'v') {
    line(x, y, x, y + w, '#F4F2EC', 4.2);
    const ex = x + l * w, ey = g > 0 ? y : y + w, hy = g > 0 ? y + w : y;
    line(x, hy, ex, hy, '#8C6A2F', 1.6);
    add(`<path d="M${X(ex)},${Y(hy)} A${w * K},${w * K} 0 0 ${(l > 0) === (g > 0) ? 0 : 1} ${X(x)},${Y(ey)}" fill="none" stroke="#8C6A2F" stroke-width=".7" stroke-dasharray="2 2"/>`);
  } else {
    line(x, y, x + w, y, '#F4F2EC', 4.2);
    const hx = g > 0 ? x : x + w, ox = g > 0 ? x + w : x, ey = y + l * w;
    line(hx, y, hx, ey, '#8C6A2F', 1.6);
    add(`<path d="M${X(hx)},${Y(ey)} A${w * K},${w * K} 0 0 ${(l > 0) === (g > 0) ? 0 : 1} ${X(ox)},${Y(y)}" fill="none" stroke="#8C6A2F" stroke-width=".7" stroke-dasharray="2 2"/>`);
  }
}

// Rótulos
const lab = (n, x, y, sub, big = 8.6) => {
  add(`<g><rect x="${X(x) - 34}" y="${Y(y) - 11}" width="68" height="${sub ? 24 : 14}" rx="2" fill="#FFFFFF" fill-opacity=".82"/>`);
  text(X(x), Y(y), 'rn', n, `style="font-size:${big}px"`);
  if (sub) text(X(x), Y(y) + 10, 'rd', sub, 'style="font-size:6.8px"');
  add('</g>');
};
const dims = a => `${f2(a[4] - a[2])} × ${f2(a[5] - a[3])} · ${f2(area(a))} m²`;
const A = Object.fromEntries(AMB.map(a => [a[0], a]));
lab('SUÍTE 1', 3.6, 1.9, dims(A['Suíte 1'])); lab('SUÍTE 2', 3.6, 9.9, dims(A['Suíte 2']));
lab('SUÍTE MASTER', 3.6, 13.9, dims(A['Suíte master']));
for (const [n, k, x, y] of [['BANHO', 'Banho 1', 1.3, 5.15], ['CLOSET', 'Closet 1', 3.8, 5.25], ['BANHO', 'Banho 2', 1.3, 7.0], ['CLOSET', 'Closet 2', 3.8, 6.85]]) {
  text(X(x), Y(y), 'rn', n, 'style="font-size:6.6px"'); text(X(x), Y(y) + 8, 'rd', `${f2(area(A[k]))} m²`, 'style="font-size:6px"');
}
text(X(1.4), Y(17.7), 'rn', 'BANHO MASTER', 'style="font-size:6.6px"'); text(X(1.4), Y(17.7) + 8, 'rd', `2,80 × 3,00 · ${f2(area(A['Banho master']))} m²`, 'style="font-size:6px"');
text(X(4.3), Y(17.4), 'rn', 'CLOSET MASTER', 'style="font-size:6.6px"'); text(X(4.3), Y(17.4) + 8, 'rd', `3,40 × 3,00 · ${f2(area(A['Closet master']))} m²`, 'style="font-size:6px"');
add(`<text transform="translate(${X(5.65)},${Y(7)}) rotate(-90)" class="rn" style="font-size:6.6px">CIRCULAÇÃO 1,20</text>`);
add(`<text transform="translate(${X(5.65)},${Y(15.35)}) rotate(-90)" class="rn" style="font-size:5.6px">ROUPARIA</text>`);
text(X(9.5), Y(11.72), 'rn', 'GALERIA ENVIDRAÇADA 1,20', 'style="font-size:6.4px"');
lab('SERVIÇO', 7.5, 13.6, '2,60 × 3,60 · 9,36 m²', 7.4);
lab('COZINHA', 10.8, 12.95, dims(A['Cozinha']));
lab('VESTÍBULO', 13.9, 2.9, '2,20 × 6,00', 7.6);
lab('ESCRITÓRIO', 16.4, 1.8, dims(A['Escritório']), 8);
text(X(16.9), Y(4.75), 'rn', 'BANHO SOCIAL', 'style="font-size:6.4px"'); text(X(16.9), Y(4.75) + 8, 'rd', 'reversível · 6,84 m²', 'style="font-size:6px"');
lab('SALA DE ESTAR', 15.8, 7.1, dims(A['Sala de estar']));
lab('SALA DE JANTAR', 15.8, 15.2, dims(A['Sala de jantar']));
lab('VARANDA GOURMET', 15.8, 17.6, dims(A['Varanda gourmet']), 7.6);
lab('PÁTIO DE ENTRADA', 9.5, 5.2, '6,60 × 11,00 · jardim', 7.6);
lab('PÁTIO POSTERIOR', 9.5, 17.5, 'aberto para o quintal', 7.2);
text(X(13.9), Y(-0.35), 'rn', '▼ ENTRADA', 'style="font-size:7px;fill:#8C6A2F"');

// Cotas
const cota = (x0, x1, y, t, vert) => {
  if (!vert) {
    line(x0, y, x1, y, '#55595F', .7); for (const x of [x0, x1]) line(x, y - .12, x, y + .12, '#55595F', .7);
    text(((X(x0) + X(x1)) / 2).toFixed(1), Y(y) - 3, 'cota', t);
  } else {
    line(y, x0, y, x1, '#55595F', .7); for (const v of [x0, x1]) line(y - .12, v, y + .12, v, '#55595F', .7);
    add(`<text transform="translate(${X(y) - 3},${((Y(x0) + Y(x1)) / 2).toFixed(1)}) rotate(-90)" class="cota">${t}</text>`);
  }
};
cota(0, 18.8, -1.55, '18,80'); cota(0, 6.2, -0.95, '6,20'); cota(6.2, 12.8, -0.95, '6,60'); cota(12.8, 18.8, -0.95, '6,00');
cota(0, 19, -1.55, '19,00', true);
for (const [a, b] of [[0, 4], [4, 6], [6, 8], [8, 12], [12, 16], [16, 19]]) cota(a, b, -0.85, f2(b - a), true);
for (const [a, b] of [[0, 6], [6, 11], [11, 15.8], [15.8, 19]]) cota(a, b, 19.75, f2(b - a), true);

const planta = s.join('\n'); s = [];

// Barra lateral: legenda, áreas e terreno
const SX = X(18.8) + 82; let sy = 108;
const sideH = (t) => { text(SX, sy, 'lh', t); sy += 14; };
sideH('Legenda de zonas');
for (const [z, t] of [['suite', 'Ala íntima (suítes, closets, banhos)'], ['social', 'Social (escritório, estar, jantar, cozinha)'],
  ['apoio', 'Apoio (serviço, banho social, rouparia)'], ['circ', 'Circulação (vestíbulo, galeria)'], ['varanda', 'Varanda'], ['patio', 'Pátios (área livre)']]) {
  add(`<rect x="${SX}" y="${sy - 8}" width="18" height="11" fill="${COR[z][0]}" stroke="${COR[z][1]}"/>`); text(SX + 26, sy, 'lg', t); sy += 15;
}
sy += 6; sideH('Convenções gráficas');
for (const [d, t] of [['<line x1="0" y1="0" x2="18" y2="0" stroke="#2B2F36" stroke-width="4"/>', 'Parede'],
  ['<line x1="0" y1="0" x2="18" y2="0" stroke="#4C86C6" stroke-width="1.4"/>', 'Janela'], ['<line x1="0" y1="0" x2="18" y2="0" stroke="#4C86C6" stroke-width="1.4" stroke-dasharray="3 2"/>', 'Janela alta (banhos, closet, serviço)'],
  ['<line x1="0" y1="0" x2="18" y2="0" stroke="#4C86C6" stroke-width="4" stroke-opacity=".3"/>', 'Porta ou pano de vidro'], ['<line x1="0" y1="0" x2="18" y2="0" stroke="#8C6A2F" stroke-width="1.6"/>', 'Porta: folha + arco de giro']]) {
  add(`<g transform="translate(${SX},${sy - 3})">${d}</g>`); text(SX + 26, sy, 'lg', t); sy += 14;
}
const fech = AMB.filter(a => a[1] !== 'varanda').reduce((t, a) => t + area(a), 0);
const vara = area(A['Varanda gourmet']);
sy += 8; sideH('Quadro de áreas');
const linhas = [['Suíte 1 e 2 (quarto 4,00 × 5,00)', '20,00 m² cada'], ['Suíte master (quarto 4,00 × 5,00)', '20,00 m²'],
  ['Banho + closet (suítes 1 e 2)', '10,00 m² cada'], ['Banho + closet master', f2(area(A['Banho master']) + area(A['Closet master'])) + ' m²'],
  ['Escritório', f2(area(A['Escritório'])) + ' m²'], ['Banho social reversível', f2(area(A['Banho social'])) + ' m²'],
  ['Vestíbulo', f2(area(A['Vestíbulo'])) + ' m²'], ['Sala de estar', f2(area(A['Sala de estar'])) + ' m²'], ['Sala de jantar', f2(area(A['Sala de jantar'])) + ' m²'],
  ['Cozinha', f2(area(A['Cozinha'])) + ' m²'], ['Área de serviço', f2(area(A['Área de serviço'])) + ' m²'],
  ['Circulações (íntima + galeria) e rouparia', f2(area(A['Circulação íntima']) + area(A['Galeria']) + area(A['Rouparia'])) + ' m²'],
  ['Área fechada (projeção)', f2(fech) + ' m²', 1], ['Varanda gourmet', f2(vara) + ' m²'], ['Total construído', f2(fech + vara) + ' m²', 1]];
for (const [t, v, b] of linhas) { text(SX, sy, 'lg', t, b ? 'style="font-weight:600"' : ''); text(SX + 290, sy, 'lg', v, `text-anchor="end"${b ? ' style="font-weight:600"' : ''}`); sy += 12.5; }

// Terreno mínimo
const R = { fr: 5, lat: 1.5, fu: 3 };
const LW = 18.8 + 2 * R.lat, LD = 19 + R.fr + R.fu;
sy += 10; sideH('Terreno mínimo proposto');
const tl = [[`Casa: 18,80 × 19,00 m`], [`Recuos (hipótese): frente ${f2(R.fr)} · laterais ${f2(R.lat)} · fundo ${f2(R.fu)} m`],
  [`Mínimo: ${f2(LW)} × ${f2(LD)} m = ${f2(LW * LD)} m²`, 1], [`Recomendado: 22,00 × 30,00 m = 660,00 m² (quintal de 6,00 m)`, 1],
  [`Ocupação no lote recomendado: ${f2((fech + vara) / 660 * 100)} %`]];
for (const [t, b] of tl) { text(SX, sy, 'lg', t, b ? 'style="font-weight:600"' : ''); sy += 12.5; }
// Croqui de implantação no lote recomendado (22 × 30)
const k = 4.2, cx = SX + 70, cy = sy + 4;
add(`<g transform="translate(${cx},${cy})"><rect width="${22 * k}" height="${30 * k}" fill="#E6ECDF" stroke="#5F7350" stroke-width="1"/>`
  + `<path d="M${1.6 * k},${5 * k} h${6.2 * k} v${11 * k} h${6.6 * k} v${-11 * k} h${6 * k} v${19 * k} h${-6 * k} v${-3.2 * k} h${-6.6 * k} v${3.2 * k} h${-6.2 * k} Z" fill="#D9D3C4" stroke="#2B2F36" stroke-width="1"/>`
  + `<rect x="0" y="0" width="${22 * k}" height="${5 * k}" fill="none" stroke="#5F7350" stroke-dasharray="2 2"/>`
  + `<text x="${11 * k}" y="${-4}" class="cota">rua · 22,00</text>`
  + `<text transform="translate(${-4},${15 * k}) rotate(-90)" class="cota">30,00</text>`
  + `<text x="${11 * k}" y="${2.9 * k}" class="cota">recuo 5,00</text>`
  + `<text x="${11 * k}" y="${27.6 * k}" class="cota">quintal 6,00</text></g>`);
sy = cy + 30 * k + 6;

const W = Math.ceil(SX + 310), H = Math.ceil(Math.max(Y(19) + 30, sy) + 14);
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Planta humanizada · Casa em H (v1)</title><style>text{font-family:"Inter","Segoe UI","DejaVu Sans",Helvetica,Arial,sans-serif;fill:#2F333A}.tt{font-size:15px;font-weight:600}.st{font-size:8.6px;fill:#5d6168}.rn{font-weight:600;text-anchor:middle;letter-spacing:.2px}.rd{text-anchor:middle;fill:#4a4e55}.cota{font-size:6.6px;text-anchor:middle;fill:#55595F}.lh{font-size:8.4px;font-weight:600}.lg{font-size:6.8px;fill:#43474d}</style>
<rect width="${W}" height="${H}" fill="#FBFAF7"/>
<text x="${OX}" y="30" class="tt">Planta humanizada · Casa em H (v1)</text>
<text x="${OX}" y="46" class="st">Ala íntima com 3 suítes (quarto 4,00 × 5,00, banho na fachada, closet para o pátio) · ala social · ligação por cozinha e serviço · casa 18,80 × 19,00 m · escala 30 px/m</text>
${planta}
${s.join('\n')}
</svg>
`;
fs.writeFileSync(__dirname + '/planta_H_v1.svg', svg);
console.log('planta_H_v1.svg', W, H, 'fechada', f2(fech), 'total', f2(fech + vara), 'lote min', f2(LW), f2(LD));
