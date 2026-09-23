> **FIIs:** cadastro, posição, atualização de saldo e dividendos permanecem na carteira. A análise de mercado e a integração com BRAPI/CVM foram retiradas nesta versão.

# Patrimônio Familiar — atualização V2

Atualização feita sobre o repositório LucasFJU/patrimonio-app. Não substitui a carteira por dados de exemplo e não exige recriar tabelas.

## Incluído

- Tema claro/escuro, seguindo o sistema até uma escolha manual, salva neste navegador.
- Login por e-mail e senha da mesma conta Supabase em vários aparelhos. Recuperação e definição de senha por e-mail.
- FIIs e Outros como classes próprias, além de CDB, Tesouro, ações e exterior/ETFs/BDRs.
- Quantidade atual, preço médio em reais, data de compra e responsável opcionais. Custo da posição calculado por quantidade × preço médio.
- Meta patrimonial editável (inicialmente R$ 1 milhão), capital investido líquido e aportes no painel.
- Comparação da alocação atual com suas metas, incluindo FIIs.
- Diário com criação, edição e exclusão confirmada; motivo, expectativa e revisão.
- Cadastro de FIIs como uma classe da carteira; quantidades, preço médio, saldos e dividendos continuam manuais.
- Atualização automática da carteira em Visão geral, Evolução mensal e Dividendos a cada 15 segundos e ao voltar para a janela. A consulta pausa em formulários. Conflitos continuam bloqueados pela versão da carteira.
- Leitura de backups e dados anteriores, mantendo o esquema 1 e a tabela portfolios existentes.

## Atualizar o site existente

1. No site atual, baixe um backup JSON em Configurações. Feche as abas antigas nos outros aparelhos até terminar o deploy.
2. Extraia o ZIP em uma pasta. Substitua os arquivos do repositório pelo conteúdo extraído, incluindo o novo `app/family.js`, este guia e os testes. Mantenha a raiz que contém `package.json` como raiz do projeto na Vercel.
3. Preserve as variáveis já configuradas na Vercel. Não envie `.env.local` ou chaves secretas ao GitHub.
4. O commit na branch de produção pode disparar o deploy automático da Vercel. Espere a compilação terminar antes de reabrir o app nos aparelhos.
5. **Não execute novamente `supabase/setup.sql`: ele é só para uma instalação nova. Esta atualização não altera o banco.**
6. Use o mesmo e-mail e senha nos dois aparelhos. Se a conta antiga só usava link, escolha “Esqueci ou ainda não defini minha senha”. Abra o link recebido e defina a senha. Não crie uma segunda conta.
7. No Supabase, confira que Site URL e Redirect URLs permitem a origem publicada e que o envio de e-mail funciona. Mantenha novos cadastros públicos desativados como na configuração anterior.
8. Confirme os dados antigos, tema, cadastro de FII e lançamento de dividendos. Faça uma alteração em um aparelho e confira a Visão geral no outro após até 15 segundos. Em conflito, preserve suas anotações e recarregue antes de tentar novamente.

## Limites explícitos

- Quantidade e preço médio são campos informados da posição atual, não um livro fiscal de compras e vendas. Não atualizam saldos automaticamente nem calculam impostos. Aportes, transferências e atualização de saldo continuam nos lançamentos para evitar duplicação de capital.
- Análise mensal de FIIs e cotações integradas estão pausadas. Cadastre cada fundo na carteira e registre os dividendos e saldos manualmente.
- A integração de ações existente usa BRAPI. Não foi trocada por BolsAI: o projeto não contém contrato de API nem credenciais dessa fonte. Nenhuma nota ou recomendação fictícia foi adicionada.
- A preferência de tema pertence a cada aparelho. A carteira, metas e diário compartilham o mesmo registro privado da conta.
- Evite usar versões antigas do aplicativo depois de cadastrar FIIs: os validadores antigos não conhecem as novas classes. Para voltar à V1, restaure o backup anterior à atualização.

## Validação desta entrega

A carteira permanece no esquema 1 e continua usando a tabela portfolios existente. Não é necessária migração no Supabase. As integrações de análise de FIIs foram removidas; a análise mensal de ações permanece separada.
