# Modulus — instruções de continuidade

Atualizado em 05/10/2026. Cole este arquivo num chat novo (ou peça "leia docs/CONTINUIDADE.md") para retomar.

## 1. Objetivo
O **Modulus** (antes GerPlantas; nome trocado em 05/10/2026) é um gerador de plantas residenciais por regras. É um site estático (HTML/JS, sem servidor e sem IA) publicado no GitHub Pages: https://marceloclr.github.io/plantas/. O repositório é `marceloclr/plantas`, branch `main`.

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
  - **Regra de 05/10/2026 (substitui a de 02/10):** com subsolo, o campo de vagas não conta; o subsolo comporta **o máximo de vagas** que cabe no lote (com o menor subsolo para esse máximo). Prioridade às vagas **perpendiculares ao comprimento do lote**: corredor de manobra de 5 m ao longo do lote, no prumo da rampa, com vagas de um lado (largura 10 m) ou dos dois (15 m); se o arranjo em faixas transversais couber mais, ele vence. No terreno mínimo o subsolo fica sob a casa (`subMin`). Teto opcional `subVagasMax` (campo "Teto de vagas no subsolo"; 0 = sem limite): com ele, o subsolo fica do menor tamanho que acomoda essas vagas.
  - Escada e elevador na lateral; manobra contínua de 5 m, sem pilares; jardim de inverno a céu aberto, oposto à rampa (no fundo ou no recuo lateral).
  - Uma cor para cada parte: rampa, manobra, vagas, escada, elevador e jardim.
  - Opção de ocupar os recuos, com conferência da permeabilidade.
