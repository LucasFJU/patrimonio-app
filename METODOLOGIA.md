# Metodologia da triagem mensal — versão 1.0

O objetivo é oferecer até cinco empresas para investigação, com fundamentos, liquidez e riscos visíveis. A classificação não identifica as cinco melhores ações de toda a Bolsa, não prevê retornos e não substitui a avaliação de adequação ao investidor.

## Universo

ITUB4, BBDC4, BBAS3, BBSE3, PSSA3, TAEE11, EGIE3, CPFE3, CMIG4, CPLE6, VIVT3, TIMS3, ABEV3, WEGE3 e PETR4. São 15 escolhas iniciais para comparação; não houve otimização nem backtest comprovando superioridade desse universo. Renomes conhecidos retornados pelo provedor são refletidos no código exibido. Reveja a lista e a classificação setorial quando houver reorganizações societárias.

A carteira do usuário não é enviada à BRAPI. A lista quantitativa é a mesma para as contas cadastradas no projeto; não é uma recomendação personalizada ao seu perfil. O plano de aportes é calculado separadamente com suas configurações.

## Requisitos de elegibilidade

Todos precisam ser atendidos:

1. Cotação positiva, sem data futura, com no máximo sete dias corridos.
2. Patrimônio líquido positivo, com balanço de no máximo 180 dias e sem data futura.
3. Data do trimestre dos indicadores de no máximo 180 dias, sem data futura. Trata-se da referência declarada pelo fornecedor; não é confirmação de auditoria ou de atualização de cada campo.
4. Lucros positivos nos três últimos exercícios anuais completos: no ano de 2026, por exemplo, 2025, 2024 e 2023. Um ano ausente, não positivo ou antigo exclui a empresa.
5. Pelo menos 20 pregões distintos nos últimos 100 dias, com último pregão em até sete dias, e volume financeiro médio estimado de pelo menos R$ 5 milhões por dia. São usados até os 40 pregões mais recentes disponíveis na janela solicitada de três meses.
6. Lucro por ação e P/L positivos; ROE positivo e no máximo 100%; dividend yield informado entre 0% e 100%. Os tetos são verificações de plausibilidade, não garantias contábeis. DY zero é aceito como informação existente, mas recebe zero pontos por dividendos.
7. Não financeiras: dívida total, caixa e EBITDA disponíveis, EBITDA positivo e dívida líquida/EBITDA no máximo 4x. Caixa líquido é permitido. Bancos e seguradoras não são avaliados por dívida/EBITDA.

Dados ausentes permanecem ausentes. Não se usa zero para preencher um indicador desconhecido. Cada exclusão é exibida; a seleção pode conter de zero a cinco empresas.

## Normalização

Valores monetários retornados pela BRAPI são tratados como reais conforme seu contrato. ROE e DY são frações (0,07 = 7%). Lucro anual utiliza `netIncomeApplicableToCommonShares`, com alternativas `netIncome` e `netIncomeFromContinuingOps` quando o campo anterior está ausente. Patrimônio usa `controllerShareholdersEquity`, `totalStockholderEquity` ou `shareholdersEquity`, nessa ordem. Essas alternativas podem ter diferenças de escopo societário; confira a demonstração oficial antes de comparar.

O volume financeiro é **aproximado** pela média de preço de fechamento × quantidade negociada, não o volume financeiro exato transacionado em bolsa. Ajustes históricos de preços e eventos societários podem afetar a estimativa. Histórico anual de lucro não é histórico de retorno da ação.

## Nota de 0 a 100

`limitar(x)` restringe x ao intervalo de 0 a 1. A soma é arredondada para o inteiro mais próximo; os componentes ficam armazenados no relatório.

| Critério | Regra | Máximo |
| --- | --- | --- |
| Qualidade: retorno sobre patrimônio | `20 × limitar(ROE / 0,25)` | 20 |
| Qualidade: alavancagem | Não financeiras: `10 × limitar(1 − máximo(0, dívida líquida/EBITDA)/4)`; bancos/seguros recebem 5 fixos por falta de medição regulatória | 10 |
| Preço | `25 × limitar((25 − P/L)/20)`; P/L ≤ 5 recebe o máximo, ≥ 25 recebe zero | 25 |
| Dividendos | `20 × limitar(DY/0,08)`; se DY > 12%, reduz este componente à metade | 20 |
| Crescimento | CAGR de lucro em dois intervalos: `(lucro recente/lucro mais antigo)^(1/2) − 1`; nota `15 × limitar((CAGR + 0,05)/0,25)` | 15 |
| Liquidez | `10 × limitar(log10(volume médio/5.000.000)/2)` | 10 |

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

A edição é uma fotografia datada do mês. Ela não é uma cotação em tempo real e pode ficar desatualizada dentro do próprio mês; sempre confira o preço atual antes de uma decisão. A execução diária tenta gerar a edição ou completar uma edição com menos de cinco candidatas, limitada a uma consulta por dia.

O universo pequeno, as diferenças contábeis, os erros do provedor e os parâmetros fixos limitam as conclusões. Ausência de uma empresa na lista não significa que seja ruim. Permanência na lista não significa que deva continuar sendo comprada a qualquer preço.
