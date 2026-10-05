# Revisão: janelas e portas das plantas modelo, acessibilidade como opção e implantação

## Contexto
O usuário aprovou levar as Fases 4 e 4-B para a `main` e, antes, pediu um plano para cinco revisões:
1. As **janelas dos quartos** das plantas modelo divergem entre a planta humanizada e a técnica (ele viu na **opção D da casa simétrica**). Premissa nova: **sempre que possível, as janelas ficam em pontos distantes entre si, para gerar ventilação cruzada**.
2. As **portas dos banheiros e dos closets** divergem entre as plantas.
3. Revisar a **premissa da acessibilidade**, conferir se ela funciona por inteiro e torná-la **uma opção que o usuário marca**.
4. Na seção **"Implantação e terreno"**, distribuir melhor o espaço entre a imagem da implantação e a tabela de dados.

### O que a investigação encontrou
**Casa simétrica, opção D, metade esquerda (a direita é o espelho), em metros a partir da frente da varanda:**

| Elemento | Humanizada (`planta_D_v2.svg`, desenho fixo) | Técnica (`planSVG` em `casa-simetrica/index.html`) |
|---|---|---|
| Janela frontal do quarto | centrada, 2,60 m (x 1,2–3,8) | junto ao vestíbulo, 1,20 m (x 3,65–4,85) |
| Janela lateral do quarto | na frente da parede (y 2,45–3,55) | no fundo da parede (y 4,8–6,4), 1,60 m |
| Porta do quarto | início do vestíbulo (y 2,4–3,2), de abrir | fim do vestíbulo (y 5,8–6,6) |
| Porta do banho | pelo closet (y 8,85–9,65), de abrir | pelo quarto, de correr, vão de 0,80 m |
| Janelas do banho | uma, alta | duas: maxim-ar sobre a bacia e no boxe |
| Cama | cabeceira na parede lateral | cabeceira na parede frontal |
| Porta do closet | centrada (igual) | centrada |

- Na humanizada, as duas janelas do quarto ficam no mesmo canto, o que **contraria a premissa**. Na técnica, ficam em diagonal (cerca de 5,7 m entre os centros).
- A própria página avisa que a humanizada v2 é **anterior à adaptação NBR 9050**.
- **Os arquivos `_norte`** repetem o mesmo conteúdo dentro de um grupo girado. A metade direita de cada desenho é um grupo espelhado (`translate(336,0) scale(-1,1)`), então basta corrigir a metade esquerda.

**Gerador (`gerador/motor.js`, `aberturas`):**
- A janela fica **centrada** no trecho externo.
- A segunda janela só entra se a primeira não alcançar 1/8 da área do piso. Na prática, o quarto de esquina recebe uma janela só, sem ventilação cruzada.
- `porta()` encosta a porta no canto, mas a janela não se afasta dela.

**Acessibilidade hoje:**
- **Casa simétrica (técnica):** banhos e WC das opções A–D passam em todos os itens de `checkBath` (giro, transferência, aproximação, boxe, porta e barras), e as faixas livres na rota têm pelo menos 0,90 m. Lacunas:
  - as portas dos quartos, dos closets e da cozinha estão desenhadas com 0,80 m de folha, o que dá menos de 0,80 m de vão livre (a página promete vão de 0,80 m);
  - na opção A, os closets não têm giro e a faixa em frente ao armário é de 0,60 m (aceita como fora da rota, mas não está dito);
  - a humanizada não foi adaptada.
- **Casa em H:** a verificação está como pendência (`casa-h/index.html`).
- **Gerador:** não há regra alguma. Portas de 0,80 m (0,70 m nos banhos), corredor de 1,20 m, sem banho acessível, sem giro e sem rota sem degraus. O subsolo semienterrado sobe a casa 1,40 m sem nenhum aviso.

**Implantação e terreno (`gerador/index.html`):** `.lote-wrap` usa `minmax(0,320px) minmax(0,1fr)`. A imagem fica presa a 320 px e a tabela, com poucas linhas, ocupa o resto da largura.

## Abordagem

### Etapa 0: merge aprovado
Mesclar `fase-4-conforto` e depois `fase-4b-sol-vento` na `main` (com `--no-ff`, testes e push). Criar o branch `revisao-janelas-acessibilidade` a partir da `main`.

