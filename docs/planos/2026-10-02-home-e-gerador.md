# Plantas: home de projetos + gerador de plantas por formulário

## Context
O repositório `marceloclr/plantas` (GitHub Pages, branch `main`, raiz) hoje só tem as pastas `casa-simetrica/` (página rica, no padrão de referência) e `casa-h/` (página simples criada hoje). A raiz `/plantas/` não tem `index.html`. O usuário quer:
1. `/plantas/` abrindo uma home com os projetos (casa simétrica e casa em H), com o visual da casa simétrica como padrão.
2. Um projeto novo, o **gerador**: o usuário preenche campos (terreno frente × fundo, recuos, quantidade e tipo de cômodos, banheiros, garagem, salas, térrea ou sobrado, subsolo) e recebe plantas geradas.

Decisões do usuário: os projetos ficam na raiz e as URLs atuais não mudam. O motor é feito de regras em JavaScript, rodando no navegador, sem IA e sem servidor. O subsolo deve existir tanto na térrea quanto no sobrado.

## Estrutura final
```
plantas/
├─ index.html            ← home (novo)
├─ assets/
│  ├─ base.css           ← tokens, tema claro/escuro, header, sidebar, painéis, cards, tabelas (extraído de casa-simetrica/index.html)
│  └─ base.js            ← botão de tema (chave localStorage 'plantas-tema'), menu móvel/recolher, dicas
├─ casa-simetrica/       ← inalterado na URL; passa a ter link "← Projetos" no header
├─ casa-h/               ← refeita no padrão da casa simétrica
├─ gerador/
│  ├─ index.html         ← formulário + resultado
│  ├─ motor.js           ← programa → layout (puro, testável)
│  ├─ desenho.js         ← layout → SVG (estilo de casa-h/gerar.js)
│  └─ testes.html        ← casos de teste rodando no navegador
└─ docs/planos/2026-10-02-home-e-gerador.md  ← cópia deste plano (fluxo do autor)
```

## Etapas (um commit Conventional Commits + push por etapa; relatório no fim)

### Etapa 1: base visual comum + home
- Extrair de `casa-simetrica/index.html` (linhas ~10–236: `:root` com os tokens, os dois blocos de tema escuro, `header.bar`, `.brand`, `.crumb`, `.panel`, `.hero`, `.carimbo`, `.card`, `.tbl-wrap`, `.tag`, footer) para `assets/base.css`. Extrair também a lógica de tema (linhas ~1751–1755) para `assets/base.js`.
- A casa simétrica **continua com o CSS embutido** (não reescrevo um arquivo de 174 KB). Só acrescento o link "← Projetos" no `.brand`. Isso evita regressão.
- `index.html` na raiz terá header igual, hero ("Plantas humanizadas"), uma grade de cartões (miniatura SVG, título, ficha curta: área, lote, fase) e o link para cada projeto: Casa simétrica, Casa em H e Gerador.

### Etapa 2: casa em H no padrão
- Reescrever `casa-h/index.html` usando `../assets/base.css`. A página terá hero com carimbo (ficha técnica), a planta (`planta_H_v1.svg`, com o PNG como alternativa), as seções Organização, Quadro de áreas, Terreno mínimo e Pendências (recuos a confirmar) e o link "← Projetos".
- `gerar.js` e a planta não mudam.

### Etapa 3: gerador, motor térreo
Campos (com padrões editáveis):
- **Terreno:** frente, fundo, recuos (frente, laterais, fundo), taxa de ocupação máxima e orientação da frente (opcional).
- **Programa:** número de quartos e quantos são suítes (uma pode ser master), banheiros sociais/lavabo, salas (estar, jantar, TV, escritório: marcar e quantificar), cozinha (aberta ou fechada), área de serviço e despensa, garagem (vagas, coberta sim/não), varanda/gourmet.
- **Tipo:** térrea ou sobrado; subsolo sim/não (com o que vai nele: garagem, depósito, lazer).

