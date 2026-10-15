'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft, ChevronDown, ChevronUp, Loader2, Trash2, Sparkles, AlertCircle, FolderOpen } from 'lucide-react';
import './planos.css';
// Motor de precificação: fonte única em lib/precificacao.js (nada de cópia de regras aqui dentro).
import {
  PLANOS, PLANOS_ORDEM, PLANOS_PRONTOS, MODULOS, MODULOS_ORDEM, AVISO_CUSTOS_CLIENTE,
  calcularDoFormulario, calcularPlanosProntos, modulosPadraoDoPlano,
  formatarReais, formatarReaisCentavos,
} from '../lib/precificacao';

// ─── Componentes de campo — mobile-safe (defaultValue + onBlur) ────────────────

const Campo = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <label className="campo">
    <span className="campo-label">{label}</span>
    <input className="campo-input" type={type} defaultValue={value} placeholder={placeholder} onBlur={(e) => onChange(e.target.value)} />
  </label>
);

const CampoNumero = ({ label, value, onChange, min = 0 }) => (
  <label className="campo">
    <span className="campo-label">{label}</span>
    <input className="campo-numero" type="number" min={min} defaultValue={value} onBlur={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || 0))} />
  </label>
);

const CampoTextArea = ({ value, onChange, placeholder, rows = 4 }) => (
  <textarea className="notas-input" placeholder={placeholder} defaultValue={value} onBlur={(e) => onChange(e.target.value)} rows={rows} />
);

// ─── Dados do formulário ────────────────────────────────────────────────────────

const OBJETIVOS_OPCOES = ['Vendas diretas', 'Reconhecimento de marca', 'Engajamento/comunidade', 'Geração de leads', 'Educar o público', 'Fidelizar clientes'];
const TOM_OPCOES = ['Descontraído', 'Formal/corporativo', 'Divertido/humor', 'Inspirador', 'Técnico/educativo', 'Provocador'];
const RECURSOS_OPCOES = ['Fotos próprias disponíveis', 'Vídeos próprios disponíveis', 'Precisa de produção de fotos', 'Precisa de produção de vídeos', 'Já tem banco de imagens/identidade visual'];

const hoje = () => new Date().toISOString().slice(0, 10);

const fichaVazia = () => ({
  identificacao: { empresa: '', ramo: '', entrevistado: '', cargo: '', telefone: '', email: '', data: hoje() },
  marca: { descricao: '', diferenciais: '' },
  objetivos: { selecionados: [], detalhes: '' },
  publico: '',
  tom: { selecionados: [], referencias: '' },
  // plano e modulos ficam DENTRO do escopo (mesmo JSON form_data — sem mudar o banco)
  escopo: { postsFeeds: 8, stories: 8, reels: 2, artesAvulsas: 0, plataformas: 1, duracaoMeses: 1, plano: 'personalizado', modulos: [] },
  pautas: '',
  recursos: { selecionados: [], detalhes: '' },
});

// Merge profundo: briefings antigos não têm os campos novos (plano, modulos); eles ganham os padrões seguros.
function mesclar(base, extra) {
  if (base === null || typeof base !== 'object' || Array.isArray(base)) {
    return extra === undefined ? base : extra;
  }
  const out = { ...base };
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    Object.keys(extra).forEach((k) => { out[k] = k in base ? mesclar(base[k], extra[k]) : extra[k]; });
  }
  return out;
}

const formatarData = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

const temAlgumaResposta = (form) => {
  return !!(form.marca?.descricao?.trim() || form.publico?.trim() || form.pautas?.trim() || (form.objetivos?.selecionados || []).length > 0);
};

const NOME_PARA_ID = { 'Essencial': 'essencial', 'Estratégico': 'estrategico', 'Sistema': 'sistema' };

// ─── Preços no relatório ──────────────────────────────────────────────────────

