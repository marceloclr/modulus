// Exporta as plantas humanizadas da casa simétrica a partir do mesmo modelo da planta técnica (humDoc em
// casa-simetrica/index.html): planta_X_v2.svg (frente para cima) e planta_X_v2_norte.svg (norte para cima).
// Uso: node tools/humanizadas.mjs   → grava os SVGs e imprime as medidas para gerar os PNGs (Edge headless).
import fs from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../casa-simetrica/', import.meta.url);
const html = fs.readFileSync(new URL('index.html', dir), 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function humDoc'));
if(!js) throw new Error('humDoc não encontrado em casa-simetrica/index.html');
const code = js.slice(0, js.indexOf('/* ---------- Navegação')).replace(/^\s*\(function\(\)\{/, '');
const ctx = {Math, console, document:{documentElement:{}}, window:{matchMedia:() => ({matches:false})}};
vm.createContext(ctx);
vm.runInContext(code + ';this.API={humDoc};', ctx);

const medidas = [];
for(const g of ['A', 'B', 'C', 'D']) for(const norte of [false, true]){
  const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + ctx.API.humDoc(g, norte) + '\n';
  const nome = `planta_${g}_v2${norte ? '_norte' : ''}`;
  fs.writeFileSync(new URL(nome + '.svg', dir), svg);
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  medidas.push(`${nome} ${w} ${h}`);
}
console.log(medidas.join('\n'));
