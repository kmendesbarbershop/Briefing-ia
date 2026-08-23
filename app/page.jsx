'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, ArrowLeft, ChevronDown, ChevronUp, Loader2, Trash2, Sparkles, AlertCircle, FolderOpen, Printer, Download, Upload } from 'lucide-react';

// ─── Motor de precificação (espelha a planilha) ────────────────────────────────

const VALORES_BASE = {
  postFeed: 35, storyAvulso: 10, reelsEditado: 60, arteAvulsa: 25,
  gestaoPrimeiraPlataforma: 100, plataformaAdicional: 150,
};
const REGRAS_DESCONTO = {
  descontoPlataformasAdicionais: 0.10, limitePostsVolume: 20, descontoVolume: 0.10,
  duracaoMinSemestral: 6, descontoSemestral: 0.05, duracaoMinAnual: 12, descontoAnual: 0.10,
};
const MARGEM_NEGOCIACAO = 0.05;

function calcularPrecificacao(escopo) {
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
  if (duracaoMeses >= REGRAS_DESCONTO.duracaoMinAnual) { percentualDescontoContrato = REGRAS_DESCONTO.descontoAnual; tipoContrato = 'anual'; }
  else if (duracaoMeses >= REGRAS_DESCONTO.duracaoMinSemestral) { percentualDescontoContrato = REGRAS_DESCONTO.descontoSemestral; tipoContrato = 'semestral'; }
  const valorFinalSemMargem = subtotal * (1 - percentualDescontoContrato);
  const valorFinalComMargem = valorFinalSemMargem * (1 + MARGEM_NEGOCIACAO);
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    postsFeeds: { qtd: postsFeeds, valor: r2(valorPostsFeeds) },
    stories: { qtd: stories, valor: valorStories },
    reels: { qtd: reels, valor: valorReels },
    artesAvulsas: { qtd: artesAvulsas, valor: valorArtesAvulsas },
    gestaoPlataformas: { qtd: plataformas, valor: r2(valorGestaoPlataformas) },
    descontoVolumeAplicado, valorDescontoVolume: r2(valorDescontoVolume),
    subtotal: r2(subtotal), percentualDescontoContrato, tipoContrato,
    valorFinalSemMargem: r2(valorFinalSemMargem), valorFinalComMargem: r2(valorFinalComMargem),
  };
}

const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Componentes de campo — mobile-safe (defaultValue + onBlur) ────────────────

const Campo = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <label className="campo">
    <span className="campo-label">{label}</span>
    <input className="campo-input" type={type} defaultValue={value} placeholder={placeholder} onBlur={(e)=>onChange(e.target.value)} />
  </label>
);

const CampoNumero = ({ label, value, onChange, min = 0 }) => (
  <label className="campo">
    <span className="campo-label">{label}</span>
    <input className="campo-numero" type="number" min={min} defaultValue={value} onBlur={(e)=>onChange(Math.max(min, parseInt(e.target.value,10)||0))} />
  </label>
);

const CampoTextArea = ({ value, onChange, placeholder, rows=4 }) => (
  <textarea className="notas-input" placeholder={placeholder} defaultValue={value} onBlur={(e)=>onChange(e.target.value)} rows={rows} />
);

// ─── Dados do formulário ────────────────────────────────────────────────────────

const OBJETIVOS_OPCOES = ['Vendas diretas','Reconhecimento de marca','Engajamento/comunidade','Geração de leads','Educar o público','Fidelizar clientes'];
const TOM_OPCOES = ['Descontraído','Formal/corporativo','Divertido/humor','Inspirador','Técnico/educativo','Provocador'];
const RECURSOS_OPCOES = ['Fotos próprias disponíveis','Vídeos próprios disponíveis','Precisa de produção de fotos','Precisa de produção de vídeos','Já tem banco de imagens/identidade visual'];

const hoje = () => new Date().toISOString().slice(0,10);

