/* Estado único da interface do gerador: entrada do formulário + estado da tela (blocos, variante, pavimento, espelho).
   Lido e gravado só por aqui; serializado na URL (#s=…) e no navegador (localStorage plantas-estado).
   Aceita os links antigos (#q=…&v=…&e=…). Funções puras, também usadas pelos testes no Node. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(); else root.Estado = factory();
})(this, function(){
'use strict';
const VERSAO = 2, CHAVE_LOCAL = 'plantas-estado';
const BLOCOS = ['b1', 'b2', 'b3', 'b4'];
const ESTADOS_BLOCO = ['a-definir', 'em-edicao', 'pronto', 'concluido', 'revisar', 'bloqueado'];

function blocosIniciais(){ return {b1:'a-definir', b2:'a-definir', b3:'a-definir', b4:'bloqueado'}; }
function novo(padrao){
  return {versao:VERSAO, entrada:Object.assign({}, padrao), ui:{blocos:blocosIniciais(), abertos:[], variante:0, pavimento:null, espelho:null, processado:false}};
}

// base64url com UTF-8 (também lê o base64 comum dos links antigos)
function b64(s){ const by = new TextEncoder().encode(s); let bin = ''; for(const b of by) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function deB64(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length % 4) s += '='; const bin = atob(s); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }

// só o que difere do padrão vai para o link (mais curto); campos fora do padrão vazios não entram
function diferencas(entrada, padrao){
  const d = {};
  for(const [k, v] of Object.entries(entrada || {})){
    if(v === undefined || (typeof v === 'number' && isNaN(v) && !(k in padrao))) continue;
    if(!(k in padrao) || padrao[k] !== v) d[k] = (typeof v === 'number' && isNaN(v)) ? null : v;
  }
  return d;
}

function compacto(est, padrao){
  const u = est.ui || {}, o = {v:VERSAO, e:diferencas(est.entrada, padrao), u:{v:u.variante||0}};
  if(u.pavimento !== null && u.pavimento !== undefined) o.u.p = u.pavimento;
  if(u.espelho !== null && u.espelho !== undefined) o.u.m = u.espelho ? 1 : 0;
  if(u.blocos && BLOCOS.some(b => u.blocos[b] !== blocosIniciais()[b])) o.u.b = u.blocos;
  if(u.abertos && u.abertos.length) o.u.a = u.abertos;
  if(u.processado) o.u.d = 1;   // dimensões já processadas uma vez: o resultado aparece
  return o;
}
function expandir(o, padrao){
  if(!o || typeof o !== 'object' || !o.e) return null;
  const est = novo(padrao), u = o.u || {};
  Object.assign(est.entrada, o.e);
  est.ui.variante = Number.isInteger(u.v) && u.v >= 0 ? u.v : 0;
  if(Number.isInteger(u.p) && u.p >= 0) est.ui.pavimento = u.p;
  if(u.m === 0 || u.m === 1) est.ui.espelho = !!u.m;
  if(u.b && typeof u.b === 'object') for(const b of BLOCOS) if(ESTADOS_BLOCO.includes(u.b[b])) est.ui.blocos[b] = u.b[b];
  if(Array.isArray(u.a)) est.ui.abertos = u.a.filter(b => BLOCOS.includes(b));
  // links e sessões de antes de 06/10/2026 não têm a marca: bloco 1 concluído (ou a revisar) conta como processado
  est.ui.processado = u.d === 1 || ['concluido', 'revisar'].includes(est.ui.blocos.b1);
  return est;
}

function paraHash(est, padrao){ return '#s=' + b64(JSON.stringify(compacto(est, padrao))); }
function deHash(hash, padrao){
  hash = hash || '';
  const s = (hash.match(/[#&]s=([^&]+)/) || [])[1];
  if(s){ try{ return expandir(JSON.parse(deB64(s)), padrao); }catch(e){ return null; } }
  const q = (hash.match(/[#&]q=([^&]+)/) || [])[1];   // link antigo: entrada completa normalizada
  if(q){ let ent; try{ ent = JSON.parse(deB64(q)); }catch(e){ return null; }
    if(!ent || typeof ent !== 'object') return null;
    const est = novo(padrao); Object.assign(est.entrada, ent);
    const v = (hash.match(/[#&]v=(\d+)/) || [])[1], e = (hash.match(/[#&]e=([01])/) || [])[1];
    est.ui.variante = v ? +v : 0; if(e !== undefined) est.ui.espelho = e === '1';
    return est; }
  return null;
}
function paraLocal(est, padrao){ return JSON.stringify(compacto(est, padrao)); }
function deLocal(txt, padrao){ try{ return expandir(JSON.parse(txt), padrao); }catch(e){ return null; } }

// repositório: leitura e escrita centralizadas, com aviso a quem assina
function criar(padrao){
  let est = novo(padrao);
  const ouvintes = [];
  const avisa = (caminho) => ouvintes.forEach(fn => { try{ fn(est, caminho); }catch(e){ console.error(e); } });
  return {
    ler: () => est,
    substituir(novoEst){ est = novoEst || novo(padrao); avisa(''); },
    escrever(caminho, valor){
      const ps = caminho.split('.'); let o = est;
      for(let i = 0; i < ps.length - 1; i++){ if(!o[ps[i]] || typeof o[ps[i]] !== 'object') o[ps[i]] = {}; o = o[ps[i]]; }
      if(o[ps[ps.length-1]] === valor) return false;
      o[ps[ps.length-1]] = valor; avisa(caminho); return true;
    },
    assinar(fn){ ouvintes.push(fn); return () => { const i = ouvintes.indexOf(fn); if(i >= 0) ouvintes.splice(i, 1); }; },
    serializar: () => paraHash(est, padrao),
    paraLocal: () => paraLocal(est, padrao),
  };
}

return {VERSAO, CHAVE_LOCAL, BLOCOS, ESTADOS_BLOCO, novo, blocosIniciais, diferencas, paraHash, deHash, paraLocal, deLocal, criar, _b64:b64, _deB64:deB64};
});
