/* Valores de custo no navegador: camada oficial (o dados/custos.json aceito), ajustes manuais e valores efetivos.
   Guarda em IndexedDB (reserva: localStorage), atualiza do JSON publicado com quebra de cache e mostra as diferenças antes
   de aplicar, preserva os ajustes, restaura os oficiais e exporta/importa. As funções de camada são puras (testadas no Node). */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(); else root.Valores = factory();
})(this, function(){
'use strict';
const CHAVE = 'plantas-custos', BANCO = 'modulus', LOJA = 'valores';

/* Valores editáveis: [caminho, rótulo, grupo]. Nos fatores e adicionais edita-se o valor médio; mín e máx acompanham na mesma proporção. */
function editaveis(d){
  const out = [];
  for(const k of ['R1-B', 'R1-N', 'R1-A']){ out.push([`cub.onerado.${k}`, `CUB ${k} não desonerado (R$/m²)`, 'CUB']); out.push([`cub.desonerado.${k}`, `CUB ${k} desonerado (R$/m²)`, 'CUB']); }
  for(const [k, c] of Object.entries(d.coeficientes)) out.push([`coeficientes.${k}.med`, c.nome, 'Coeficientes de área equivalente']);
  for(const [k, m] of Object.entries(d.municipios)) out.push([`fatores.logistica.${k}.med`, `Logística · ${m.nome}`, 'Fatores locais']);
  for(const [k, m] of Object.entries(d.municipios)) out.push([`fatores.condominio.${k}.med`, `Condomínio · ${m.nome}`, 'Fatores locais']);
  for(const [k, x] of Object.entries(d.fatores.marinho)) out.push([`fatores.marinho.${k}.med`, `Mar · ${x.nome}`, 'Fatores locais']);
  for(const [k, s] of Object.entries(d.fatores.estrutural)) out.push([`fatores.estrutural.${k}.med`, s.nome, 'Fatores estruturais']);
  for(const [k, a] of Object.entries(d.adicionais)) out.push([`adicionais.${k}.med`, `${a.nome} (${{m2Projecao:'R$/m² de projeção', m2Subsolo:'R$/m²', un:'R$', m2Lamina:'R$/m² de lâmina', vb:'R$', m2Fachada:'R$/m²', pct:'%'}[a.unidade] || a.unidade})`, 'Adicionais']);
  return out;
}
const ler = (o, cam) => cam.split('.').reduce((x, k) => x == null ? x : x[k], o);
function escrever(o, cam, v){ const ps = cam.split('.'); let x = o; for(let i = 0; i < ps.length - 1; i++) x = x[ps[i]]; x[ps[ps.length - 1]] = v; }

/* efetivo = oficial + ajustes; no valor médio de uma faixa, mín e máx acompanham na mesma proporção */
function aplicarAjustes(oficial, ajustes){
  const d = JSON.parse(JSON.stringify(oficial));
  for(const [cam, v] of Object.entries(ajustes || {})){
    if(typeof ler(d, cam) !== 'number' || typeof v !== 'number' || !isFinite(v)) continue;
    if(cam.endsWith('.med')){ const pai = ler(d, cam.slice(0, -4)), k = pai.med ? v / pai.med : 1;
      if(pai.min === pai.med && pai.max === pai.med){ pai.min = v; pai.max = v; } else { pai.min = +(pai.min * k).toFixed(4); pai.max = +(pai.max * k).toFixed(4); } }
    escrever(d, cam, v);
  }
  return d;
}
/* diferenças numéricas entre dois conjuntos de valores (para mostrar antes de atualizar) */
function diferencas(a, b, cam, out){
  out = out || []; cam = cam || '';
  if(typeof a === 'number' || typeof b === 'number'){ if(a !== b) out.push({caminho:cam, antes:a, depois:b}); return out; }
  if(a && b && typeof a === 'object' && typeof b === 'object') for(const k of new Set([...Object.keys(a), ...Object.keys(b)])) diferencas(a[k], b[k], cam ? cam + '.' + k : k, out);
  else if(typeof a === 'string' && a !== b && /mesRef|coletadoEm|publicadoEm/.test(cam)) out.push({caminho:cam, antes:a, depois:b});
  return out;
}

/* ---------- armazenamento ---------- */
function abrirBanco(){ return new Promise((ok, erro) => { try{ const r = indexedDB.open(BANCO, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); }catch(e){ erro(e); } }); }
async function carregarLocal(){
  try{ const db = await abrirBanco(); const rec = await new Promise((ok, erro) => { const q = db.transaction(LOJA).objectStore(LOJA).get(CHAVE); q.onsuccess = () => ok(q.result || null); q.onerror = () => erro(q.error); }); db.close(); if(rec) return rec; }catch(e){}
  try{ const t = localStorage.getItem(CHAVE); return t ? JSON.parse(t) : null; }catch(e){ return null; }
}
async function gravarLocal(rec){
  let feito = false;
  try{ const db = await abrirBanco(); await new Promise((ok, erro) => { const tx = db.transaction(LOJA, 'readwrite'); tx.objectStore(LOJA).put(rec, CHAVE); tx.oncomplete = ok; tx.onerror = () => erro(tx.error); }); db.close(); feito = true; }catch(e){}
  try{ localStorage.setItem(CHAVE, JSON.stringify(rec)); feito = true; }catch(e){}
  return feito;
}

/* ---------- interface (Bloco 2, subseção "Valores e atualização") ---------- */
function montar(caixa, op){
  // op: {raiz:'../', validar:fn(dados)→erros[], schema, aoMudar:fn(efetivo, historico), f2, mesTxt}
  let rec = null, historico = null, publicado = null;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const num = v => (Math.round(v*10000)/10000).toString().replace('.', ',');
  const efetivo = () => aplicarAjustes(rec.oficial, rec.ajustes);
  const avisa = (html, tipo) => { const m = caixa.querySelector('.val-msg'); m.innerHTML = html; m.className = 'val-msg warn' + (tipo === 'ok' ? ' ok' : ''); m.hidden = !html; };
  async function buscar(nome, fresco){ const r = await fetch(op.raiz + 'dados/' + nome + '.json' + (fresco ? '?t=' + Date.now() : ''), {cache: fresco ? 'no-store' : 'no-cache'}); if(!r.ok) throw new Error(nome + ': ' + r.status); return r.json(); }
  function desenhar(){
    const d = rec.oficial, aj = rec.ajustes || {}, n = Object.keys(aj).length;
    let h = `<p class="val-selo" tabindex="0" data-tip="Valores oficiais aceitos neste navegador em ${esc(new Date(rec.gravadoEm).toLocaleDateString('pt-BR'))}">Valores de ${esc(op.mesTxt(d.cub.mesRef))} · ${esc(d.cub.fonte)} · coletados em ${esc(d.cub.coletadoEm.split('-').reverse().join('/'))}${n ? ` · <strong>${n} ajuste${n > 1 ? 's' : ''} manual${n > 1 ? 'is' : ''}</strong>` : ''}</p>`;
    h += `<div class="val-acoes"><button class="btn" type="button" data-acao="atualizar" data-tip="Busca o arquivo de valores publicado no site (sem cache) e mostra o que mudou antes de aplicar. Os ajustes manuais são preservados">Atualizar valores</button>`;
    h += `<button class="btn" type="button" data-acao="restaurar" data-tip="Apaga os ajustes manuais e volta aos valores oficiais aceitos"${n ? '' : ' disabled'}>Restaurar valores oficiais</button>`;
    h += `<button class="btn" type="button" data-acao="exportar" data-tip="Baixa um arquivo JSON com os valores oficiais em uso e os seus ajustes">Exportar</button>`;
    h += `<label class="btn" data-tip="Carrega um arquivo exportado antes (valida pelo esquema antes de aplicar)">Importar<input type="file" accept="application/json,.json" data-acao="importar" hidden></label></div>`;
    h += `<div class="val-msg warn" role="status" hidden></div>`;
    h += `<details class="sub val-editor"><summary>Ajustar valores (CUB, coeficientes, fatores e adicionais)</summary><div class="val-grade">`;
    let grupo = '';
    for(const [cam, rot, g] of editaveis(d)){
      if(g !== grupo){ h += `<p class="val-grupo">${esc(g)}</p>`; grupo = g; }
      const of = ler(d, cam), at = cam in aj ? aj[cam] : of, pai = cam.endsWith('.med') ? ler(d, cam.slice(0, -4)) : null;
      const dica = `Oficial: ${num(of)}${pai && pai.origem ? ' · ' + pai.origem : ''}${pai && pai.min !== pai.max ? ` · faixa ${num(pai.min)} a ${num(pai.max)} (acompanha o ajuste)` : ''}`;
      h += `<label class="fld${cam in aj ? ' ajustado' : ''}"><span data-tip="${esc(dica)}">${esc(rot)}</span><input type="number" step="any" min="0" data-cam="${esc(cam)}" value="${at}" aria-label="${esc(rot)}"></label>`;
    }
    h += `</div></details>`;
    caixa.innerHTML = h;
  }
  async function aceitar(oficial){ rec = {oficial, ajustes: rec ? rec.ajustes || {} : {}, gravadoEm: new Date().toISOString(), fonte: oficial.cub.fonte}; await gravarLocal(rec); desenhar(); op.aoMudar(efetivo(), historico); }
  function mostrarDiferencas(novo){
    const dif = diferencas(rec.oficial, novo);
    if(!dif.length){ avisa(`Os valores já estão atualizados (${esc(op.mesTxt(novo.cub.mesRef))}).`, 'ok'); return; }
    const linhas = dif.slice(0, 14).map(x => `<li><code>${esc(x.caminho)}</code>: ${esc(String(x.antes))} → <strong>${esc(String(x.depois))}</strong></li>`).join('');
    avisa(`<strong>${dif.length} valor${dif.length > 1 ? 'es mudaram' : ' mudou'} no arquivo publicado</strong> (${esc(op.mesTxt(rec.oficial.cub.mesRef))} → ${esc(op.mesTxt(novo.cub.mesRef))})<ul>${linhas}${dif.length > 14 ? `<li>e mais ${dif.length - 14}</li>` : ''}</ul>
      <div class="val-acoes"><button class="btn prim" type="button" data-acao="aplicar" data-tip="Aceita os valores publicados como oficiais; os seus ajustes continuam valendo">Aplicar</button><button class="btn" type="button" data-acao="manter" data-tip="Continua com os valores atuais">Manter os atuais</button></div>`);
    publicado = novo;
  }
  caixa.addEventListener('click', async e => {
    const b = e.target.closest('[data-acao]'); if(!b || b.tagName === 'INPUT') return;
    const a = b.dataset.acao;
    if(a === 'atualizar'){ b.disabled = true; avisa('Buscando o arquivo publicado…');
      try{ const novo = await buscar('custos', true), erros = op.validar(novo); if(erros.length) avisa('O arquivo publicado não passou na validação: ' + esc(erros.slice(0, 3).join('; ')));
        else { historico = await buscar('custos-historico', true).catch(() => historico); mostrarDiferencas(novo); } }
      catch(err){ avisa('Não foi possível buscar os valores publicados (' + esc(err.message) + ').'); }
      b.disabled = false; }
    if(a === 'aplicar' && publicado){ await aceitar(publicado); publicado = null; avisa('Valores atualizados.', 'ok'); }
    if(a === 'manter'){ publicado = null; avisa(''); }
    if(a === 'restaurar'){ rec.ajustes = {}; await gravarLocal(rec); desenhar(); op.aoMudar(efetivo(), historico); avisa('Valores oficiais restaurados.', 'ok'); }
    if(a === 'exportar'){ const blob = new Blob([JSON.stringify({tipo:'modulus-valores', versao:1, exportadoEm:new Date().toISOString(), oficial:rec.oficial, ajustes:rec.ajustes || {}}, null, 2)], {type:'application/json'});
      const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'modulus-valores-' + rec.oficial.cub.mesRef + '.json'; document.body.appendChild(l); l.click(); setTimeout(() => { URL.revokeObjectURL(l.href); l.remove(); }, 500); }
  });
  caixa.addEventListener('change', async e => {
    const i = e.target;
    if(i.dataset.acao === 'importar'){ const f = i.files[0]; if(!f) return; i.value = '';
      try{ const j = JSON.parse(await f.text()), of = j.oficial || j, erros = op.validar(of);
        if(erros.length) return avisa('Arquivo inválido: ' + esc(erros.slice(0, 3).join('; ')));
        rec = {oficial:of, ajustes:j.ajustes || {}, gravadoEm:new Date().toISOString(), fonte:of.cub.fonte}; await gravarLocal(rec); desenhar(); op.aoMudar(efetivo(), historico); avisa('Valores importados.', 'ok'); }
      catch(err){ avisa('Arquivo inválido (não é um JSON de valores).'); }
      return; }
    if(i.dataset.cam){ e.stopPropagation();
      const v = parseFloat(i.value), of = ler(rec.oficial, i.dataset.cam);
      if(!isFinite(v) || v === of) delete rec.ajustes[i.dataset.cam]; else rec.ajustes[i.dataset.cam] = v;
      await gravarLocal(rec); i.closest('label').classList.toggle('ajustado', i.dataset.cam in rec.ajustes);
      const sel = caixa.querySelector('.val-selo'); const n = Object.keys(rec.ajustes).length;
      sel.innerHTML = sel.innerHTML.replace(/ · <strong>.*<\/strong>/, '') + (n ? ` · <strong>${n} ajuste${n > 1 ? 's' : ''} manual${n > 1 ? 'is' : ''}</strong>` : '');
      caixa.querySelector('[data-acao=restaurar]').disabled = !n;
      op.aoMudar(efetivo(), historico); }
  });
  caixa.addEventListener('input', e => { if(e.target.dataset.cam) e.stopPropagation(); });
  // início: os valores aceitos neste navegador mandam; sem eles, aceita o arquivo publicado
  return (async () => {
    const [pub, hist, loc] = await Promise.all([buscar('custos').catch(() => null), buscar('custos-historico').catch(() => null), carregarLocal()]);
    historico = hist;
    if(loc && loc.oficial && !op.validar(loc.oficial).length) rec = loc;
    else if(pub && !op.validar(pub).length){ rec = {oficial:pub, ajustes:{}, gravadoEm:new Date().toISOString(), fonte:pub.cub.fonte}; await gravarLocal(rec); }
    else throw new Error('sem valores de custo');
    desenhar();
    if(pub && loc && pub.cub.mesRef > loc.oficial.cub.mesRef) avisa(`Há valores novos publicados (${esc(op.mesTxt(pub.cub.mesRef))}). Use “Atualizar valores” para ver as diferenças.`);
    op.aoMudar(efetivo(), historico);
    return {efetivo: efetivo(), historico};
  })();
}

return {CHAVE, editaveis, aplicarAjustes, diferencas, carregarLocal, gravarLocal, montar};
});