const fichaVazia = () => ({
  identificacao: { empresa:'', ramo:'', entrevistado:'', cargo:'', telefone:'', email:'', data:hoje() },
  marca: { descricao:'', diferenciais:'' },
  objetivos: { selecionados:[], detalhes:'' },
  publico: '',
  tom: { selecionados:[], referencias:'' },
  escopo: { postsFeeds:8, stories:8, reels:2, artesAvulsas:0, plataformas:1, duracaoMeses:1 },
  pautas: '',
  recursos: { selecionados:[], detalhes:'' },
});

const formatarData = (iso) => { if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };

const temAlgumaResposta = (form) => {
  return !!(form.marca?.descricao?.trim() || form.publico?.trim() || form.pautas?.trim() || (form.objetivos?.selecionados||[]).length>0);
};

// ─── Relatório ────────────────────────────────────────────────────────────────

function Relatorio({ form, briefingIA, precificacao, numero, salvo, salvando, onVoltar, onEditar, onSalvar }) {
  const { identificacao } = form;
  const pautas = briefingIA?.pautas_sugeridas || [];
  return (
    <div className="tela">
      <header className="topo">
        <button className="botao-icone" onClick={onVoltar}><ArrowLeft size={20}/></button>
        <span className="topo-titulo">Briefing gerado</span>
      </header>
      <div className="relatorio-header">
        <div className="selo">
          <span className="selo-texto">Briefing</span>
          <span className="selo-numero">Nº {String(numero).padStart(4,'0')}</span>
          <span className="selo-data">{formatarData(identificacao.data)}</span>
        </div>
        <div className="relatorio-info">
          <h2>{identificacao.empresa||'Empresa sem nome'}</h2>
          {identificacao.ramo && <p className="tag-ramo">{identificacao.ramo}</p>}
          <p className="tag-entrevistado">{identificacao.entrevistado||'Entrevistado não informado'}{identificacao.cargo?` · ${identificacao.cargo}`:''}</p>
        </div>
      </div>

      <section className="bloco">
        <h3 className="bloco-titulo">Resumo estratégico</h3>
        <p className="resumo-texto">{briefingIA?.resumo_estrategico||'Sem resumo disponível.'}</p>
      </section>

      {pautas.length > 0 && (
        <section className="bloco">
          <h3 className="bloco-titulo">Pautas sugeridas</h3>
          <div className="pautas-lista">
            {pautas.map((p,i)=>(
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

      {precificacao && (
        <section className="bloco">
          <h3 className="bloco-titulo">Estimativa de valor</h3>
          <div className="preco-destaque">
            <span className="preco-label">Valor mensal proposto</span>
            <span className="preco-valor">{formatarMoeda(precificacao.valorFinalComMargem)}</span>
            <span className="preco-periodo">{form.escopo.duracaoMeses}x · contrato {precificacao.tipoContrato}</span>
          </div>
          <div className="memoria-calculo" style={{marginTop:10}}>
            <div className="memoria-linha"><span>Posts feed ({precificacao.postsFeeds.qtd}x)</span><span>{formatarMoeda(precificacao.postsFeeds.valor)}</span></div>
            <div className="memoria-linha"><span>Stories ({precificacao.stories.qtd}x)</span><span>{formatarMoeda(precificacao.stories.valor)}</span></div>
            <div className="memoria-linha"><span>Reels ({precificacao.reels.qtd}x)</span><span>{formatarMoeda(precificacao.reels.valor)}</span></div>
            {precificacao.artesAvulsas.qtd > 0 && <div className="memoria-linha"><span>Artes avulsas ({precificacao.artesAvulsas.qtd}x)</span><span>{formatarMoeda(precificacao.artesAvulsas.valor)}</span></div>}
            <div className="memoria-linha"><span>Gestão de plataformas ({precificacao.gestaoPlataformas.qtd}x)</span><span>{formatarMoeda(precificacao.gestaoPlataformas.valor)}</span></div>
          </div>
        </section>
      )}

      <div className="acoes-relatorio">
        <button className="botao botao-secundario" onClick={onEditar}>Editar respostas</button>
        {!salvo && <button className="botao botao-primario" onClick={onSalvar} disabled={salvando}>{salvando?<Loader2 size={16} className="girando"/>:null}{salvando?'Salvando…':'Salvar briefing'}</button>}
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(null);

  const carregarFichas = useCallback(async () => {
    setLoadingFichas(true);
    try { const r = await fetch('/api/briefings'); const j = await r.json(); setFichas(j.briefings||[]); }
    catch { setFichas([]); }
    finally { setLoadingFichas(false); }
  }, []);

  useEffect(() => { carregarFichas(); }, [carregarFichas]);

  function resetForm() { setForm(fichaVazia()); setBriefingIA(null); setPrecificacao(null); setActiveId(null); setPendenteSalvar(false); setOpenSections({marca:true}); setError(null); }
  function voltarDashboard() { resetForm(); setView('dashboard'); }
  function novaEntrevista() { resetForm(); setView('form'); }
  function toggleSecao(id) { setOpenSections(prev=>({...prev,[id]:!prev[id]})); }

  const updateIdent = useCallback((campo, valor) => setForm(f=>({...f,identificacao:{...f.identificacao,[campo]:valor}})), []);
  const onChangeEmpresa = useCallback((v)=>updateIdent('empresa',v),[updateIdent]);
  const onChangeRamo = useCallback((v)=>updateIdent('ramo',v),[updateIdent]);
  const onChangeEntrevistado = useCallback((v)=>updateIdent('entrevistado',v),[updateIdent]);
  const onChangeCargo = useCallback((v)=>updateIdent('cargo',v),[updateIdent]);
  const onChangeTelefone = useCallback((v)=>updateIdent('telefone',v),[updateIdent]);
  const onChangeEmail = useCallback((v)=>updateIdent('email',v),[updateIdent]);
  const onChangeData = useCallback((v)=>updateIdent('data',v),[updateIdent]);

  const updateMarca = useCallback((campo,v)=>setForm(f=>({...f,marca:{...f.marca,[campo]:v}})),[]);
  const updatePublico = useCallback((v)=>setForm(f=>({...f,publico:v})),[]);
  const updatePautas = useCallback((v)=>setForm(f=>({...f,pautas:v})),[]);
  const updateTomRef = useCallback((v)=>setForm(f=>({...f,tom:{...f.tom,referencias:v}})),[]);
  const updateObjetivosDet = useCallback((v)=>setForm(f=>({...f,objetivos:{...f.objetivos,detalhes:v}})),[]);
  const updateRecursosDet = useCallback((v)=>setForm(f=>({...f,recursos:{...f.recursos,detalhes:v}})),[]);

  function toggleChip(grupo, opcao) {
    setForm(f=>{
      const atual = f[grupo].selecionados||[];
      const novo = atual.includes(opcao) ? atual.filter(o=>o!==opcao) : [...atual,opcao];
      return {...f,[grupo]:{...f[grupo],selecionados:novo}};
    });
  }

  function updateEscopo(campo, valor) {
    setForm(f=>({...f,escopo:{...f.escopo,[campo]:valor}}));
  }

  async function gerarBriefing() {
    if(!form.identificacao.empresa.trim()){setError('Informe o nome da empresa antes de gerar o briefing.');return;}
    if(!temAlgumaResposta(form)){setError('Preencha pelo menos as informações da marca ou objetivos.');return;}
    setError(null);setInfo(null);setGenerating(true);
    try {
      const res = await fetch('/api/briefing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({form})});
      const json = await res.json();
      if(!res.ok){setError(json.error||'Erro ao gerar briefing.');return;}
      setBriefingIA(json.briefingIA);
      setPrecificacao(calcularPrecificacao(form.escopo));
      setPendenteSalvar(true);setView('relatorio');
    } catch { setError('Não foi possível conectar ao servidor. Tente novamente.'); }
    finally { setGenerating(false); }
  }

  async function gravar({voltarParaPainel}) {
    if(!form.identificacao.empresa.trim()){setError('Informe o nome da empresa para salvar.');return;}
    setSaving(true);setError(null);
    try {
      if(activeId){
        const res=await fetch(`/api/briefings/${activeId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({form,briefingIA,precificacao})});
        if(!res.ok) throw new Error();
      } else {
        const res=await fetch('/api/briefings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({form,briefingIA,precificacao})});
        if(!res.ok) throw new Error();
        const json=await res.json();setActiveId(json.briefing.id);
      }
      setPendenteSalvar(false);await carregarFichas();
      if(voltarParaPainel){resetForm();setView('dashboard');setInfo(briefingIA?'Briefing salvo.':'Dados salvos. Você pode gerar o briefing depois.');}
    } catch { setError('Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  }

  async function abrirFicha(item) {
    setError(null);setInfo(null);
    try {
      const res=await fetch(`/api/briefings/${item.id}`);const json=await res.json();const salvo=json.briefing;
      const base=fichaVazia();const f=salvo.form_data||{};
      setForm({...base,...f});
      setBriefingIA(salvo.briefing_ia||null);
      setPrecificacao(salvo.precificacao||null);
      setActiveId(item.id);setPendenteSalvar(false);
      setView(salvo.briefing_ia?'relatorio':'form');
    } catch { setError('Não foi possível abrir este briefing.'); }
  }

  async function excluirFicha(item, e) {
    e.stopPropagation();
    try { await fetch(`/api/briefings/${item.id}`,{method:'DELETE'});await carregarFichas(); }
    catch { setError('Não foi possível excluir.'); }
  }

  const numeroAtual = activeId
    ? (fichas.find(f=>f.id===activeId)?.numero??fichas.length+1)
    : (fichas.reduce((max,f)=>Math.max(max,f.numero||0),0)+1);

  return (
    <div className="app">

      {view==='dashboard' && (
        <div className="tela">
          <div className="cabecalho-dashboard"><h1>Briefing IA</h1><p>Estratégia de conteúdo e precificação automática para redes sociais</p></div>
          <button className="botao botao-primario botao-nova" onClick={novaEntrevista}><Plus size={16}/> Novo briefing</button>
          {info && <div className="aviso">{info}</div>}
          {error && <div className="erro"><AlertCircle size={16}/>{error}</div>}
          {!loadingFichas&&fichas.length===0 && <div className="estado-vazio"><FolderOpen size={28}/><strong>Nenhum briefing ainda</strong><span>Comece um novo briefing para gerar a primeira estratégia.</span></div>}
          {fichas.length>0 && (
            <div className="lista-fichas">
              {fichas.map(item=>(
                <div key={item.id} className="ficha-card" onClick={()=>abrirFicha(item)}>
                  <div className="ficha-info">
                    <span className="ficha-numero">Nº {String(item.numero).padStart(4,'0')}</span>
                    <span className="ficha-empresa">{item.empresa||'Sem nome'}</span>
                    <span className="ficha-meta">{item.ramo?`${item.ramo} · `:''}{item.entrevistado||'Entrevistado não informado'} · {formatarData(item.data)}</span>
                    {!item.tem_briefing && <span className="ficha-pendente">Briefing pendente</span>}
                  </div>
                  <button className="ficha-excluir" onClick={e=>excluirFicha(item,e)} aria-label="Excluir"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view==='form' && (
        <div className="tela">
          <header className="topo">
            <button className="botao-icone" onClick={voltarDashboard}><ArrowLeft size={20}/></button>
            <span className="topo-titulo">{activeId?'Editar briefing':'Novo briefing'} · Nº {String(numeroAtual).padStart(4,'0')}</span>
          </header>

          <div className="secao">
            <div className="secao-body" style={{paddingTop:14}}>
              <div className="ident-grid">
                <Campo label="Empresa / Loja" value={form.identificacao.empresa} onChange={onChangeEmpresa} placeholder="Ex: Padaria Bom Pão"/>
                <Campo label="Ramo de atividade" value={form.identificacao.ramo} onChange={onChangeRamo} placeholder="Ex: Alimentação"/>
                <Campo label="Nome do entrevistado" value={form.identificacao.entrevistado} onChange={onChangeEntrevistado} placeholder="Ex: Maria Silva"/>
                <Campo label="Cargo / função" value={form.identificacao.cargo} onChange={onChangeCargo} placeholder="Ex: Sócia-proprietária"/>
                <Campo label="Telefone / WhatsApp" value={form.identificacao.telefone} onChange={onChangeTelefone} placeholder="Ex: (11) 99999-0000"/>
                <Campo label="E-mail" value={form.identificacao.email} onChange={onChangeEmail} placeholder="Opcional"/>
                <Campo label="Data" type="date" value={form.identificacao.data} onChange={onChangeData}/>
              </div>
            </div>
          </div>

          {/* 02 — Marca */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('marca')}>
              <span className="secao-numero">02</span><span className="secao-titulo">Sobre a marca</span>
              {openSections.marca?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.marca && (
              <div className="secao-body">
                <label className="campo-grupo"><span className="campo-pergunta">O que a marca faz e como se posiciona?</span>
                  <CampoTextArea value={form.marca.descricao} onChange={(v)=>updateMarca('descricao',v)} placeholder="Descreva o negócio, produtos/serviços..."/>
                </label>
                <label className="campo-grupo"><span className="campo-pergunta">Diferenciais e concorrentes de referência</span>
                  <CampoTextArea value={form.marca.diferenciais} onChange={(v)=>updateMarca('diferenciais',v)} rows={3} placeholder="O que diferencia a marca? Quais concorrentes usar de referência?"/>
                </label>
              </div>
            )}
          </div>

          {/* 03 — Objetivos */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('objetivos')}>
              <span className="secao-numero">03</span><span className="secao-titulo">Objetivos com redes sociais</span>
              {openSections.objetivos?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.objetivos && (
              <div className="secao-body">
                <div className="campo-grupo">
                  <span className="campo-pergunta">Selecione os objetivos principais</span>
                  <div className="chips">
                    {OBJETIVOS_OPCOES.map(op=>(
                      <button key={op} type="button" className={`chip${form.objetivos.selecionados.includes(op)?' chip-ativo':''}`} onClick={()=>toggleChip('objetivos',op)}>{op}</button>
                    ))}
                  </div>
                </div>
                <label className="campo-grupo"><span className="campo-pergunta">Detalhes</span>
                  <CampoTextArea value={form.objetivos.detalhes} onChange={updateObjetivosDet} rows={3} placeholder="Alguma meta específica ou contexto adicional?"/>
                </label>
              </div>
            )}
          </div>

          {/* 04 — Público */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('publico')}>
              <span className="secao-numero">04</span><span className="secao-titulo">Público-alvo</span>
              {openSections.publico?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.publico && (
              <div className="secao-body">
                <CampoTextArea value={form.publico} onChange={updatePublico} placeholder="Idade, gênero predominante, interesses, dores, onde estão..."/>
              </div>
            )}
          </div>

          {/* 05 — Tom de voz */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('tom')}>
              <span className="secao-numero">05</span><span className="secao-titulo">Tom de voz e identidade</span>
              {openSections.tom?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.tom && (
              <div className="secao-body">
                <div className="campo-grupo">
                  <span className="campo-pergunta">Tom de voz desejado</span>
                  <div className="chips">
                    {TOM_OPCOES.map(op=>(
                      <button key={op} type="button" className={`chip${form.tom.selecionados.includes(op)?' chip-ativo':''}`} onClick={()=>toggleChip('tom',op)}>{op}</button>
                    ))}
                  </div>
                </div>
                <label className="campo-grupo"><span className="campo-pergunta">Referências visuais ou de tom</span>
                  <CampoTextArea value={form.tom.referencias} onChange={updateTomRef} rows={3} placeholder="Perfis, marcas ou exemplos de referência..."/>
                </label>
              </div>
            )}
          </div>

          {/* 06 — Escopo do pacote (dirige a precificação) */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('escopo')}>
              <span className="secao-numero">06</span><span className="secao-titulo">Escopo do pacote</span>
              <span className="secao-etiqueta">precifica</span>
              {openSections.escopo?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.escopo && (
              <div className="secao-body">
                <div className="escopo-grid">
                  <CampoNumero label="Posts feed/mês" value={form.escopo.postsFeeds} onChange={(v)=>updateEscopo('postsFeeds',v)}/>
                  <CampoNumero label="Stories/mês" value={form.escopo.stories} onChange={(v)=>updateEscopo('stories',v)}/>
                  <CampoNumero label="Reels/mês" value={form.escopo.reels} onChange={(v)=>updateEscopo('reels',v)}/>
                  <CampoNumero label="Artes avulsas/mês" value={form.escopo.artesAvulsas} onChange={(v)=>updateEscopo('artesAvulsas',v)}/>
                  <CampoNumero label="Nº de plataformas" value={form.escopo.plataformas} onChange={(v)=>updateEscopo('plataformas',v)} min={1}/>
                  <CampoNumero label="Duração do contrato (meses)" value={form.escopo.duracaoMeses} onChange={(v)=>updateEscopo('duracaoMeses',v)} min={1}/>
                </div>
              </div>
            )}
          </div>

          {/* 07 — Pautas */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('pautas')}>
              <span className="secao-numero">07</span><span className="secao-titulo">Pautas e temas</span>
              {openSections.pautas?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.pautas && (
              <div className="secao-body">
                <CampoTextArea value={form.pautas} onChange={updatePautas} placeholder="O que pode e o que não pode ser abordado? Temas prioritários?"/>
              </div>
            )}
          </div>

          {/* 08 — Recursos */}
          <div className="secao">
            <button className="secao-header" onClick={()=>toggleSecao('recursos')}>
              <span className="secao-numero">08</span><span className="secao-titulo">Recursos disponíveis</span>
              {openSections.recursos?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {openSections.recursos && (
              <div className="secao-body">
                <div className="chips">
                  {RECURSOS_OPCOES.map(op=>(
                    <button key={op} type="button" className={`chip${form.recursos.selecionados.includes(op)?' chip-ativo':''}`} onClick={()=>toggleChip('recursos',op)}>{op}</button>
                  ))}
                </div>
                <label className="campo-grupo" style={{marginTop:10}}><span className="campo-pergunta">Detalhes</span>
                  <CampoTextArea value={form.recursos.detalhes} onChange={updateRecursosDet} rows={3} placeholder="Observações sobre materiais disponíveis..."/>
                </label>
              </div>
            )}
          </div>

          {error && <div className="erro erro-bloco"><AlertCircle size={16}/><span>{error}</span></div>}

          <div className="acoes-form">
            <button className="botao botao-secundario" onClick={()=>gravar({voltarParaPainel:true})} disabled={saving||generating}>{saving?<Loader2 size={16} className="girando"/>:null}{saving?'Salvando…':'Salvar dados'}</button>
            <button className="botao botao-primario" onClick={gerarBriefing} disabled={generating||saving}>{generating?<Loader2 size={16} className="girando"/>:<Sparkles size={16}/>}{generating?'Gerando briefing…':'Gerar briefing'}</button>
          </div>
        </div>
      )}

      {view==='relatorio'&&briefingIA && (
        <Relatorio form={form} briefingIA={briefingIA} precificacao={precificacao} numero={numeroAtual}
          salvo={!!activeId&&!pendenteSalvar} salvando={saving}
          onVoltar={()=>activeId?voltarDashboard():setView('form')} onEditar={()=>setView('form')} onSalvar={()=>gravar({voltarParaPainel:false})}/>
      )}
    </div>
  );
}
