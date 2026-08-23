-- Rode isso no SQL Editor do projeto Supabase "dossie-ia" (mesmo projeto do Dossiê IA).
-- Cria a tabela "briefings_onboarding" para o app Briefing IA (etapa de onboarding do cliente).
-- Use este arquivo só se estiver criando a tabela do zero — se já rodou o SQL antigo
-- (que criava "briefings"), use supabase-rename-onboarding.sql em vez deste.

create table if not exists public.briefings_onboarding (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  empresa text not null,
  ramo text,
  entrevistado text,
  data date,
  form_data jsonb not null default '{}'::jsonb,
  briefing_ia jsonb,
  precificacao jsonb,
  tem_briefing boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists briefings_onboarding_numero_idx on public.briefings_onboarding (numero desc);

-- RLS desabilitado, igual ao padrão usado na tabela "fichas" do Dossiê IA
-- (acesso controlado só pelo service role key, usada exclusivamente no servidor).
alter table public.briefings_onboarding disable row level security;
