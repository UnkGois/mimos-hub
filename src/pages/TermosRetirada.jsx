import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlineClipboardCheck,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlinePencilAlt,
  HiOutlineSearch,
  HiOutlineFilter,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineDownload,
  HiOutlineChatAlt2,
  HiOutlineTrash,
  HiOutlineExclamation,
  HiOutlineRefresh,
  HiOutlineBan,
  HiOutlineUserAdd,
  HiOutlinePlus,
} from 'react-icons/hi'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ErrorState from '../components/ErrorState'
import { useToast } from '../components/Toast'
import * as termoService from '../services/termoService'
import * as garantiaService from '../services/garantiaService'
import TermoEscolhaModal from '../components/TermoEscolhaModal'
import TermoRetiradaModal from '../components/TermoRetiradaModal'
import SignaturePad from '../components/SignaturePad'

const PER_PAGE = 20

const formatDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

const statusConfig = {
  Pendente: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: HiOutlineClock, label: 'Pendente' },
  AguardandoOperador: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: HiOutlinePencilAlt, label: 'Aguardando' },
  Concluido: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: HiOutlineCheckCircle, label: 'Concluído' },
  Expirado: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: HiOutlineBan, label: 'Expirado' },
}

const tipoLabel = {
  presencial: 'Presencial',
  whatsapp: 'WhatsApp',
  terceiro: 'Terceiro',
}

const tipoIcon = {
  presencial: HiOutlinePencilAlt,
  whatsapp: HiOutlineChatAlt2,
  terceiro: HiOutlineUserAdd,
}

const gridCols = 'grid grid-cols-[1fr_1fr_120px_120px_100px_120px]'