function PlanoCard({ id, calc, recomendado }) {
  const e = calc.escopo;
  const aPartirDe = id === 'sistema';
  const modsPiloto = calc.modulosPiloto.linhas.map((l) => l.nome);
  const modsRenov = calc.modulosRenovacao.linhas.map((l) => l.nome);
  return (
    <div className={`plano-card${recomendado ? ' plano-rec' : ''}`}>
      {recomendado && <span className="plano-badge">Recomendado</span>}
      <h4 className="plano-nome">{PLANOS[id].nome}</h4>
      <p className="plano-escopo">{e.reels} reels · {e.postsFeeds} posts · {e.stories} stories</p>
      <p className="plano-mods">
        {modsPiloto.length > 0 ? `Inclui: ${modsPiloto.join(', ')}` : 'Conteúdo e gestão da plataforma'}
        {modsRenov.length > 0 && <span>Na renovação: {modsRenov.join(', ')}</span>}
      </p>
      <div className="plano-linha">
        <span className="rotulo">Valor do piloto (3 meses)</span>
        <span className="valor">{aPartirDe && <span className="a-partir">a partir de</span>}{formatarReais(calc.valorPiloto)}<small>/mês</small></span>
      </div>
      <div className="plano-linha">
        <span className="rotulo">Valor na renovação (mínimo 6 meses)</span>
        <span className="valor">{aPartirDe && <span className="a-partir">a partir de</span>}{formatarReais(calc.valorRenovacao)}<small>/mês</small></span>
      </div>
    </div>
  );
}

function BlocoPrecos({ form, precificacao, planoRecomendadoId }) {
  if (!precificacao) return null;

  // Briefing salvo antes da nova política: mostra o valor que foi calculado na época, sem recalcular.
  if (precificacao.versao !== 2) {
    return (
      <section className="bloco">
        <h3 className="bloco-titulo">Estimativa de valor</h3>
        <div className="preco-destaque">
          <span className="preco-label">Valor mensal proposto</span>
          <span className="preco-valor">{formatarReaisCentavos(precificacao.valorFinalComMargem)}</span>
          <span className="preco-periodo">{form.escopo?.duracaoMeses}x · contrato {precificacao.tipoContrato}</span>
        </div>
        <p style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>Cálculo feito com a tabela de preços anterior. Gere o briefing de novo para usar os planos atuais.</p>
        <div className="custos-aviso">{AVISO_CUSTOS_CLIENTE}</div>
      </section>
    );
  }

  const planos = precificacao.planos || calcularPlanosProntos();
  const modsSel = [...(precificacao.modulos || [])].sort().join(',');
  const modsPadrao = [...modulosPadraoDoPlano(precificacao.plano)].sort().join(',');
  const mostrarConfig =
    precificacao.plano === 'personalizado' ||
    modsSel !== modsPadrao ||
    precificacao.modulosPiloto.ajusteRemocao > 0 ||
    precificacao.modulosRenovacao.ajusteRemocao > 0;
  const c = precificacao.conteudo;

  return (
    <section className="bloco">
      <h3 className="bloco-titulo">Estimativa de valor</h3>
      <div className="planos-grid">
        {PLANOS_PRONTOS.map((id) => (
          <PlanoCard key={id} id={id} calc={planos[id]} recomendado={id === planoRecomendadoId} />
        ))}
      </div>

      {mostrarConfig && (
        <div className="plano-card config-card">
          <h4 className="plano-nome">Configuração deste briefing{precificacao.plano !== 'personalizado' ? ` (base ${PLANOS[precificacao.plano].nome})` : ''}</h4>
          <p className="plano-escopo">
            {precificacao.escopo.reels} reels · {precificacao.escopo.postsFeeds} posts · {precificacao.escopo.stories} stories
            {precificacao.escopo.artesAvulsas > 0 ? ` · ${precificacao.escopo.artesAvulsas} artes avulsas` : ''} · {precificacao.escopo.plataformas} plataforma(s)
          </p>
          <div className="memoria-calculo">
            <div className="memoria-linha"><span>Posts feed ({c.postsFeeds.qtd}x)</span><span>{formatarReaisCentavos(c.postsFeeds.valor)}</span></div>
            <div className="memoria-linha"><span>Stories ({c.stories.qtd}x)</span><span>{formatarReaisCentavos(c.stories.valor)}</span></div>
            <div className="memoria-linha"><span>Reels ({c.reels.qtd}x)</span><span>{formatarReaisCentavos(c.reels.valor)}</span></div>
            {c.artesAvulsas.qtd > 0 && <div className="memoria-linha"><span>Artes avulsas ({c.artesAvulsas.qtd}x)</span><span>{formatarReaisCentavos(c.artesAvulsas.valor)}</span></div>}
            <div className="memoria-linha"><span>Gestão de plataformas ({c.gestaoPlataformas.qtd}x)</span><span>{formatarReaisCentavos(c.gestaoPlataformas.valor)}</span></div>
            {precificacao.modulosPiloto.linhas.map((l) => (
              <div key={l.id} className="memoria-linha"><span>{l.nome}</span><span>{formatarReaisCentavos(l.valor)}</span></div>
            ))}
            {precificacao.modulosRenovacao.linhas.map((l) => (
              <div key={l.id} className="memoria-linha"><span>{l.nome} (na renovação)</span><span>{formatarReaisCentavos(l.valor)}</span></div>
            ))}
          </div>
          <div className="plano-linha">
            <span className="rotulo">Valor do piloto (3 meses)</span>
            <span className="valor">{formatarReais(precificacao.valorPiloto)}<small>/mês</small></span>
          </div>
          <div className="plano-linha">
            <span className="rotulo">Valor na renovação (mínimo 6 meses)</span>
            <span className="valor">{formatarReais(precificacao.valorRenovacao)}<small>/mês</small></span>
          </div>
        </div>
      )}

      <div className="landing-linha">Landing page: a partir de R$ {precificacao.landingPage.aPartirDe.toLocaleString('pt-BR')} (valor único)</div>
      <div className="custos-aviso">{AVISO_CUSTOS_CLIENTE}</div>

      {(precificacao.avisos || []).map((a) => (
        <div key={a} className="aviso-interno"><b>Aviso interno</b>{a}</div>
      ))}
    </section>
  );
}

