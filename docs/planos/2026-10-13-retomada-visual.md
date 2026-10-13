# Modulus: retomada, tela mais limpa, nova animação de sol e vento, revisão das plantas manuais e etapa J

## Contexto
O trabalho parou em 06/10/2026. Hoje (13/10) a `main` está em 15689fd, já no GitLab, e o branch `etapa-j-edicao` tem só a J1 (b3a6715, f659577). O usuário pediu:
- a frente 2: revisão das plantas feitas à mão, só análise e plano;
- a frente 3: a etapa J inteira;
- antes delas, um plano de retomada que inclua a melhoria visual do sistema.

Palavras do usuário: "reduzir informações na tela, escolher as mais fundamentais e mover o que não for extremamente necessário para a operação para o manual e usar tooltips para 'limpar' as telas. O que precisa melhorar muito é o visual e efeitos dinâmicos das animações da posição e movimento de sol e sombras e dos ventos. Faça um benchmarking para termos uma solução contemporânea de fácil leitura e agradável e bonita."

A opção B da casa simétrica fica parada até o usuário escolher entre a versão principal e a simétrica.

**Diagnóstico da tela atual** (captura do gerador publicado, exemplo de 12 × 35 m):
- um parágrafo de apresentação acima dos números;
- 7 botões e um campo soltos na barra da planta;
- a legenda de zonas sempre aberta;
- o quadro de áreas completo, com 25 linhas;
- o quadro "Como o gerador decide" em cinco cartões, com cerca de 2 telas de texto corrido;
- notas longas em quase todos os grupos do formulário;
- no card "Sol e vento", textos de fonte e de método embaixo.

**A animação atual** (`gerador/animacao.js`):
- sombra de um só tom, de borda dura;
- sol num círculo chapado, sobre uma trajetória tracejada dentro do lote;
- o mês muda aos saltos (setInterval de 1,2 s);
- o vento é feito de 11 linhas retas tracejadas que atravessam a casa e ignoram o volume;
- não há luz ambiente ligada à hora;
- o vento não tem hora do dia, embora os dados `velHora` existam.

## Ordem proposta (um branch por etapa, um commit por passo, relatório e aprovação antes do merge)

### R0. Retomada (sem branch)
- `git fetch`, `main` atualizada e `core.hooksPath .githooks`.
- `node gerador/testes.js` na `main` e no `etapa-j-edicao`, para conferir que a J1 continua verde.
- Rebase do `etapa-j-edicao` sobre a `main` (só entrou o CI do GitLab).
- Atualizar `docs/CONTINUIDADE.md` com a nova ordem.

### Frente 2. Revisão das plantas feitas à mão (só análise; branch `revisao-plantas-manuais`, só docs)
1. `tools/percurso-manual.mjs`: um verificador de percurso que lê os retângulos e as portas de `roomsACD`/`roomsB` (casa-simetrica/index.html) e de `casa-h/gerar.js`. Para cada cômodo, ele monta o grafo de portas e responde a duas perguntas:
   - o cômodo só é alcançado passando pela cozinha, pela lavanderia ou por um cômodo de permanência?
   - qual é o percurso da visita (entrada → estar → jantar) e o dos moradores (quartos → salas)?
   O verificador também confere o giro de 1,50 m e as faixas livres.
2. Coerência entre o quadro de áreas, a planta técnica, a humanizada, os cortes e os textos de cada opção (A, C, D e casa H).
3. Relatório `docs/auditoria/2026-10-13-plantas-manuais.md`, com um diagnóstico por planta e um plano de correção priorizado. **Nada é alterado nas plantas.**

### V. Melhoria visual (antes da J, porque a J2 põe o botão "Editar" na barra da planta, e a barra muda aqui)

**V0. Benchmarking e protótipo (artifact para aprovar, sem mexer no repo)**
- Referências e o que aproveitar de cada uma:
  - Shadowmap e ShadeMap: régua de hora contínua, sombra suave que muda de comprimento e de opacidade com a altura do sol, céu ligado à hora.
  - 3D Sun-Path de Andrew Marsh e SunCalc: anel do horizonte ao redor do lote, com as horas e o arco do dia; nascente e poente marcados.
  - Autodesk Forma: mapa de calor de horas de sol no lote e nas fachadas, legenda contínua discreta.
  - Ladybug Tools: rosa dos ventos por velocidade, carta solar.
  - Windy, earth.nullschool e Ventusky: partículas com rastro que esmaece, com a velocidade dada pelo m/s.
  - RWIND e Forma Wind: escoamento que contorna o volume, esteira a sotavento.
  - Clima da Apple: gradiente do céu pela hora, transições suaves, controles mínimos.