Motor (`motor.js`, funções puras):
1. **Programa → lista de ambientes** com área mínima e proporção máxima (tabela de mínimos de código de obras genérico, editável e documentada; ex.: quarto ≥ 9 m² e lado ≥ 2,70; suíte master ≥ 12 m²; banho ≥ 2,4 m²; vaga 2,50 × 5,00).
2. **Área edificável:** terreno menos recuos, limitada pela taxa de ocupação. Avisa quando o programa não cabe e diz o lote mínimo.
3. **Tipologias candidatas** pela proporção da área edificável: linear (lote estreito), L, U, H (lote largo, aproveitando a lógica de alas de `casa-h/gerar.js`).
4. **Zoneamento em faixas:** social e garagem na frente, serviço e molhados no meio, íntimo no fundo (ou cada zona em uma ala, no H/U). Os cômodos de cada faixa são encaixados por divisão recursiva de retângulos (*slicing*) respeitando as áreas e os lados mínimos. Molhados ficam encostados para concentrar a hidráulica, e a circulação tem largura ≥ 1,00 m.
5. **Aberturas:** portas pela adjacência com a circulação; janelas nas paredes externas (janela alta nos banhos).
6. **Pontuação** das variantes (área desperdiçada, circulação, cômodos sem parede externa, proporções) e exibição das 3 melhores.

### Etapa 4: subsolo (térrea e sobrado)
- Pavimento extra com o contorno da projeção (ou do terreno, se o subsolo puder ocupar os recuos, em uma opção configurável). Nele vão garagem (vagas + circulação de manobra de 5,00 m), depósito e lazer.
- Rampa (inclinação máxima configurável, padrão 20%, com comprimento calculado e desenhado) e escada ligando ao térreo, alinhada à circulação.

### Etapa 5: sobrado
- O térreo recebe o social, o serviço e a garagem (se não estiver no subsolo); o superior recebe os quartos e as suítes.
- Escada (cálculo de Blondel: espelho ≈ 0,175, piso ≈ 0,28, pé-direito configurável) posicionada no térreo e reservada **no mesmo lugar** em todos os pavimentos (subsolo e superior). As prumadas dos banhos ficam alinhadas entre os pavimentos sempre que possível.
- A taxa de ocupação considera a projeção, e o coeficiente de aproveitamento soma todos os pavimentos.

### Saída do gerador (todas as etapas)
- Abas por pavimento (Subsolo · Térreo · Superior) e por variante; implantação no lote com os recuos.
- Quadro de áreas, avisos (o que não coube e as regras violadas) e parâmetros usados.
- Botões: baixar SVG, baixar PNG (canvas) e salvar/carregar JSON do programa. O link compartilhável leva os campos na URL (`?q=` em base64), sem servidor.
- Visual: `assets/base.css` com o desenho no estilo de `casa-h/gerar.js` (cores de zona, paredes, portas com arco, janelas, cotas).

## Reuso
- Tokens, cores de zona (`--suite-f`, `--social-f`, `--apoio-f`, `--var-f`, `--recuo-f` …) e componentes: `casa-simetrica/index.html` (linhas 10–236).
- Desenho de paredes, portas, janelas, cotas, legenda e croqui do lote: `casa-h/gerar.js` (as funções `rect`, `line`, `cota`, o bloco de portas e o croqui), adaptado para receber o layout do motor em vez das listas fixas.
- Padrão de render via strings SVG com `<title>` nos ambientes: `casa-simetrica/index.html` (função `R`, linhas ~593+).

## Verificação
- Etapa 1–2: servidor local (`python -m http.server`) e Edge headless (`--screenshot`, `--dump-dom`), como já feito nesta sessão. Conferir a home, a casa-h e a casa simétrica (sem regressão, com o link de volta) nos temas claro e escuro e em largura de celular (390 px). Depois do push, conferir a URL publicada (HTTP 200) com `curl`.
- Gerador: `gerador/testes.html` com casos fixos, rodando no Edge headless (`--dump-dom`):
  - 10×30 térrea com 2 quartos;
  - 12×30 térrea com 3 suítes e 2 vagas;
  - 22×30 com o programa da casa em H (deve propor H ou U);
  - 10×25 sobrado com 4 quartos e subsolo com 2 vagas;
  - programa grande demais (deve avisar e indicar o lote mínimo).
  Em todos os casos, nenhum ambiente fica abaixo do mínimo, não há sobreposição, tudo fica dentro da área edificável e as escadas ficam alinhadas entre os pavimentos.
- Capturas de tela das variantes geradas para inspeção visual no relatório final.
- Relatório em português: o que foi testado e o que não foi.
