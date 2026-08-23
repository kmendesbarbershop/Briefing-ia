// ─── Motor de Precificação — Gestão de Redes Sociais ───────────────────────────
// Espelha a planilha Calculadora_Precificacao.xlsx.
// NUNCA delegar este cálculo à IA — é determinístico, baseado em regras fixas.
// (Cópia server-side da mesma lógica usada em app/page.jsx — mantenha as duas em sincronia.)

export const VALORES_BASE = {
  postFeed: 35,
  storyAvulso: 10,
  reelsEditado: 60,
  arteAvulsa: 25,
  gestaoPrimeiraPlataforma: 100,
  plataformaAdicional: 150,
};

export const REGRAS_DESCONTO = {
  descontoPlataformasAdicionais: 0.10,
  limitePostsVolume: 20,
  descontoVolume: 0.10,
  duracaoMinSemestral: 6,
  descontoSemestral: 0.05,
  duracaoMinAnual: 12,
  descontoAnual: 0.10,
};

const MARGEM_NEGOCIACAO = 0.05;
const r2 = (n) => Math.round(n * 100) / 100;

export function calcularPrecificacao(escopo) {
  const { postsFeeds, stories, reels, artesAvulsas, plataformas, duracaoMeses } = escopo;

  let valorPostsFeeds = postsFeeds * VALORES_BASE.postFeed;
  const descontoVolumeAplicado = postsFeeds > REGRAS_DESCONTO.limitePostsVolume;
  let valorDescontoVolume = 0;
  if (descontoVolumeAplicado) {
    valorDescontoVolume = valorPostsFeeds * REGRAS_DESCONTO.descontoVolume;
    valorPostsFeeds -= valorDescontoVolume;
  }

  const valorStories = stories * VALORES_BASE.storyAvulso;
  const valorReels = reels * VALORES_BASE.reelsEditado;
  const valorArtesAvulsas = artesAvulsas * VALORES_BASE.arteAvulsa;

  let valorGestaoPlataformas = 0;
  if (plataformas >= 1) {
    valorGestaoPlataformas = VALORES_BASE.gestaoPrimeiraPlataforma;
    if (plataformas > 1) {
      let valorAdicionais = (plataformas - 1) * VALORES_BASE.plataformaAdicional;
      valorAdicionais *= (1 - REGRAS_DESCONTO.descontoPlataformasAdicionais);
      valorGestaoPlataformas += valorAdicionais;
    }
  }

  const subtotal = valorPostsFeeds + valorStories + valorReels + valorArtesAvulsas + valorGestaoPlataformas;

  let percentualDescontoContrato = 0;
  let tipoContrato = 'mensal';
  if (duracaoMeses >= REGRAS_DESCONTO.duracaoMinAnual) {
    percentualDescontoContrato = REGRAS_DESCONTO.descontoAnual;
    tipoContrato = 'anual';
  } else if (duracaoMeses >= REGRAS_DESCONTO.duracaoMinSemestral) {
    percentualDescontoContrato = REGRAS_DESCONTO.descontoSemestral;
    tipoContrato = 'semestral';
  }

  const valorFinalSemMargem = subtotal * (1 - percentualDescontoContrato);
  const valorFinalComMargem = valorFinalSemMargem * (1 + MARGEM_NEGOCIACAO);

  return {
    postsFeeds: { qtd: postsFeeds, valor: r2(valorPostsFeeds) },
    stories: { qtd: stories, valor: valorStories },
    reels: { qtd: reels, valor: valorReels },
    artesAvulsas: { qtd: artesAvulsas, valor: valorArtesAvulsas },
    gestaoPlataformas: { qtd: plataformas, valor: r2(valorGestaoPlataformas) },
    descontoVolumeAplicado,
    valorDescontoVolume: r2(valorDescontoVolume),
    subtotal: r2(subtotal),
    percentualDescontoContrato,
    tipoContrato,
    valorFinalSemMargem: r2(valorFinalSemMargem),
    valorFinalComMargem: r2(valorFinalComMargem),
  };
}
