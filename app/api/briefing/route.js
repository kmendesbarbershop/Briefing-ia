// POST /api/briefing
// Recebe { form } e retorna { briefingIA } gerado pelo Gemini.
// Nunca calcula preço aqui — precificação é sempre feita em JS puro (ver lib/precificacao.js).

const GEMINI_MODEL = 'gemini-3.5-flash'; // gemini-1.5-flash foi descontinuado (404) — atualizar aqui quando o Google trocar de novo

function montarPrompt(form) {
  const { identificacao, marca, objetivos, publico, tom, escopo, pautas, recursos } = form;

  return `Você é um estrategista de conteúdo e mídias sociais especialista em pequenas e médias empresas no Brasil.

Empresa: ${identificacao?.empresa || 'não informado'}
Ramo de atividade: ${identificacao?.ramo || 'não informado'}

Sobre a marca: ${marca?.descricao || '(não informado)'}
Diferenciais e concorrentes de referência: ${marca?.diferenciais || '(não informado)'}

Objetivos com redes sociais: ${(objetivos?.selecionados || []).join(', ') || '(não informado)'}
Detalhes dos objetivos: ${objetivos?.detalhes || '(não informado)'}

Público-alvo: ${publico || '(não informado)'}

Tom de voz desejado: ${(tom?.selecionados || []).join(', ') || '(não informado)'}
Referências de tom/visual: ${tom?.referencias || '(não informado)'}

Escopo mensal do pacote: ${escopo?.postsFeeds ?? 0} posts feed, ${escopo?.stories ?? 0} stories, ${escopo?.reels ?? 0} reels, ${escopo?.artesAvulsas ?? 0} artes avulsas, em ${escopo?.plataformas ?? 1} plataforma(s), contrato de ${escopo?.duracaoMeses ?? 1} mês(es).

Pautas e temas (o que pode/não pode abordar): ${pautas || '(não informado)'}

Recursos disponíveis: ${(recursos?.selecionados || []).join(', ') || '(não informado)'}
Detalhes de recursos: ${recursos?.detalhes || '(não informado)'}

Com base SOMENTE nessas informações, gere um briefing estratégico de conteúdo (onboarding do cliente). Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:

{
  "resumo_estrategico": "2 a 4 frases sobre o posicionamento e a linha editorial recomendada",
  "pautas_sugeridas": [
    {
      "plataforma": "ex: Instagram, TikTok, WhatsApp Status",
      "formato": "ex: Reels, Carrossel, Stories, Post estático",
      "tema": "tema específico do conteúdo, no máximo 20 palavras"
    }
  ],
  "cronograma": {
    "semana1": "foco da semana 1, no máximo 20 palavras",
    "semana2": "foco da semana 2, no máximo 20 palavras",
    "semana3": "foco da semana 3, no máximo 20 palavras",
    "semana4": "foco da semana 4, no máximo 20 palavras"
  }
}

Gere entre 5 e 8 pautas sugeridas, distribuídas entre as plataformas informadas no escopo. Seja específico e prático, evite jargão técnico. Responda em português do Brasil.

TERMINOLOGIA OBRIGATÓRIA: nunca use as palavras "chatbot" ou "bot". Sempre que a solução envolver atendimento automatizado por mensagem, use "Agente de IA" no lugar.`;
}

function extrairJSON(texto) {
  if (!texto) return null;
  let t = texto.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try { return JSON.parse(t); } catch {}
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (ini !== -1 && fim !== -1 && fim > ini) {
    try { return JSON.parse(t.slice(ini, fim + 1)); } catch {}
  }
  return null;
}

export async function POST(request) {
  try {
    const { form } = await request.json();
    if (!form?.identificacao?.empresa?.trim()) {
      return Response.json({ error: 'Informe o nome da empresa antes de gerar o briefing.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const prompt = montarPrompt(form);

    // Desde 2026 o Gemini exige o cabeçalho x-goog-api-key (as novas "auth keys" não
    // funcionam mais pelo parâmetro ?key= na URL, que era só pras antigas "standard keys").
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4000,
          thinkingConfig: { thinkingLevel: 'low' },
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const corpo = await geminiRes.text().catch(() => '');
      return Response.json(
        { error: `A IA respondeu com erro ${geminiRes.status}.`, detalhes: corpo.slice(0, 800) },
        { status: 502 }
      );
    }

    const data = await geminiRes.json();
    // Gemini 3.x pode incluir partes de "thinking" antes do texto final — filtramos só as partes de texto reais.
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const texto = parts.filter((p) => p?.text && !p.thought).map((p) => p.text).join('');
    const briefingIA = extrairJSON(texto);

    if (!briefingIA || !Array.isArray(briefingIA.pautas_sugeridas)) {
      return Response.json(
        { error: 'A resposta da IA veio fora do formato esperado.', detalhes: texto.slice(0, 800) },
        { status: 502 }
      );
    }

    return Response.json({ briefingIA });
  } catch (err) {
    return Response.json({ error: 'Falha inesperada ao gerar o briefing.', detalhes: String(err?.message || err) }, { status: 500 });
  }
}
