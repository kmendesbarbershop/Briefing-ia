// lib/precificacao.js — Motor de Precificação (fonte única) · Briefing IA
//
// REGRA DE OURO: todo cálculo de preço é determinístico, feito aqui, em código.
// NUNCA delegar à IA (Gemini). A IA só pode recomendar o NOME do plano.
//
// Este é o único lugar com as regras de preço. A tela (app/page.jsx) apenas importa daqui.
// A margem de negociação (5%) é embutida em silêncio e NUNCA aparece para o cliente.

// ─── Valores base (conteúdo) ───────────────────────────────────────────────────
export const VALORES_BASE = {
  postFeed: 40,                 // carrossel ou estático
  storyAvulso: 15,              // arte/folder
  reelsEditado: 80,             // cliente envia o bruto; entrega = roteiro + edição + capa + legenda
  arteAvulsa: 30,
  gestaoPrimeiraPlataforma: 150,
  plataformaAdicional: 200,
};

// ─── Regras de desconto ────────────────────────────────────────────────────────
// Os descontos semestral/anual valem só sobre o subtotal de CONTEÚDO, nunca sobre módulos.
export const REGRAS_DESCONTO = {
  descontoPlataformasAdicionais: 0.10, // 2+ plataformas, só sobre as adicionais
  limitePostsVolume: 20,               // acima disso, desconto de volume
  descontoVolume: 0.10,                // sobre o valor dos posts feed
  duracaoMinSemestral: 6,
  descontoSemestral: 0.05,
  duracaoMinAnual: 12,
  descontoAnual: 0.10,
};

// Margem de negociação — SEMPRE aplicada sobre o conteúdo, nunca exposta ao cliente.
export const MARGEM_NEGOCIACAO = 0.05;

// ─── Piloto e renovação ────────────────────────────────────────────────────────
export const DURACAO_PILOTO_MESES = 3;
export const DURACAO_MIN_RENOVACAO_MESES = 6;
export const AUMENTO_RENOVACAO = 0.25; // fácil de editar: 0.25 = +25% sobre o valor do piloto
export const APLICAR_DESCONTO_SEMESTRAL_NA_RENOVACAO = false;

// ─── Módulos (valores fixos mensais, somados DEPOIS da margem) ─────────────────
// Sem margem e sem desconto de contrato sobre módulos.
// Os valores de agenteIA e crm já têm tudo diluído — não existe valor separado de setup.
export const MODULOS = {
  planoVendas30: { nome: 'Plano de vendas de 30 dias', valor: 250 },
  manychat: { nome: 'Manychat', valor: 250 },
  trafego: { nome: 'Gestão de tráfego pago', valor: 900 },
  agenteIA: { nome: 'Agente de IA', valor: 700 },
  crm: { nome: 'CRM', valor: 300 },
};
export const MODULOS_ORDEM = ['planoVendas30', 'manychat', 'trafego', 'agenteIA', 'crm'];
export const COMBO_AGENTE_CRM = 900; // aplicado automaticamente se agenteIA + crm estiverem marcados
export const MODULOS_SO_RENOVACAO = ['agenteIA', 'crm']; // só podem ser oferecidos na renovação (6 meses)
export const DESCONTO_REMOCAO_MODULO = 0.8; // módulo removido de um plano que o inclui abate 80% do avulso

// Landing page NÃO entra na mensalidade: linha separada, valor único.
export const LANDING_PAGE_A_PARTIR_DE = 1000;

export const AVISO_IA_CRM_6_MESES = 'Agente de IA e CRM exigem contrato de no mínimo 6 meses.';
export const AVISO_CUSTOS_CLIENTE = 'Custos de plataforma e verba de anúncio são pagos pelo cliente diretamente.';

