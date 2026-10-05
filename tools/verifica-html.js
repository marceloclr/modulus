/* Confere as páginas HTML do site: equilíbrio das tags e sintaxe dos <script> embutidos
   (pega, por exemplo, um const duplicado em sincroniza(), que já quebrou o formulário).
   Uso: node tools/verifica-html.js [arquivos...]  (sem argumentos: todos os .html do repositório) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.join(__dirname, '..');
const VAZIAS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
// elementos SVG que costumam aparecer autofechados (<path/>) já são tratados pelo "/>"; estes fecham sozinhos no HTML
const OPCIONAIS = new Set(['p','li','dt','dd','tr','td','th','thead','tbody','tfoot','option','colgroup']);

function listar(dir){
  const out = [];
  for(const e of fs.readdirSync(dir, {withFileTypes:true})){
    if(e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if(e.isDirectory()) out.push(...listar(p)); else if(e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function linhaDe(txt, i){ return txt.slice(0, i).split('\n').length; }

function verificar(arq){
  const txt = fs.readFileSync(arq, 'utf8'), erros = [];
  // scripts embutidos: compila sem executar
  const reScript = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while((m = reScript.exec(txt))){
    if(/\bsrc=/.test(m[1]) || /type=["'](?!text\/javascript|module)/.test(m[1]) || !m[2].trim()) continue;
    try{ new vm.Script(m[2], {filename: arq}); }
    catch(e){ erros.push(`linha ${linhaDe(txt, m.index)}: script com erro de sintaxe: ${e.message}`); }
  }
  // tags: tira comentários, scripts, estilos e templates de texto antes de contar
  const limpo = txt.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, m => m.replace(/[^\n]/g, ' '));
  const pilha = [], reTag = /<\/?([a-zA-Z][\w:-]*)\b[^>]*?(\/?)>/g;
  while((m = reTag.exec(limpo))){
    const nome = m[1].toLowerCase(), fecha = m[0][1] === '/', auto = m[2] === '/';
    if(nome === '!doctype' || VAZIAS.has(nome) || auto) continue;
    if(!fecha){ pilha.push({nome, i: m.index}); continue; }
    let k = pilha.length - 1;
    while(k >= 0 && pilha[k].nome !== nome && OPCIONAIS.has(pilha[k].nome)) k--;
    if(k >= 0 && pilha[k].nome === nome){
      for(const s of pilha.splice(k)) if(s.nome !== nome && !OPCIONAIS.has(s.nome)) erros.push(`linha ${linhaDe(limpo, s.i)}: <${s.nome}> sem fechamento`);
    } else erros.push(`linha ${linhaDe(limpo, m.index)}: </${nome}> sem abertura`);
  }
  for(const s of pilha) if(!OPCIONAIS.has(s.nome)) erros.push(`linha ${linhaDe(limpo, s.i)}: <${s.nome}> sem fechamento`);
  return erros;
}

const alvos = process.argv.slice(2).length ? process.argv.slice(2).map(a => path.resolve(a)) : listar(RAIZ);
let falhas = 0;
for(const arq of alvos){
  const erros = verificar(arq), rel = path.relative(RAIZ, arq);
  if(erros.length){ falhas++; console.log('FALHA ' + rel); erros.slice(0, 10).forEach(e => console.log('      - ' + e)); }
}
console.log(falhas ? `${falhas} página(s) com problema` : `html: ${alvos.length} página(s) conferidas`);
process.exitCode = falhas ? 1 : 0;
