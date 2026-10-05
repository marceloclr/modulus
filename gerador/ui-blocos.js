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
function travas(b){ const o = Object.assign({}, b); o.b4 = o.b1 === 'concluido' ? (o.b4 === 'bloqueado' ? 'a-definir' : o.b4) : 'bloqueado'; return o; }

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
  // botão principal vira "Gerar novamente": a planta já se atualiza a cada alteração
  const ger = topo.querySelector('button[type=submit]');
  if(ger) ger.setAttribute('data-tip', 'Refaz o cálculo com os campos atuais. A planta já se atualiza sozinha a cada alteração');

  function pintar(){
    const s = est.ler(), b = travas(s.ui.blocos);
    for(const x of BLOCOS){
      const chip = document.getElementById('chip-'+x.id), d = document.getElementById('bl-'+x.id), st = b[x.id];
      const vazioAberto = x.vazio && st !== 'bloqueado';
      chip.dataset.estado = st; chip.textContent = vazioAberto ? 'em breve' : ROTULO[st];
      chip.setAttribute('title', vazioAberto ? 'Este bloco ganha campos numa fase seguinte' : DICA[st]);
      d.dataset.estado = st;
      document.getElementById('sum-'+x.id).setAttribute('aria-disabled', st === 'bloqueado' ? 'true' : 'false');
      const tv = d.querySelector('.bl-vazio'); if(tv) tv.textContent = st === 'bloqueado' && x.trava ? x.trava : x.vazio;
      document.getElementById('res-'+x.id).textContent = st === 'bloqueado' && x.trava ? x.trava : resumo(x.id, form);
    }
  }
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
  form.addEventListener('change', () => pintar());
  form.addEventListener('input', () => pintar());
  pintar();
  return {pintar, corpos};
}

return {BLOCOS, ROTULO, travas, resumo, montar};
});
