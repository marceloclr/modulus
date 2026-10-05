/* Menu lateral do gerador em blocos sanfonados guiados (beta).
   Monta os blocos a partir dos fieldset existentes (data-secao), mostra número, título, chip de estado e resumo,
   e guarda no estado único quais blocos estão abertos. A lógica de transição dos blocos é pura e testada no Node. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports = factory(); else root.UiBlocos = factory();
})(this, function(){
'use strict';

const BLOCOS = [
  {id:'b1', num:1, titulo:'Dimensões', cor:'var(--patina)'},
  {id:'b2', num:2, titulo:'Tipo de estrutura e padrão de custos', cor:'var(--moss)', vazio:'O sistema estrutural (alvenaria estrutural, concreto armado, laje nervurada, protendido, metálica, steel frame), o município e o padrão de acabamento chegam na próxima fase, com a estimativa de custo.'},
  {id:'b3', num:3, titulo:'Energia solar', cor:'var(--brass)', vazio:'Os níveis de atendimento N1 a N4, a geração, as baterias e o retorno do investimento chegam numa fase seguinte, calculados sobre a planta escolhida.'},
  {id:'b4', num:4, titulo:'Estilo arquitetônico', cor:'var(--plum, var(--slate))', vazio:'A galeria comparativa de estilos (casa com cara de casa, farm, inglês, moderna contemporânea e ecológica), as fachadas e o muro chegam numa fase seguinte.', trava:'Conclua o bloco 1 para liberar a escolha do estilo.'},
];
const ROTULO = {'a-definir':'a definir', 'em-edicao':'em edição', 'pronto':'pronto', 'concluido':'concluído', 'revisar':'revisar', 'bloqueado':'bloqueado'};
const DICA = {'a-definir':'Ainda não preenchido', 'em-edicao':'Em preenchimento: há campos obrigatórios pendentes ou fora da faixa', 'pronto':'Campos obrigatórios completos: use “Concluir bloco”',
  'concluido':'Bloco concluído; pode ser reaberto a qualquer momento', 'revisar':'Um bloco anterior mudou: confira este bloco e conclua de novo', 'bloqueado':'Conclua o bloco 1 para liberar'};

/* ---------- lógica pura ---------- */
const ORDEM = BLOCOS.map(b => b.id);
// o estilo (bloco 4) depende de toda a geometria do bloco 1; o solar (bloco 3), só do que muda carga ou cobertura.
// O custo (bloco 2) é recalculado sozinho a cada mudança de área, sem pedir revisão.
const CAMPOS_SOLAR = /^(quartos|suites|master|tipo|formato|frente|fundo|rec|taxa|piscina|elevador|rooftop|rt[A-Z]|supModo|sec[A-Z]|torreCalor|gourmet|edicula|ed[A-Z]|subsolo|peDireito)/;
function dependentes(bloco, campo){
  if(bloco === 'b1') return (CAMPOS_SOLAR.test(campo || '') ? ['b3'] : []).concat(['b4']);
  return [];
}
function travas(b){ const o = Object.assign({}, b); o.b4 = o.b1 === 'concluido' ? (o.b4 === 'bloqueado' ? 'a-definir' : o.b4) : 'bloqueado'; return o; }
// alteração de um campo: o próprio bloco fica "pronto" ou "em edição" (um concluído só reabre se ficar inválido);
// os blocos seguintes já concluídos que dependem do campo voltam a "revisar"
function aposAlterar(blocos, bloco, campo, valido){
  const b = Object.assign({}, blocos);
  if(b[bloco] !== 'bloqueado'){
    if(b[bloco] === 'concluido'){ if(!valido) b[bloco] = 'em-edicao'; }
    else b[bloco] = valido ? 'pronto' : 'em-edicao';
  }
  for(const d of dependentes(bloco, campo)) if(b[d] === 'concluido') b[d] = 'revisar';
  return travas(b);
}
function aposConcluir(blocos, bloco){ const b = Object.assign({}, blocos); b[bloco] = 'concluido'; return travas(b); }
function proximo(blocos, bloco){ const t = travas(blocos); for(let k = ORDEM.indexOf(bloco) + 1; k < ORDEM.length; k++) if(t[ORDEM[k]] !== 'bloqueado') return ORDEM[k]; return null; }

