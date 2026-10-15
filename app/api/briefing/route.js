// POST /api/briefing
// Recebe { form } e retorna { briefingIA } gerado pelo Gemini.
// Nunca calcula preço aqui — precificação é sempre feita em JS puro (ver lib/precificacao.js).

// Dá tempo suficiente para as tentativas automáticas abaixo (o padrão da Vercel pode ser curto demais).
export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-3.6-flash'; // confirmado funcionando na conta (mesmo modelo usado no Dossiê IA)

// Quando o Google responde 503 (servidor sobrecarregado), tenta de novo sozinho.
// Só o 503 é repetido — outros erros (401, 400 etc.) aparecem na hora, pois repetir não resolveria.
const MAX_TENTATIVAS = 3;
const ESPERA_ENTRE_TENTATIVAS_MS = [2000, 4000]; // espera antes da 2ª e da 3ª tentativa

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function chamarGeminiComRetry(url, opcoes) {
  let resposta;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    resposta = await fetch(url, opcoes);
    if (resposta.status !== 503) return resposta;
    if (tentativa < MAX_TENTATIVAS) {
      await esperar(ESPERA_ENTRE_TENTATIVAS_MS[tentativa - 1]);
    }
  }
  return resposta; // última resposta (503), tratada como erro normal pelo código abaixo
}

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
  },
  "plano_recomendado": {
    "nome": "exatamente um destes três: Essencial, Estratégico ou Sistema",
    "justificativa": "1 a 2 frases ligando a escolha às dores e aos objetivos informados acima"
  }
}

Sobre o campo "plano_recomendado" — escolha o plano que melhor resolve as dores e objetivos informados:
- Essencial: foco em Reels e posts, presença consistente e profissional, sem automação.
- Estratégico: mais Reels e Stories, plano de vendas de 30 dias e automação de Direct com Manychat, para quem quer transformar conteúdo em vendas.
- Sistema: o Estratégico mais gestão de tráfego pago e Agente de IA, para quem já quer um funil completo e atendimento automatizado.
NUNCA informe preço, valor, desconto ou qualquer número de investimento — a precificação é feita por outro sistema.

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

    // Confirmado com o Dossiê IA (que autentica com sucesso nesta conta): usar ?key= na URL,
    // não o cabeçalho x-goog-api-key — essa conta específica não funciona com o cabeçalho.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await chamarGeminiComRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // Normaliza o plano recomendado: só aceita um dos 3 nomes válidos; qualquer outra coisa é descartada.
    const NOMES_VALIDOS = ['Essencial', 'Estratégico', 'Sistema'];
    const rec = briefingIA.plano_recomendado;
    const nomeBruto = String(rec?.nome || '').trim();
    const nomeValido = NOMES_VALIDOS.find((n) => n.toLowerCase() === nomeBruto.toLowerCase().replace('sistema synapse', 'sistema'));
    briefingIA.plano_recomendado = nomeValido
      ? { nome: nomeValido, justificativa: String(rec?.justificativa || '').slice(0, 400) }
      : null;

    return Response.json({ briefingIA });
  } catch (err) {
    return Response.json({ error: 'Falha inesperada ao gerar o briefing.', detalhes: String(err?.message || err) }, { status: 500 });
  }
}
