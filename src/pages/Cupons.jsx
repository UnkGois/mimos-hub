import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  HiOutlineGift,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineX,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineBadgeCheck,
  HiOutlineClock,
  HiOutlineBan,
  HiOutlinePencilAlt,
  HiOutlineTrash,
} from 'react-icons/hi'
import { maskCPF } from '../utils/masks'
import * as cupomService from '../services/cupomService'
import * as clienteService from '../services/clienteService'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ErrorState from '../components/ErrorState'
import { useToast } from '../components/Toast'

const PER_PAGE = 20

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

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

const getStatusCupom = (cupom) => {
  // Prefer server-computed status
  if (cupom.status) return cupom.status
  if (cupom.desativado) return 'Desativado'
  if (cupom.usado) return 'Usado'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const validade = new Date(cupom.validade + 'T23:59:59')
  if (validade < hoje) return 'Expirado'
  return 'Ativo'
}

const StatusBadge = memo(({ status }) => {
  const styles = {
    Ativo: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    Usado: 'bg-blue-50 text-blue-500 border-blue-100',
    Expirado: 'bg-red-50 text-red-500 border-red-100',
    Desativado: 'bg-gray-50 text-gray-500 border-gray-200',
  }
  return (
    <span className={`rounded-full px-3 py-0.5 text-xs font-medium border whitespace-nowrap ${styles[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
})

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

const gridCols = 'grid grid-cols-[140px_150px_100px_100px_90px_120px_100px]'

const selectArrow = "appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_0.75rem_center] pr-9"

const PERCENTUAIS = [5, 10, 15, 20, 25, 30]
const VALORES_REAIS = [10, 20, 30, 50, 100]

const formatCurrency = (v) => {
  const num = Number(v)
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatDesconto = (cupom) => {
  if (cupom.tipo_desconto === 'valor' && cupom.valor_desconto != null) {
    return formatCurrency(cupom.valor_desconto)
  }
  return `${Number(cupom.percentual)}%`
}

const VALIDADES = [
  { dias: 7, label: '7 dias' },
  { dias: 15, label: '15 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 60, label: '60 dias' },
  { dias: 90, label: '90 dias' },
]

const STATUS_OPTIONS = [
  { value: 'Ativo', label: 'Ativo', color: 'bg-emerald-500', ring: 'ring-emerald-200' },
  { value: 'Usado', label: 'Usado', color: 'bg-blue-500', ring: 'ring-blue-200' },
  { value: 'Desativado', label: 'Desativado', color: 'bg-gray-400', ring: 'ring-gray-200' },
  { value: 'Expirado', label: 'Expirado', color: 'bg-red-500', ring: 'ring-red-200' },
]

const Cupons = () => {
  const toast = useToast()

  // Table state
  const [cupons, setCupons] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  // Stats
  const [stats, setStats] = useState({ total: 0, ativos: 0, usados: 0 })

  // Modal state — Create
  const [modalAberto, setModalAberto] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesResult, setClientesResult] = useState([])
  const [dropdownCliente, setDropdownCliente] = useState(false)
  const [tipoDesconto, setTipoDesconto] = useState('percentual') // 'percentual' | 'valor'
  const [percentual, setPercentual] = useState(10)
  const [percentualCustom, setPercentualCustom] = useState('')
  const [valorReais, setValorReais] = useState(20)
  const [valorReaisCustom, setValorReaisCustom] = useState('')
  const [validadeDias, setValidadeDias] = useState(30)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Modal state — Status change
  const [statusModal, setStatusModal] = useState(null) // cupom object
  const [novoStatus, setNovoStatus] = useState('')
  const [salvandoStatus, setSalvandoStatus] = useState(false)

  // Modal state — Delete
  const [deleteModal, setDeleteModal] = useState(null) // cupom object
  const [excluindo, setExcluindo] = useState(false)

  // Debounce refs
  const debounceRef = useRef(null)
  const clienteDebounceRef = useRef(null)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownCliente(false)
      }
    }
    if (dropdownCliente) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownCliente])

  // Escape closes modals
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (deleteModal) setDeleteModal(null)
        else if (statusModal) setStatusModal(null)
        else if (modalAberto) setModalAberto(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [modalAberto, statusModal, deleteModal])

  const carregarDados = useCallback(async (paginaAtual = 1, buscaAtual = busca) => {
    setLoading(true)
    setErro(null)
    try {
      const params = {
        skip: (paginaAtual - 1) * PER_PAGE,
        limit: PER_PAGE,
      }
      if (buscaAtual) params.codigo = buscaAtual

      const data = await cupomService.listar(params)
      setCupons(data.items)
      setTotal(data.total)

      // Compute stats from items
      const todosAtivos = data.items.filter((c) => getStatusCupom(c) === 'Ativo').length
      const todosUsados = data.items.filter((c) => getStatusCupom(c) === 'Usado').length

      setStats({
        total: data.total,
        ativos: todosAtivos,
        usados: todosUsados,
      })
    } catch {
      setErro('Não foi possível carregar os cupons.')
    } finally {
      setLoading(false)
    }
  }, [busca])

  useEffect(() => {
    carregarDados(1)
  }, [])

  const handleBusca = (v) => {
    setBusca(v)
    setPagina(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      carregarDados(1, v)
    }, 400)
  }

  const handlePagina = (p) => {
    setPagina(p)
    carregarDados(p, busca)
  }

  // Client search for modal
  const handleBuscaCliente = (v) => {
    setBuscaCliente(v)
    setClienteSelecionado(null)
    if (clienteDebounceRef.current) clearTimeout(clienteDebounceRef.current)
    if (v.length < 2) {
      setClientesResult([])
      setDropdownCliente(false)
      return
    }
    clienteDebounceRef.current = setTimeout(async () => {
      try {
        const data = await clienteService.listar({ nome: v, limit: 8 })
        setClientesResult(data.items)
        setDropdownCliente(data.items.length > 0)
      } catch {
        setClientesResult([])
      }
    }, 300)
  }

  const selecionarCliente = (c) => {
    setClienteSelecionado(c)
    setBuscaCliente(c.nome)
    setDropdownCliente(false)
  }

  const handlePercentualBtn = (val) => {
    setPercentual(val)
    setPercentualCustom('')
  }

  const handlePercentualCustom = (v) => {
    const num = parseInt(v, 10)
    setPercentualCustom(v)
    if (!isNaN(num) && num > 0 && num <= 100) {
      setPercentual(num)
    }
  }

  const handleValorReaisBtn = (val) => {
    setValorReais(val)
    setValorReaisCustom('')
  }

  const handleValorReaisCustom = (v) => {
    setValorReaisCustom(v)
    const num = parseFloat(v.replace(',', '.'))
    if (!isNaN(num) && num > 0) {
      setValorReais(num)
    }
  }

  const abrirModal = () => {
    setClienteSelecionado(null)
    setBuscaCliente('')
    setClientesResult([])
    setDropdownCliente(false)
    setTipoDesconto('percentual')
    setPercentual(10)
    setPercentualCustom('')
    setValorReais(20)
    setValorReaisCustom('')
    setValidadeDias(30)
    setMotivo('')
    setModalAberto(true)
  }

  const handleCriarCupom = async () => {
    if (!clienteSelecionado) {
      toast.error('Selecione um cliente')
      return
    }

    const isPerc = tipoDesconto === 'percentual'
    const valor = isPerc ? percentual : valorReais

    if (isPerc && (percentual <= 0 || percentual > 100)) {
      toast.error('Percentual inválido')
      return
    }
    if (!isPerc && valorReais <= 0) {
      toast.error('Valor inválido')
      return
    }

    const descontoLabel = isPerc
      ? `${percentual}% de desconto`
      : `R$ ${valorReais.toFixed(2).replace('.', ',')} de desconto`

    setEnviando(true)
    try {
      await cupomService.criarManual({
        cliente_id: clienteSelecionado.id,
        tipo_desconto: tipoDesconto,
        valor,
        motivo: motivo || `Cupom manual — ${descontoLabel}`,
        validade_dias: validadeDias,
      })
      toast.success('Cupom gerado e enviado via WhatsApp!')
      setModalAberto(false)
      carregarDados(pagina, busca)
    } catch {
      toast.error('Erro ao gerar cupom.')
    } finally {
      setEnviando(false)
    }
  }

  // Status change
  const abrirStatusModal = (cupom) => {
    setStatusModal(cupom)
    setNovoStatus(getStatusCupom(cupom))
  }

  const handleSalvarStatus = async () => {
    if (!statusModal) return
    setSalvandoStatus(true)
    try {
      await cupomService.atualizarStatus(statusModal.id, novoStatus)
      toast.success(`Status alterado para "${novoStatus}"`)
      setStatusModal(null)
      carregarDados(pagina, busca)
    } catch {
      toast.error('Erro ao alterar status do cupom.')
    } finally {
      setSalvandoStatus(false)
    }
  }

  // Delete
  const handleExcluir = async () => {
    if (!deleteModal) return
    setExcluindo(true)
    try {
      await cupomService.excluir(deleteModal.id)
      toast.success('Cupom excluído com sucesso!')
      setDeleteModal(null)
      carregarDados(pagina, busca)
    } catch {
      toast.error('Erro ao excluir cupom.')
    } finally {
      setExcluindo(false)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * PER_PAGE

  const gerarPaginas = () => {
    const pages = []
    const max = 5
    let start = Math.max(1, paginaAtual - Math.floor(max / 2))
    let end = Math.min(totalPaginas, start + max - 1)
    if (end - start < max - 1) start = Math.max(1, end - max + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  // Generate preview message
  const descontoPreview = tipoDesconto === 'percentual'
    ? `${percentual}% de desconto`
    : `${formatCurrency(valorReais)} de desconto`

  const previewMsg = clienteSelecionado
    ? `✨ Oi ${clienteSelecionado.nome}! Tudo bem? 💕\n\nA Mimos de Alice preparou um presente especial pra você! 🎁\n\nVocê ganhou ${descontoPreview} na sua próxima compra!\n\n🎀 Cupom: MDA-XXXX\n📅 Válido até: ${formatDate(new Date(Date.now() + validadeDias * 86400000).toISOString())}\n\nUse na loja física ou nas nossas lojas online!\nEstamos com peças lindas esperando por você! 💎\n\nCom carinho,\nMDA - Mimos de Alice Joias 🩷\nwww.mimosdealicejoias.com.br`
    : ''

  const inputBase = 'rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200'

  if (loading && cupons.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary">Cupons de Desconto</h2>
          <p className="text-sm text-gray-400 font-light">Gerencie cupons e envie via WhatsApp</p>
        </div>
        <LoadingSkeleton tipo="cards" />
        <div className="mt-6"><LoadingSkeleton linhas={10} /></div>
      </div>
    )
  }

  if (erro && cupons.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary">Cupons de Desconto</h2>
          <p className="text-sm text-gray-400 font-light">Gerencie cupons e envie via WhatsApp</p>
        </div>
        <ErrorState mensagem={erro} onRetry={() => carregarDados(1)} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-primary">Cupons de Desconto</h2>
          <p className="text-sm text-gray-400 font-light">Gerencie cupons e envie via WhatsApp</p>
        </div>
        <button
          onClick={abrirModal}
          className="bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-all cursor-pointer"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Novo Cupom
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MiniCard icon={HiOutlineGift} gradient="from-primary to-accent" valor={stats.total} label="Total de Cupons" />
        <MiniCard icon={HiOutlineBadgeCheck} gradient="from-emerald-500 to-emerald-400" valor={stats.ativos} label="Cupons Ativos" />
        <MiniCard icon={HiOutlineCheckCircle} gradient="from-blue-500 to-blue-400" valor={stats.usados} label="Cupons Usados" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            value={busca}
            onChange={(e) => handleBusca(e.target.value)}
            placeholder="Buscar por codigo..."
            className={`${inputBase} w-64 pl-10`}
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className={`${inputBase} ${selectArrow}`}
        >
          <option value="">Todos os status</option>
          <option value="Ativo">Ativo</option>
          <option value="Usado">Usado</option>
          <option value="Expirado">Expirado</option>
          <option value="Desativado">Desativado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 overflow-hidden">
        {cupons.length > 0 ? (
          <>
            {/* Header */}
            <div className={`${gridCols} text-xs text-gray-400 uppercase tracking-wider font-medium px-6 py-3 bg-light/30 border-b border-gray-100 hidden lg:grid`}>
              <span>Codigo</span>
              <span>Cliente</span>
              <span className="text-center">Desconto</span>
              <span>Validade</span>
              <span className="text-center">Status</span>
              <span>Criado em</span>
              <span className="text-right">Acoes</span>
            </div>

            {/* Rows */}
            {(filtroStatus ? cupons.filter((c) => getStatusCupom(c) === filtroStatus) : cupons).map((c) => {
              const st = getStatusCupom(c)
              return (
                <div key={c.id}>
                  {/* Desktop */}
                  <div className={`${gridCols} px-6 py-4 border-b border-gray-50 hover:bg-light/20 transition-colors duration-200 items-center hidden lg:grid`}>
                    <span className="text-sm font-mono font-semibold text-primary truncate">{c.codigo}</span>
                    <span className="text-sm text-gray-600 truncate pr-2">{c.cliente_nome || '—'}</span>
                    <span className="text-sm font-semibold text-accent text-center">{formatDesconto(c)}</span>
                    <span className="text-xs text-gray-400">{formatDate(c.validade)}</span>
                    <div className="flex justify-center"><StatusBadge status={st} /></div>
                    <span className="text-xs text-gray-400">{formatDateTime(c.criado_em)}</span>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => abrirStatusModal(c)}
                        className="p-2 rounded-xl hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-all cursor-pointer"
                        title="Alterar status"
                      >
                        <HiOutlinePencilAlt className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal(c)}
                        className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                        title="Excluir"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="lg:hidden px-4 py-4 border-b border-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-mono font-semibold text-primary">{c.codigo}</span>
                      <StatusBadge status={st} />
                    </div>
                    <p className="text-sm text-gray-600 font-medium mb-1">{c.cliente_nome || '—'}</p>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-accent">{formatDesconto(c)}</span>
                      <span className="text-xs text-gray-400">Validade: {formatDate(c.validade)}</span>
                    </div>
                    {c.motivo && <p className="text-xs text-gray-400 truncate mb-2">{c.motivo}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirStatusModal(c)}
                        className="text-xs text-amber-500 font-medium hover:underline cursor-pointer"
                      >
                        Alterar status
                      </button>
                      <button
                        onClick={() => setDeleteModal(c)}
                        className="text-xs text-red-500 font-medium hover:underline cursor-pointer"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Pagination */}
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
          <div className="flex flex-col items-center justify-center py-16">
            <HiOutlineGift className="w-16 h-16 text-gray-200" />
            <p className="text-gray-400 text-sm mt-4">Nenhum cupom encontrado</p>
            <p className="text-gray-300 text-xs">Crie um novo cupom para comecar</p>
          </div>
        )}
      </div>

      {/* ─── MODAL NOVO CUPOM ─── */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-primary">Novo Cupom de Desconto</h3>
                <p className="text-sm text-gray-400 mt-0.5">Gere e envie via WhatsApp</p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Client search */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    value={buscaCliente}
                    onChange={(e) => handleBuscaCliente(e.target.value)}
                    placeholder="Buscar por nome..."
                    className={`w-full ${inputBase} pl-10`}
                  />
                  {dropdownCliente && clientesResult.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-48 overflow-y-auto">
                      {clientesResult.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => selecionarCliente(c)}
                          className="w-full px-4 py-3 text-left hover:bg-light/50 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-700">{c.nome}</p>
                            <p className="text-xs text-gray-400">{maskCPF(c.cpf)} · {c.telefone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clienteSelecionado && (
                  <div className="mt-2 bg-light/50 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-primary">{clienteSelecionado.nome}</p>
                      <p className="text-xs text-gray-400">{clienteSelecionado.telefone}</p>
                    </div>
                    <button
                      onClick={() => { setClienteSelecionado(null); setBuscaCliente('') }}
                      className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 cursor-pointer"
                    >
                      <HiOutlineX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Tipo de desconto toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Tipo de Desconto <span className="text-red-400">*</span>
                </label>
                <div className="flex rounded-2xl bg-gray-100 p-1 mb-4">
                  <button
                    onClick={() => setTipoDesconto('percentual')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      tipoDesconto === 'percentual'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Porcentagem (%)
                  </button>
                  <button
                    onClick={() => setTipoDesconto('valor')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      tipoDesconto === 'valor'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Valor em Reais (R$)
                  </button>
                </div>

                {tipoDesconto === 'percentual' ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {PERCENTUAIS.map((p) => (
                        <button
                          key={p}
                          onClick={() => handlePercentualBtn(p)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            percentual === p && !percentualCustom
                              ? 'bg-accent text-white shadow-md shadow-accent/30'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={percentualCustom}
                        onChange={(e) => handlePercentualCustom(e.target.value)}
                        placeholder="Outro valor"
                        className={`${inputBase} w-32`}
                      />
                      <span className="text-sm text-gray-400">%</span>
                      <span className="text-sm text-gray-300 ml-2">Selecionado: <span className="font-semibold text-accent">{percentual}%</span></span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {VALORES_REAIS.map((v) => (
                        <button
                          key={v}
                          onClick={() => handleValorReaisBtn(v)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            valorReais === v && !valorReaisCustom
                              ? 'bg-accent text-white shadow-md shadow-accent/30'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          R${v}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorReaisCustom}
                        onChange={(e) => handleValorReaisCustom(e.target.value)}
                        placeholder="Outro valor"
                        className={`${inputBase} w-32`}
                      />
                      <span className="text-sm text-gray-300 ml-2">Selecionado: <span className="font-semibold text-accent">{formatCurrency(valorReais)}</span></span>
                    </div>
                  </>
                )}
              </div>

              {/* Validity */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Validade
                </label>
                <div className="flex flex-wrap gap-2">
                  {VALIDADES.map((v) => (
                    <button
                      key={v.dias}
                      onClick={() => setValidadeDias(v.dias)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        validadeDias === v.dias
                          ? 'bg-primary text-white shadow-md shadow-primary/30'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Motivo (opcional)
                </label>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: Cupom especial aniversário..."
                  className={`w-full ${inputBase}`}
                />
              </div>

              {/* Preview */}
              {clienteSelecionado && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Preview da Mensagem WhatsApp</p>
                  <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{previewMsg}</pre>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-100 text-gray-500 px-6 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCriarCupom}
                  disabled={enviando || !clienteSelecionado}
                  className="flex-1 bg-accent text-white px-6 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  {enviando ? 'Enviando...' : 'Gerar e Enviar WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ALTERAR STATUS ─── */}
      {statusModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setStatusModal(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-primary">Alterar Status</h3>
                <p className="text-sm text-gray-400 mt-0.5">Cupom {statusModal.codigo}</p>
              </div>
              <button
                onClick={() => setStatusModal(null)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNovoStatus(opt.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer ${
                    novoStatus === opt.value
                      ? `border-primary/30 bg-light/50 ring-2 ${opt.ring}`
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${opt.color}`} />
                  <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                  {novoStatus === opt.value && (
                    <HiOutlineCheckCircle className="w-5 h-5 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setStatusModal(null)}
                className="flex-1 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarStatus}
                disabled={salvandoStatus || novoStatus === getStatusCupom(statusModal)}
                className="flex-1 bg-accent text-white px-5 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
              >
                {salvandoStatus ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL EXCLUIR CUPOM ─── */}
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
              <h3 className="text-lg font-bold text-primary mb-2">Excluir Cupom</h3>
              <p className="text-sm text-gray-500">
                Tem certeza que deseja excluir o cupom <span className="font-semibold text-primary">{deleteModal.codigo}</span>? Esta ação não pode ser desfeita.
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

export default Cupons
