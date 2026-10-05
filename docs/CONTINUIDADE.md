# GerPlantas — instruções de continuidade

Atualizado em 05/10/2026. Cole este arquivo num chat novo (ou peça "leia docs/CONTINUIDADE.md") para retomar.

## 1. Objetivo
O **GerPlantas** é um gerador de plantas residenciais por regras. É um site estático (HTML/JS, sem servidor e sem IA) publicado no GitHub Pages: https://marceloclr.github.io/plantas/. O repositório é `marceloclr/plantas`, branch `main`.

O usuário preenche um formulário com terreno, recuos, orientação, cômodos, banheiros, garagem, sobrado, subsolo, rooftop, edícula e piscina. O site devolve variantes de planta em escala, com quadro de áreas, implantação no lote e avisos.

## 2. Decisões e preferências do usuário (regras do produto)
- **Fluxo de trabalho:** em mudanças grandes, plano antes de executar; um commit Conventional Commits com push por etapa; relatório final em português; ao concluir uma rodada, atualizar este arquivo.
- **Orientação:** a rosa dos ventos aparece sempre, com o **norte para cima**, e é a **planta que gira** conforme o rumo da frente. O rumo da frente é pedido de forma visual, com 8 rumos.
- **Terreno:** todas as plantas, inclusive o subsolo e a edícula, são desenhadas **sobre o terreno**, com divisas, área edificável e rua.
- **Vento:** o vento predominante vem de **leste/sudeste**. A avaliação exige aberturas a barlavento e a sotavento; entrada e saída de fundos ficam em faces opostas; a versão espelhada é sugerida quando favorece o fluxo.
- **Torre de calor (opcional):** sobre a escada no sobrado, ou sobre o estar na térrea.
- **Subsolo:**
  - Sem depósito e sem lazer.
  - Vagas de **3,00 × 5,00 m**; rampa com **3,50 m** de largura, desenhada inteira em escala (o trecho no recuo fica tracejado).
  - O subsolo é **dimensionado pelas vagas pedidas** (menor retângulo, para reduzir custo).
  - Escada e elevador na lateral; manobra contínua de 5 m, sem pilares; jardim de inverno a céu aberto, oposto à rampa (no fundo ou no recuo lateral).
  - Uma cor para cada parte: rampa, manobra, vagas, escada, elevador e jardim.
  - Opção de ocupar os recuos, com conferência da permeabilidade.
- **Sol nos quartos (05/10/2026):** quarto nunca voltado para o poente (face O, proibida: variantes com quarto a oeste só aparecem se nenhuma outra escapar); SO e NO penalizados (sol da tarde em parte do ano); prioridade ao nascente (NE, L, SE). Janelas dos quartos evitam a face O e começam pelas faces a nascente; o espelhamento soma vento e sol. Limite conhecido: com a frente para L ou O, os quartos ficam com as laterais N/S (sem face a nascente), pois o íntimo fica no fundo.
- **Subsolo (05/10/2026):** ao marcar o subsolo, as vagas vão para ele e a seção pergunta "Vagas no subsolo" (mínimo 1, obrigatório para concluir o bloco 1). Rampa em âmbar com seta "DESCE"; manobra hachurada, com contorno tracejado, rótulo e setas; seta da manobra para dentro de cada vaga.
- **Garagem:** o carro fica perpendicular à face por onde entra (garagem aberta para a frente → carros de frente para a rua), inclusive na casa em H; vão do portão aberto na fachada.
- **Acessos (05/10/2026):** `Motor.acessos` calcula faixas de veículos (garagem, rampa), vagas descobertas no recuo (primeiro do lado oposto à porta; corredor de 2,40 m alinhado à porta quando todas cabem), portões de veículos (faixas vizinhas viram um portão), portão social de 1,00 m alinhado à porta, a 0,60 m ou mais do de veículos e do mesmo lado da porta, e caminho de pedestres de 1,20 m que nunca cruza a rampa nem a frente da garagem. Desenhados na planta do térreo e na implantação (com legenda).
- **Cards das variantes:** mostram terreno (frente × fundo e área) e casa (largura × profundidade e área construída).
- **Zoom:** botões −, + e "Ajustar" na planta e na implantação (50 % a 400 %; atalhos + − 0).
- **Escadas e elevador:** os lances não precisam ficar empilhados; o elevador fica sempre no mesmo prumo em todos os andares.
- **Vagas:** podem ficar no térreo, só no subsolo, ou no subsolo e no térreo.
- **Sobrado:** em bloco único, L e U, com superior correspondente ou parcial por seções e escolha do que vai para cima. O H é só para casa térrea.
- **Rooftop:**
  - Na térrea e no sobrado.
  - Posição sobre o pavimento de baixo: frente, centro ou fundo.
  - Áreas em m² de área técnica, varanda gourmet, varanda coberta e terraço, além de banho e spa.
  - Pavimento de baixo esmaecido no desenho.
