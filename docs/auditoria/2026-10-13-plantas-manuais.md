# Revisão das plantas feitas à mão (13/10/2026)

Só diagnóstico e plano: **nada foi alterado nas plantas.** Pedido do usuário: "a revisão das outras plantas geradas manualmente. Apenas analise e planejamento para as demais." A opção B entra aqui como referência, porque o usuário já apontou o defeito dela e a correção aguarda a escolha entre a versão principal e a simétrica.

## Como foi verificado

- **`tools/percurso-manual.mjs` (novo, só leitura).** Monta o grafo de portas e vãos de cada planta e procura o menor percurso da entrada até cada cômodo. Resultado em texto ou, com `--json`, em JSON. Onde busca os dados:
  - **casa simétrica:** roda o modelo da própria página (`circModel`, `hzTecnica`, `vFor`, `B2`), do mesmo jeito que `tools/humanizadas.mjs`;
  - **casa em H:** lê `AMB`, `PAR`, `PORTAS`, `VAOS` e `JAN` de `casa-h/gerar.js`.
- **O que ele aponta:**
  - cômodo que só é alcançado pela cozinha, pela lavanderia, por um banho, por um closet ou por um quarto;
  - percurso da visita (entrada → estar → jantar) e dos moradores (cada quarto → sala);
  - falta de giro de 1,50 m e faixa livre menor que 0,90 m;
  - soma dos cômodos diferente da área fechada declarada;
  - **passagens que a rota acessível do modelo atravessa sem porta nem vão.** A rota mostra que a intenção é passar ali, mas a humanizada desenha parede contínua.
- Conferência visual das humanizadas exportadas (`casa-simetrica/planta_*_v2.png`, `casa-h/planta_H_v1.png`) e do quadro de áreas da casa H.

## Diagnóstico por planta

### Opções A (compacta), C (intermediária) e D (ampla), mesma organização

| Gravidade | Achado |
|---|---|
| **Alta** | **Não fica definido como a sala chega à cozinha.** O modelo não tem porta nem vão entre "Estar e jantar" e "Cozinha", mas a rota acessível r4 passa por ali. Na humanizada, a parede é contínua: a cozinha só se liga à despensa e à área de serviço, que se abrem para a varanda de fundos. Pelo desenho, quem está na sala não chega à cozinha. Na planta técnica, as zonas têm só contorno fino e não mostram a intenção. O corte desenha uma parede parcial em k0. |
| Média | Despensa e área de serviço só são alcançadas pela cozinha (ou pela varanda de fundos). Isso é aceitável, desde que a ligação sala–cozinha exista. |
| Média | O WC social e a rouparia se abrem direto para a sala. O WC à vista de quem está no estar é pouco discreto. |
| Baixa | Opção A: os closets não têm giro de 1,50 m nem área de 1,50 × 1,20 m. A página já declara "só aproximação frontal, fora da rota acessível". |

Estão bem resolvidos:
- a visita chega ao estar pelo vestíbulo;
- os quartos dão para o vestíbulo e não para a sala;
- banho e closet ficam dentro da suíte;
- a soma dos cômodos confere com a área fechada declarada.

### Opção B (simetria transversal), referência

| Gravidade | Achado |
|---|---|
| **Alta** | **O jantar só é alcançado pela cozinha** (estar → cozinha → jantar): a visita atravessa a cozinha. Este é o defeito já apontado pelo usuário. |
| **Alta** | **A suíte norte só é alcançada pela cozinha** e se abre direto para o jantar. Do quarto norte à sala, o morador passa por jantar e cozinha. |
| **Alta** | **A circulação oeste e a despensa não têm ligação com a casa:** só se abrem uma para a outra e para a varanda de fundos. |
| Média | A suíte sul se abre direto para o estar. O quarto fica à vista de quem chega. |
| Média | Três passagens que a rota usa aparecem como parede na humanizada: circulação de entrada ↔ estar, estar ↔ cozinha e cozinha ↔ jantar. |
| Média | A lavanderia só é alcançada pela cozinha. |

A proposta principal já enviada (sala única longitudinal a leste, cozinha longitudinal e hall ao sul) resolve as três falhas altas. Ainda precisa ligar a circulação oeste ao jantar e à despensa.

### Casa em H

| Gravidade | Achado |
|---|---|
| Média | A área de serviço só é alcançada pela cozinha (ou pelo quintal). É a solução usual, e a página a assume como "ligação por cozinha e serviço". |
| Baixa | Os banhos das suítes 1 e 2 e o banho social têm portas de 0,70 m, e os banhos 1 e 2 só se abrem pelo closet. Isso só é problema se a casa H tiver de seguir a mesma premissa de acessibilidade da casa simétrica, que hoje ela não declara. |

Estão bem resolvidos:
- a visita vai da rua ao vestíbulo e dali ao estar, que é integrado ao jantar (sem parede);
- cada suíte chega à sala pela circulação íntima, pela galeria e pelo jantar, sem passar por cozinha nem serviço;
- o quadro de áreas confere: a área fechada de 244,28 m² é igual à soma dos cômodos, e o total de 263,48 m² inclui a varanda gourmet de 19,20 m².

## Plano de correção (para aprovar; nada aplicado)

1. **Modelo com passagens abertas (A–D):** incluir em `roomsACD` e `roomsB` uma lista de vãos sem folha, como já existe em `VAOS` da casa H. A humanizada (`humSVG`) e a planta técnica passam a interromper a parede nesses trechos, e a circulação deixa de depender só da rota desenhada à mão.
2. **A, C e D, ligação sala–cozinha:** o usuário escolhe uma de duas soluções:
   - **(a)** cozinha integrada, com vão livre de 1,20 a 1,60 m no eixo e bancada (preferível: mantém a ventilação cruzada pelo eixo, que hoje atravessa essa parede);
   - **(b)** porta de 0,90 m no eixo.
   Nos dois casos, é preciso atualizar o corte, que hoje desenha uma parede parcial em k0, os textos e as imagens exportadas (`tools/humanizadas.mjs`).
3. **A, C e D, WC social:** avaliar a porta voltada para o vestíbulo ou um anteparo. É opcional e mexe na simetria.
4. **B:** aplicar a proposta escolhida (principal ou simétrica). Ligar a circulação oeste ao jantar e à despensa e tirar as portas dos quartos de dentro do estar e do jantar, passando-as para o hall e a circulação.
5. **Casa H:** nada obrigatório. Opcional: declarar se ela segue a acessibilidade, e, se seguir, alargar as portas dos banhos para 0,90 m e dar ao banho 1 e ao banho 2 uma porta que não passe pelo closet.
6. **Prevenção:** rodar `node tools/percurso-manual.mjs` antes de cada mudança nessas páginas. Quando os achados altos zerarem, o verificador entra no pre-commit.