// ─── Planos prontos (presets) ──────────────────────────────────────────────────
// modulosInclusos = módulos que já fazem parte do plano (base para a regra de personalização).
export const PLANOS = {
  essencial: {
    id: 'essencial', nome: 'Essencial',
    escopo: { reels: 8, postsFeeds: 4, stories: 0, artesAvulsas: 0, plataformas: 1, duracaoMeses: 3 },
    modulosInclusos: [],
  },
  estrategico: {
    id: 'estrategico', nome: 'Estratégico',
    escopo: { reels: 12, postsFeeds: 8, stories: 12, artesAvulsas: 0, plataformas: 1, duracaoMeses: 3 },
    modulosInclusos: ['planoVendas30', 'manychat'],
  },
  sistema: {
    id: 'sistema', nome: 'Sistema Synapse',
    escopo: { reels: 12, postsFeeds: 8, stories: 12, artesAvulsas: 0, plataformas: 1, duracaoMeses: 3 },
    modulosInclusos: ['planoVendas30', 'manychat', 'trafego', 'agenteIA'], // CRM é opcional
  },
  personalizado: {
    id: 'personalizado', nome: 'Personalizado',
    escopo: null, // o usuário edita livremente
    modulosInclusos: [],
  },
};
export const PLANOS_ORDEM = ['essencial', 'estrategico', 'sistema', 'personalizado'];
export const PLANOS_PRONTOS = ['essencial', 'estrategico', 'sistema'];

const r2 = (n) => Math.round(n * 100) / 100;

// ─── Conteúdo ──────────────────────────────────────────────────────────────────
export function calcularConteudo(escopo) {
  const postsFeeds = Number(escopo.postsFeeds) || 0;
  const stories = Number(escopo.stories) || 0;
  const reels = Number(escopo.reels) || 0;
  const artesAvulsas = Number(escopo.artesAvulsas) || 0;
  const plataformas = Number(escopo.plataformas) || 0;
  const duracaoMeses = Number(escopo.duracaoMeses) || 1;

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
      const adicionais = (plataformas - 1) * VALORES_BASE.plataformaAdicional;
      valorGestaoPlataformas += adicionais * (1 - REGRAS_DESCONTO.descontoPlataformasAdicionais);
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
    stories: { qtd: stories, valor: r2(valorStories) },
    reels: { qtd: reels, valor: r2(valorReels) },
    artesAvulsas: { qtd: artesAvulsas, valor: r2(valorArtesAvulsas) },
    gestaoPlataformas: { qtd: plataformas, valor: r2(valorGestaoPlataformas) },
    descontoVolumeAplicado,
    valorDescontoVolume: r2(valorDescontoVolume),
    subtotal: r2(subtotal),
    percentualDescontoContrato,
    tipoContrato,
    valorFinalSemMargem: r2(valorFinalSemMargem),
    valorFinalComMargem: r2(valorFinalComMargem), // conteúdo já com a margem oculta
  };
}

// ─── Módulos ───────────────────────────────────────────────────────────────────
function valorModulosSelecionados(ids) {
  const set = new Set(ids);
  const combo = set.has('agenteIA') && set.has('crm');
  let total = 0;
  const linhas = [];
  ids.forEach((id) => {
    if (combo && MODULOS_SO_RENOVACAO.includes(id)) return; // entram no combo
    linhas.push({ id, nome: MODULOS[id].nome, valor: MODULOS[id].valor });
    total += MODULOS[id].valor;
  });
  if (combo) {
    linhas.push({ id: 'agenteIA+crm', nome: `${MODULOS.agenteIA.nome} + ${MODULOS.crm.nome}`, valor: COMBO_AGENTE_CRM });
    total += COMBO_AGENTE_CRM;
  }
  return { linhas, total };
}

// Regra de personalização: módulo ADICIONADO cobra 100% do avulso (já está em "selecionados").
// Módulo REMOVIDO de um plano que o inclui abate 80% do avulso → o cliente paga os 20% restantes
// (ex.: Estratégico sem Manychat = Estratégico − 200).
function ajusteRemocao(planoId, selecionados, filtro) {
  const inclusos = (PLANOS[planoId]?.modulosInclusos || []).filter(filtro);
  const removidos = inclusos.filter((id) => !selecionados.includes(id));
  return r2(removidos.reduce((s, id) => s + MODULOS[id].valor * (1 - DESCONTO_REMOCAO_MODULO), 0));
}