- O artifact tem três partes:
  - uma tabela comparativa (leitura, estética, interação, custo de implementar no Modulus);
  - um protótipo vivo da nova animação, com o sol e o vento sobre uma planta exemplo;
  - um antes e depois da tela limpa.
- Aprovação do usuário antes de V1.

**V1. Tela limpa + manual + dicas** (branch `v-tela-limpa`)
1. Componente de ajuda em `assets/base.js` e `base.css`, sobre o `data-tip` que já existe:
   - ícone "?" (`.ajuda`) com dica curta, que funciona por teclado e por toque;
   - link "Saiba mais" para uma âncora do manual;
   - o atributo é `data-manual="#ancora"`.
2. Página nova `manual/index.html`, no menu de `base.js` (ícone livro):
   - recebe "Como o gerador decide" (o texto sai de `gerador/index.html`, linhas 489–540), as notas longas do formulário, os métodos e as fontes (sol, vento ERA5, CUB, Lei 14.300, NBR 9050) e um glossário leigo (adianta a V2);
   - fica com o mesmo visual da casa (base.css).
3. Gerador:
   - o parágrafo de apresentação sai, o título fica;
   - a barra da planta mantém só as vistas, com ícones, e ganha dois menus, "Baixar" (SVG e PNG) e "Salvar" (banco e arquivo), além de Espelhar e Zoom;
   - a legenda de zonas vira um botão "Legenda", e o nome da zona aparece por dica sobre o cômodo;
   - o quadro de áreas mostra o resumo (total e área por pavimento), com a tabela completa em `<details>`;
   - na implantação e nos cards, as notas e os selos passam para "?";
   - o formulário troca as `small`/`sub-nota` longas por "?" e deixa uma frase só quando ela for decisiva.
4. `cartoes.js`, `animacao.js` e `ui-blocos.js`: as notas de método passam para "?" com link para o manual.
5. Conferir: `tools/verifica-html.js`, testes, as capturas antes e depois (desktop e 390 px), e que nenhuma informação sumiu: cada texto removido precisa ter destino no manual (vai uma lista no relatório).

**V2. Nova animação de sol e sombras** (branch `v-animacao-sol`)
- Camada em SVG mais um canvas sobreposto, só no navegador. `insolacao.js` e `vento.js` continuam puros.
- **Luz da hora:**
  - véu de cor sobre o lote: dourado ao nascer, neutro ao meio-dia, laranja no fim da tarde;
  - opacidade da sombra dada por `sen(h)`;
  - sombra de borda suave: penumbra em duas camadas ou `feGaussianBlur` leve.
- **Sol:** anel do horizonte em volta do lote, com as marcas de 6h a 18h e as de nascente e poente. O arco do dia é desenhado com gradiente pela altura. O disco do sol leva halo e raio até a casa.
- **Movimento:**
  - interpolação contínua (requestAnimationFrame com suavização) na troca de mês e de hora, sem saltos;
  - "Percorrer o ano" vira um deslize contínuo;
  - uma régua só de mês e hora, com um mini-gráfico da altura solar.
- **Leitura:**
  - fachadas com intensidade em gradiente;
  - manchas de sol nas janelas com brilho;
  - mapa de horas de sol no lote opcional, ao estilo Forma, a partir do `Insolacao.quadro` acumulado.
- O painel lateral fica enxuto: hora, altura e azimute, barras das fachadas e alertas. O resto vai para "?".
- Com `prefers-reduced-motion`, a animação vira um quadro estático. Fora da tela ela pausa (o IntersectionObserver já existe).

**V3. Nova animação do vento** (branch `v-animacao-vento`; inclui a V1 antiga, o vento de 24 h)
- Partículas em canvas com rastro que esmaece. A densidade e a velocidade vêm do m/s do mês e da **hora**: `velHora` e a direção por hora, se faltar no `dados/vento.json` (ajuste de `tools/coleta-vento.mjs`).
- `Vento.campo(v, dir, F)` (puro, testável): escoamento ilustrativo que contorna a projeção da casa, com desvio potencial simples em torno dos retângulos e uma esteira a sotavento mais lenta e marcada. A nota diz em "?" que não é CFD.
- Janelas de entrada (verde) e de saída (laranja) com pulso suave, e uma linha que liga cada entrada à saída pelo interior quando houver ventilação cruzada.
- A rosa dos ventos ganha transição animada entre os meses, a cor passa a indicar a velocidade e há um marcador da hora.
- Testes de unidade do campo: nenhuma partícula entra na casa, a esteira fica a sotavento e a simetria se mantém com a casa espelhada.