/* ---------- DOM ---------- */
const NOMES_FMT = {auto:'formato automático', bloco:'bloco único', L:'em L', U:'em U', H:'em H'};
function resumo(id, form){
  const E = form.elements, f2 = n => (Math.round(n*100)/100).toString().replace('.', ',');
  if(id === 'b1'){
    const tipo = (form.querySelector('input[name=tipo]:checked')||{}).value === 'sobrado' ? 'Sobrado' : 'Térrea';
    const q = +E.quartos.value || 0, s = Math.min(+E.suites.value || 0, q), rumo = (form.querySelector('input[name=orientacao]:checked')||{}).value;
    const partes = [tipo, NOMES_FMT[E.formato.value] || E.formato.value, `${q} quarto${q===1?'':'s'}${s ? ` (${s} suíte${s===1?'':'s'})` : ''}`];
    if(E.frente.value && E.fundo.value) partes.push(`lote ${f2(+E.frente.value)} × ${f2(+E.fundo.value)} m`);
    if(E.subsolo.checked) partes.push('subsolo');
    if(rumo) partes.push('frente ' + rumo);
    return partes.join(' · ');
  }
  return 'Em preparação';
}

function el(tag, attrs, html){ const e = document.createElement(tag); for(const [k,v] of Object.entries(attrs||{})) e.setAttribute(k, v); if(html !== undefined) e.innerHTML = html; return e; }
function subsecao(titulo, filhos){ const fs = el('fieldset', {class:'fs'}); fs.appendChild(el('legend', {}, titulo)); filhos.filter(Boolean).forEach(c => fs.appendChild(c)); return fs; }
function recolhida(fs){ const d = el('details', {class:'sub'}); d.appendChild(el('summary', {}, fs.querySelector('legend').textContent)); d.appendChild(fs); return d; }