// ─── Cálculo completo de uma configuração ──────────────────────────────────────
// Piloto (3 meses): conteúdo + módulos, EXCETO Agente de IA e CRM (só na renovação).
// Renovação (mín. 6 meses): valor do piloto × (1 + AUMENTO_RENOVACAO) + Agente de IA/CRM (valores fixos).
export function calcularPlano({ escopo, modulos = [], plano = 'personalizado' }) {
  const planoId = PLANOS[plano] ? plano : 'personalizado';
  const selecionados = MODULOS_ORDEM.filter((id) => modulos.includes(id));

  const conteudo = calcularConteudo(escopo);

  const idsPiloto = selecionados.filter((id) => !MODULOS_SO_RENOVACAO.includes(id));
  const idsRenov = selecionados.filter((id) => MODULOS_SO_RENOVACAO.includes(id));

  const modPiloto = valorModulosSelecionados(idsPiloto);
  const ajustePiloto = ajusteRemocao(planoId, selecionados, (id) => !MODULOS_SO_RENOVACAO.includes(id));
  const modRenov = valorModulosSelecionados(idsRenov);
  const ajusteRenov = ajusteRemocao(planoId, selecionados, (id) => MODULOS_SO_RENOVACAO.includes(id));

  const totalModulosPiloto = r2(modPiloto.total + ajustePiloto);
  const totalModulosRenov = r2(modRenov.total + ajusteRenov);

  const valorPiloto = r2(conteudo.valorFinalComMargem + totalModulosPiloto);

  let basePiloto = valorPiloto;
  if (APLICAR_DESCONTO_SEMESTRAL_NA_RENOVACAO && conteudo.percentualDescontoContrato === 0) {
    const conteudoSemestral = conteudo.subtotal * (1 - REGRAS_DESCONTO.descontoSemestral) * (1 + MARGEM_NEGOCIACAO);
    basePiloto = r2(conteudoSemestral + totalModulosPiloto);
  }
  const valorRenovacao = r2(basePiloto * (1 + AUMENTO_RENOVACAO) + totalModulosRenov);

  const avisos = [];
  if (selecionados.some((id) => MODULOS_SO_RENOVACAO.includes(id)) && (Number(escopo.duracaoMeses) || 1) < DURACAO_MIN_RENOVACAO_MESES) {
    avisos.push(AVISO_IA_CRM_6_MESES);
  }

  return {
    versao: 2,
    plano: planoId,
    escopo: {
      reels: conteudo.reels.qtd, postsFeeds: conteudo.postsFeeds.qtd, stories: conteudo.stories.qtd,
      artesAvulsas: conteudo.artesAvulsas.qtd, plataformas: conteudo.gestaoPlataformas.qtd,
      duracaoMeses: Number(escopo.duracaoMeses) || 1,
    },
    conteudo,
    modulosPiloto: { linhas: modPiloto.linhas, ajusteRemocao: ajustePiloto, total: totalModulosPiloto },
    modulosRenovacao: { linhas: modRenov.linhas, ajusteRemocao: ajusteRenov, total: totalModulosRenov },
    valorPiloto,
    valorRenovacao,
    landingPage: { aPartirDe: LANDING_PAGE_A_PARTIR_DE },
    avisos,
  };
}

// Módulos que cada plano pronto traz por padrão (CRM nunca vem marcado).
export function modulosPadraoDoPlano(planoId) {
  return [...(PLANOS[planoId]?.modulosInclusos || [])];
}

// Cálculo dos 3 planos prontos, com seus módulos padrão (usado nas 3 colunas do relatório).
export function calcularPlanosProntos() {
  const out = {};
  PLANOS_PRONTOS.forEach((id) => {
    out[id] = calcularPlano({ escopo: PLANOS[id].escopo, modulos: modulosPadraoDoPlano(id), plano: id });
  });
  return out;
}

// Atalho: calcula a partir do formulário (escopo + plano + módulos guardados dentro de form.escopo).
export function calcularDoFormulario(form) {
  const e = form?.escopo || {};
  return calcularPlano({ escopo: e, modulos: e.modulos || [], plano: e.plano || 'personalizado' });
}

// ─── Exibição ──────────────────────────────────────────────────────────────────
// Arredonda para o real inteiro APENAS na exibição (997,50 → R$ 998). Os dados salvos mantêm os centavos.
export function formatarReais(valor) {
  const inteiro = Math.round(r2(Number(valor) || 0));
  return `R$ ${inteiro.toLocaleString('pt-BR')}`;
}

// Formato com centavos, para a memória de cálculo.
export function formatarReaisCentavos(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