### Frente 3. Etapa J, J2 a J6 (branch `etapa-j-edicao`, plano em docs/planos/2026-10-06-etapa-j.md)
- J2: botão "Editar" na barra nova, `gerador/edicao-ui.js`, alças das paredes e encaixe de 5 cm. A conversão ponteiro → casa considera o giro, o espelho e o zoom. Medidas ao vivo, inválido em vermelho.
- J3: portas e janelas. J4: troca de cômodos. J5: desfazer, refazer e persistência (estado, link, arquivo, banco, versão do motor).
- J6: testes no Edge e no Firefox headless, com eventos de ponteiro, e no celular. O manual ganha a seção "Editar a planta", e `docs/CONTINUIDADE.md` é atualizado.

## Arquivos principais
- `gerador/index.html` (layout, barra, quadro, "Como decide"), `assets/base.js` e `base.css` (ajuda, menu), `manual/index.html` (novo).
- `gerador/animacao.js` (reescrita das camadas e da régua), `gerador/insolacao.js` (reuso de `quadro`, `sombras`, `direcao`, `solEm`), `gerador/vento.js` (+ `campo`), `dados/vento.json` e `tools/coleta-vento.mjs` (vento por hora).
- `gerador/cartoes.js`, `gerador/ui-blocos.js` (notas → ajuda).
- `gerador/edicao.js` (J1 pronto) e `gerador/edicao-ui.js` (novo).
- `tools/percurso-manual.mjs` (novo, só leitura das páginas manuais).

## Verificação
- `node gerador/testes.js` a cada passo: golden de 31, unidades e catraca da auditoria. O golden não muda nas etapas V.
- `node tools/verifica-html.js` e o hook de pre-commit.
- Servidor local: `python -m http.server 8765 --bind 127.0.0.1`.
- Edge headless (CDP) para capturas antes e depois, em 1440 px e 390 px, nos temas claro e escuro.
- Taxa de quadros da animação medida no CDP: meta de ≥ 50 fps com 600 partículas.
- Firefox headless na J6.
- Relatório curto em português ao fim de cada etapa e prompt de continuidade em `~/.claude/continuidade/` e `docs/CONTINUIDADE.md`.

## Decisões de 13/10/2026 (depois da V0)
- **V0:** protótipo publicado em https://claude.ai/artifact/Mtxj5tp2NLonLdp7ZPG5Ci (versão 2).
- **Sol e vento dentro da casa (pedido do usuário, viável e demonstrado no protótipo):**
  - **V2:** manchas de sol no piso por janela, do peitoril à verga (`Insolacao.luzPavimento` já calcula; com `ALTURAS` e o fator de brise), mais o feixe da janela até a mancha e a área de sol por cômodo no painel. Melhorias: espessura da parede (vão) e a mancha que sobe na parede oposta quando passa do cômodo.
  - **V3:** caminho do ar da janela de entrada, pelas portas (`p.portas`, largura × 2,10 m; vãos × 2,40 m), até a de saída (menor caminho no grafo de portas); vazão por aberturas em série, Q = Cd · A_ef · U · √ΔCp (BS 5925, ASHRAE Fundamentals cap. 16), Cd = 0,6, Cp +0,6·cos(incidência) / −0,3, U do ERA5 pelo perfil suburbano do ASHRAE (≈ 0,55 × U10) com fator de abrigo 0,5; cômodos de uma face só por 0,025·A·U; renovações por hora com faixas (forte ≥ 30, bom 10–30, fraco 3–10). Função pura `Vento.interno(v, q, p, dirDe, U10)` com testes; as partículas dentro da casa ficam mais rápidas nas aberturas estreitas.
- **Casa simétrica (etapa M, depois da V3 e antes da J2):**
  - **A, C e D:** cozinha **integrada** à sala, com vão livre e bancada no eixo; modelo com vãos sem folha (`roomsACD`), humanizada, técnica, corte, textos e imagens.
  - **B:** proposta principal, com **hall só ao sul** (sala única longitudinal a leste com 29,9 m², cozinha de 17,0 m², hall de 4,7 m²); também ligar a circulação oeste ao jantar e à despensa e tirar as portas dos quartos de dentro do estar e do jantar.
  - Conferir com `node tools/percurso-manual.mjs` (achados altos em zero).
