# Blocos guiados, custos, estrutura, energia solar, torre de ar, brises e estilos com fachadas (aprovado em 05/10/2026)

Pedido do usuário (prompt v2, 05/10/2026): reorganizar o menu lateral em blocos sanfonados guiados, com renderização ao vivo e cards por cor; acrescentar custo médio de construção (CUB-CE), sistema estrutural, energia solar on-grid com comutação para off-grid, dossiê de torres de ar e uma segunda fase de projeto com estilo arquitetônico, quatro fachadas e muro frontal; coleta mensal dos custos com persistência no navegador. Implantação em fases pequenas e reversíveis, com testes golden, sinalizador beta e aprovação a cada fase.

## Decisões do usuário (05/10/2026)
1. **Quatro blocos:** 1 Dimensões · 2 Tipo de estrutura e padrão de custos · 3 Energia solar · 4 Estilo arquitetônico.
2. Energia solar **antes** do estilo, com cobertura provisória que se recalcula quando o estilo é escolhido.
3. Coleta do CUB por GitHub Action que **abre pull request**; o botão do site leva à página do Action (sem proxy e sem token no cliente).
4. Token de cor novo `--plum` (#7A5470 / #C9A0BE) para o estilo.
5. Fatores local, estrutural e de estilo publicados como **estimativas editáveis**, com a origem na dica.
6. **Subsolo nos dois tipos (térrea e sobrado)**, em todos os formatos que o motor aceita (bloco, L, U; o H é só térreo). O motor já gera os dois; o Bloco 1 mantém o subsolo como subseção própria, visível para os dois tipos, e os testes golden cobrem cada combinação.
7. **Brises:** opção nova. Quando marcada, o gerador estuda o tipo e o ângulo que melhor sombreiam cada abertura pela geometria solar de Fortaleza (seção 8).

## 1. Entendimento e mapa de arquivos
Hoje o formulário (`aside.sb`) tem 8 `fieldset` e cerca de 120 campos; cada `change` chama `sincroniza()` e `gerar()`. O pedido transforma o formulário num fluxo guiado em blocos, com estado único (URL e navegador) e resultado ao vivo, e acrescenta camadas de análise em módulos próprios sobre a variante gerada: estrutura, custo, solar, torre de ar e brises. Depois vem a segunda fase de projeto: estilo, fachadas e muro. O `motor.js` recebe só pontos de integração mínimos, por script Node com âncoras únicas.

- **Alterados:** `gerador/index.html`, `gerador/motor.js` (2 a 3 âncoras), `gerador/desenho.js`, `gerador/testes.js`, `assets/base.css`, `assets/base.js`, `banco/index.html`, `assets/projetos.json`, `docs/CONTINUIDADE.md`.
- **Novos:** `gerador/estado.js`, `ui-blocos.js`, `estrutura.js`, `custos.js`, `solar.js`, `brises.js`, `estilos.js`, `fachadas.js`, `graficos.js`, `golden.js` e `golden/`; `dados/custos.json`, `custos-historico.json`, `custos.schema.json`; `estilos/estilos.json` e `estilos.schema.json`; `tools/coleta-cub.mjs`, `tools/verifica-html.js`, `.githooks/pre-commit`; `.github/workflows/atualiza-custos.yml`; `torre/index.html`.
- **Constatações:** o `testes.js` tem 21 casos (o CONTINUIDADE dizia 22). `Motor.gerar` leva de 3 a 50 ms no Node (pior caso: sobrado com subsolo), o que deixa a meta de 150 ms viável sem Web Worker. `desenho.js` roda no Node. As janelas trazem `h`, `alta` e `vidro`, mas não o peitoril. A casa de referência da galeria será uma entrada fixa do motor que imita a opção A da casa simétrica.

## 2. Interface
**Blocos** (`<details>` não exclusivos, com resumo de uma linha e chip de estado: a definir, em edição, concluído, revisar):

| Bloco | Conteúdo | Cor |
|---|---|---|
| 1 Dimensões | terreno e orientação · tipo e formato · subsolo · quartos e banheiros · salas e serviço · dimensões dos cômodos (recolhida) · garagem e áreas externas · anexos (recolhida) · conforto passivo: torre de ar e brises | `--patina` |
| 2 Tipo de estrutura e padrão de custos | sistema estrutural, vãos e balanço · município, distância do mar, padrão, CUB desonerado · coeficientes e fatores (avançado) | `--moss` |
| 3 Energia solar | nível N1–N4, consumo, autonomia, tarifa, carregador de veículo elétrico | `--brass` |
| 4 Estilo arquitetônico | galeria, comparação de até 5, escolha, muro; liberado depois do Bloco 1 concluído | `--plum` |

- **Concluir somente pelo botão**, que valida, fecha, abre o próximo bloco e põe o foco no primeiro campo. Quando os obrigatórios estiverem válidos, o chip mostra "pronto para concluir".
- **Primeira visita** (sem hash e sem estado salvo): o Bloco 1 abre sozinho, **sem** autofoco.
- **Invalidação** por mapa de dependências em `ui-blocos.js`, nunca em `sincroniza()`: formato, tipo e terreno → estilo e fachadas voltam a "revisar"; quartos, piscina e elevador → solar volta a "revisar".
- **Teclado e acessibilidade:** `aria-invalid`, `aria-describedby`; o bloco bloqueado leva `aria-disabled` e cancela o `toggle`.
- **Celular (≤ 899 px):** os cards de resultado são movidos para logo abaixo do bloco concluído.
- **Ao vivo:** `input` com espera de 200 ms e descarte de resultados antigos; `data-ms` com o tempo; "Gerar plantas" vira "Gerar novamente".
- **Estado:** `#s=` com só as diferenças em relação ao padrão; os links antigos `#q=` continuam aceitos; `localStorage['plantas-estado']`.
- **Cards:** `.card.res` com borda superior `var(--c)` e faixa `color-mix(in srgb, var(--c) 9%, var(--surface-2))`.

| Cor | Bloco | Card | Filtro do banco |
|---|---|---|---|
| patina | 1 | Variante da planta | Formato, pavimentos |
| moss | 2 | Estimativa de custo | Padrão |
| slate | — | Estrutura | Sistema estrutural |
| brass | 3 | Energia solar | Solar |
| steel | — | Torre de ar e Brises (conforto passivo) | Torre |
| plum | 4 | Estilo | Estilo |
| rust | — | Fachadas | — |
| graphite | — | Muro frontal | — |

Contraste das cores como borda (meta 3:1), claro / escuro: patina 4,82 / 6,19; moss 5,18 / 5,81; slate 5,83 / 5,85; brass 3,73 / 6,48; steel 5,34 / 5,93; plum 6,31 / 6,61; rust 5,31 / 5,52; graphite 10,60 / 9,10. O brass no tema claro não passa para texto (4,5:1): os chips usam texto `--ink` com ponto colorido, e, se for preciso, `--brass-ink: #7E6338`.

## 3. Esquemas
- `dados/custos.json`: `cub` (uf, fonte, url, mesRef, publicadoEm, coletadoEm, sha256Zip, onerado, desonerado, composicao), `referencias` (sinapi: tabela 2296, var. 48; incc), `padroes` (simples R1-B, intermediario R1-N, alto R1-A), `coeficientes`, `fatores.{local,marinho,estrutural,estilo}` com min/med/max/origem/fontes, `adicionais`, `solar`, `brises`, `muro`.
- `dados/custos-historico.json`: série mensal `[{mesRef, onerado, desonerado, sinapi, incc}]`.
- `estilos/estilos.json`: `casaReferencia` e `estilos[]` (id, nome, cor, telhado {tipo, inclinacao, telha}, beiral, platibanda, peDireito, esquadrias, materiais, paleta, elementos, camadas, zb8, fatorCusto, muro, brises {padrao, material}).
- `estado`: `{versao:2, entrada:{…PADRAO + municipio, distMar, padrao, cub, estSistema, estVaos, estBalanco, solNivel, solConsumo, solAutonomia, torreTipo, brises, brisesTipo, brisesFaces, muroAltura, muroTipo}, ui:{blocos, abertos, variante, pavimento, espelho}, custos:{ajustes, projecaoIncc}, estilo:{comparar, escolhido, fachada}}`.

## 4. Valores-rascunho (coletados em 05/10/2026)
**CUB-CE de agosto/2026** (último publicado, emitido em 09/09/2026):

| Padrão | Onerado (R$/m²) | Desonerado (R$/m²) |
|---|---|---|
| R1-B | 2.400,49 (+1,43%) | 2.269,16 |
| R1-N | 2.905,13 (+1,15%) | 2.723,15 |
| R1-A | 3.472,63 (+0,82%) | 3.275,17 |
| R8-N | 2.458,13 | 2.313,49 |

Composição do R1-N: materiais 1.151,26; mão de obra 1.633,61; administração 119,98; equipamentos 0,28. Os valores de julho/2026 também foram extraídos.

**Referências:** SINAPI-CE (SIDRA, tabela 2296, variável 48) R$ 1.883,20 em ago/2026, API com CORS liberado. INCC-M de set/2026: +0,25% no mês e +6,61% em 12 meses. Projeção pelo INCC opcional e marcada como estimada.

**Área equivalente (NBR 12721):**

| Uso | Coeficiente |
|---|---|
| Garagem | 0,60 (0,50–0,75) |
| Varanda | 0,85 (0,75–1,00) |
| Terraço descoberto e rooftop | 0,45 (0,30–0,60) |
| Área técnica | 0,60 |
| Piscina | 0,60 |
| Jardins | 0,20 |

**Fator local** (estimativa, produto de logística × condomínio × marinho):

| Componente | Fortaleza | Eusébio | Aquiraz (sede) | Porto das Dunas |
|---|---|---|---|---|
| Logística | 1,00 | 1,01–1,03 | 1,02–1,05 | 1,03–1,06 |
| Condomínio | 1,00 (1,02 em condomínio) | 1,02–1,04 | 1,00 | 1,02–1,04 |
| Marinho | 1,04–1,07 a até 500 m do mar | — | — | 1,05–1,08 |

O fator marinho segue a NBR 6118, classes III e IV.

**Sistemas estruturais:**

| Sistema | Fator | Vão econômico / máximo | Balanço |
|---|---|---|---|
| Alvenaria estrutural | 0,93–0,97 | 4–5 / 6 m | ≤ 1,0 m |
| Concreto armado | 1,00 | 4–6 / 8 m | 1,5–2,0 m |
| Laje nervurada | 1,02–1,05 | 7–10 / 12 m | 2,0–2,5 m |
| Concreto protendido | 1,06–1,10 | 8–12 / 15 m | 3–4 m |
| Estrutura metálica | 1,08–1,15 (+0,03 no litoral) | 6–10 / 15 m | 3–5 m |
| Steel frame | 1,00–1,10 | 3–5 / 6 m | ≤ 1,2 m |
| CLT/MLC (só referência) | 1,20–1,35 | 4–6 / 8 m | 2 m |

**Estilo:**

| Estilo | Fator |
|---|---|
| Cara de casa | 0,98–1,03 |
| Farm | 1,02–1,06 |
| Inglês | 1,06–1,12 |
| Moderna | 1,06–1,12 |
| Ecológica | 1,02–1,08 |

**Adicionais:**
- Fundação: térrea R$ 180–260 por m² de projeção; sobrado R$ 300–450 por m².
- Subsolo: R$ 1.500–2.500/m².
- Elevador: R$ 90–180 mil.
- Piscina: R$ 1.800–3.000 por m² de lâmina, mais R$ 8–15 mil de equipamentos.
- Projetos, ART e taxas: 4–8%.
- BDI: 20,34 / 22,12 / 25,00% (TCU, Acórdão 2622/2013).
- **Brises de alumínio:** R$ 600–1.500 por m² de fachada protegida (estimativa).

**Solar:**
- HSP de 5,5 a 5,7, a confirmar no CRESESB SunData; PR de 0,75 a 0,80.
- Preço instalado: R$ 3,62/Wp (2 kWp), R$ 2,66/Wp (4 kWp) e R$ 2,0–2,4/Wp a partir de 8 kWp (Greener, 1º semestre de 2026).
- Bateria LiFePO₄: R$ 2.500–4.000/kWh; inversor híbrido: R$ 1.000–1.800/kW (ambos a confirmar).
- Tarifa B1 da Enel CE: R$ 0,702/kWh sem tributos; Fio B a 60% em 2026, 75% em 2027 e 90% em 2028.

**Muro:**
- Alvenaria de 2 m: R$ 900–1.600 por metro.
- Gradil: R$ 700–1.200/m²; cobogó: R$ 350–600/m².
- Portão social: R$ 3–7 mil; portão de garagem automático: R$ 8–18 mil.
- Padrão de entrada Enel: R$ 2,5–5 mil.

## 5. Dossiê da torre de ar (resumo)
Na ZB8 o vento manda: com ΔT de 1 a 3 K, o efeito chaminé dá cerca de 1.900 m³/h por m² de abertura (H = 6 m, ΔT = 2 K), contra cerca de 8.600 m³/h por vento (4 m/s, ΔCp = 1). Soluções analisadas: chaminé, captador de vento, combinado, coroamento de sucção (Lelé), chaminé solar, híbrida com exaustor EC, exaustor eólico, torre evaporativa (inadequada na ZB8) e dutos enterrados (ganho baixo e condensação).

Recomendação por tipologia:

| Tipologia | Solução |
|---|---|
| Térrea | Coroamento de sucção sobre o estar, mais EC opcional |
| Sobrado | Torre sobre a escada com coroamento de sucção, chaminé solar e EC (híbrida) |
| Rooftop | Captador para E/SE na caixa de escada com exaustão pela torre (combinado) |
| H | Captação na ala a barlavento e shed no núcleo |

O campo `torreTipo` substitui `torreCalor` (`true` passa a valer `chamine`).

## 6. Fachadas
Elevações ortogonais em SVG, com:
- **Entradas:** salas, trechos externos, janelas e portas, torre, rooftop e o estilo.
- **Profundidade:** planos ordenados do fundo para a frente.
- **Vãos:** peitoril e verga por tipo de abertura.
- **Cobertura por estilo:** duas águas, quatro águas, platibanda ou telhado verde.
- **Sombras:** pelo ângulo de perfil tan(h)/cos(α − φ), com o sol de Fortaleza no equinócio às 9h.
- **Acabamento:** texturas em `<pattern>`; céu, terreno, vegetação e figura humana; cotas e legenda.
- **Exportação:** SVG com as cores resolvidas e PNG em 2×.

Muro com portões, padrão Enel, Cagece, lixeira, correio e paisagismo, permeabilidade em % e opção sem muro ou cerca viva. three.js fica fora do escopo.

## 7. Coleta e persistência
- **Action `atualiza-custos.yml`:** disparo manual e agendamento diário entre os dias 6 e 15, que encerra sem fazer nada se o mês já estiver gravado. Etapas: ler a página e achar os links, baixar o zip, `pdftotext -raw`, ler o Relatório 5 e a tabela desonerada pelo conteúdo, conferir com o SIDRA, validar a variação dentro de ±5% e abrir pull request (com o rótulo "revisar" se algo sair da faixa).
- **Botão "Atualizar valores":** busca o JSON publicado com quebra de cache, mostra as diferenças e grava em IndexedDB (localStorage como reserva). Camadas oficial + ajustes = efetivo; "Restaurar valores oficiais"; exportar e importar.
- **Selo:** "Valores de mm/aaaa · fonte · coletados em dd/mm/aaaa", com alerta acima de 45 dias depois do fim do mês de referência.

## 8. Brises: estudo do melhor ângulo (novo)
- **Campos (Bloco 1, conforto passivo):**
  - `brises`: sim ou não;
  - `brisesTipo`: automático, horizontal, vertical, misto (grelha), móvel;
  - `brisesFaces`: automático (faces com insolação crítica) ou escolha por face.
- **`gerador/brises.js`** (funções puras):
  - **Posição do sol:** Fortaleza (latitude −3,73°, longitude −38,52°), por declinação e ângulo horário, no dia 21 de cada mês, das 7h às 17h.
  - **Período a sombrear:** na ZB8 é o ano inteiro em horário de sol (NBR 15220-3: sombrear as aberturas e ventilar).
  - **Ângulos por face (azimute φ):** HSA = α − φ (sombra horizontal) e VSA = atan(tan h / cos HSA) (sombra vertical, ou de perfil). Só contam as horas com |HSA| < 90°.
  - **Lâmina horizontal** de profundidade d, espaçamento s e inclinação β: bloqueia o sol quando o perfil do raio cai abaixo da linha que liga a borda de uma lâmina à da seguinte. A mesma lógica vale para a **lâmina vertical**, usando HSA.
  - **Otimização:** varredura de β de −45° a +45° e de d/s de 0,5 a 1,5. Objetivo: maximizar o sombreamento direto ponderado pela irradiância de cada hora. Restrições: fração de vista livre ≥ 40%, abertura para ventilação ≥ 50% e lâminas verticais nas faces E/SE inclinadas para conduzir o vento predominante, não para barrá-lo.
  - **Saída por face:** tipo recomendado, ângulo, d/s e profundidade para um espaçamento padrão (ex.: 0,30 m), % de sombreamento anual e horas sem proteção.
- **Expectativa física (a latitude baixa confirma pelo cálculo):** nas faces N e S o sol fica alto, então brise horizontal curto basta. Nas faces L e O o sol chega baixo, então a solução é lâmina vertical inclinada ou brise móvel; brise horizontal fixo pouco serve ali.
- **Card "Brises"** (cor `--steel`, junto da torre, como conforto passivo):
  - carta solar estereográfica em SVG com a máscara de sombra de cada face;
  - tabela por face com o ângulo e a fórmula no `data-tip`;
  - custo incluído no card de custo.
- **Desenho:** linha tracejada nas janelas da planta (Fase 4) e lâminas na fachada com sombra própria (Fase 6).
- **Integração com os estilos:** a moderna traz brises por padrão; a ecológica usa cobogó ou brise de madeira; os demais usam venezianas e beirais (o estudo informa a sombra equivalente do beiral).

## 9. Fases e etapas
Cada fase tem um branch próprio, um commit por etapa com push, testes, capturas em 1440 e 390 px nos temas claro e escuro, relatório e aprovação do usuário antes da fase seguinte. **Portão de todo commit:** `node --check` em todo JS, `node gerador/testes.js` (com o golden), `node tools/verifica-html.js` e conferir que o formulário carrega.

**Fase 0, rede de segurança** (nada muda na tela). Etapas:
1. Este plano.
2. Testes golden do motor e hash dos SVGs, incluindo subsolo em térrea e sobrado nos formatos bloco, L, U e H.
3. Tempo de geração por caso.
4. Gancho de pre-commit e `verifica-html.js`.
5. Sinalizador beta.
6. Continuidade.

**Fase 1, interface:** estado único, formulário pelo estado, blocos (beta), concluir e invalidar, ao vivo, celular, cores e `--plum`, documentação. O subsolo fica como subseção do Bloco 1 para os dois tipos.

**Fase 2, estrutura e custos:** dados e esquema, estrutura com verificação de parede sobre parede (gancho `opts.posAvalia` no `Motor.gerar`), custos, Bloco 2, card com gráfico, atualizar valores e persistência, SINAPI e INCC.

**Fase 3, energia solar:** cobertura provisória até o estilo.

**Fase 4, conforto passivo:** dossiê `torre/`, `torreTipo` no motor, desenho e card da torre; **`brises.js`, campos, card com carta solar e indicação na planta.**

**Fase 5:** catálogo de estilos, núcleo do renderizador de elevações e galeria sobre a casa de referência.

**Fase 6:** quatro fachadas da variante, camadas do estilo (inclusive as lâminas dos brises), muro com regras e custo, exportação.

**Fase 7:** Action de coleta, filtros do banco, `projetos.json` e remoção do beta.

## 10. Riscos e limitações
- Estimativa paramétrica não é orçamento: os fatores são estimativas, e o card mostra faixa.
- Projeto e obra exigem responsável técnico com ART ou RRT.
- O CUB sai com cerca de 40 dias de atraso, e a projeção pelo INCC é estimada.
- O PDF do Sinduscon muda de nome e de leiaute (usar `-raw`).
- As fachadas vetoriais são de apresentação.
- Regras de muro, recuo e condomínio estão a confirmar.
- O solar fica provisório até a escolha do estilo.
- Os brises são estudados só pela radiação direta: a difusa e a reflexão no entorno ficam fora, e o resultado não substitui simulação (EnergyPlus ou Apolux).

## 11. Atualização do CONTINUIDADE.md
Ao fim de cada fase: regras novas, módulos e dados, número de testes e golden, pendências, armadilhas novas (`pdftotext -raw`; zips com nome variável; `--atualizar-golden` só com justificativa; nada novo em `sincroniza()`; `<details>` bloqueado cancela o `toggle`) e o comando do gancho.
