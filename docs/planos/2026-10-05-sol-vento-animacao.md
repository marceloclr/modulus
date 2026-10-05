# Fase 4-B: animação do sol e do vento ao longo do ano (régua de meses) — aprovado em 05/10/2026

## Contexto
O usuário pediu, antes da Fase 5, uma investigação do que é factível e um plano para um job completo: uma **régua numerada com os 12 meses**; ao mover o marcador, uma **animação mostra a incidência solar** sobre a construção daquele mês; o mesmo para a **incidência dos ventos**, avaliando o Windy como fonte. O Modulus é um site estático (GitHub Pages, sem servidor). Hoje há a geometria completa da variante (`motor.js`: salas, janelas com `h`/`alta`, `peDireito`, rumo da frente e `rumoFace`/`ladoDaJanela` exportados), a geometria solar de Fortaleza em `gerador/brises.js` (`sol`, `instantes`, `dni`, HSA/VSA) e a avaliação de vento L/SE em `motor.js` (`avaliaVento`, `VENTO = 112,5°`). A Fase 4 (branch `fase-4-conforto`) ainda aguarda aprovação; este trabalho parte dela.

## Investigação: o que é factível

| Item | Factível? | Como |
|---|---|---|
| Sol por mês e hora sobre a planta | Sim, no navegador, sem dados externos | `Brises.sol(n, hora)` já dá altura e azimute; sombras e manchas de sol são projeções 2D simples |
| Sombras da casa no lote | Sim | Cada cômodo é um prisma (altura = pavimento × pé-direito); a sombra é o envoltório do retângulo e do retângulo deslocado de `H/tan h` na direção oposta ao sol |
| Sol entrando pelas janelas (mancha no piso) | Sim | Vão (peitoril 1,00 m e verga 2,10 m; janela alta 1,60–2,20 m) projetado no piso pelo VSA/HSA |
| Incidência por fachada no mês | Sim | Soma de `dni × cos(incidência)` por face, mesma conta de `brises.js` |
| 3D (three.js) | Possível, mas fora do escopo aprovado no plano da Fase 4 (seção 6) e pesado | Fica como opção futura; aqui, planta 2D + corte solar |
| **Windy** | **Não serve para a média mensal** | A API (Map/Point Forecast) só dá previsão de poucos dias; a versão gratuita é **só para testes** e proibida em produção; a profissional custa **990 €/ano**. O widget `embed.windy.com` é gratuito, mas não pode ser alterado e não pode ser usado em aplicativo comercial. Uso proposto: **botão “Vento agora no Windy”** abrindo windy.com nas coordenadas do lote (sem iframe, sem custo, sem risco de termos) |
| Vento por mês (rosa dos ventos) | Sim, com dados gravados no repositório | **Open-Meteo Historical (ERA5)**: dados horários de direção e velocidade a 10 m desde 1940, grátis para uso não comercial, com atribuição CC BY 4.0. Coleta uma vez, por script, para `dados/vento.json` (o mesmo modelo de `custos.json`); a página não depende de serviço externo. NASA POWER fica como conferência das médias |
| Escoamento do vento pela casa | Só indicativo | CFD real não roda no navegador; mostra linhas de corrente na direção do mês, janelas a barlavento (entrada) e a sotavento (saída) e a força do vento do mês. A animação fica rotulada como ilustração |

## Abordagem recomendada

### Interface (beta, seção “Conforto passivo”)
- Card novo **“Sol e vento ao longo do ano”** (cor `--card-torre`/steel), com abas **Sol | Vento** e a mesma régua.
- **Régua de meses:** `<input type="range" min="1" max="12">` com 12 marcas numeradas (1 jan … 12 dez) por `<datalist>` + rótulos clicáveis; `aria-valuetext` com o nome do mês; teclado (setas, Home/End). Botão ▶ percorre os meses (1,2 s por mês).
- **Aba Sol:** dentro do mês, a animação percorre o dia 21, das 6h às 18h (régua de horas secundária e ▶/⏸). Sobre a planta do pavimento escolhido (mesma rotação e escala de `Desenho.planta`):
  - sol no arco do dia, com altura e azimute no rótulo;
  - sombras da casa (e dos anexos) no lote;
  - fachadas iluminadas coloridas pela intensidade;
  - manchas de sol no piso entrando pelas janelas;
  - brises (quando houver) reduzindo a mancha, pela fração de `Brises.luz`.
  - Painel ao lado: kWh/m² por fachada no mês, horas de sol direto por cômodo e alerta quando um quarto recebe sol da tarde.
