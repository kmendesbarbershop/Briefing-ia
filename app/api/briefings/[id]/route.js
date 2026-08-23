import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

const TABELA = 'briefings_onboarding';

// GET /api/briefings/:id — dados completos de uma ficha
export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABELA)
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    return Response.json({ briefing: data });
  } catch (err) {
    return Response.json({ error: 'Não foi possível abrir este briefing.', detalhes: String(err?.message || err) }, { status: 404 });
  }
}

// PATCH /api/briefings/:id — atualiza form/briefingIA/precificação
export async function PATCH(request, { params }) {
  try {
    const { form, briefingIA, precificacao } = await request.json();
    const supabase = getSupabaseAdmin();

    const updates = {};
    if (form) {
      updates.form_data = form;
      updates.empresa = form.identificacao?.empresa;
      updates.ramo = form.identificacao?.ramo || null;
      updates.entrevistado = form.identificacao?.entrevistado || null;
      updates.data = form.identificacao?.data || null;
    }
    if (briefingIA !== undefined) {
      updates.briefing_ia = briefingIA;
      updates.tem_briefing = !!briefingIA;
    }
    if (precificacao !== undefined) {
      updates.precificacao = precificacao;
    }

    const { data, error } = await supabase
      .from(TABELA)
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ briefing: data });
  } catch (err) {
    return Response.json({ error: 'Não foi possível salvar as alterações.', detalhes: String(err?.message || err) }, { status: 500 });
  }
}

// DELETE /api/briefings/:id — exclui a ficha
export async function DELETE(request, { params }) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(TABELA).delete().eq('id', params.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Não foi possível excluir.', detalhes: String(err?.message || err) }, { status: 500 });
  }
}
