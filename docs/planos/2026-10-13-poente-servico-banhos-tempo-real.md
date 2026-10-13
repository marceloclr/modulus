# Poente, serviço a oeste, banho por suíte e geração em tempo real (etapas P, S e T)

Plano de 13/10/2026. Pedidos do usuário:
- "A regra de quarto para o poente não está sendo respeitada, inclusive para o pavimento superior, revise."
- "Preferencialmente sempre dispor a área de serviço para o poente, total ou parcialmente."
- "Possibilitar a geração em tempo real de acordo com as seleções realizadas pelo usuário."
- "Disponibilizar a definição de banheiros nas extremidades (norte, sul, leste, oeste) para cada suíte."

## Diagnóstico (só leitura, scratchpad `diag-poente.js`)
Varredura de 8 orientações × térrea e sobrado × com e sem subsolo × lotes de 10 × 25, 12 × 30 e 15 × 30 m, nas variantes que o gerador mostra.

| Programa | Pavimento | Quarto na face oeste (±22,5°) | Quarto a SO/NO (±67,5°) |
|---|---|---|---|
| 3 quartos | térreo da térrea | 6 % | 27 % |
| 3 quartos | térreo da térrea com subsolo | 11 % | 29 % |
| 3 quartos | superior do sobrado | 1 % | 12 a 13 % |
| 4 quartos | térreo da térrea | 12 % | 24 % |
| 4 quartos | superior do sobrado | 0 % | 13 a 20 % |

Causas:
1. **O filtro só barra o oeste puro (±22,5°).** SO e NO só perdem pontos. Com a frente diagonal (NE, SE, SO, NO), nenhuma face é oeste puro, e as faces que recebem o sol da tarde ficam liberadas. É o que aparece sobretudo no superior.
2. **Lote estreito:** em 12 × 30 m com frente norte ou sul, as variantes de corredor lateral (quartos a leste, corredor a oeste) passam do comprimento: ficam com 22,7 a 24,3 m numa área edificável de 22 m e são descartadas. Só cabem as de corredor central, com uma fila de quartos para o oeste. Hoje o motor mostra essas variantes, com aviso, em vez de não mostrar nada.
3. **Sem fila de apoio:** não existe variante que ponha banhos, closets e serviço como fila no lado do poente, que seria a solução compacta para esse caso.

## Etapa P: poente (revisão da regra)
1. **Poente passa a ser O ± 67,5°** (inclui SO e NO) para quarto, suíte e master, em todos os pavimentos. A ordem de escolha das variantes fica:
   - sem quarto no poente;
   - só com quarto a SO/NO, sem o oeste puro, com aviso;
   - com quarto no oeste puro, com aviso, só se nada escapar.
   A regra G19 da auditoria acompanha (O ± 67,5°), e a catraca é refeita.
2. **Variante nova, "corredor com apoio no poente":** os quartos ficam numa fila no lado oposto ao poente, e a fila do poente recebe banhos das suítes, closets, banho social, rouparia e serviço, com o corredor no meio. Ela é mais curta que o corredor lateral, porque os banhos saem da fila dos quartos.
3. **O mesmo no superior:** as tiras do superior (`superiorTiras`) recebem o apoio na tira do poente quando houver duas tiras.
4. **Inversão** (fundo a oeste): a térrea já inverte; o sobrado e a casa com subsolo passam a tentar a inversão também (pendência antiga, catraca G19 = 11).

## Etapa S: serviço e banhos
1. **Serviço no poente (preferência):** na faixa de apoio, a área de serviço vai para a ponta voltada ao poente, encostada na fachada oeste (total ou parcialmente). A nota sobe com isso e cai quando o serviço não toca o poente numa casa que tem fachada a oeste. É uma preferência, não um descarte.
2. **Banho por suíte:** no bloco Quartos, cada suíte e a master ganham "Banho em": automático, norte, sul, leste ou oeste.
   - **Automático:** o banho vai para o poente quando a suíte tem face a oeste (o banho protege o quarto); senão, fica como hoje.
   - **Rumo escolhido:** o motor põe o banho na ponta do módulo (início ou fim da faixa) e no lado (fachada ou corredor) mais próximos desse rumo, depois do giro e do espelhamento. Com o espelhamento automático, a variante espelhada só vale se mantiver os rumos pedidos.
   - Quando o rumo pedido não cabe (por exemplo, norte numa suíte encostada ao vizinho), o gerador usa o rumo mais próximo e avisa.
   - Campos `banhoPos` (lista por suíte, na ordem master, suíte 1, suíte 2…), normalizados, no link, no arquivo e no banco.

## Etapa T: geração em tempo real
1. **Ao vivo:** depois que o bloco Dimensões é concluído pela primeira vez, qualquer mudança no formulário regera as variantes na hora (espera de 250 ms depois da última tecla), sem o botão "Gerar novamente". O resultado continua oculto até a primeira conclusão do bloco, como foi decidido.
2. **Interruptor "Gerar ao vivo"** no topo do formulário, ligado por padrão, guardado neste navegador. Desligado, o comportamento é o de hoje.
3. Cálculo leve primeiro: a planta e os números saem na hora; custo, energia, conforto e animação vêm logo depois (requestIdleCallback).
4. Se a geração passar de 150 ms, a espera sobe para 500 ms, para não travar a digitação.

## Testes
- Golden: muda por causa das variantes novas e da regra nova. Regravo e justifico cada diferença (mesmo procedimento das etapas anteriores).
- Unidades:
  - nenhuma variante mostrada com quarto no poente quando existe uma que escapa, nas 8 orientações;
  - a variante "apoio no poente" cabe em 12 × 30 m com frente norte;
  - o serviço toca a fachada oeste quando há;
  - o banho no rumo pedido e o aviso quando não cabe.
- Auditoria: G19 com O ± 67,5° e casos novos.
- Navegador: geração ao vivo sem travar, tempo por geração e o interruptor.

## Ordem proposta (um branch por etapa, um commit por passo)
P → S → T, depois o rooftop (etapa R, já planejada) e por fim a edição direta (J2 a J6).

## Decisões do usuário (13/10/2026)
- **Limite do poente selecionável:** campo novo `poenteLimite` no bloco Terreno, com as opções "Oeste, sudoeste e noroeste (O ± 67,5°)" (padrão) e "Só o oeste (O ± 22,5°)". A ordem de escolha das variantes, o aviso, a nota e a G19 seguem o limite escolhido.
- **Ao vivo depois de concluir Dimensões,** com interruptor (como no item T1).
- **Etapa M mesclada na main.**