const TermosRetirada = () => {
  const toast = useToast()

  // Dados
  const [termos, setTermos] = useState([])
  const [total, setTotal] = useState(0)
  const [metricas, setMetricas] = useState({ total: 0, concluidos: 0, aguardando: 0 })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  // Filtros
  const [filtros, setFiltros] = useState({ nome: '', status: '' })
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [pagina, setPagina] = useState(1)

  // Modais
  const [excluirConfirm, setExcluirConfirm] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [assinarTermo, setAssinarTermo] = useState(null) // termo aguardando assinatura do operador
  const [assinando, setAssinando] = useState(false)

  // Novo Termo flow
  const [novoTermoStep, setNovoTermoStep] = useState(null) // null | 'select_garantia' | 'escolha' | 'presencial'
  const [garantias, setGarantias] = useState([])
  const [garantiasLoading, setGarantiasLoading] = useState(false)
  const [garantiaSelecionada, setGarantiaSelecionada] = useState(null)
  const [garantiaBusca, setGarantiaBusca] = useState('')
  const [termoTipoFluxo, setTermoTipoFluxo] = useState('presencial')

  // Carregar termos
  const carregarTermos = useCallback(async (pag = 1, filtrosAtivos = {}) => {
    setLoading(true)
    setErro(null)
    try {
      const params = {
        skip: (pag - 1) * PER_PAGE,
        limit: PER_PAGE,
      }
      if (filtrosAtivos.nome) params.nome = filtrosAtivos.nome
      if (filtrosAtivos.status) params.status = filtrosAtivos.status

      const data = await termoService.listarTodos(params)
      setTermos(data.items || [])
      setTotal(data.total || 0)
    } catch {
      setErro('Não foi possível carregar os termos.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carregar métricas
  const carregarMetricas = useCallback(async () => {
    try {
      const data = await termoService.obterMetricas()
      setMetricas(data)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    carregarTermos(1, {})
    carregarMetricas()
  }, [carregarTermos, carregarMetricas])

  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE))
  const paginaAtual = Math.min(pagina, totalPaginas)

  const buscar = () => {
    setPagina(1)
    carregarTermos(1, filtros)
  }

  const limpar = () => {
    setFiltros({ nome: '', status: '' })
    setPagina(1)
    carregarTermos(1, {})
  }

  const mudarPagina = (novaPag) => {
    setPagina(novaPag)
    carregarTermos(novaPag, filtros)
  }

  // Download PDF
  const handleDownloadPDF = async (termoId) => {
    try {
      await termoService.downloadPDF(termoId)
    } catch {
      toast.error('Erro ao baixar PDF.')
    }
  }

  // Enviar WhatsApp
  const handleEnviarWhatsApp = async (termoId) => {
    try {
      await termoService.enviarWhatsApp(termoId)
      toast.success('Termo enviado via WhatsApp!')
    } catch {
      toast.error('Erro ao enviar via WhatsApp.')
    }
  }

  // Excluir
  const handleExcluir = async () => {
    if (!excluirConfirm) return
    setExcluindo(true)
    try {
      await termoService.excluir(excluirConfirm.id)
      toast.success('Termo excluído com sucesso!')
      setExcluirConfirm(null)
      carregarTermos(pagina, filtros)
      carregarMetricas()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erro ao excluir termo.'
      toast.error(msg)
    } finally {
      setExcluindo(false)
    }
  }

  // Assinar como operador
  const handleAssinarOperador = async (base64) => {
    if (!assinarTermo) return
    setAssinando(true)
    try {
      await termoService.assinarOperador(assinarTermo.id, base64)
      toast.success('Termo assinado e enviado via WhatsApp!')
      setAssinarTermo(null)
      carregarTermos(pagina, filtros)
      carregarMetricas()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erro ao assinar termo.'
      toast.error(msg)
    } finally {
      setAssinando(false)
    }
  }

  // Carregar garantias ativas na tela
  const carregarGarantias = useCallback(async () => {
    setGarantiasLoading(true)
    try {
      const data = await garantiaService.listar({ limit: 50, status: 'Ativa' })
      setGarantias(data.items || [])
    } catch { /* silencioso */ }
    finally { setGarantiasLoading(false) }
  }, [])

  useEffect(() => { carregarGarantias() }, [carregarGarantias])

  const handleNovoTermo = (g) => {
    setGarantiaSelecionada(g)
    setNovoTermoStep('escolha')
  }

  const handleEscolhaTipo = async (tipo) => {
    if (tipo === 'presencial' || tipo === 'terceiro') {
      setNovoTermoStep('presencial')
      setTermoTipoFluxo(tipo)
    } else if (tipo === 'whatsapp') {
      try {
        await termoService.criar({ garantia_id: garantiaSelecionada.id, tipo_fluxo: 'whatsapp' })
        toast.success('Link de assinatura enviado via WhatsApp!')
        setNovoTermoStep(null)
        carregarTermos(pagina, filtros)
        carregarMetricas()
      } catch (err) {
        const msg = err?.response?.data?.detail || 'Erro ao enviar link.'
        toast.error(msg)
      }
    }
  }

  const handleTermoConcluido = () => {
    setNovoTermoStep(null)
    carregarTermos(pagina, filtros)
    carregarMetricas()
  }

  // Escape handler
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (assinarTermo && !assinando) setAssinarTermo(null)
        else if (excluirConfirm) setExcluirConfirm(null)
        else if (novoTermoStep === 'presencial') setNovoTermoStep('escolha')
        else if (novoTermoStep === 'escolha') setNovoTermoStep(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [excluirConfirm, novoTermoStep, assinarTermo, assinando])

  const gerarPaginas = () => {
    const pages = []
    const max = 5
    let start = Math.max(1, paginaAtual - Math.floor(max / 2))
    let end = Math.min(totalPaginas, start + max - 1)
    if (end - start < max - 1) start = Math.max(1, end - max + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const garantiasFiltradas = garantias.filter((g) => {
    if (!garantiaBusca) return true
    const q = garantiaBusca.toLowerCase()
    return (
      g.cliente?.nome?.toLowerCase().includes(q) ||
      g.certificado?.toLowerCase().includes(q) ||
      g.produto?.nome?.toLowerCase().includes(q)
    )
  })

  const inputBase = 'w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200'
  const selectArrow = "appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_1rem_center] pr-10"

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-primary">Termos de Retirada</h2>
          <p className="text-sm text-gray-400 font-light">Gerencie os termos de retirada de produtos</p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <HiOutlineClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-dark">{metricas.total}</p>
            <p className="text-xs text-gray-400">Total de Termos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <HiOutlineCheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{metricas.concluidos}</p>
            <p className="text-xs text-gray-400">Concluídos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
            <HiOutlineClock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{metricas.aguardando}</p>
            <p className="text-xs text-gray-400">Aguardando</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 mb-6">
        <div
          className="flex justify-between items-center cursor-pointer select-none"
          onClick={() => setFiltrosAbertos((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <HiOutlineFilter className="w-5 h-5 text-accent" />
            <span className="font-semibold text-primary">Filtros</span>
          </div>
          <button className="p-1 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
            <HiOutlineChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${filtrosAbertos ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: filtrosAbertos ? '200px' : '0px', opacity: filtrosAbertos ? 1 : 0 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Cliente / Terceiro</label>
              <input
                value={filtros.nome}
                onChange={(e) => setFiltros(p => ({ ...p, nome: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="Buscar por nome"
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros(p => ({ ...p, status: e.target.value }))}
                className={`${inputBase} ${selectArrow}`}
              >
                <option value="">Todos</option>
                <option value="Pendente">Pendente</option>
                <option value="AguardandoOperador">Aguardando Operador</option>
                <option value="Concluido">Concluído</option>
                <option value="Expirado">Expirado</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={limpar}
                className="bg-gray-100 text-gray-500 px-5 py-2.5 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
              >
                Limpar
              </button>
              <button
                onClick={buscar}
                className="bg-accent text-white px-6 py-2.5 rounded-2xl shadow-md shadow-accent/20 hover:shadow-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
              >
                <HiOutlineSearch className="w-4 h-4" />
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Criar Novo Termo — Garantias Ativas */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-primary">Criar Novo Termo</h3>
            <p className="text-xs text-gray-400">Selecione uma garantia ativa para gerar o termo de retirada</p>
          </div>
          <input
            value={garantiaBusca}
            onChange={(e) => setGarantiaBusca(e.target.value)}
            placeholder="Buscar garantia..."
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 w-64"
          />
        </div>

        {garantiasLoading ? (
          <div className="flex justify-center py-6">
            <HiOutlineRefresh className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : garantiasFiltradas.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {garantiasFiltradas.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-2xl border border-gray-100 hover:border-primary/30 hover:bg-light/30 p-4 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 truncate">{g.cliente?.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{g.produto?.nome}</p>
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary mx-4 shrink-0">{g.certificado}</span>
                <button
                  onClick={() => handleNovoTermo(g)}
                  className="bg-accent text-white px-4 py-2 rounded-xl text-xs font-semibold hover:shadow-lg hover:shadow-accent/20 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <HiOutlinePlus className="w-3.5 h-3.5" />
                  Criar Termo
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">Nenhuma garantia ativa encontrada</p>
          </div>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <LoadingSkeleton linhas={8} />
      ) : erro ? (
        <ErrorState mensagem={erro} onRetry={() => carregarTermos(pagina, filtros)} />
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 overflow-hidden">
          <div className="p-6 pb-0">
            <p className="text-sm text-gray-400">
              {total} termo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
          </div>

          {termos.length > 0 ? (
            <>
              {/* Header desktop */}
              <div className={`${gridCols} text-xs text-gray-400 uppercase tracking-wider font-medium px-6 py-3 bg-light/30 border-b border-gray-100 mt-4 hidden lg:grid`}>
                <span>Cliente</span>
                <span>Produto</span>
                <span>Tipo</span>
                <span>Data</span>
                <span>Status</span>
                <span className="text-right">Ações</span>
              </div>

              {termos.map((t) => {
                const cfg = statusConfig[t.status] || statusConfig.Pendente
                const TipoIcon = tipoIcon[t.tipo_fluxo] || HiOutlinePencilAlt

                // Etapa do termo pendente
                let etapaInfo = null
                if (t.status === 'Pendente' && t.tipo_fluxo === 'whatsapp') {
                  etapaInfo = { label: 'Aguardando assinatura do cliente via WhatsApp', cor: 'text-amber-600 bg-amber-50', etapa: '1/3' }
                } else if (t.status === 'Pendente' && t.tipo_fluxo === 'terceiro') {
                  etapaInfo = { label: `Aguardando assinatura de ${t.terceiro_nome || 'terceiro'} via WhatsApp`, cor: 'text-amber-600 bg-amber-50', etapa: '1/3' }
                } else if (t.status === 'AguardandoOperador') {
                  etapaInfo = { label: 'Cliente assinou — aguardando assinatura do operador', cor: 'text-blue-600 bg-blue-50', etapa: '2/3' }
                } else if (t.status === 'Concluido') {
                  etapaInfo = { label: 'Concluído — PDF gerado e enviado', cor: 'text-emerald-600 bg-emerald-50', etapa: '3/3' }
                }

                return (
                  <div key={t.id}>
                    {/* Desktop row */}
                    <div className={`${gridCols} px-6 py-4 border-b border-gray-50 hover:bg-light/20 transition-colors items-center hidden lg:grid`}>
                      <div>
                        <p className="text-sm font-medium text-gray-700 truncate">{t.cliente_nome || '—'}</p>
                        {t.terceiro_nome && (
                          <p className="text-xs text-amber-500 truncate">Terceiro: {t.terceiro_nome}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 truncate">{t.produto_nome || '—'}</p>
                        <p className="text-xs text-primary">{t.certificado}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TipoIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{tipoLabel[t.tipo_fluxo] || t.tipo_fluxo}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDateTime(t.criado_em)}</span>
                      <div>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-medium border inline-flex w-fit ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        {etapaInfo && t.status !== 'Concluido' && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">Etapa {etapaInfo.etapa}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        {t.status === 'AguardandoOperador' && (
                          <button
                            onClick={() => setAssinarTermo(t)}
                            className="p-2 rounded-xl hover:bg-primary/10 text-gray-400 hover:text-primary transition-all cursor-pointer"
                            title="Assinar como operador"
                          >
                            <HiOutlinePencilAlt className="w-4 h-4" />
                          </button>
                        )}
                        {t.status === 'Concluido' && (
                          <>
                            <button
                              onClick={() => handleDownloadPDF(t.id)}
                              className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all cursor-pointer"
                              title="Baixar PDF"
                            >
                              <HiOutlineDownload className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEnviarWhatsApp(t.id)}
                              className="p-2 rounded-xl hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all cursor-pointer"
                              title="Enviar WhatsApp"
                            >
                              <HiOutlineChatAlt2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExcluirConfirm(t)}
                          className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                          title="Excluir"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Barra de etapa para pendentes — desktop */}
                    {etapaInfo && t.status !== 'Concluido' && (
                      <div className={`hidden lg:flex items-center gap-3 px-6 py-2 border-b border-gray-50 ${etapaInfo.cor}`}>
                        <div className="flex items-center gap-1.5">
                          {['1', '2', '3'].map(step => {
                            const current = parseInt(etapaInfo.etapa)
                            const s = parseInt(step)
                            return (
                              <div key={step} className="flex items-center gap-1">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  s < current ? 'bg-emerald-500 text-white' :
                                  s === current ? 'bg-current text-white ring-2 ring-current/30' :
                                  'bg-gray-200 text-gray-400'
                                }`}>{step}</div>
                                {step !== '3' && <div className={`w-4 h-0.5 ${s < current ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                              </div>
                            )
                          })}
                        </div>
                        <span className="text-xs font-medium">{etapaInfo.label}</span>
                      </div>
                    )}

                    {/* Mobile card */}
                    <div className="lg:hidden px-4 py-4 border-b border-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{t.cliente_nome || '—'}</p>
                          {t.terceiro_nome && (
                            <p className="text-xs text-amber-500">Terceiro: {t.terceiro_nome}</p>
                          )}
                        </div>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate mb-1">{t.produto_nome || '—'}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                        <span className="text-primary">{t.certificado}</span>
                        <span>{tipoLabel[t.tipo_fluxo] || t.tipo_fluxo}</span>
                        <span>{formatDateTime(t.criado_em)}</span>
                      </div>
                      {/* Etapa mobile */}
                      {etapaInfo && t.status !== 'Concluido' && (
                        <div className={`rounded-xl px-3 py-2 text-xs font-medium mb-3 ${etapaInfo.cor}`}>
                          Etapa {etapaInfo.etapa} — {etapaInfo.label}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {t.status === 'AguardandoOperador' && (
                          <button
                            onClick={() => setAssinarTermo(t)}
                            className="p-2 rounded-xl hover:bg-primary/10 text-gray-400 hover:text-primary transition-all cursor-pointer"
                            title="Assinar como operador"
                          >
                            <HiOutlinePencilAlt className="w-4 h-4" />
                          </button>
                        )}
                        {t.status === 'Concluido' && (
                          <>
                            <button
                              onClick={() => handleDownloadPDF(t.id)}
                              className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all cursor-pointer"
                            >
                              <HiOutlineDownload className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEnviarWhatsApp(t.id)}
                              className="p-2 rounded-xl hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all cursor-pointer"
                            >
                              <HiOutlineChatAlt2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExcluirConfirm(t)}
                          className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Paginação */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-50">
                <p className="text-sm text-gray-400">
                  Mostrando {(paginaAtual - 1) * PER_PAGE + 1}-{Math.min(paginaAtual * PER_PAGE, total)} de {total}
                </p>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => mudarPagina(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual <= 1}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-light disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <HiOutlineChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  {gerarPaginas().map((p) => (
                    <button
                      key={p}
                      onClick={() => mudarPagina(p)}
                      className={`w-9 h-9 rounded-xl text-sm transition-all cursor-pointer ${
                        p === paginaAtual
                          ? 'bg-accent text-white font-semibold'
                          : 'hover:bg-light text-gray-500'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => mudarPagina(Math.min(totalPaginas, paginaAtual + 1))}
                    disabled={paginaAtual >= totalPaginas}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-light disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <HiOutlineChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <HiOutlineClipboardCheck className="w-16 h-16 text-gray-200" />
              <p className="text-gray-400 text-sm mt-4">Nenhum termo encontrado</p>
              <p className="text-gray-300 text-xs">Clique em "Novo Termo" para criar</p>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL ESCOLHA TIPO (Novo Termo) ─── */}
      {novoTermoStep === 'escolha' && garantiaSelecionada && (
        <TermoEscolhaModal
          garantia={garantiaSelecionada}
          onClose={() => setNovoTermoStep(null)}
          onEscolha={handleEscolhaTipo}
        />
      )}

      {/* ─── MODAL TERMO PRESENCIAL (Novo Termo) ─── */}
      {novoTermoStep === 'presencial' && garantiaSelecionada && (
        <TermoRetiradaModal
          garantia={garantiaSelecionada}
          onClose={() => setNovoTermoStep(null)}
          onSuccess={handleTermoConcluido}
          tipoFluxo={termoTipoFluxo}
        />
      )}

      {/* ─── MODAL ASSINAR COMO OPERADOR ─── */}
      {assinarTermo && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => !assinando && setAssinarTermo(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-primary">Assinatura do Operador</h3>
              <p className="text-sm text-gray-400 mt-0.5">Finalize o termo de retirada</p>
            </div>

            <div className="p-6">
              {/* Resumo do termo */}
              <div className="bg-light/50 rounded-2xl p-4 mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Cliente</span>
                  <span className="text-sm font-medium text-gray-700">{assinarTermo.cliente_nome}</span>
                </div>
                {assinarTermo.terceiro_nome && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Terceiro</span>
                    <span className="text-sm font-medium text-amber-600">{assinarTermo.terceiro_nome}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Produto</span>
                  <span className="text-sm font-medium text-gray-700">{assinarTermo.produto_nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Certificado</span>
                  <span className="text-sm font-medium text-primary">{assinarTermo.certificado}</span>
                </div>
              </div>

              {/* Indicação que cliente já assinou */}
              <div className="bg-emerald-50 rounded-xl p-3 mb-5 flex items-center gap-2">
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700">
                  {assinarTermo.terceiro_nome
                    ? `${assinarTermo.terceiro_nome} já assinou este termo.`
                    : 'A cliente já assinou este termo.'}
                </p>
              </div>

              {/* SignaturePad */}
              <SignaturePad
                label="Assinatura do Operador"
                disabled={assinando}
                onConfirm={handleAssinarOperador}
                onClear={() => {}}
              />

              {assinando && (
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400">
                  <HiOutlineRefresh className="w-4 h-4 animate-spin" />
                  Assinando e gerando PDF...
                </div>
              )}

              <button
                onClick={() => setAssinarTermo(null)}
                disabled={assinando}
                className="w-full mt-4 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CONFIRMAÇÃO EXCLUSÃO ─── */}
      {excluirConfirm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-[fade-in_0.15s_ease-out]"
          onClick={() => !excluindo && setExcluirConfirm(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 animate-[scale-in_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 mx-auto flex items-center justify-center mb-4">
                <HiOutlineExclamation className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-dark mb-2">Excluir Termo</h3>
              <p className="text-sm text-gray-500">
                Tem certeza que deseja excluir o termo de{' '}
                <span className="font-semibold text-primary">{excluirConfirm.cliente_nome}</span>
                {excluirConfirm.certificado && (
                  <> (certificado <span className="font-semibold text-primary">{excluirConfirm.certificado}</span>)</>
                )}
                ?
              </p>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setExcluirConfirm(null)}
                disabled={excluindo}
                className="flex-1 bg-gray-100 text-gray-500 px-6 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="flex-1 bg-red-500 text-white px-6 py-3 rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/30 text-sm font-semibold transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <HiOutlineTrash className="w-4 h-4" />
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TermosRetirada
