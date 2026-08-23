-- Rode isso no SQL Editor do projeto Supabase "dossie-ia".
-- Renomeia a tabela "briefings" (criada anteriormente) para "briefings_onboarding",
-- preparando o terreno para uma futura tabela "briefings_mensal".

alter table if exists public.briefings rename to briefings_onboarding;
alter index if exists briefings_numero_idx rename to briefings_onboarding_numero_idx;
