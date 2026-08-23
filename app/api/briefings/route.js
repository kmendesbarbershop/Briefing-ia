import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const TABELA = 'briefings_onboarding';

// GET /api/briefings — lista resumida para o painel (dashboard)
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABELA)
      .select('id, numero, empresa, ramo, entrevistado, data, tem_briefing')
      .order('numero', { ascending: false });

    if (error) throw error;
    return Response.json({ briefings: data || [] });
  } catch (err) {
    return Response.json({ error: 'Não foi possível carregar os briefings.', detalhes: String(err?.message || err) }, { status: 500 });
  }
}

// POST /api/briefings — cria uma nova ficha (com ou sem briefingIA já gerado)
export async function POST(request) {
  try {
    const { form, briefingIA, precificacao } = await request.json();
    if (!form?.identificacao?.empresa?.trim()) {
      return Response.json({ error: 'Informe o nome da empresa para salvar.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: maiorNumeroRows } = await supabase
      .from(TABELA)
      .select('numero')
      .order('numero', { ascending: false })
      .limit(1);
    const proximoNumero = (maiorNumeroRows?.[0]?.numero || 0) + 1;

    const { data, error } = await supabase
      .from(TABELA)
      .insert({
        numero: proximoNumero,
        empresa: form.identificacao.empresa,
        ramo: form.identificacao.ramo || null,
        entrevistado: form.identificacao.entrevistado || null,
        data: form.identificacao.data || null,
        form_data: form,
        briefing_ia: briefingIA || null,
        precificacao: precificacao || null,
        tem_briefing: !!briefingIA,
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json({ briefing: data });
  } catch (err) {
    return Response.json({ error: 'Não foi possível salvar o briefing.', detalhes: String(err?.message || err) }, { status: 500 });
  }
}
