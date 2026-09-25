# Fases 7 e 8: metas, alertas e desempenho

## Fase 7

- A área **Meu plano** aceita até 20 metas adicionais, com nome, valor desejado, progresso editável e prazo opcional. Elas são informativas; não alteram carteira nem contas.
- O painel sinaliza orçamento a partir de 80% e excesso de limite. Também compara gastos confirmados até o mesmo dia do mês anterior, e só alerta quando a alta atinge 20% e R$ 100.
- Lançamentos pendentes, excluídos e substituídos pela sincronização ficam fora dos alertas.
- Metas são campos opcionais dos dados existentes, portanto backups antigos continuam válidos e nenhuma migration é necessária.

## Fase 8

- `monthlyHistory` agora ordena os eventos uma vez e percorre a carteira incrementalmente, em vez de recalcular a carteira para cada mês.
- Medição local: `node scripts/benchmark-history.mjs`, com 5.000 eventos e 81 competências, produziu exatamente a mesma série e passou de **100,5 ms** (implementação anterior) para **1,8 ms** (atual), uma melhoria de **55,3×** nesta amostra.
- O JavaScript inicial da rota passou de aproximadamente **428.900 bytes** (baseline: chunk da página de 414.523 bytes + framework de 14.377 bytes) para **355.573 bytes**, redução de **17,1%**. Controle financeiro, painel, carteira, relatórios e metas são carregados por demanda ao abrir a área correspondente.
- A decisão é manter `portfolios.data` sem normalização nesta entrega. A aplicação já limita o JSON a 4,75 MB e restringe os conjuntos de eventos/transações. Não há medição disponível do tamanho ou latência dos registros reais de produção para justificar uma migração relacional; normalizar agora exigiria duplicar regras de backup, RLS e concorrência sem evidência de benefício. Reavaliar quando medições de produção mostrarem crescimento próximo ao limite ou lentidão mensurável ao salvar/carregar.

## Verificação

- `node --test --test-isolation=none tests/*.test.mjs`: 64 testes aprovados.
- `npm run build`: build de produção aprovado.
- `node scripts/benchmark-history.mjs`: paridade exata entre a série antiga de referência e a versão otimizada.