### Etapa 1: premissa de ventilação cruzada no gerador (`gerador/motor.js`, `aberturas`)
- **Quartos e salas com duas ou mais faces externas:** sempre uma janela em uma segunda face, mesmo que a primeira já atenda a 1/8 do piso, mantendo a regra do sol nos quartos (sem oeste, nascente primeiro).
- **Posição:**
  - em faces vizinhas (canto), cada janela vai para a ponta mais longe do canto comum;
  - em faces opostas, ficam em pontas contrárias (diagonal);
  - sempre com 0,30 m de boneca e sem invadir a porta de entrada (lógica que já existe).
- **Uma só face externa:** a janela se afasta da porta do cômodo e vai para a ponta oposta do trecho.
- **Teste novo:** em todo quarto com duas faces externas, distância entre os centros das janelas de pelo menos 60 % da diagonal do cômodo. O golden muda; regravar e justificar.

### Etapa 2: casa simétrica, humanizada igual à técnica
Fonte única: a planta técnica, a mais nova, já adaptada à NBR 9050 e já com as janelas em diagonal.
- **`tools/humanizadas.mjs`:**
  - lê o modelo do estudo (VARS, BLY, `derive`, `emitFix`) extraindo o script de `casa-simetrica/index.html` com `vm`, sem duplicar números;
  - reescreve em `planta_{A,B,C,D}_v2.svg` só os elementos da suíte, na metade esquerda (a direita é o grupo espelhado):
    - grupo `win`: janela frontal, lateral, maxim-ar da bacia e do boxe;
    - grupo `door`: porta do quarto no fim do vestíbulo, porta de correr do banho pelo quarto e porta de correr do closet;
    - grupo `furn`: cama com cabeceira na parede frontal, banco sob a janela frontal, escrivaninha ou banco sob a janela lateral e louças do banho no arranjo do BLY (bacia, lavatório, boxe com banco e barras);
    - grupos `air` (setas de vento) e `label`, que acompanham as novas janelas.
  - Opção B (modelo próprio `B2`/`planB`): mesmo procedimento com as coordenadas de `planB`.
- Regerar `planta_X_v2_norte.svg` com o mesmo grupo girado do arquivo atual e os PNGs pelo Edge headless (1600 px).
- Página do estudo: tirar o aviso "a humanizada é anterior à adaptação" e ajustar as listas de mobiliário (`HUM`) que citam a posição da cama ou da escrivaninha.
- **Portas:** quartos, closets e cozinha passam a ter folha de 0,90 m (vão livre de 0,80 m) na técnica e na humanizada, cumprindo o que a página de acessibilidade promete. Na opção A, a tabela marca o closet como "fora da rota acessível, giro de 180° não cabe".
- **Casa em H (`casa-h/gerar.js`):** medir as janelas dos quartos e as portas de banho e closet. Se algum quarto tiver as janelas no mesmo canto, aplicar a mesma regra e regerar o SVG e o PNG; se não, registrar que está conforme.

### Etapa 3: acessibilidade como opção no gerador
- **Campo `acessivel`** (padrão: desmarcado), numa subseção "Acessibilidade (NBR 9050)" do bloco 1, com uma linha que explica o que muda.
- **Com a opção marcada:**
  - **Portas:** folha de 0,90 m (vão de 0,80 m) em todos os cômodos do percurso, inclusive banhos (`larguraPorta`).
  - **Banho acessível:** pelo menos um por pavimento com quarto, com lados mínimos de 2,40 × 2,50 m pelo eixo (o B_banho do estudo: 2,25 × 2,35 m livres) e porta de correr. Prefere o banho social; sem ele, usa o banho da suíte master.
  - **Desenho do banho acessível:** círculo de giro de 1,50 m, área de transferência e barras, reaproveitando o padrão do estudo.
  - **Circulação:** corredores com pelo menos 1,20 m (já são) e giro de 1,50 m livre no fim do corredor. Onde não couber, aviso.
  - **Rota sem degraus:** com subsolo semienterrado (casa 1,40 m acima da rua) e sem elevador, aviso e penalidade, sugerindo rampa de 8,33 % (cerca de 16,8 m) ou plataforma.
  - **Sobrado sem elevador:** exige um quarto e um banho acessível no térreo; se todos os quartos estiverem em cima, aviso e penalidade.
  - **Quartos:** lado mínimo de 2,80 m (giro de 1,50 m ao lado de uma cama de casal).
- **`avalia`:**
  - novas penalidades só com a opção marcada;
  - item novo na dica da Pontuação;
  - card "Acessibilidade" (beta) com a lista atende / não atende: portas, banho acessível, giro, corredor, rota, quarto no térreo.
- **Sem a opção marcada, nada muda** (golden igual, salvo o campo novo na entrada normalizada).