- **Varanda e terraços:** varanda corrida ou em L; terraços sempre em faixa contínua ou em L.
- **Edícula:** sem hall; na de 2 pavimentos, o banho de cima fica sobre o de baixo.
- **Dimensões:** opcionais por cômodo, em largura × comprimento ou área.
- **Rodada em curso (05/10/2026):** plano `docs/planos/2026-10-05-blocos-custos-solar-estilos.md`, em 8 fases (0 a 7), cada uma num branch próprio e com aprovação do usuário antes da seguinte. Decisões: quatro blocos (Dimensões · Tipo de estrutura e padrão de custos · Energia solar · Estilo arquitetônico); concluir bloco só pelo botão; solar antes do estilo, com cobertura provisória; coleta do CUB por GitHub Action que abre pull request; token `--plum`; fatores de custo como estimativas editáveis; subsolo em térrea e sobrado; brises com estudo do melhor ângulo.
- **Visual:** marca GerPlantas (`assets/logo.svg`); paleta forte por zona; barra superior escura, com contraste em relação ao conteúdo.

## 3. Estado atual
- **Rodadas concluídas:** veja os planos em `docs/planos/`. A última concluída é `2026-10-02-norte-ventos-rooftop.md`. Em curso: `2026-10-05-blocos-custos-solar-estilos.md`, com a **Fase 0 concluída e na `main`** e a **Fase 1 concluída** no branch `fase-1-blocos-estado-ao-vivo`, aguardando aprovação para entrar na `main`. Depois da Fase 1, uma rodada de premissas (branch `premissas-sol-subsolo-acessos`): sol nos quartos, vagas do subsolo, destaque de rampa e manobra, carros no H, acessos e portões, cards com terreno e casa, zoom. Próxima: Fase 2 (estrutura e custos).
- **Testes:** `node gerador/testes.js` roda 21 casos de regras (também em `gerador/testes.html`), o **golden** (`gerador/golden.js`: 31 casos, saída canônica do motor e SHA-256 de cada planta, espelhada e implantação, gravados em `gerador/golden/saida.json`) e o tempo de geração (avisa acima de 150 ms; hoje o máximo é ~65–80 ms). Para regravar o golden de propósito: `node gerador/testes.js --atualizar-golden`, com justificativa no commit.
- **Portão de commit:** `.githooks/pre-commit` roda `node --check` em todo JS, os testes com golden e `node tools/verifica-html.js` (equilíbrio de tags e sintaxe dos scripts embutidos). Ative uma vez por clone: `git config core.hooksPath .githooks`.
- **Beta:** `?beta=1` liga e `?beta=0` desliga (localStorage `plantas-beta`); as classes `.so-beta` e `.sem-beta` controlam o que aparece. Os recursos novos entram ocultos até a Fase 7.
- **Fase 1 (no beta):** `gerador/estado.js` (estado único; link `#s=` só com o que difere do padrão; links antigos `#q=` aceitos; `localStorage` `plantas-estado` restaura a sessão no beta) e `gerador/ui-blocos.js` (blocos 1 Dimensões · 2 Tipo de estrutura e padrão de custos · 3 Energia solar · 4 Estilo, montados a partir dos `fieldset[data-secao]`; chips a definir/em edição/pronto/concluído/revisar/bloqueado; "Concluir bloco" só pelo botão; o 4 trava até o 1 ser concluído; mudar o 1 manda 3 e 4 para "revisar"; no celular o painel do resultado desce para baixo do bloco concluído). Ao vivo: `input` nos números com espera de 200 ms; com número fora da faixa, espera a correção; tempo em `#plan[data-ms]` (30–60 ms no navegador). Tokens novos `--plum`, `--brass-ink` e `--card-*` em `base.css`. Testes unitários em `gerador/testes-unidades.js` (9, inclusive sol nos quartos nos 8 rumos e acessos).
- **Arquivos:**
  - `gerador/motor.js`: funções puras. Destaques: `gerar`, `normaliza`, `programa`, `linear` (bloco/L), `emU`, `emH`, `nucleo`, `subsolo`, `comRooftop`, `comTorre`, `comAnexos`, `edicula`, `aberturas` (portas, janelas, saída de fundos), `janelasSubsolo`, `avaliaVento`, `avalia`, `loteMinimo`.
  - `gerador/desenho.js`: `planta` (terreno, rotação, rótulos legíveis, rosa, setas de vento), `lote`, `rosa`, `girado`, `textosLegiveis`, `espelha`.
  - `gerador/index.html`: formulário e resultados.
  - `banco/`: estudos publicados e plantas salvas no navegador.
  - `assets/`: `base.css` (tokens e cabeçalho), `base.js` (menu, tema e sinalizador beta), `projetos.json`, logo.
  - `casa-simetrica/` e `casa-h/`: estudos publicados.

