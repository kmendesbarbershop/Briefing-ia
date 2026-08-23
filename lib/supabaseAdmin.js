import { createClient } from '@supabase/supabase-js';

// Client server-side, com a service role key — NUNCA importar isto em componentes 'use client'.
// Usado somente dentro das rotas de API (app/api/**/route.js).
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
