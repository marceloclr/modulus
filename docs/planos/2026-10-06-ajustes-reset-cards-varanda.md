# Ajustes de 06/10/2026: limpeza profunda, cards vazios até a 1ª geração e varanda de fundos

Pedido do usuário (06/10/2026, depois do merge da F1):

> "inclua um reset/restauro/limpar cache profundo para o sistema. Os 4 cards da tela geradora devem carregar sem valores e apenas mostrar valores depois de processar as dimensões a primeira vez. Incluir opção de varanda nos fundos com dimensões selecionáveis."

Branch `ajustes-reset-cards-varanda`, um commit por passo. A ordem vai do mais simples ao mais delicado. A varanda mexe no motor; as outras duas, só na interface.

## A. Limpar dados (limpeza profunda)

- **Onde:** botão "Limpar dados do navegador" no rodapé de todas as páginas. Fica em `assets/base.js`, e a casa simétrica, que tem script próprio, ganha o mesmo botão.
- **Confirmação:** janela da própria página (`<dialog>`), com a lista do que será apagado e o botão "Apagar e recarregar".
- **O que apaga:**
  - todas as chaves `plantas-*`, `memorial-*` e `modulus-*` do `localStorage` e todo o `sessionStorage`;
  - o banco IndexedDB `modulus`, com os valores de custo;
  - o Cache Storage e os service workers, se houver (hoje não há; fica preparado);
  - o endereço `#s=…` com o estado do gerador.
- **Recarga:** a página recarrega com `?limpo=<hora>` na URL, para o navegador buscar de novo os scripts e as folhas de estilo, sem a cópia guardada.
- **Plantas salvas no banco:** uma caixa "Apagar também as plantas salvas no banco" vem **desmarcada**. O resto é apagado sempre. Junto da caixa, um lembrete de que o banco pode ser exportado em JSON antes.
- O botão "Restaurar" do gerador continua como está: volta só os campos do formulário aos valores iniciais.

## B. Os quatro cards só mostram valores depois da primeira conclusão das Dimensões

- **Cards afetados:** Área edificável, Área fechada, Ocupação e Pontuação.
- **Antes da conclusão:** cada card mostra "—" e uma linha "Conclua o bloco Dimensões para calcular".
- **O que conta como processar:** a primeira vez que o bloco 1 (Dimensões) é concluído pelo botão.
- **Registro:** o estado guarda `ui.processado`, no navegador e no link. Depois disso os cards mostram os valores, mesmo que o bloco volte a "em edição" ou "revisar".
- **Quando volta a vazio:** com "Restaurar" e com a limpeza da parte A.
- **Planta e variantes:** continuam aparecendo como hoje, com a casa do programa padrão. O pedido fala só dos cards. Se você preferir esconder também a planta até a conclusão, é uma linha a mais.

## C. Varanda de fundos com medidas selecionáveis

- **Formulário** (bloco Dimensões, junto da varanda frontal):
  - caixa "Varanda de fundos";
  - **Profundidade:** 1,50 / 2,00 / 2,50 / 3,00 m (padrão 2,00);
  - **Largura:** "Toda a fachada de fundos" (padrão) / 3,00 / 4,00 / 5,00 / 6,00 m.
- **Motor** (`varandaFundos`, `varandaFundosP`, `varandaFundosL`):
  - uma faixa aberta encostada na fachada de fundos do térreo, em todos os formatos;
  - em L, U e H, a faixa fica no trecho de fundos mais largo;
  - com largura parcial, a faixa fica centrada no cômodo que dá acesso a ela;
  - **acesso:** porta a partir do estar, jantar ou TV quando o social está no fundo (zoneamento invertido); senão, da suíte master; senão, da circulação. O cômodo escolhido é sempre o que mais encosta na faixa;
  - a casa fica mais funda: entra nas contas de recuo de fundo, ocupação, permeabilidade e terreno mínimo. Se não couber no lote, a variante é descartada com o motivo, como hoje;
  - sobrado: a varanda de fundos automática, que existe quando o superior é mais comprido, passa a respeitar a profundidade escolhida, se for maior.
- **Planta humanizada:** deck, mesa externa e vasos, pela `mobilia.js`.
- **Testes:**
  - casos novos para bloco, L, U e H com a varanda de fundos e para a largura parcial;
  - a auditoria inteira continua firme (porta real, janela fora da divisa, M08 e M09);
  - o golden não muda, porque a opção vem desligada.

## Decisões do usuário (06/10/2026)

1. **Dois botões de limpeza:** "Limpar dados do navegador" apaga tudo, menos as plantas salvas; "Apagar plantas salvas" é exclusivo para o banco.
2. **Planta e cards ocultos até as seleções do usuário:** o resultado do gerador (cards, variantes, planta e quadro) carrega oculto e só aparece depois da primeira conclusão do bloco Dimensões. Isto substitui a parte B acima, onde a planta continuava visível.
3. **Medidas da varanda de fundos:** as listas de profundidade e largura servem.
