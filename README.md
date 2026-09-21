# Patrimônio

Aplicação web em português para acompanhar investimentos no computador e no celular, com publicação na Vercel. Código editável em Next.js + React. Não é um programa Windows nem um aplicativo de loja: abre no navegador e inclui um manifesto para instalação como aplicativo web quando o navegador permitir.

## O que está pronto

- Carteira inicial de R$ 5.700 no CDB Santander e aporte mensal configurável, começando em R$ 800.
- Cadastro de CDB, Tesouro Direto, ações e investimento internacional.
- Registro de aportes, retiradas, dividendos/JCP líquidos, reinvestimentos, transferências internas e saldos.
- Evolução mensal separando capital novo de resultado financeiro, sem criar rentabilidade fictícia.
- Metas de reserva, divisão do aporte e simulador de longo prazo.
- Exportação CSV, backup JSON e restauração com validação.
- Acesso por e-mail e sincronização privada entre dispositivos após conectar o Supabase.
- Integração de mercado BRAPI v2, seleção quantitativa de até cinco candidatas por mês, motivos de exclusão e arquivo de edições anteriores.
- Agendamento na Vercel: verifica diariamente se falta a edição mensal ou se ela ficou incompleta. Limite de uma consulta completa por dia, inclusive pelo botão manual.

As compras continuam sendo realizadas por você no Santander. O aplicativo não acessa sua conta bancária, não recebe senha do Santander e não executa ordens.

## Comece em seu computador

1. Extraia o ZIP para uma pasta. Abra a pasta `patrimonio` no VS Code ou Codex.
2. Instale o Node.js 22 LTS ou outra versão compatível com o projeto.
3. No terminal dessa pasta, execute:

```bash
npm ci
npm run dev
```

4. Abra o endereço local que o terminal mostrar. Sem variáveis de ambiente, o app funciona em modo local.
5. Em **Configurações**, confirme nome, despesas mensais, aporte, meses de reserva e horizonte. R$ 8.000 de despesas, seis meses de reserva e dez anos de horizonte são hipóteses iniciais editáveis; não foram verificadas.
6. Em **Minha carteira**, edite o CDB para marcar como reserva somente depois de confirmar liquidez, vencimento e condições de resgate. Ele começa fora da reserva por falta dessas informações.

O saldo inicial é a posição atual informada, não o custo histórico nem o rendimento anterior ao uso do app. O histórico começa na primeira abertura local; em uma conta nova, na primeira gravação. Não foram inventados meses passados.

## Publicar na Vercel

Você não precisa enviar a conversa para outro chat do Codex. O projeto neste ZIP é o que deve abrir no Codex caso queira continuar trabalhando em outro ambiente.

1. Crie um repositório **privado** no GitHub e envie o conteúdo da pasta `patrimonio`, incluindo `package-lock.json`, `public`, `app`, `lib` e `vercel.json`. Não envie `node_modules`, `.next` nem arquivos com chaves. Ao usar a interface web do GitHub, confirme que enviou também `.env.example` apenas como modelo, sem segredos.
2. Na Vercel, escolha **Add New → Project**, importe o repositório e confirme o framework **Next.js**. A pasta raiz deve ser aquela que contém `package.json`.
3. Use `npm run build` para o build e deixe a pasta de saída no padrão do framework. Selecione uma versão de Node compatível (22 ou superior).
4. Você pode publicar inicialmente em modo local, mas cada navegador terá dados separados. Para dados compartilhados, conclua a conexão abaixo e faça um novo deploy.
5. No celular, abra a URL publicada. Para um atalho, use **Adicionar à tela de início** ou a opção de instalação do navegador. O modo instalado não implementa uso offline nem sincronização offline.

## Conectar sua conta e o banco de dados

O projeto já contém a integração; nenhuma conta externa foi criada ou configurada durante a entrega.