function montar(form, est, opts){
  opts = opts || {};
  const sec = n => form.querySelector(`fieldset[data-secao="${n}"]`);
  const rotuloDe = nome => { const i = form.elements[nome]; return i && i.closest('label'); };
  const acts = form.querySelectorAll('.form-acts'), topo = acts[0], rodape = acts[acts.length-1];
  const caixa = el('div', {class:'blocos'});
  topo.after(caixa);
  const corpos = {};
  for(const b of BLOCOS){
    const d = el('details', {class:'bloco', id:'bl-'+b.id, 'data-bloco':b.id, style:'--c:'+b.cor});
    const sm = el('summary', {id:'sum-'+b.id});
    sm.innerHTML = `<span class="bl-num" aria-hidden="true">${b.num}</span><span class="bl-txt"><span class="bl-tit" id="tit-${b.id}">${b.titulo}</span><span class="bl-res" id="res-${b.id}"></span></span><span class="bl-chip" id="chip-${b.id}"></span>`;
    d.appendChild(sm);
    const corpo = el('div', {class:'bl-corpo', role:'group', 'aria-labelledby':'tit-'+b.id});
    d.appendChild(corpo); corpos[b.id] = corpo;
    if(b.vazio) corpo.appendChild(el('p', {class:'bl-vazio'}, b.vazio));
    caixa.appendChild(d);
    caixa.appendChild(el('div', {class:'bloco-res', 'data-para':b.id}));
  }
  // bloco 1: as seções atuais, com o subsolo e o conforto passivo como subseções próprias
  const subsolo = subsecao('Subsolo', [rotuloDe('subsolo'), document.getElementById('subOps')]);
  const conforto = subsecao('Conforto passivo', [rotuloDe('torreCalor')]);
  [sec('terreno'), sec('tipo'), subsolo, sec('quartos'), sec('salas'), recolhida(sec('dimensoes')), sec('garagem'), recolhida(sec('anexos')), conforto]
    .forEach(n => corpos.b1.appendChild(n));
  caixa.after(rodape);
  // conclusão: só pelo botão (a conclusão automática fecharia o bloco no meio da digitação)
  for(const b of BLOCOS){
    if(b.vazio) continue;
    const corpo = corpos[b.id];
    corpo.appendChild(el('div', {class:'bl-erro', id:'erro-'+b.id, role:'alert', hidden:''}));
    const ac = el('div', {class:'bl-acoes'});
    ac.appendChild(el('button', {type:'button', class:'btn bl-concluir', 'data-bloco':b.id,
      'data-tip':'Confere os campos obrigatórios, fecha este bloco e abre o seguinte. O bloco pode ser reaberto depois'}, 'Concluir bloco'));
    corpo.appendChild(ac);
  }
  // botão principal vira "Gerar novamente": a planta já se atualiza a cada alteração
  const ger = topo.querySelector('button[type=submit]');
  if(ger) ger.setAttribute('data-tip', 'Refaz o cálculo com os campos atuais. A planta já se atualiza sozinha a cada alteração');

  function pintar(){
    posicionar();
    const s = est.ler(), b = travas(s.ui.blocos);
    for(const x of BLOCOS){
      const chip = document.getElementById('chip-'+x.id), d = document.getElementById('bl-'+x.id), st = b[x.id];
      const vazioAberto = x.vazio && st !== 'bloqueado';
      chip.dataset.estado = st; chip.textContent = vazioAberto ? 'em breve' : ROTULO[st];
      chip.setAttribute('title', vazioAberto ? 'Este bloco ganha campos numa fase seguinte' : DICA[st]);
      d.dataset.estado = st;
      const bt = d.querySelector('.bl-concluir'); if(bt) bt.classList.toggle('pronto', st === 'pronto');
      document.getElementById('sum-'+x.id).setAttribute('aria-disabled', st === 'bloqueado' ? 'true' : 'false');
      const tv = d.querySelector('.bl-vazio'); if(tv) tv.textContent = st === 'bloqueado' && x.trava ? x.trava : x.vazio;
      document.getElementById('res-'+x.id).textContent = st === 'bloqueado' && x.trava ? x.trava : resumo(x.id, form);
    }
  }
  // validação: obrigatórios e faixas (min/max) dos campos visíveis; o passo (step) não bloqueia
  const OBRIG = {b1:['frente', 'fundo', 'quartos']};
  const visivel = i => !i.disabled && !i.closest('[hidden]');
  function rotulo(i){
    if(i.name === 'orientacao') return 'Orientação da frente';
    if(i.getAttribute('aria-label')) return i.getAttribute('aria-label');
    const l = i.closest('label'); if(!l) return i.name;
    const c = l.cloneNode(true); c.querySelectorAll('small,select,input').forEach(x => x.remove()); return c.textContent.trim();
  }
  const num = v => String(v).replace('.', ',');
  function validar(id){
    const corpo = corpos[id], probs = [];
    if(id === 'b1' && !form.querySelector('input[name=orientacao]:checked'))
      probs.push({el: form.querySelector('input[name=orientacao]'), msg: 'Escolha na rosa dos ventos para onde a frente do terreno (a rua) está voltada.'});
    for(const i of corpo.querySelectorAll('input[type=number]')){
      if(!visivel(i)) continue;
      const v = i.validity;
      if((OBRIG[id] || []).includes(i.name) && i.value === '') probs.push({el:i, msg:`${rotulo(i)}: informe um valor.`});
      else if(v.badInput) probs.push({el:i, msg:`${rotulo(i)}: número inválido.`});
      else if(v.rangeUnderflow || v.rangeOverflow) probs.push({el:i, msg:`${rotulo(i)}: use um valor entre ${num(i.min)} e ${num(i.max)}.`});
    }
    return probs;
  }
  function mostrarErros(id, probs){
    const box = document.getElementById('erro-'+id); if(!box) return;
    corpos[id].querySelectorAll('[aria-invalid="true"]').forEach(i => { i.removeAttribute('aria-invalid'); desliga(i, 'erro-'+id); });
    if(!probs.length){ box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = `<strong>Antes de concluir este bloco:</strong><ul>${probs.map(p => `<li>${p.msg}</li>`).join('')}</ul>`;
    box.hidden = false;
    probs.forEach(p => { p.el.setAttribute('aria-invalid', 'true'); liga(p.el, 'erro-'+id); });
  }
  function liga(i, idErro){ const a = (i.getAttribute('aria-describedby') || '').split(' ').filter(Boolean); if(!a.includes(idErro)) a.push(idErro); i.setAttribute('aria-describedby', a.join(' ')); }
  function desliga(i, idErro){ const a = (i.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== idErro); if(a.length) i.setAttribute('aria-describedby', a.join(' ')); else i.removeAttribute('aria-describedby'); }
  function focar(i){ const sub = i.closest('details.sub'); if(sub) sub.open = true; const d = i.closest('details.bloco'); if(d) d.open = true; i.focus(); if(i.scrollIntoView) i.scrollIntoView({block:'center'}); }
  function primeiroCampo(id){
    const c = [...corpos[id].querySelectorAll('input:not([type=file]),select,textarea')].find(i => visivel(i) && !(i.closest('details.sub') && !i.closest('details.sub').open));
    return c || document.getElementById('sum-'+id);
  }
  function gravaBlocos(novos){ est.escrever('ui.blocos', novos); pintar(); if(opts.persistir) opts.persistir(); }
  function concluir(id){
    const probs = validar(id);
    mostrarErros(id, probs);
    if(probs.length){ gravaBlocos(aposAlterar(est.ler().ui.blocos, id, '', false)); focar(probs[0].el); return false; }
    const novos = aposConcluir(est.ler().ui.blocos, id);
    document.getElementById('bl-'+id).open = false;
    gravaBlocos(novos);
    const nx = proximo(novos, id);
    const vaga = caixa.querySelector(`.bloco-res[data-para="${id}"]`), comRes = estreito.matches && vaga && vaga.children.length;
    const alvo = nx ? primeiroCampo(nx) : document.getElementById('sum-'+id);
    if(nx) document.getElementById('bl-'+nx).open = true;
    // no celular, a tela mostra o resultado que acabou de descer; o foco já fica no bloco seguinte
    if(comRes){ alvo.focus({preventScroll:true}); vaga.scrollIntoView({block:'start'}); }
    else { alvo.focus(); if(nx && alvo.scrollIntoView) alvo.scrollIntoView({block:'nearest'}); }
    if(opts.aoConcluir) opts.aoConcluir(id);
    return true;
  }
  function aoAlterar(e){
    const d = e.target.closest && e.target.closest('details.bloco'); if(!d || e.target.closest('.bloco-res')) return;
    const id = d.dataset.bloco, probs = validar(id);
    const box = document.getElementById('erro-'+id);
    if(box && !box.hidden) mostrarErros(id, probs);   // com a lista aberta, ela acompanha as correções
    else if(e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true' && !probs.some(p => p.el === e.target)){ e.target.removeAttribute('aria-invalid'); desliga(e.target, 'erro-'+id); }
    const novos = aposAlterar(est.ler().ui.blocos, id, e.target.name, !probs.length);
    if(JSON.stringify(novos) !== JSON.stringify(est.ler().ui.blocos)) gravaBlocos(novos); else pintar();
  }

  // celular: os cards de cada bloco concluído descem para logo abaixo dele (no desktop ficam na coluna principal)
  const RESULTADOS = {b1: ['#main > .panel']};
  const estreito = window.matchMedia ? window.matchMedia('(max-width: 899px)') : {matches:false};
  const origem = {};
  function posicionar(){
    const b = travas(est.ler().ui.blocos);
    let algum = false;
    for(const [id, sels] of Object.entries(RESULTADOS)){
      const vaga = caixa.querySelector(`.bloco-res[data-para="${id}"]`), desce = estreito.matches && b[id] === 'concluido';
      for(const sel of sels){
        const n = document.querySelector(sel) || (origem[sel] && origem[sel].no); if(!n) continue;
        if(!origem[sel]) origem[sel] = {no:n, pai:n.parentNode, depois:n.nextSibling};
        if(desce){ if(n.parentNode !== vaga) vaga.appendChild(n); algum = true; }
        else if(n.parentNode !== origem[sel].pai) origem[sel].pai.insertBefore(n, origem[sel].depois);
      }
    }
    const main = document.getElementById('main'); if(main) main.hidden = algum && !main.querySelector('.panel');
  }
  if(estreito.addEventListener) estreito.addEventListener('change', posicionar);

  function guardaAbertos(){ est.escrever('ui.abertos', BLOCOS.map(b => b.id).filter(id => document.getElementById('bl-'+id).open)); if(opts.persistir) opts.persistir(); }

  // abertura inicial: a sessão restaurada manda; na primeira visita, o bloco 1 abre sozinho (sem autofoco)
  const abertos = est.ler().ui.abertos;
  const abrir = opts.primeiraVisita ? ['b1'] : abertos;
  abrir.forEach(id => { const d = document.getElementById('bl-'+id); if(d && travas(est.ler().ui.blocos)[id] !== 'bloqueado') d.open = true; });
  if(opts.primeiraVisita) est.escrever('ui.abertos', ['b1']);

  caixa.addEventListener('click', e => {
    const sm = e.target.closest('.bloco > summary');
    if(sm && sm.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });
  caixa.addEventListener('toggle', e => { if(e.target.classList && e.target.classList.contains('bloco')) guardaAbertos(); }, true);
  caixa.addEventListener('click', e => { const bt = e.target.closest('.bl-concluir'); if(bt) concluir(bt.dataset.bloco); });
  form.addEventListener('change', aoAlterar);
  form.addEventListener('input', aoAlterar);
  // "Restaurar" volta os campos e também o percurso dos blocos ao início
  const pad = document.getElementById('padrao');
  if(pad) pad.addEventListener('click', () => {
    BLOCOS.forEach(b => { document.getElementById('bl-'+b.id).open = b.id === 'b1'; mostrarErros(b.id, []); });
    est.escrever('ui.abertos', ['b1']); gravaBlocos(Object.assign({}, est.ler().ui.blocos, {b1:'a-definir', b2:'a-definir', b3:'a-definir', b4:'bloqueado'}));
  });
  pintar();
  return {pintar, corpos, concluir, validar};
}

return {BLOCOS, ROTULO, ORDEM, dependentes, travas, aposAlterar, aposConcluir, proximo, resumo, montar};
});