// ─── Relatório ────────────────────────────────────────────────────────────────

function Relatorio({ form, briefingIA, precificacao, numero, salvo, salvando, onVoltar, onEditar, onSalvar }) {
  const { identificacao } = form;
  const pautas = briefingIA?.pautas_sugeridas || [];
  const rec = briefingIA?.plano_recomendado;
  const planoRecomendadoId = NOME_PARA_ID[rec?.nome] || 'estrategico';
  return (
    <div className="tela">
      <header className="topo">
        <button className="botao-icone" onClick={onVoltar}><ArrowLeft size={20} /></button>
        <span className="topo-titulo">Briefing gerado</span>
      </header>
      <div className="relatorio-header">
        <div className="selo">
          <span className="selo-texto">Briefing</span>
          <span className="selo-numero">Nº {String(numero).padStart(4, '0')}</span>
          <span className="selo-data">{formatarData(identificacao.data)}</span>
        </div>
        <div className="relatorio-info">
          <h2>{identificacao.empresa || 'Empresa sem nome'}</h2>
          {identificacao.ramo && <p className="tag-ramo">{identificacao.ramo}</p>}
          <p className="tag-entrevistado">{identificacao.entrevistado || 'Entrevistado não informado'}{identificacao.cargo ? ` · ${identificacao.cargo}` : ''}</p>
        </div>
      </div>

      <section className="bloco">
        <h3 className="bloco-titulo">Resumo estratégico</h3>
        <p className="resumo-texto">{briefingIA?.resumo_estrategico || 'Sem resumo disponível.'}</p>
      </section>

      {rec?.nome && (
        <section className="bloco rec-bloco">
          <h3 className="bloco-titulo">Plano recomendado</h3>
          <p className="rec-nome">{rec.nome === 'Sistema' ? 'Sistema Synapse' : rec.nome}</p>
          {rec.justificativa && <p className="rec-just">{rec.justificativa}</p>}
        </section>
      )}

      {pautas.length > 0 && (
        <section className="bloco">
          <h3 className="bloco-titulo">Pautas sugeridas</h3>
          <div className="pautas-lista">
            {pautas.map((p, i) => (
              <div key={i} className="pauta-card">
                <span className="pauta-plataforma">{p.plataforma}</span>
                <span className="pauta-formato">{p.formato}</span>
                <p className="pauta-tema">{p.tema}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {briefingIA?.cronograma && (
        <section className="bloco">
          <h3 className="bloco-titulo">Cronograma sugerido</h3>
          <div className="roadmap">
            <div className="roadmap-item"><span className="roadmap-marca">Semana 1</span><p>{briefingIA.cronograma.semana1}</p></div>
            <div className="roadmap-item"><span className="roadmap-marca">Semana 2</span><p>{briefingIA.cronograma.semana2}</p></div>
            <div className="roadmap-item"><span className="roadmap-marca">Semana 3</span><p>{briefingIA.cronograma.semana3}</p></div>
            <div className="roadmap-item"><span className="roadmap-marca">Semana 4</span><p>{briefingIA.cronograma.semana4}</p></div>
          </div>
        </section>
      )}

      <BlocoPrecos form={form} precificacao={precificacao} planoRecomendadoId={planoRecomendadoId} />

      <div className="acoes-relatorio">
        <button className="botao botao-secundario" onClick={onEditar}>Editar respostas</button>
        {!salvo && <button className="botao botao-primario" onClick={onSalvar} disabled={salvando}>{salvando ? <Loader2 size={16} className="girando" /> : null}{salvando ? 'Salvando…' : 'Tentar salvar de novo'}</button>}
        {salvo && <button className="botao botao-primario" onClick={onVoltar}>Voltar ao painel</button>}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState('dashboard');
  const [fichas, setFichas] = useState([]);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [form, setForm] = useState(fichaVazia);
  const [briefingIA, setBriefingIA] = useState(null);
  const [precificacao, setPrecificacao] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [pendenteSalvar, setPendenteSalvar] = useState(false);
  const [openSections, setOpenSections] = useState({ marca: true });
  const [escopoKey, setEscopoKey] = useState(0); // força os campos numéricos a mostrar o valor do plano escolhido
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(null);

  const carregarFichas = useCallback(async () => {
    setLoadingFichas(true);
    try { const r = await fetch('/api/briefings'); const j = await r.json(); setFichas(j.briefings || []); }
    catch { setFichas([]); }
    finally { setLoadingFichas(false); }
  }, []);

  useEffect(() => { carregarFichas(); }, [carregarFichas]);

  function resetForm() { setForm(fichaVazia()); setBriefingIA(null); setPrecificacao(null); setActiveId(null); setPendenteSalvar(false); setOpenSections({ marca: true }); setEscopoKey((k) => k + 1); setError(null); }
  function voltarDashboard() { resetForm(); setView('dashboard'); }
  function novaEntrevista() { resetForm(); setView('form'); }
  function toggleSecao(id) { setOpenSections(prev => ({ ...prev, [id]: !prev[id] })); }

  const updateIdent = useCallback((campo, valor) => setForm(f => ({ ...f, identificacao: { ...f.identificacao, [campo]: valor } })), []);
  const onChangeEmpresa = useCallback((v) => updateIdent('empresa', v), [updateIdent]);
  const onChangeRamo = useCallback((v) => updateIdent('ramo', v), [updateIdent]);
  const onChangeEntrevistado = useCallback((v) => updateIdent('entrevistado', v), [updateIdent]);
  const onChangeCargo = useCallback((v) => updateIdent('cargo', v), [updateIdent]);
  const onChangeTelefone = useCallback((v) => updateIdent('telefone', v), [updateIdent]);
  const onChangeEmail = useCallback((v) => updateIdent('email', v), [updateIdent]);
  const onChangeData = useCallback((v) => updateIdent('data', v), [updateIdent]);

  const updateMarca = useCallback((campo, v) => setForm(f => ({ ...f, marca: { ...f.marca, [campo]: v } })), []);
  const updatePublico = useCallback((v) => setForm(f => ({ ...f, publico: v })), []);
  const updatePautas = useCallback((v) => setForm(f => ({ ...f, pautas: v })), []);
  const updateTomRef = useCallback((v) => setForm(f => ({ ...f, tom: { ...f.tom, referencias: v } })), []);
  const updateObjetivosDet = useCallback((v) => setForm(f => ({ ...f, objetivos: { ...f.objetivos, detalhes: v } })), []);
  const updateRecursosDet = useCallback((v) => setForm(f => ({ ...f, recursos: { ...f.recursos, detalhes: v } })), []);

  function toggleChip(grupo, opcao) {
    setForm(f => {
      const atual = f[grupo].selecionados || [];
      const novo = atual.includes(opcao) ? atual.filter(o => o !== opcao) : [...atual, opcao];
      return { ...f, [grupo]: { ...f[grupo], selecionados: novo } };
    });
  }

  // Editar um número do escopo transforma o plano em "Personalizado" (só se o valor realmente mudou).
  function updateEscopo(campo, valor) {
    setForm(f => {
      if (f.escopo[campo] === valor) return f;
      return { ...f, escopo: { ...f.escopo, [campo]: valor, plano: 'personalizado' } };
    });
  }

  // Escolher um plano pronto preenche o escopo e marca os módulos que ele inclui.
  function selecionarPlano(id) {
    setForm(f => {
      if (id === 'personalizado') return { ...f, escopo: { ...f.escopo, plano: 'personalizado' } };
      return { ...f, escopo: { ...f.escopo, ...PLANOS[id].escopo, plano: id, modulos: modulosPadraoDoPlano(id) } };
    });
    setEscopoKey((k) => k + 1);
  }

  function toggleModulo(id) {
    setForm(f => {
      const atual = f.escopo.modulos || [];
      const novo = atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id];
      return { ...f, escopo: { ...f.escopo, modulos: novo } };
    });
  }

  // Salva a ficha no Supabase. Usada tanto pelo auto-save (logo após gerar)
  // quanto pelo botão manual de retry, e pelo "Salvar dados" no formulário.
  async function persistir({ formAtual, briefingAtual, precificacaoAtual }) {
    if (activeId) {
      const r = await fetch(`/api/briefings/${activeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: formAtual, briefingIA: briefingAtual, precificacao: precificacaoAtual }),
      });
      if (!r.ok) throw new Error('patch failed');
    } else {
      const r = await fetch('/api/briefings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: formAtual, briefingIA: briefingAtual, precificacao: precificacaoAtual }),
      });
      if (!r.ok) throw new Error('post failed');
      const j = await r.json();
      setActiveId(j.briefing.id);
    }
    setPendenteSalvar(false);
    await carregarFichas();
  }

  // Snapshot do cálculo: configuração do formulário + as 3 colunas dos planos prontos, centavos preservados.
  function montarPrecificacao(formAtual) {
    return { ...calcularDoFormulario(formAtual), modulos: formAtual.escopo.modulos || [], planos: calcularPlanosProntos() };
  }

  async function gerarBriefing() {
    if (!form.identificacao.empresa.trim()) { setError('Informe o nome da empresa antes de gerar o briefing.'); return; }
    if (!temAlgumaResposta(form)) { setError('Preencha pelo menos as informações da marca ou objetivos.'); return; }
    setError(null); setInfo(null); setGenerating(true);
    try {
      const res = await fetch('/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Erro ao gerar briefing.'); return; }

      const novoBriefingIA = json.briefingIA;
      const novaPrecificacao = montarPrecificacao(form); // preço SEMPRE calculado em código, nunca pela IA
      setBriefingIA(novoBriefingIA);
      setPrecificacao(novaPrecificacao);
      setView('relatorio');

      // Gerar já é salvar: a ficha aparece no painel sem um clique extra.
      try {
        await persistir({ formAtual: form, briefingAtual: novoBriefingIA, precificacaoAtual: novaPrecificacao });
      } catch {
        // O relatório continua na tela; o botão "Tentar salvar de novo" aparece.
        setPendenteSalvar(true);
      }
    } catch { setError('Não foi possível conectar ao servidor. Tente novamente.'); }
    finally { setGenerating(false); }
  }

  async function gravar({ voltarParaPainel }) {
    if (!form.identificacao.empresa.trim()) { setError('Informe o nome da empresa para salvar.'); return; }
    setSaving(true); setError(null);
    try {
      await persistir({ formAtual: form, briefingAtual: briefingIA, precificacaoAtual: precificacao });
      if (voltarParaPainel) { resetForm(); setView('dashboard'); setInfo(briefingIA ? 'Briefing salvo.' : 'Dados salvos. Você pode gerar o briefing depois.'); }
    } catch { setError('Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  }

  async function abrirFicha(item) {
    setError(null); setInfo(null);
    try {
      const res = await fetch(`/api/briefings/${item.id}`); const json = await res.json(); const salvo = json.briefing;
      // Merge profundo: ficha antiga sem plano/modulos ganha plano "personalizado" e modulos [].
      setForm(mesclar(fichaVazia(), salvo.form_data || {}));
      setBriefingIA(salvo.briefing_ia || null);
      setPrecificacao(salvo.precificacao || null);
      setActiveId(item.id); setPendenteSalvar(false); setEscopoKey((k) => k + 1);
      setView(salvo.briefing_ia ? 'relatorio' : 'form');
    } catch { setError('Não foi possível abrir este briefing.'); }
  }

  async function excluirFicha(item, e) {
    e.stopPropagation();
    try { await fetch(`/api/briefings/${item.id}`, { method: 'DELETE' }); await carregarFichas(); }
    catch { setError('Não foi possível excluir.'); }
  }

  const numeroAtual = activeId
    ? (fichas.find(f => f.id === activeId)?.numero ?? fichas.length + 1)
    : (fichas.reduce((max, f) => Math.max(max, f.numero || 0), 0) + 1);

  const avisosForm = view === 'form' ? calcularDoFormulario(form).avisos : [];

  return (
    <div className="app">

      {view === 'dashboard' && (
        <div className="tela">
          <div className="cabecalho-dashboard"><h1>Briefing IA</h1><p>Estratégia de conteúdo e precificação automática para redes sociais</p></div>
          <button className="botao botao-primario botao-nova" onClick={novaEntrevista}><Plus size={16} /> Novo briefing</button>
          {info && <div className="aviso">{info}</div>}
          {error && <div className="erro"><AlertCircle size={16} />{error}</div>}
          {!loadingFichas && fichas.length === 0 && <div className="estado-vazio"><FolderOpen size={28} /><strong>Nenhum briefing ainda</strong><span>Comece um novo briefing para gerar a primeira estratégia.</span></div>}
          {fichas.length > 0 && (
            <div className="lista-fichas">
              {fichas.map(item => (
                <div key={item.id} className="ficha-card" onClick={() => abrirFicha(item)}>
                  <div className="ficha-info">
                    <span className="ficha-numero">Nº {String(item.numero).padStart(4, '0')}</span>
                    <span className="ficha-empresa">{item.empresa || 'Sem nome'}</span>
                    <span className="ficha-meta">{item.ramo ? `${item.ramo} · ` : ''}{item.entrevistado || 'Entrevistado não informado'} · {formatarData(item.data)}</span>
                    {!item.tem_briefing && <span className="ficha-pendente">Briefing pendente</span>}
                  </div>
                  <button className="ficha-excluir" onClick={e => excluirFicha(item, e)} aria-label="Excluir"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'form' && (
        <div className="tela">
          <header className="topo">
            <button className="botao-icone" onClick={voltarDashboard}><ArrowLeft size={20} /></button>
            <span className="topo-titulo">{activeId ? 'Editar briefing' : 'Novo briefing'} · Nº {String(numeroAtual).padStart(4, '0')}</span>
          </header>

          <div className="secao">
            <div className="secao-body" style={{ paddingTop: 14 }}>
              <div className="ident-grid">
                <Campo label="Empresa / Loja" value={form.identificacao.empresa} onChange={onChangeEmpresa} placeholder="Ex: Padaria Bom Pão" />
                <Campo label="Ramo de atividade" value={form.identificacao.ramo} onChange={onChangeRamo} placeholder="Ex: Alimentação" />
                <Campo label="Nome do entrevistado" value={form.identificacao.entrevistado} onChange={onChangeEntrevistado} placeholder="Ex: Maria Silva" />
                <Campo label="Cargo / função" value={form.identificacao.cargo} onChange={onChangeCargo} placeholder="Ex: Sócia-proprietária" />
                <Campo label="Telefone / WhatsApp" value={form.identificacao.telefone} onChange={onChangeTelefone} placeholder="Ex: (11) 99999-0000" />
                <Campo label="E-mail" value={form.identificacao.email} onChange={onChangeEmail} placeholder="Opcional" />
                <Campo label="Data" type="date" value={form.identificacao.data} onChange={onChangeData} />
              </div>
            </div>
          </div>

          {/* 02 — Marca */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('marca')}>
              <span className="secao-numero">02</span><span className="secao-titulo">Sobre a marca</span>
              {openSections.marca ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.marca && (
              <div className="secao-body">
                <label className="campo-grupo"><span className="campo-pergunta">O que a marca faz e como se posiciona?</span>
                  <CampoTextArea value={form.marca.descricao} onChange={(v) => updateMarca('descricao', v)} placeholder="Descreva o negócio, produtos/serviços..." />
                </label>
                <label className="campo-grupo"><span className="campo-pergunta">Diferenciais e concorrentes de referência</span>
                  <CampoTextArea value={form.marca.diferenciais} onChange={(v) => updateMarca('diferenciais', v)} rows={3} placeholder="O que diferencia a marca? Quais concorrentes usar de referência?" />
                </label>
              </div>
            )}
          </div>

          {/* 03 — Objetivos */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('objetivos')}>
              <span className="secao-numero">03</span><span className="secao-titulo">Objetivos com redes sociais</span>
              {openSections.objetivos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.objetivos && (
              <div className="secao-body">
                <div className="campo-grupo">
                  <span className="campo-pergunta">Selecione os objetivos principais</span>
                  <div className="chips">
                    {OBJETIVOS_OPCOES.map(op => (
                      <button key={op} type="button" className={`chip${form.objetivos.selecionados.includes(op) ? ' chip-ativo' : ''}`} onClick={() => toggleChip('objetivos', op)}>{op}</button>
                    ))}
                  </div>
                </div>
                <label className="campo-grupo"><span className="campo-pergunta">Detalhes</span>
                  <CampoTextArea value={form.objetivos.detalhes} onChange={updateObjetivosDet} rows={3} placeholder="Alguma meta específica ou contexto adicional?" />
                </label>
              </div>
            )}
          </div>

          {/* 04 — Público */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('publico')}>
              <span className="secao-numero">04</span><span className="secao-titulo">Público-alvo</span>
              {openSections.publico ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.publico && (
              <div className="secao-body">
                <CampoTextArea value={form.publico} onChange={updatePublico} placeholder="Idade, gênero predominante, interesses, dores, onde estão..." />
              </div>
            )}
          </div>

          {/* 05 — Tom de voz */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('tom')}>
              <span className="secao-numero">05</span><span className="secao-titulo">Tom de voz e identidade</span>
              {openSections.tom ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.tom && (
              <div className="secao-body">
                <div className="campo-grupo">
                  <span className="campo-pergunta">Tom de voz desejado</span>
                  <div className="chips">
                    {TOM_OPCOES.map(op => (
                      <button key={op} type="button" className={`chip${form.tom.selecionados.includes(op) ? ' chip-ativo' : ''}`} onClick={() => toggleChip('tom', op)}>{op}</button>
                    ))}
                  </div>
                </div>
                <label className="campo-grupo"><span className="campo-pergunta">Referências visuais ou de tom</span>
                  <CampoTextArea value={form.tom.referencias} onChange={updateTomRef} rows={3} placeholder="Perfis, marcas ou exemplos de referência..." />
                </label>
              </div>
            )}
          </div>

          {/* 06 — Escopo do pacote (dirige a precificação) */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('escopo')}>
              <span className="secao-numero">06</span><span className="secao-titulo">Escopo do pacote</span>
              <span className="secao-etiqueta">precifica</span>
              {openSections.escopo ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.escopo && (
              <div className="secao-body">
                <div className="campo-grupo">
                  <span className="campo-pergunta">Plano</span>
                  <div className="chips">
                    {PLANOS_ORDEM.map((id) => (
                      <button key={id} type="button" className={`chip${(form.escopo.plano || 'personalizado') === id ? ' chip-ativo' : ''}`} onClick={() => selecionarPlano(id)}>
                        {id === 'sistema' ? 'Sistema' : PLANOS[id].nome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="escopo-grid" key={escopoKey}>
                  <CampoNumero label="Posts feed/mês" value={form.escopo.postsFeeds} onChange={(v) => updateEscopo('postsFeeds', v)} />
                  <CampoNumero label="Stories/mês" value={form.escopo.stories} onChange={(v) => updateEscopo('stories', v)} />
                  <CampoNumero label="Reels/mês" value={form.escopo.reels} onChange={(v) => updateEscopo('reels', v)} />
                  <CampoNumero label="Artes avulsas/mês" value={form.escopo.artesAvulsas} onChange={(v) => updateEscopo('artesAvulsas', v)} />
                  <CampoNumero label="Nº de plataformas" value={form.escopo.plataformas} onChange={(v) => updateEscopo('plataformas', v)} min={1} />
                  <CampoNumero label="Duração do contrato (meses)" value={form.escopo.duracaoMeses} onChange={(v) => updateEscopo('duracaoMeses', v)} min={1} />
                </div>

                <div className="campo-grupo">
                  <span className="campo-pergunta">Módulos</span>
                  <div className="modulos-lista">
                    {MODULOS_ORDEM.map((id) => (
                      <label key={id} className="modulo-item">
                        <input type="checkbox" checked={(form.escopo.modulos || []).includes(id)} onChange={() => toggleModulo(id)} />
                        <span>{MODULOS[id].nome}</span>
                        <span className="modulo-valor">{formatarReais(MODULOS[id].valor)}/mês</span>
                      </label>
                    ))}
                  </div>
                </div>

                {avisosForm.map((a) => (
                  <div key={a} className="aviso-interno"><b>Aviso interno</b>{a}</div>
                ))}
              </div>
            )}
          </div>

          {/* 07 — Pautas */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('pautas')}>
              <span className="secao-numero">07</span><span className="secao-titulo">Pautas e temas</span>
              {openSections.pautas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.pautas && (
              <div className="secao-body">
                <CampoTextArea value={form.pautas} onChange={updatePautas} placeholder="O que pode e o que não pode ser abordado? Temas prioritários?" />
              </div>
            )}
          </div>

          {/* 08 — Recursos */}
          <div className="secao">
            <button className="secao-header" onClick={() => toggleSecao('recursos')}>
              <span className="secao-numero">08</span><span className="secao-titulo">Recursos disponíveis</span>
              {openSections.recursos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openSections.recursos && (
              <div className="secao-body">
                <div className="chips">
                  {RECURSOS_OPCOES.map(op => (
                    <button key={op} type="button" className={`chip${form.recursos.selecionados.includes(op) ? ' chip-ativo' : ''}`} onClick={() => toggleChip('recursos', op)}>{op}</button>
                  ))}
                </div>
                <label className="campo-grupo" style={{ marginTop: 10 }}><span className="campo-pergunta">Detalhes</span>
                  <CampoTextArea value={form.recursos.detalhes} onChange={updateRecursosDet} rows={3} placeholder="Observações sobre materiais disponíveis..." />
                </label>
              </div>
            )}
          </div>

          {error && <div className="erro erro-bloco"><AlertCircle size={16} /><span>{error}</span></div>}

          <div className="acoes-form">
            <button className="botao botao-secundario" onClick={() => gravar({ voltarParaPainel: true })} disabled={saving || generating}>{saving ? <Loader2 size={16} className="girando" /> : null}{saving ? 'Salvando…' : 'Salvar dados'}</button>
            <button className="botao botao-primario" onClick={gerarBriefing} disabled={generating || saving}>{generating ? <Loader2 size={16} className="girando" /> : <Sparkles size={16} />}{generating ? 'Gerando briefing…' : 'Gerar briefing'}</button>
          </div>
        </div>
      )}

      {view === 'relatorio' && briefingIA && (
        <Relatorio form={form} briefingIA={briefingIA} precificacao={precificacao} numero={numeroAtual}
          salvo={!!activeId && !pendenteSalvar} salvando={saving}
          onVoltar={() => activeId ? voltarDashboard() : setView('form')} onEditar={() => setView('form')} onSalvar={() => gravar({ voltarParaPainel: false })} />
      )}
    </div>
  );
}
