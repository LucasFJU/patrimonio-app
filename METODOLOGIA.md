# Metodologia da triagem mensal — versão 1.1

O objetivo é oferecer até cinco empresas para investigação, com fundamentos, liquidez e riscos visíveis. A classificação não identifica as cinco melhores ações de toda a Bolsa, não prevê retornos e não substitui a avaliação de adequação ao investidor.

## Universo

ITUB4, BBDC4, BBAS3, BBSE3, PSSA3, TAEE11, EGIE3, CPFE3, CMIG4, CPLE6, VIVT3, TIMS3, ABEV3, WEGE3 e PETR4. São 15 escolhas iniciais para comparação; não houve otimização nem backtest comprovando superioridade desse universo. Renomes conhecidos retornados pelo provedor são refletidos no código exibido. Reveja a lista e a classificação setorial quando houver reorganizações societárias.

A carteira do usuário não é enviada à BolsAI. A lista quantitativa é a mesma para as contas cadastradas no projeto; não é uma recomendação personalizada ao seu perfil. O plano de aportes é calculado separadamente com suas configurações.

## Requisitos de elegibilidade

Todos precisam ser atendidos:

1. Cotação positiva, sem data futura, com no máximo sete dias corridos.
2. Patrimônio líquido positivo, com fundamentos de no máximo 180 dias e sem data futura.
3. Volume financeiro médio estimado de pelo menos R$ 5 milhões/dia, calculado como fechamento × média de volume de 52 semanas informada pela BolsAI; estatística datada em até sete dias.
4. Lucro por ação, P/L e ROE positivos; ROE até 100%. Os tetos são verificações de plausibilidade, não garantias contábeis.
5. Não financeiras: dívida líquida/EBITDA informada e no máximo 4x. Caixa líquido é permitido. Bancos e seguradoras não são avaliados por dívida/EBITDA.

DY e CAGR de lucro em cinco anos pontuam quando a API os informa. Se estiverem ausentes, a empresa não recebe esses pontos, e o painel sinaliza a ausência. Outros dados ausentes excluem a empresa quando impedem os requisitos acima. Não se usa zero para preencher um indicador desconhecido. Cada exclusão é exibida; a seleção pode conter de zero a cinco empresas.

## Normalização

A integração usa os endpoints BolsAI /fundamentals/{ticker} e /stocks/{ticker}/stats, autenticados pelo header X-API-Key. O plano Free documenta fundamentos e preços atuais, com limite de 200 requisições por dia. Cada rodada consulta os 15 códigos nesses dois endpoints, em até 30 chamadas. Histórico fundamentalista, demonstrações financeiras, histórico de dividendos e screener podem exigir o plano Pro; a aplicação não os chama.

ROE, DY e CAGR são percentuais enviados pelo fornecedor e convertidos para frações antes dos cálculos. Volume financeiro médio é estimado como preço de fechamento × volume médio de ações em 52 semanas; não representa o valor exato negociado em bolsa. Campos sem valor continuam ausentes. Confira relatórios oficiais de RI e da CVM antes de decidir.

## Nota de 0 a 100

A função limitar(x) restringe x ao intervalo de 0 a 1. A soma é arredondada para o inteiro mais próximo; os componentes ficam armazenados no relatório. Se DY ou CAGR estiver ausente, sua parcela fica em zero, sem reponderar os demais critérios.

| Critério | Regra | Máximo |
| --- | --- | --- |
| Qualidade: retorno sobre patrimônio | 20 × limitar(ROE / 0,25) | 20 |
| Qualidade: alavancagem | Não financeiras: 10 × limitar(1 − máximo(0, dívida líquida/EBITDA)/4); bancos/seguros recebem 5 fixos por falta de medição regulatória | 10 |
| Preço | 25 × limitar((25 − P/L)/20); P/L ≤ 5 recebe o máximo, ≥ 25 recebe zero | 25 |
| Dividendos | 20 × limitar(DY/0,08); se DY > 12%, reduz este componente à metade | 20 |
| Crescimento | CAGR de lucro em cinco anos, quando informado: 15 × limitar((CAGR + 0,05)/0,25) | 15 |
| Liquidez | 10 × limitar(log10(volume médio/5.000.000)/2) | 10 |