- **Sol nos quartos (05/10/2026):** quarto nunca voltado para o poente (face O, proibida: variantes com quarto a oeste só aparecem se nenhuma outra escapar); SO e NO penalizados (sol da tarde em parte do ano); prioridade ao nascente (NE, L, SE). Janelas dos quartos evitam a face O e começam pelas faces a nascente; o espelhamento soma vento e sol. Limite conhecido: com a frente para L ou O, os quartos ficam com as laterais N/S (sem face a nascente), pois o íntimo fica no fundo.
- **Subsolo (05/10/2026):** ao marcar o subsolo, as vagas vão para ele; o campo de vagas some (só aparece "Vagas no térreo" na opção "No subsolo e no térreo") e uma nota explica o máximo de vagas. Rampa em âmbar com seta "DESCE"; manobra hachurada, com contorno tracejado, rótulo e setas; seta da manobra para dentro de cada vaga.
- **Circulação enxuta (05/10/2026):** o trecho final de um corredor que serve só a um quarto (ou ao closet da suíte) passa a fazer parte dele; o hall de apoio encostado na cozinha (sem escada nem elevador) é integrado à cozinha, e o corredor abre para ela. Só quando o cômodo continua retangular e os vizinhos mantêm 1,00 m de corredor (`enxuga()` em `motor.js`). Com dois cômodos na ponta (corredor central), a ponta continua corredor.
- **Pontuação:** o card tem dica explicando a nota (100 menos as penalidades de `avalia()`) e quanto a variante perdeu. O jardim de inverno não conta na penalidade de proporção.
- **Página inicial e banco (05/10/2026):** sem o box "Coleção"; apresentação ao lado da logo. "Estudos em destaque" e o banco mostram um exemplo de cada formato (bloco, L, U, H) com 3 suítes e 3 vagas, gerados ao vivo por `assets/exemplos.js` (acompanham as regras), seguidos dos estudos desenhados à mão.
- **Garagem:** o carro fica perpendicular à face por onde entra (garagem aberta para a frente → carros de frente para a rua), inclusive na casa em H; vão do portão aberto na fachada.
- **Acessos (05/10/2026):** `Motor.acessos` calcula faixas de veículos (garagem, rampa), vagas descobertas no recuo (primeiro do lado oposto à porta; corredor de 2,40 m alinhado à porta quando todas cabem), portões de veículos (faixas vizinhas viram um portão), portão social de 1,00 m alinhado à porta, a 0,60 m ou mais do de veículos e do mesmo lado da porta, e caminho de pedestres de 1,20 m que nunca cruza a rampa nem a frente da garagem. Desenhados na planta do térreo e na implantação (com legenda).
- **Cards das variantes:** mostram terreno (frente × fundo e área) e casa (largura × profundidade e área construída).
- **Custos (Fase 2, beta):** `dados/custos.json` (CUB-CE ago/2026: R1-B 2.400,49 · R1-N 2.905,13 · R1-A 3.472,63, onerado; desonerado 2.269,16 · 2.723,15 · 3.275,17; SINAPI-CE 2296; INCC-M; coeficientes NBR 12721; fatores com faixa e origem; adicionais), `dados/custos-historico.json` e esquemas validados por `tools/valida-schema.js`. `gerador/custos.js` calcula área equivalente × CUB × fatores (local = logística × condomínio × mar; estrutura; estilo) + adicionais (fundação, subsolo, elevador, piscina) + projetos e taxas + BDI (empreitada), faixa mín–máx e INCC opcional. `gerador/valores.js`: camadas oficial + ajustes = efetivo, IndexedDB (reserva localStorage), "Atualizar valores" com diferenças, restaurar, exportar e importar. Cards em `gerador/cartoes.js` + `gerador/graficos.js` (SVG próprio; rampa ordinal validada; SINAPI ao vivo pelo SIDRA). Fatores locais, estruturais e de estilo são estimativas.
- **Energia solar (Fase 3, beta) — decisão do usuário (05/10/2026): só a projeção de custo do pacote básico** (portão automático, iluminação interna e externa, câmeras, geladeira, um ar-condicionado e ventiladores, um por quarto + sala), todas as cargas ligadas pela bateria; sem níveis N1–N4, sem consumo informado e sem carregador de veículo. `gerador/solar.js`: kWp = consumo do pacote ÷ (HSP × 30 × PR) (sem descontar a disponibilidade); irradiação mensal NASA POWER (2001–2020, média 5,76); módulos de 610 Wp; área contra a cobertura × aproveitamento (laje 0,60 provisório até o estilo); bateria = crítica diária × autonomia ÷ (0,9 × 0,95) em múltiplos de 2,5 kWh; inversor pela demanda e pela partida do maior motor; economia pela Lei 14.300 (Fio B 60 % em 2026, Fio B integral estimado em R$ 0,29/kWh) e payback simples e descontado. Card na seção #energia (cor solar), vistas geração × consumo, retorno e cargas. Preços de bateria, inversor híbrido, tributos e Fio B são estimativas a confirmar.
- **Estrutura (Fase 2, beta):** `gerador/estrutura.js`; gancho `Motor.gerar(entrada, {posAvalia:[...]})`; alvenaria estrutural no sobrado exige ≥ 85 % de parede sobre parede (tolerância 0,15 m), senão avisa e penaliza; vão maior que o econômico (ou o máximo, com "vãos maiores") e balanço acima do usual geram aviso.
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
- **Visual:** marca Modulus: ícone (M modular azul e laranja com folhas) em `assets/logo.svg`, logo completo com "Modulus" e o subtítulo "SISTEMA" em `assets/logo-completo.svg` e embutido na página inicial; nome em uma cor só, em IBM Plex Sans. O repositório e o endereço continuam `plantas`; paleta forte por zona; barra superior escura, com contraste em relação ao conteúdo.

