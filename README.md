# Briefing IA — Onboarding

Briefing de onboarding + precificação automática para redes sociais. Parte do REEB Synapse (irmão do Dossiê IA). Futuramente vai ganhar um módulo irmão de "briefing mensal" — por isso a tabela já nasce com o sufixo `_onboarding`.

Deploy 100% via navegador — GitHub web, Vercel, Supabase, Google AI Studio. Sem terminal, sem Node local.

## Passo a passo

1. **Supabase:** rode `supabase-rename-onboarding.sql` no SQL Editor do projeto `dossie-ia` (se a tabela `briefings` já existir) — ou `supabase-briefings-onboarding.sql` se estiver criando do zero.
2. **GitHub:** crie o repositório `briefing-ia` e suba TODOS os arquivos desta pasta de uma vez (Add file → Upload files, arrastando a pasta inteira) — mantendo a estrutura de pastas (`app/`, `app/api/...`, `lib/`).
3. **Vercel:** importe o repositório `briefing-ia` como novo projeto.
4. **Variáveis de ambiente no Vercel** (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
5. Deploy. Teste sempre na URL canônica do projeto (não em URLs de preview).