Os cortes são heurísticos, definidos para esta primeira versão e não calibrados por evidência de retorno superior. P/L baixo pode sinalizar deterioração; ROE alto pode refletir patrimônio reduzido; DY alto pode decorrer de evento extraordinário. Não há um modelo setorial completo de valuation. Bancos/seguradoras têm nota máxima efetiva de 95 nesta versão.

Ordenação: nota decrescente, código alfabético em empate. São selecionadas até cinco empresas, com no máximo duas do mesmo setor. Empresas elegíveis fora das vagas aparecem entre as não selecionadas com o motivo. Esse limite diversifica a lista, não garante diversificação da sua carteira.

## O que conferir antes de comprar

- Documentos oficiais de RI: DFP/ITR, notas explicativas, parecer de auditoria e fatos relevantes.
- Lucro recorrente versus itens extraordinários e conversão de lucro em caixa.
- Histórico de dividendos/JCP, payout e capacidade de manter a distribuição. Esta versão usa DY agregado; não analisa automaticamente a série de pagamentos nem calcula payout.
- Dívida, indexadores, vencimentos, covenants, caixa e investimentos necessários.
- Bancos: capital regulatório, inadimplência, cobertura e provisões. Seguros: solvência, sinistralidade e resultados financeiros.
- Governança, controlador, conflitos, diluição, passivos e risco regulatório.
- Preço atual no Santander, custos, disponibilidade, código negociado, mercado fracionário quando aplicável e concentração já existente na carteira.

As notícias, riscos qualitativos e documentos não são lidos automaticamente pelo aplicativo. Os alertas apresentados são genéricos por indicador/setor. Nenhuma ordem é enviada ao Santander.

## Plano de aportes

O saldo de reserva soma apenas ativos CDB/Tesouro que você marcou como reserva. O CDB inicial não é marcado automaticamente porque sua liquidez não foi informada.

- Abaixo de um mês de despesas: o aporte sugerido fica em CDB, condicionado a escolher um produto adequado à reserva.
- Até a meta total: Tesouro recebe o menor entre R$ 200 e 25% do aporte. Ações recebem o menor entre R$ 100 e 12,5%, exceto perfil conservador ou horizonte inferior a cinco anos. O restante fica no CDB. A parcela de Tesouro exige um título compatível com reserva; não pressupõe que qualquer título seja adequado.
- Após a reserva: usa os quatro percentuais escolhidos por você. Com perfil conservador ou horizonte inferior a cinco anos, a parte variável é direcionada para CDB.

Não transfere dinheiro nem indica um CDB específico. Os percentuais iniciais de 25% reproduzem a ideia do usuário como configuração editável, não como alocação validada. O simulador usa aportes ao fim de cada mês e retorno total constante hipotético (dividendos já incluídos), sem descontar inflação, impostos ou custos.

## Periodicidade, transparência e limites

A edição é uma fotografia datada do mês. Ela não é uma cotação em tempo real e pode ficar desatualizada dentro do próprio mês; sempre confira o preço atual antes de uma decisão. A execução diária tenta gerar a edição ou completar uma edição com menos de cinco candidatas, limitada a uma tentativa por dia. Cada rodada consulta os 15 tickers em dois endpoints (até 30 chamadas), com três requisições simultâneas.

O universo pequeno, as diferenças contábeis, os erros do provedor e os parâmetros fixos limitam as conclusões. Ausência de uma empresa na lista não significa que seja ruim. Permanência na lista não significa que deva continuar sendo comprada a qualquer preço.