1. Crie um projeto Supabase dedicado ao aplicativo.
2. No SQL Editor, execute o conteúdo de `supabase/setup.sql` **uma vez**, em um projeto novo. O script cria as tabelas, permissões e regras de acesso. Não execute novamente sobre tabelas existentes sem revisar a migração.
3. Em Authentication, habilite autenticação por e-mail. Cadastre seu usuário por **Add user / Create user** e confirme o e-mail. Desabilite novos cadastros públicos. O app usa `shouldCreateUser: false`, aceitando apenas contas já cadastradas.
4. Configure envio de e-mail/SMTP para seu endereço. O serviço padrão pode restringir destinatários; teste o recebimento antes de depender dele.
5. Em Authentication → URL Configuration, configure **Site URL** com a URL definitiva da Vercel e adicione a mesma origem às URLs de redirecionamento permitidas. Para desenvolvimento, adicione também a origem local efetivamente utilizada. Evite liberar URLs genéricas desnecessárias.
6. Cadastre as variáveis abaixo na Vercel. Para uso local conectado, copie `.env.example` para `.env.local` e preencha no seu computador. Nunca envie esse arquivo ao GitHub.

| Variável | Onde obter / função |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública publishable do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta service_role; usada apenas pelo servidor para análise de mercado |
| `BRAPI_TOKEN` | Token da fonte de dados BRAPI, com acesso aos endpoints necessários |
| `CRON_SECRET` | Segredo aleatório de pelo menos 32 caracteres, apenas no servidor |
| `OWNER_USER_ID` | UUID do seu usuário em Authentication; restringe a atualização manual ao proprietário |

Para gerar o segredo no seu computador:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não coloque `NEXT_PUBLIC_` nas chaves secretas. As duas variáveis públicas são incorporadas ao aplicativo no build; faça um novo deploy sempre que as alterar.

7. Entre no app com seu e-mail e abra o link recebido. Faça um primeiro lançamento ou salve suas metas para gravar a carteira.
8. Se já usou o modo local, **baixe o backup antes de ativar a conta**. Depois do login, restaure-o em Configurações. Não há migração silenciosa: restaurar substitui a carteira da conta, mediante confirmação.
9. Abra a mesma URL e conta no outro dispositivo. As gravações são compartilhadas, mas a tela não recebe mudanças em tempo real. Recarregue para ver alterações do outro aparelho. Se os dois editarem simultaneamente, o app recusa uma gravação sobre versão antiga.

A política de acesso do banco limita a leitura e alteração da carteira ao próprio usuário autenticado. As análises de empresas não contêm sua carteira e são compartilhadas entre usuários cadastrados desse projeto.

## Ativar a análise mensal

1. Confira se seu plano BRAPI permite consultas para todos os 15 códigos de `lib/ranking.mjs`, três exercícios anuais completos e os recursos abaixo. A disponibilidade pode exigir contratação. Não presuma que o plano gratuito cobre este conjunto.
2. Recursos utilizados: `/v2/stocks/quote`, `statistics`, `financial-data`, `balance-sheet`, `income-statement` e `historical`. Dados incompletos ou sem permissão resultam em exclusões explicadas na tela.
3. Depois de configurar `BRAPI_TOKEN`, entre no app e use **Análise do mês → Atualizar análise**. Leia a cobertura e as datas. Não existe uma lista de ações fictícia pré-carregada.
4. `vercel.json` agenda `/api/cron` uma vez por dia, às 12h UTC (9h de Brasília), no ambiente de produção. A execução exata depende do plano e do serviço de agendamento da Vercel. O endpoint exige o cabeçalho `Authorization: Bearer CRON_SECRET`, enviado pela Vercel.
5. Uma edição com cinco candidatas fica arquivada no mês. A rotina diária não refaz essa edição; se houver menos de cinco, tenta no dia seguinte. O botão manual permite nova consulta, respeitando o mesmo limite diário.
6. Uma rodada usa até 18 requisições, em grupos de até cinco códigos e no máximo três requisições simultâneas. Ao receber HTTP 429, interrompe as pendentes. Verifique a cobrança do provedor por requisição/código e sua cota.
7. Em caso de interrupção, o dia permanece reservado para impedir consumo repetido. A próxima tentativa é no dia seguinte. Uma edição existente com maior número de empresas elegíveis é preservada se a nova resposta tiver cobertura inferior.