### Etapa 4: implantação e terreno (`gerador/index.html`)
- `.lote-wrap` passa a `minmax(0,1.35fr) minmax(280px,1fr)`.
- A imagem é centrada, com `max-height: 70vh`.
- A tabela vira uma lista compacta de duas colunas, com a nota embaixo.
- Abaixo de 900 px, empilha.
- Conferir com lote estreito e fundo (12 × 35) e com lote largo (24 × 30).

### Etapa 5: pasta local e URL de `plantas` para `modulus` (pedido do usuário)
Fica por último, depois do merge desta revisão, para não quebrar o trabalho em andamento.
- **GitHub:** renomear o repositório `marceloclr/plantas` → `marceloclr/modulus` (`gh repo rename modulus`).
  - O GitHub redireciona o repositório antigo (git e web).
  - O site do Pages passa a `https://marceloclr.github.io/modulus/`, e **o endereço antigo `/plantas/` deixa de funcionar** (o Pages não redireciona). Avisar o usuário.
  - Conferir que o Pages continua ativo na `main` (raiz) depois da troca.
- **Remoto local:** `git remote set-url origin https://github.com/marceloclr/modulus.git`.
- **Pasta local:** `Documents/GitHub/plantas` → `Documents/GitHub/modulus`, renomeada com a sessão fora da pasta.
- **Referências:**
  - procurar `plantas` com `grep` em URLs e textos (`docs/CONTINUIDADE.md`, planos, `README` se houver, `tools/`, `.github/`) e trocar para `modulus` onde for endereço ou nome do repositório;
  - **manter** as chaves do navegador `plantas-estado`, `plantas-banco`, `plantas-custos`, `plantas-tema` e `plantas-beta`, para não apagar as plantas salvas e os ajustes de quem já usa o site; registrar isso como decisão.
- **Memória e continuidade:** `plantas-projeto.md` (caminho, URL e nome do repositório), `MEMORY.md` e o prompt de continuidade.
- **Verificação:**
  - `git fetch` e push no remoto novo;
  - abrir `https://marceloclr.github.io/modulus/` (status 200 depois da publicação);
  - na cópia renomeada, `node gerador/testes.js` passa.

### Etapa 6: documentação
Atualizar `docs/CONTINUIDADE.md` com as premissas (janelas distantes, humanizada igual à técnica, acessibilidade opcional). Gravar o plano em `docs/planos/`.

## Arquivos críticos
- `gerador/motor.js`: `aberturas` (janelas), `porta`, `larguraPorta`, `normaliza`, `programa`/`TIPOS` (banho acessível) e `avalia`.
- `gerador/desenho.js`: giro e barras no banho acessível.
- `gerador/index.html`, `gerador/ui-blocos.js` (subseção) e `gerador/cartoes.js` (card).
- `casa-simetrica/index.html` (portas de 0,90 m, avisos, `HUM`), `casa-simetrica/planta_*_v2*.svg` e `.png`.
- `tools/humanizadas.mjs` (novo); `casa-h/gerar.js` (se precisar).
- `gerador/testes.js` e `testes-unidades.js` (testes novos), golden regravado.

## Verificação
- `node gerador/testes.js`, com testes novos:
  - distância das janelas nos quartos de canto;
  - com `acessivel`: portas de 0,90 m, banho com pelo menos 2,40 × 2,50 m, avisos de rota e de sobrado;
  - sem `acessivel`: plantas iguais às de antes da etapa 3.
- Golden regravado nas etapas 1 e 3, com justificativa.
- Casa simétrica: para A–D, conferir por script que as janelas, portas e louças da humanizada coincidem com as da técnica (comparando as coordenadas extraídas dos dois SVGs, com tolerância de 0,05 m); `checkBath` e as faixas continuam atendendo; capturas da humanizada, da técnica e da circulação da opção D lado a lado.
- Gerador no Edge headless (perfil novo):
  - opção de acessibilidade ligada e desligada;
  - card e dica;
  - implantação em 1440 e 390 px, temas claro e escuro;
  - console sem erros.
- `node tools/verifica-html.js` e o pre-commit.

## Riscos
- Mover a cama e as louças na humanizada pode encostar em outro móvel: conferir cada opção na captura.
- Com janelas em duas faces, alguns quartos podem perder pontos por sol (a regra de sol continua valendo e manda na escolha das faces).
- O banho acessível maior aumenta a casa e pode baixar a nota em lotes estreitos (efeito esperado com a opção marcada).
