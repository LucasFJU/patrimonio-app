-- Execute uma vez no SQL Editor de um projeto Supabase novo, dedicado a este app.
-- Não contém chaves nem modifica usuários existentes.
begin;
create table public.portfolios (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object' and data ->> 'schema' = '1'),
 version integer not null default 1 check (version > 0),
 updated_at timestamptz not null default now(),
 constraint portfolio_size check (octet_length(data::text) <= 5000000)
);
alter table public.portfolios enable row level security;
revoke all on public.portfolios from anon, authenticated;
grant select, insert, update on public.portfolios to authenticated;
grant all on public.portfolios to service_role;
create policy portfolio_read on public.portfolios for select to authenticated using ((select auth.uid()) = user_id);
create policy portfolio_create on public.portfolios for insert to authenticated with check ((select auth.uid()) = user_id);
create policy portfolio_update on public.portfolios for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.market_reports (
 month text primary key check (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 generated_at timestamptz not null default now()
);
alter table public.market_reports enable row level security;
revoke all on public.market_reports from anon, authenticated;
grant select on public.market_reports to authenticated;
grant all on public.market_reports to service_role;
create policy report_read on public.market_reports for select to authenticated using (true);

create table public.market_jobs (
 day date primary key,
 status text not null check (status in ('running','completed','partial','failed')),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.market_jobs enable row level security;
revoke all on public.market_jobs from anon, authenticated;
grant all on public.market_jobs to service_role;
-- Sem políticas de cliente: somente o servidor executa consultas e grava análises.
commit;
