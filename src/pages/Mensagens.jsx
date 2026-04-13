import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  HiOutlineChatAlt2,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineSearch,
  HiOutlineEye,
  HiOutlineRefresh,
  HiOutlinePencilAlt,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from 'react-icons/hi'
import * as mensagemService from '../services/mensagemService'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ErrorState from '../components/ErrorState'
import { useToast } from '../components/Toast'

const PER_PAGE = 20

// Formata ISO datetime para "DD/MM/AAAA HH:MM"
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

// Badge de tipo
const TipoBadge = memo(({ tipo }) => {
  const key = tipo?.toLowerCase()
  const styles = {
    certificado: 'bg-blue-50 text-blue-600 border-blue-100',
    lembrete: 'bg-amber-50 text-amber-600 border-amber-100',
    desconto: 'bg-purple-50 text-purple-600 border-purple-100',
  }
  return (
    <span className={`rounded-full px-3 py-0.5 text-xs font-medium border whitespace-nowrap ${styles[key] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {tipo}
    </span>
  )
})

// Status com bolinha
const StatusIndicator = memo(({ status }) => {
  const key = status?.toLowerCase()
  const config = {
    enviado: { dot: 'bg-emerald-400', text: 'text-emerald-600' },
    falha: { dot: 'bg-red-400', text: 'text-red-500' },
    pendente: { dot: 'bg-amber-400', text: 'text-amber-500' },
  }
  const c = config[key] || { dot: 'bg-gray-300', text: 'text-gray-400' }
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {status}
    </span>
  )
})

// Grid de colunas — larguras fixas para evitar overflow de badge
const gridCols = 'grid grid-cols-[120px_150px_120px_100px_1fr_100px_80px]'

// Card de métrica no topo
const MiniCard = memo(({ icon: Icon, gradient, valor, label }) => (
  <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-primary">{valor}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  </div>
))

const selectArrow = "appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_0.75rem_center] pr-9"

// Página Mensagens Enviadas
const Mensagens = () => {
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [pagina, setPagina] = useState(1)
  const [detalhe, setDetalhe] = useState(null)

  // Edit modal
  const [editando, setEditando] = useState(null)
  const [editConteudo, setEditConteudo] = useState('')
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  const [mensagens, setMensagens] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [reenviando, setReenviando] = useState(null)

  // Métricas
  const [metricas, setMetricas] = useState({ hoje: 0, sucesso: 0, falhas: 0 })

  // Debounce ref
  const debounceRef = useRef(null)

  // Escape fecha modais
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (deleteModal) setDeleteModal(null)
        else if (editando) setEditando(null)
        else if (detalhe) setDetalhe(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [detalhe, editando, deleteModal])

  const carregarDados = useCallback(async (paginaAtual = 1, buscaAtual = busca, tipoAtual = filtroTipo, statusAtual = filtroStatus) => {
    setLoading(true)
    setErro(null)
    try {
      const params = {
        skip: (paginaAtual - 1) * PER_PAGE,
        limit: PER_PAGE,
      }
      if (buscaAtual) params.nome = buscaAtual
      if (tipoAtual) params.tipo = tipoAtual
      if (statusAtual) params.status = statusAtual

      const data = await mensagemService.listar(params)
      setMensagens(data.items)
      setTotal(data.total)

      // Calcular métricas a partir dos dados retornados
      const totalEnviado = data.items.filter((m) => m.status?.toLowerCase() === 'enviado').length
      const totalFalhas = data.items.filter((m) => m.status?.toLowerCase() === 'falha').length
      const hoje = new Date()
      const enviadasHoje = data.items.filter((m) => {
        if (!m.criado_em) return false
        const d = new Date(m.criado_em)
        return d.getFullYear() === hoje.getFullYear() &&
          d.getMonth() === hoje.getMonth() &&
          d.getDate() === hoje.getDate()
      }).length

      setMetricas({
        hoje: enviadasHoje,
        sucesso: data.items.length > 0 ? Math.round((totalEnviado / data.items.length) * 100) : 0,
        falhas: totalFalhas,
      })
    } catch {
      setErro('Não foi possível carregar as mensagens.')
    } finally {
      setLoading(false)
    }
  }, [busca, filtroTipo, filtroStatus])

  useEffect(() => {
    carregarDados(1)
  }, [])

  // Busca com debounce
  const handleBusca = (v) => {
    setBusca(v)
    setPagina(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      carregarDados(1, v, filtroTipo, filtroStatus)
    }, 400)
  }

  const handleTipo = (v) => {
    setFiltroTipo(v)
    setPagina(1)
    carregarDados(1, busca, v, filtroStatus)
  }

  const handleStatus = (v) => {
    setFiltroStatus(v)
    setPagina(1)
    carregarDados(1, busca, filtroTipo, v)
  }

  const handlePagina = (p) => {
    setPagina(p)
    carregarDados(p, busca, filtroTipo, filtroStatus)
  }

  // Reenviar mensagem
  const handleReenviar = async (mensagemId) => {
    setReenviando(mensagemId)
    try {
      await mensagemService.reenviar(mensagemId)
      toast.success('Mensagem reenviada com sucesso!')
      carregarDados(pagina, busca, filtroTipo, filtroStatus)
    } catch {
      toast.error('Erro ao reenviar mensagem.')
    } finally {
      setReenviando(null)
    }
  }

  // Abrir modal de edição
  const abrirEdicao = (m) => {
    setEditando(m)
    setEditConteudo(m.conteudo)
  }

  // Salvar edição (opcionalmente reenviar)
  const handleSalvarEdicao = async (reenviar = false) => {
    if (!editando) return
    setSalvandoEdit(true)
    try {
      await mensagemService.editar(editando.id, editConteudo, reenviar)
      toast.success(reenviar ? 'Mensagem salva e reenviada!' : 'Mensagem salva!')
      setEditando(null)
      carregarDados(pagina, busca, filtroTipo, filtroStatus)
    } catch {
      toast.error('Erro ao salvar mensagem.')
    } finally {
      setSalvandoEdit(false)
    }
  }

  // Excluir mensagem
  const handleExcluir = async () => {
    if (!deleteModal) return
    setExcluindo(true)
    try {
      await mensagemService.excluir(deleteModal.id)
      toast.success('Mensagem excluída com sucesso!')
      setDeleteModal(null)
      carregarDados(pagina, busca, filtroTipo, filtroStatus)
    } catch {
      toast.error('Erro ao excluir mensagem.')
    } finally {
      setExcluindo(false)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * PER_PAGE

  // Gera páginas para navegação
  const gerarPaginas = () => {
    const pages = []
    const max = 5
    let start = Math.max(1, paginaAtual - Math.floor(max / 2))
    let end = Math.min(totalPaginas, start + max - 1)
    if (end - start < max - 1) start = Math.max(1, end - max + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const inputBase = 'rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200'

  if (loading && mensagens.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary">Mensagens Enviadas</h2>
          <p className="text-sm text-gray-400 font-light">Histórico de envios via WhatsApp</p>
        </div>
        <LoadingSkeleton tipo="cards" />
        <div className="mt-6">
          <LoadingSkeleton linhas={10} />
        </div>
      </div>
    )
  }

  if (erro && mensagens.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary">Mensagens Enviadas</h2>
          <p className="text-sm text-gray-400 font-light">Histórico de envios via WhatsApp</p>
        </div>
        <ErrorState mensagem={erro} onRetry={() => carregarDados(1)} />
      </div>
    )
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary">Mensagens Enviadas</h2>
        <p className="text-sm text-gray-400 font-light">Histórico de envios via WhatsApp</p>
      </div>

      {/* ─── CARDS DE RESUMO ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MiniCard
          icon={HiOutlineChatAlt2}
          gradient="from-emerald-500 to-emerald-400"
          valor={metricas.hoje}
          label="Enviadas Hoje"
        />
        <MiniCard
          icon={HiOutlineCheckCircle}
          gradient="from-blue-500 to-blue-400"
          valor={`${metricas.sucesso}%`}
          label="Taxa de Sucesso"
        />
        <MiniCard
          icon={HiOutlineExclamationCircle}
          gradient="from-red-400 to-red-300"
          valor={metricas.falhas}
          label="Falhas de Envio"
        />
      </div>

      {/* ─── FILTROS INLINE ─── */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            value={busca}
            onChange={(e) => handleBusca(e.target.value)}
            placeholder="Buscar por cliente..."
            className={`${inputBase} w-64 pl-10`}
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => handleTipo(e.target.value)}
          className={`${inputBase} ${selectArrow}`}
        >
          <option value="">Todos os tipos</option>
          <option value="Certificado">Certificado</option>
          <option value="Lembrete">Lembrete</option>
          <option value="Desconto">Desconto</option>
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => handleStatus(e.target.value)}
          className={`${inputBase} ${selectArrow}`}
        >
          <option value="">Todos os status</option>
          <option value="Enviado">Enviado</option>
          <option value="Falha">Falha</option>
          <option value="Pendente">Pendente</option>
        </select>
      </div>

      {/* ─── TABELA DE MENSAGENS ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 overflow-hidden">
        {mensagens.length > 0 ? (
          <>
            {/* Header — desktop */}
            <div className={`${gridCols} text-xs text-gray-400 uppercase tracking-wider font-medium px-6 py-3 bg-light/30 border-b border-gray-100 hidden lg:grid`}>
              <span>Data/Hora</span>
              <span>Cliente</span>
              <span>Telefone</span>
              <span className="text-center">Tipo</span>
              <span>Mensagem</span>
              <span>Status</span>
              <span className="text-right">Ações</span>
            </div>

            {/* Linhas */}
            {mensagens.map((m) => (
              <div key={m.id}>
                {/* Desktop row */}
                <div className={`${gridCols} px-6 py-4 border-b border-gray-50 hover:bg-light/20 transition-colors duration-200 items-center hidden lg:grid`}>
                  <span className="text-xs text-gray-400">{formatDateTime(m.criado_em)}</span>
                  <span className="text-sm text-gray-600 font-medium truncate pr-2">{m.cliente?.nome || '—'}</span>
                  <span className="text-sm text-gray-400 truncate">{m.cliente?.telefone || '—'}</span>
                  <div className="flex justify-center"><TipoBadge tipo={m.tipo} /></div>
                  <span className="text-xs text-gray-400 truncate min-w-0">{m.conteudo}</span>
                  <StatusIndicator status={m.status} />
                  <div className="flex gap-1 justify-end">
                    {m.status?.toLowerCase() === 'falha' && (
                      <button
                        onClick={() => handleReenviar(m.id)}
                        disabled={reenviando === m.id}
                        className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all cursor-pointer disabled:opacity-50"
                        title="Reenviar"
                      >
                        <HiOutlineRefresh className={`w-4 h-4 ${reenviando === m.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => abrirEdicao(m)}
                      className="p-2 rounded-xl hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-all cursor-pointer"
                      title="Editar"
                    >
                      <HiOutlinePencilAlt className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDetalhe(m)}
                      className="p-2 rounded-xl hover:bg-light text-gray-400 hover:text-primary transition-all cursor-pointer"
                      title="Ver detalhes"
                    >
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteModal(m)}
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="lg:hidden px-4 py-4 border-b border-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400">{formatDateTime(m.criado_em)}</span>
                    <StatusIndicator status={m.status} />
                  </div>
                  <p className="text-sm text-gray-600 font-medium mb-1">{m.cliente?.nome || '—'}</p>
                  <p className="text-xs text-gray-400 mb-1">{m.cliente?.telefone || '—'}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <TipoBadge tipo={m.tipo} />
                  </div>
                  <p className="text-xs text-gray-400 truncate mb-3">{m.conteudo}</p>
                  <div className="flex gap-2">
                    {m.status?.toLowerCase() === 'falha' && (
                      <button
                        onClick={() => handleReenviar(m.id)}
                        disabled={reenviando === m.id}
                        className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <HiOutlineRefresh className={`w-4 h-4 ${reenviando === m.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => abrirEdicao(m)}
                      className="p-2 rounded-xl hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-all cursor-pointer"
                    >
                      <HiOutlinePencilAlt className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDetalhe(m)}
                      className="p-2 rounded-xl hover:bg-light text-gray-400 hover:text-primary transition-all cursor-pointer"
                    >
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteModal(m)}
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Paginação */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-50">
              <p className="text-sm text-gray-400">
                Mostrando {inicio + 1}-{Math.min(inicio + PER_PAGE, total)} de {total}
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => handlePagina(Math.max(1, paginaAtual - 1))}
                  disabled={paginaAtual <= 1}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-light disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <HiOutlineChevronLeft className="w-4 h-4 text-gray-500" />
                </button>

                {gerarPaginas().map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePagina(p)}
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
                  onClick={() => handlePagina(Math.min(totalPaginas, paginaAtual + 1))}
                  disabled={paginaAtual >= totalPaginas}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-light disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <HiOutlineChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Estado vazio */
          <div className="flex flex-col items-center justify-center py-16">
            <HiOutlineChatAlt2 className="w-16 h-16 text-gray-200" />
            <p className="text-gray-400 text-sm mt-4">Nenhuma mensagem encontrada</p>
            <p className="text-gray-300 text-xs">Tente ajustar os filtros</p>
          </div>
        )}
      </div>

      {/* ─── MODAL DE DETALHES ─── */}
      {detalhe && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-primary">Detalhes da Mensagem</h3>
                <TipoBadge tipo={detalhe.tipo} />
              </div>
              <button
                onClick={() => setDetalhe(null)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-6">
              {/* Status em destaque */}
              {detalhe.status?.toLowerCase() === 'enviado' && (
                <div className="bg-emerald-50 rounded-2xl p-3 flex items-center gap-2">
                  <HiOutlineCheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-emerald-700 font-medium">Mensagem enviada com sucesso</p>
                </div>
              )}
              {detalhe.status?.toLowerCase() === 'falha' && (
                <div className="bg-red-50 rounded-2xl p-3 flex items-center gap-2">
                  <HiOutlineExclamationCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm text-red-600 font-medium">Falha no envio</p>
                    {detalhe.motivo_falha && (
                      <p className="text-xs text-red-400 mt-0.5">Motivo: {detalhe.motivo_falha}</p>
                    )}
                  </div>
                </div>
              )}
              {detalhe.status?.toLowerCase() === 'pendente' && (
                <div className="bg-amber-50 rounded-2xl p-3 flex items-center gap-2">
                  <HiOutlineExclamationCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-600 font-medium">Aguardando envio</p>
                </div>
              )}

              {/* Destinatário */}
              <div className="bg-light/50 rounded-2xl p-4 mt-4">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Destinatário</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Cliente:</span> <span className="font-medium text-primary">{detalhe.cliente?.nome || '—'}</span></p>
                  <p><span className="text-gray-400">Telefone:</span> <span className="font-medium text-primary">{detalhe.cliente?.telefone || '—'}</span></p>
                  <p><span className="text-gray-400">E-mail:</span> <span className="font-medium text-primary">{detalhe.cliente?.email || '—'}</span></p>
                </div>
              </div>

              {/* Conteúdo da mensagem */}
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Mensagem Enviada</p>
                <div className="bg-light/50 rounded-2xl p-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{detalhe.conteudo}</p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="mt-4 space-y-1">
                <p className="text-xs text-gray-300">Criado em: {formatDateTime(detalhe.criado_em)}</p>
                {detalhe.enviado_em && (
                  <p className="text-xs text-gray-300">Enviado em: {formatDateTime(detalhe.enviado_em)}</p>
                )}
              </div>

              {/* Botão reenviar se falha */}
              {detalhe.status?.toLowerCase() === 'falha' && (
                <button
                  onClick={() => { handleReenviar(detalhe.id); setDetalhe(null) }}
                  className="bg-accent text-white rounded-2xl w-full py-3 mt-4 font-semibold hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 cursor-pointer"
                >
                  Reenviar Mensagem
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE EDIÇÃO ─── */}
      {editando && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setEditando(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-primary">Editar Mensagem</h3>
                <TipoBadge tipo={editando.tipo} />
              </div>
              <button
                onClick={() => setEditando(null)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-6">
              {/* Destinatário (read-only) */}
              <div className="bg-light/50 rounded-2xl p-4 mb-4">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Destinatário</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Cliente:</span> <span className="font-medium text-primary">{editando.cliente?.nome || '—'}</span></p>
                  <p><span className="text-gray-400">Telefone:</span> <span className="font-medium text-primary">{editando.cliente?.telefone || '—'}</span></p>
                </div>
              </div>

              {/* Conteúdo editável */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">
                  Conteúdo da Mensagem
                </label>
                <textarea
                  value={editConteudo}
                  onChange={(e) => setEditConteudo(e.target.value)}
                  rows={8}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditando(null)}
                  className="bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSalvarEdicao(false)}
                  disabled={salvandoEdit}
                  className="flex-1 bg-primary text-white px-5 py-3 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  {salvandoEdit ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => handleSalvarEdicao(true)}
                  disabled={salvandoEdit}
                  className="flex-1 bg-accent text-white px-5 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  {salvandoEdit ? 'Enviando...' : 'Salvar e Reenviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL EXCLUIR MENSAGEM ─── */}
      {deleteModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <HiOutlineTrash className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">Excluir Mensagem</h3>
              <p className="text-sm text-gray-500">
                Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="flex-1 bg-red-500 text-white px-5 py-3 rounded-2xl shadow-lg shadow-red-500/30 hover:bg-red-600 text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
              >
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Mensagens