## 4. Pendências conhecidas (nenhuma pedida)
- Itens oferecidos e não aprovados: patamar plano no início da rampa, vagas em fila e núcleo no fundo do subsolo.
- **Limites:**
  - O H não aceita sobrado.
  - Às vezes a área de serviço e o banho social saem superdimensionados.
  - Variantes com nota 0 ainda aparecem.
  - No celular, o formulário vem antes do resultado.
  - Rooftop em casa estreita: banho e área técnica podem não caber na linha da escada (o gerador avisa).
  - A tabela de mínimos é genérica, não de um município.

## 5. Armadilhas
- **Patches no `motor.js`:** escreva os blocos com template strings num arquivo à parte e insira com um script Node; use âncoras únicas. Regex escrita por heredoc perde as barras invertidas.
- **Capturas no Edge headless:** apague o perfil antes (cache). O "estouro" em 390 px é falso, porque o Edge headless tem largura mínima.
- **HTML:** `data-U` vira `dataset.u`. A regra `[hidden]{display:none!important}` é necessária porque `.chk` usa `display:flex`. Um `const` duplicado em `sincroniza()` já quebrou a página: confira se o formulário carrega depois de cada mudança.
- **Testes:** cada par de andares vizinhos precisa de um lance de escada em comum. O jardim do subsolo pode ficar fora do retângulo do subsolo, no recuo lateral.
- **Golden:** qualquer mudança no motor ou no desenho quebra o golden, inclusive mudanças desejadas. Confira o diff impresso e só então regrave com `--atualizar-golden`, explicando no commit.
- **Lógica nova da interface** vai para módulos próprios (`gerador/estado.js`, `ui-blocos.js`…), nunca para `sincroniza()`.
- **CUB-CE:** os zips do Sinduscon mudam de nome a cada mês e trazem PDFs duplicados "(1)"; leia com `pdftotext -raw` o Relatório 5 (com `-layout`, os rótulos saem deslocados das colunas). O site do Sinduscon não libera CORS; a API do SIDRA libera.
- **Capturas:** Edge headless com `--remote-debugging-port=9333` e um mini-cliente CDP em Node (WebSocket nativo); o tema se força com `Emulation.setEmulatedMedia` (prefers-color-scheme).
- **CDP:** navegar só trocando o hash não recarrega a página; acrescente um `?x=n` diferente. A captura headless com rolagem omite a barra fixa do topo (artefato; acontece também fora do beta).
- **ui-blocos:** ele move nós do formulário (subsolo, torre) e, no celular, o painel de resultado para dentro do `<form>`; os ouvintes do formulário ignoram eventos vindos de `.bloco-res`.
- **Servidor de teste:** `python -m http.server 8765 --bind 127.0.0.1`; para encerrar, `pkill -f "http.server 8765"`.

## 6. Como retomar
```bash
git clone https://github.com/marceloclr/plantas.git   # ou git pull na pasta local
cd plantas
git config core.hooksPath .githooks
node gerador/testes.js
git log --oneline -15
```
Leia primeiro este arquivo e o plano mais recente em `docs/planos/`.