Não foi contratado um plano de dados nem validado o acesso autenticado a todas as empresas. A chamada pública de verificação encontrou limitação de requisições (HTTP 429), e o aplicativo corretamente não gerou notas sem dados. Os testes usam cenários explicitamente sintéticos, nunca apresentados como mercado real.

Leia `METODOLOGIA.md`: a seleção é uma triagem quantitativa, não uma análise completa nem uma recomendação individual. Com um aporte pequeno, cinco candidatas são uma lista para estudar, não uma obrigação de comprar cinco ativos a cada mês.

## Como registrar corretamente

| Situação | Registro |
| --- | --- |
| Enviou R$ 800 novos para investir | Aporte no investimento de destino |
| Recebeu R$ 20 de dividendos líquidos | Dividendo/JCP na empresa pagadora; entra no caixa de dividendos |
| Usou esses R$ 20 para comprar | Reinvestimento no destino; sai do caixa sem contar outro aporte |
| Realocou parte do CDB para Tesouro | Transferência interna; cadastre primeiro o ativo de destino |
| Retirou dinheiro para fora da carteira | Retirada |
| Investimento subiu ou caiu de valor | Atualização de saldo conforme o extrato |
| Quer fechar o mês | Registre movimentações primeiro e depois os saldos de cada posição na data do extrato |

Os saldos são em reais, não em quantidade de ações. Esta versão não calcula preço médio fiscal, imposto de renda, DARF, lotes ou rentabilidade percentual ponderada por fluxo. Use as notas de corretagem e extratos para essas finalidades. Custos e impostos pagos devem estar refletidos nos saldos líquidos informados. Em títulos com tributos diferidos, use a mesma convenção de saldo bruto ou líquido em todos os meses e anote qual escolheu.

**Resultado registrado = patrimônio atual − saldo inicial − aportes + retiradas.** Dividendos mantidos na carteira já compõem esse resultado; reinvestimento não o aumenta novamente. Sem atualizar saldos, o resultado não acompanha a valorização de mercado.

Os últimos 100 lançamentos aparecem na tabela; o CSV e o backup incluem todos, até o limite de 20.000 registros. O gráfico principal permite até 60 meses e a tabela mensal mantém o histórico desde o início. Valores ocultos pelo ícone de olho são uma conveniência visual, não um mecanismo de proteção dos arquivos exportados.

## Verificação e manutenção

```bash
npm test
npm run build
npm start
```

- 17 testes automatizados: cálculos, reinvestimento, retiradas, transferências, validação de backup, plano, projeção, critérios de seleção, falta de dados, limite da fonte e acesso às rotas.
- Build de produção concluído com sucesso. Servidor de produção respondeu HTTP 200 para a página, manifesto e ícone; o cron sem segredo respondeu 401 e a análise não configurada respondeu 503, conforme esperado.
- Prévia visual indisponível no ambiente da entrega: navegação, layout real em dispositivos e fluxo completo de login ainda precisam ser conferidos após a publicação.
- Conexão real com Supabase, envio de e-mail, permissões aplicadas no banco e execução do cron ainda precisam ser validados no seu projeto configurado.

Depois de publicar: registre um pequeno lançamento de teste, confira o total e remova esse registro; teste o mesmo login no celular; baixe e confira um backup; faça uma atualização de análise e confira os logs na Vercel. O endpoint de cron deve recusar acesso sem segredo.

Os arquivos principais são `app/page.js` (interface), `app/globals.css` (estilos), `lib/portfolio.mjs` (cálculos), `lib/ranking.mjs` (critérios), `lib/market-provider.mjs` (dados) e `lib/market-server.mjs` (autorização e rotina). O arquivo `package-lock.json` fixa as versões entregues.

## Documentação dos serviços

- [BRAPI — endpoints de ações](https://brapi.dev/docs/acoes)
- [BRAPI — DRE anual](https://brapi.dev/docs/acoes/dre)
- [BRAPI — histórico de preços](https://brapi.dev/docs/acoes/historico)
- [Supabase — login por e-mail](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase — acesso por linha](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel — agendamento e limites](https://vercel.com/docs/cron-jobs/usage-and-pricing)

Guia preparado em 21/09/2026. Planos, telas e limites dos serviços podem mudar.
