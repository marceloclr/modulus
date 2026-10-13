# Rooftop com dimensões escolhidas (etapa R)

Plano de 13/10/2026. Pedido do usuário: "disponibilizar a escolha das dimensões do rooftop e a partir delas distribuir os cômodos dele."

## Como é hoje (`comRooftop` em gerador/motor.js)
- A largura é a da laje inteira na linha da escada; não dá para escolher.
- A profundidade depende da posição (`rtPos`):
  - centralizado: a faixa coberta de um lado da escada e o terraço do outro;
  - até a fachada frontal ou até a de fundo: da escada até a fachada.
- Cada item tem área fixa (`RT`): gourmet 12 m², varanda 10 m², banho 3 m², área técnica 4 m², terraço mínimo 10 m², spa 2,40 m. Quando falta espaço, o gerador tira a varanda primeiro e depois a gourmet, sempre com aviso.

## O que muda
1. **Dois campos no bloco do rooftop:** largura e profundidade, em metros.
   - Em branco ou 0, o rooftop fica como hoje (laje inteira), e o golden não muda.
   - Embaixo dos campos aparece a área resultante e a medida máxima que cabe na laje (por exemplo, "até 7,00 × 14,30 m").
   - Ajuda "?" com "Saiba mais" no manual (#rooftop).
2. **O retângulo do rooftop** sai da caixa de escada:
   - **largura** centrada na escada, deslocada para caber na laje do pavimento de baixo;
   - **profundidade** no sentido de `rtPos`. No centralizado, ela se divide entre os dois lados da escada; até a fachada, ela vai da escada para aquele lado.
   - Medida maior que a laje é cortada no limite, com aviso. Medida menor que a caixa de escada mais o hall vira o mínimo, também com aviso.
3. **Distribuição a partir das medidas**, na ordem de hoje:
   1. caixa de escada, elevador e hall (fixos);
   2. banho e área técnica ao lado da escada, do lado do poente;
   3. faixa coberta junto da linha da escada, com a gourmet na ponta oposta ao banho e a varanda no resto. A profundidade dela é a área pedida dividida pela largura escolhida, com 3,00 m no mínimo para a gourmet;
   4. terraço com o que sobra, no mínimo 10 m², com o spa no maior terraço de 3,00 × 3,00 m.
   - Quando um item não cabe, sai com aviso, como hoje: primeiro a varanda, depois a gourmet, depois o spa.
   - Com o rooftop mais estreito que a laje, as bordas que deixam de ter piso ficam como laje técnica (sem uso), desenhada esmaecida.
4. **Fechamentos e regras que continuam valendo:** a borda voltada para o poente leva parede ou brise, e a janela fica a 1,50 m da divisa. Os fechamentos passam a valer nas bordas do retângulo escolhido.
5. **Quadro de áreas e custo:** o pavimento do rooftop entra com a área real. A laje técnica que sobra não conta como área útil.
6. **Estado e arquivos:** os campos novos são `rtLargura` e `rtProfundidade`, normalizados (números ≥ 0), e passam pelo link, pelo arquivo do projeto e pelo banco.

## Testes
- Unidades:
  - com 0, o resultado é idêntico ao de hoje (golden de 31 casos inalterado);
  - com medidas, o retângulo tem a largura e a profundidade pedidas, fica dentro da laje e contém a escada;
  - medida maior que a laje é cortada, com aviso;
  - itens que não cabem saem na ordem certa, com aviso;
  - os fechamentos a oeste ficam nas bordas novas.
- Auditoria: os casos de rooftop do golden e dois casos novos (rooftop estreito e rooftop curto) passam pela catraca.
- Navegador: os campos, a área ao vivo, a planta do rooftop e o celular.

## Passos (branch `etapa-r-rooftop`, um commit por passo)
1. Motor: `rtLargura` e `rtProfundidade` em `normaliza` e em `comRooftop`, com os testes.
2. Interface: os campos no bloco, a área e o máximo ao vivo (`gerador/rooftop-ui.js`), a ajuda e o manual.
3. Conferência no navegador e relatório.