## 3. Estado atual
- **Rodadas concluídas:** veja os planos em `docs/planos/`. A última concluída é `2026-10-02-norte-ventos-rooftop.md`. Em curso: `2026-10-05-blocos-custos-solar-estilos.md`, com a **Fase 0 concluída e na `main`** e a **Fase 1 concluída** no branch `fase-1-blocos-estado-ao-vivo`, aguardando aprovação para entrar na `main`. Depois da Fase 1, uma rodada de premissas (branch `premissas-sol-subsolo-acessos`): sol nos quartos, vagas do subsolo, destaque de rampa e manobra, carros no H, acessos e portões, cards com terreno e casa, zoom. Fase 2 (estrutura e custos) na `main`. Fase 3 (energia solar) na `main`; ajuste "solar só básico" no branch `solar-basico`, aguardando aprovação. Mesclado na `main` em 05/10/2026 (b912d75), junto com `regras-circulacao-subsolo` (c80acf9: circulação enxuta, subsolo com máximo de vagas, dica da pontuação, página inicial e exemplos do banco). Teto opcional de vagas no branch `subsolo-teto`, aguardando aprovação. Próxima: Fase 4 (dossiê da torre de ar, tipos de torre e brises).
- **Testes:** `node gerador/testes.js` roda 21 casos de regras (também em `gerador/testes.html`), o **golden** (`gerador/golden.js`: 31 casos, saída canônica do motor e SHA-256 de cada planta, espelhada e implantação, gravados em `gerador/golden/saida.json`) e o tempo de geração (avisa acima de 150 ms; hoje o máximo é ~65–80 ms). Para regravar o golden de propósito: `node gerador/testes.js --atualizar-golden`, com justificativa no commit.
- **Portão de commit:** `.githooks/pre-commit` roda `node --check` em todo JS, os testes com golden e `node tools/verifica-html.js` (equilíbrio de tags e sintaxe dos scripts embutidos). Ative uma vez por clone: `git config core.hooksPath .githooks`.
- **Beta:** `?beta=1` liga e `?beta=0` desliga (localStorage `plantas-beta`); as classes `.so-beta` e `.sem-beta` controlam o que aparece. Os recursos novos entram ocultos até a Fase 7.
- **Fase 1 (no beta):** `gerador/estado.js` (estado único; link `#s=` só com o que difere do padrão; links antigos `#q=` aceitos; `localStorage` `plantas-estado` restaura a sessão no beta) e `gerador/ui-blocos.js` (blocos 1 Dimensões · 2 Tipo de estrutura e padrão de custos · 3 Energia solar · 4 Estilo, montados a partir dos `fieldset[data-secao]`; chips a definir/em edição/pronto/concluído/revisar/bloqueado; "Concluir bloco" só pelo botão; o 4 trava até o 1 ser concluído; mudar o 1 manda 3 e 4 para "revisar"; no celular o painel do resultado desce para baixo do bloco concluído). Ao vivo: `input` nos números com espera de 200 ms; com número fora da faixa, espera a correção; tempo em `#plan[data-ms]` (30–60 ms no navegador). Tokens novos `--plum`, `--brass-ink` e `--card-*` em `base.css`. Testes unitários em `gerador/testes-unidades.js` (21: estado, blocos, sol, acessos, dados e esquemas, estrutura, custos e solar com contas à mão, cards e valores).
- **Arquivos:**
  - `gerador/motor.js`: funções puras. Destaques: `gerar`, `normaliza`, `programa`, `linear` (bloco/L), `emU`, `emH`, `nucleo`, `subsolo`, `comRooftop`, `comTorre`, `comAnexos`, `edicula`, `aberturas` (portas, janelas, saída de fundos), `janelasSubsolo`, `avaliaVento`, `avalia`, `loteMinimo`.
  - `gerador/desenho.js`: `planta` (terreno, rotação, rótulos legíveis, rosa, setas de vento), `lote`, `rosa`, `girado`, `textosLegiveis`, `espelha`.
  - `gerador/index.html`: formulário e resultados.
  - `banco/`: estudos publicados e plantas salvas no navegador.
  - `assets/`: `base.css` (tokens e cabeçalho), `base.js` (menu, tema e sinalizador beta), `projetos.json`, logo.
  - `casa-simetrica/` e `casa-h/`: estudos publicados.

## 4. Pendências conhecidas (nenhuma pedida)
- Itens oferecidos e não aprovados: patamar plano no início da rampa e núcleo no fundo do subsolo.
- O máximo de vagas aumenta muito o subsolo (e o custo) em lotes largos ou fundos; avaliar um teto opcional se o usuário pedir.
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
- **Nomes no formulário:** um id igual ao name de um campo quebra `form.elements[nome]` (o botão Restaurar era id="padrao" e virou id="restaurar").
- **Valores no navegador:** os oficiais aceitos ficam em IndexedDB (`modulus`/`valores`) e em localStorage `plantas-custos`; para testar do zero, apague os dois.
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