- **Aba Vento:** rosa dos ventos do mês (16 setores, frequência e velocidade média, calmarias), seta da direção predominante sobre o lote, linhas de corrente animadas (velocidade proporcional ao vento do mês), janelas de entrada (barlavento) em verde e de saída (sotavento) em laranja, mais o botão “Vento agora no Windy”.
- `prefers-reduced-motion`: sem animação automática, só quadros ao mover a régua. A animação para quando o card sai da tela.

### Arquivos
- **Novos:**
  - `gerador/insolacao.js`: funções puras. `sombras(v, pav, sol)`, `manchas(v, pav, sol, brises)`, `incidenciaFaces(v, q, mes)`, `horasSolComodos(v, q, mes)`. Reaproveita `Brises.sol`, `instantes`, `luz`, `Motor.ladoDaJanela`, `rumoFace` e `compartilhado`.
  - `gerador/animacao.js`: a régua, o laço de animação (`requestAnimationFrame`) e o desenho da camada SVG sobre a planta.
  - `gerador/vento.js`: lê `dados/vento.json` e dá rosa, predominância e intensidade do mês; reaproveita a lógica de barlavento e sotavento de `avaliaVento`.
  - `dados/vento.json` e `dados/vento.schema.json` (validado por `tools/valida-schema.js`).
  - `tools/coleta-vento.mjs`: busca no Open-Meteo ERA5 de 2015 a 2024, em Fortaleza (−3,73; −38,52), e grava a rosa mensal de 16 setores.
- **Alterados:**
  - `gerador/desenho.js`: exporta a transformação da planta (`X`, `Y`, rotação), para a camada se alinhar; ou a opção `op.camada` que injeta SVG.
  - `gerador/cartoes.js`: casca do card.
  - `gerador/index.html`: seção, scripts e ligação com a variante e o espelhamento.
  - `gerador/testes-unidades.js`, `docs/CONTINUIDADE.md`.
- **O motor não muda:** o golden fica intacto.

### Etapas (branch `fase-4b-sol-vento`, um commit por etapa, com push)
1. Coleta do vento: `tools/coleta-vento.mjs`, `dados/vento.json`, esquema e teste do esquema; conferência das médias com a NASA POWER no commit.
2. `insolacao.js`: sombras, manchas, incidência e horas de sol, com testes de conta à mão (por exemplo, sombra de um cubo de 3 m com o sol a 45° = 3 m; mancha da janela ao meio-dia de junho na face norte).
3. Camada SVG alinhada à planta (rotação, espelhamento e pavimentos).
4. Card, régua de meses e de horas e animação do sol; acessibilidade e movimento reduzido.
5. Aba Vento: rosa mensal, linhas de corrente, janelas de entrada e saída e link do Windy.
6. Capturas em 1440 e 390 px, nos temas claro e escuro, e `CONTINUIDADE.md`.

## Verificação
- `node gerador/testes.js`: 21 casos, golden sem mudança e testes de unidade novos (sombras, manchas, esquema e rosa do vento).
- `node tools/verifica-html.js` e o pre-commit.
- Navegador (servidor local + Edge headless com CDP, perfil novo para evitar cache):
  - mover a régua de 1 a 12 e conferir a mudança do sol (a norte em junho e a sul em dezembro, em Fortaleza);
  - sombra para o sul em junho ao meio-dia;
  - rosa do vento a mudar entre os meses (alísios de E/SE mais fortes de agosto a outubro);
  - console sem erros e largura sem estouro em 390 px;
  - tempo por quadro abaixo de 16 ms (medido com `performance.now`).

## Riscos e limites
- O Open-Meteo é gratuito só para uso não comercial; se o site virar comercial, troca-se pela NASA POWER (domínio público) ou pelas normais do INMET (estação 82397, Fortaleza).
- Dados do ERA5 em grade de cerca de 25 km: servem para o clima regional, não para o vento local entre prédios.
- Linhas de corrente ilustrativas, não CFD.
- Sem 3D nesta fase.
