import { useState, useEffect, useCallback, memo } from 'react'
import {
  HiOutlineFilter,
  HiOutlineChevronDown,
  HiOutlineSearch,
  HiOutlineEye,
  HiOutlineDownload,
  HiOutlineChatAlt,
  HiOutlineX,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineTrash,
  HiOutlineExclamation,
  HiOutlineDocumentText,
} from 'react-icons/hi'
import { maskCPF, removeMask } from '../utils/masks'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ErrorState from '../components/ErrorState'
import { useToast } from '../components/Toast'
import * as garantiaService from '../services/garantiaService'
import * as mensagemService from '../services/mensagemService'
import * as cupomService from '../services/cupomService'
import * as termoService from '../services/termoService'
import TermoEscolhaModal from '../components/TermoEscolhaModal'
import TermoRetiradaModal from '../components/TermoRetiradaModal'

const PER_PAGE = 20

// Formata data ISO para DD/MM/AAAA
const formatDateBR = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Badge de status
const StatusBadge = memo(({ status }) => {
  const key = status?.toLowerCase()
  const styles = {
    ativa: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    expirada: 'bg-gray-100 text-gray-500 border-gray-200',
    cancelada: 'bg-red-50 text-red-500 border-red-100',
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-medium border whitespace-nowrap ${styles[key] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
})

// Badge de tipo de mensagem
const TipoBadge = memo(({ tipo }) => {
  const key = tipo?.toLowerCase()
  const styles = {
    certificado: 'bg-blue-50 text-blue-600',
    lembrete: 'bg-amber-50 text-amber-600',
    desconto: 'bg-purple-50 text-purple-600',
  }
  return (
    <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${styles[key] || 'bg-gray-50 text-gray-500'}`}>
      {tipo}
    </span>
  )
})

// Dot de status de mensagem
const StatusDot = memo(({ status }) => {
  const key = status?.toLowerCase()
  const colors = {
    enviado: 'bg-emerald-400',
    falha: 'bg-red-400',
    pendente: 'bg-amber-400',
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[key] || 'bg-gray-300'}`} />
      {status}
    </span>
  )
})

// Grid de colunas da tabela
const gridCols = 'grid grid-cols-[140px_1fr_1fr_100px_100px_100px_145px]'

// Página Consulta Garantias
const ConsultaGarantias = () => {
  const toast = useToast()
  // Filtros
  const [filtros, setFiltros] = useState({
    nome: '',
    cpf: '',
    certificado: '',
    dataInicial: '',
    dataFinal: '',
    status: '',
  })
  const [filtrosAbertos, setFiltrosAbertos] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [detalhe, setDetalhe] = useState(null)

  // Dados da API
  const [garantias, setGarantias] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [baixandoPdf, setBaixandoPdf] = useState(null)
  const [reenviando, setReenviando] = useState(null)
  const [gerandoCupom, setGerandoCupom] = useState(null)
  const [excluirConfirm, setExcluirConfirm] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [termoEscolhaAberto, setTermoEscolhaAberto] = useState(null)
  const [termoPresencialAberto, setTermoPresencialAberto] = useState(null)
  const [termoTipoFluxo, setTermoTipoFluxo] = useState('presencial')

  const setFiltro = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }))
  }

  // Escape fecha modais
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (termoPresencialAberto) setTermoPresencialAberto(null)
        else if (termoEscolhaAberto) setTermoEscolhaAberto(null)
        else if (excluirConfirm) setExcluirConfirm(null)
        else if (detalhe) setDetalhe(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [detalhe, excluirConfirm, termoEscolhaAberto, termoPresencialAberto])

  // Enter nos filtros dispara busca
  const handleFilterKeyDown = (e) => {
    if (e.key === 'Enter') buscar()
  }

  // Busca garantias na API
  const carregarGarantias = useCallback(async (pag = 1, filtrosAtivos = {}) => {
    setLoading(true)
    setErro(null)
    try {
      const params = {
        skip: (pag - 1) * PER_PAGE,
        limit: PER_PAGE,
      }
      if (filtrosAtivos.nome) params.nome = filtrosAtivos.nome
      if (filtrosAtivos.cpf) params.cpf = removeMask(filtrosAtivos.cpf)
      if (filtrosAtivos.certificado) params.certificado = filtrosAtivos.certificado
      if (filtrosAtivos.dataInicial) params.data_inicio = filtrosAtivos.dataInicial
      if (filtrosAtivos.dataFinal) params.data_fim = filtrosAtivos.dataFinal
      if (filtrosAtivos.status) params.status = filtrosAtivos.status

      const data = await garantiaService.listar(params)
      setGarantias(data.items)
      setTotal(data.total)
    } catch {
      setErro('Não foi possível carregar as garantias.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carrega ao montar
  useEffect(() => {
    carregarGarantias(1, {})
  }, [carregarGarantias])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE))
  const paginaAtual = Math.min(pagina, totalPaginas)

  const buscar = () => {
    setPagina(1)
    carregarGarantias(1, filtros)
  }

  const limpar = () => {
    const vazio = { nome: '', cpf: '', certificado: '', dataInicial: '', dataFinal: '', status: '' }
    setFiltros(vazio)
    setPagina(1)
    carregarGarantias(1, {})
  }

  const mudarPagina = (novaPag) => {
    setPagina(novaPag)
    carregarGarantias(novaPag, filtros)
  }

  // Download PDF
  const handleDownloadPDF = async (id) => {
    setBaixandoPdf(id)
    try {
      await garantiaService.downloadPDF(id)
      toast.success('PDF baixado com sucesso!')
    } catch {
      toast.error('Erro ao baixar PDF.')
    } finally {
      setBaixandoPdf(null)
    }
  }

  // Reenviar WhatsApp
  const handleReenviarWhatsApp = async (garantiaId) => {
    setReenviando(garantiaId)
    try {
      await mensagemService.enviar(garantiaId, 'Certificado')
      toast.success('Mensagem reenviada com sucesso!')
    } catch {
      toast.error('Erro ao reenviar mensagem.')
    } finally {
      setReenviando(null)
    }
  }

  // Gerar cupom
  const handleGerarCupom = async (clienteId, garantiaId) => {
    setGerandoCupom(garantiaId)
    try {
      const cupom = await cupomService.gerar(clienteId, garantiaId)
      toast.success(`Cupom ${cupom.codigo} (${cupom.percentual}% OFF) gerado e enviado via WhatsApp!`)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erro ao gerar cupom.'
      toast.error(msg)
    } finally {
      setGerandoCupom(null)
    }
  }

  // Callback da escolha do tipo de termo
  const handleTermoEscolha = async (tipo) => {
    const garantia = termoEscolhaAberto
    if (tipo === 'presencial' || tipo === 'terceiro') {
      setTermoEscolhaAberto(null)
      setTermoTipoFluxo(tipo)
      setTermoPresencialAberto(garantia)
    } else if (tipo === 'whatsapp') {
      try {
        await termoService.criar({ garantia_id: garantia.id, tipo_fluxo: 'whatsapp' })
        toast.success('Link de assinatura enviado via WhatsApp!')
        setTermoEscolhaAberto(null)
      } catch (err) {
        const msg = err?.response?.data?.detail || 'Erro ao enviar link de assinatura.'
        toast.error(msg)
      }
    }
  }

  // Excluir garantia
  const handleExcluir = async () => {
    if (!excluirConfirm) return
    setExcluindo(true)
    try {
      await garantiaService.excluir(excluirConfirm.id)
      toast.success(`Garantia ${excluirConfirm.certificado} excluída com sucesso!`)
      setExcluirConfirm(null)
      setDetalhe(null)
      carregarGarantias(pagina, filtros)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erro ao excluir garantia.'
      toast.error(msg)
    } finally {
      setExcluindo(false)
    }
  }

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

  const inputBase = 'w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200'
  const selectArrow = "appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_1rem_center] pr-10"

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary">Consultar Garantias</h2>
        <p className="text-sm text-gray-400 font-light">Busque e gerencie certificados emitidos</p>
      </div>

      {/* ─── CARD DE FILTROS ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 mb-6">
        {/* Header colapsável */}
        <div
          className="flex justify-between items-center cursor-pointer select-none"
          onClick={() => setFiltrosAbertos((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <HiOutlineFilter className="w-5 h-5 text-accent" />
            <span className="font-semibold text-primary">Filtros de Busca</span>
          </div>
          <button className="p-1 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
            <HiOutlineChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${filtrosAbertos ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Conteúdo colapsável */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: filtrosAbertos ? '500px' : '0px', opacity: filtrosAbertos ? 1 : 0 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Nome do Cliente</label>
              <input
                value={filtros.nome}
                onChange={(e) => setFiltro('nome', e.target.value)}
                onKeyDown={handleFilterKeyDown}
                placeholder="Buscar por nome"
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">CPF</label>
              <input
                value={filtros.cpf}
                onChange={(e) => setFiltro('cpf', maskCPF(e.target.value))}
                onKeyDown={handleFilterKeyDown}
                placeholder="000.000.000-00"
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">N Certificado</label>
              <input
                value={filtros.certificado}
                onChange={(e) => setFiltro('certificado', e.target.value)}
                onKeyDown={handleFilterKeyDown}
                placeholder="MDA-2026-..."
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Data Inicial</label>
              <input
                type="date"
                value={filtros.dataInicial}
                onChange={(e) => setFiltro('dataInicial', e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Data Final</label>
              <input
                type="date"
                value={filtros.dataFinal}
                onChange={(e) => setFiltro('dataFinal', e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltro('status', e.target.value)}
                className={`${inputBase} ${selectArrow}`}
              >
                <option value="">Todas</option>
                <option value="Ativa">Ativas</option>
                <option value="Expirada">Expiradas</option>
                <option value="Cancelada">Canceladas</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={limpar}
              className="bg-gray-100 text-gray-500 px-5 py-2.5 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all duration-200 cursor-pointer"
            >
              Limpar
            </button>
            <button
              onClick={buscar}
              className="bg-accent text-white px-6 py-2.5 rounded-2xl shadow-md shadow-accent/20 hover:shadow-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              <HiOutlineSearch className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* ─── TABELA DE RESULTADOS ─── */}
      {loading ? (
        <LoadingSkeleton linhas={10} />
      ) : erro ? (
        <ErrorState mensagem={erro} onRetry={() => carregarGarantias(pagina, filtros)} />
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 overflow-hidden">
          {/* Contagem */}
          <div className="p-6 pb-0">
            <p className="text-sm text-gray-400">
              {total} garantia{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
            </p>
          </div>

          {garantias.length > 0 ? (
            <>
              {/* Header da tabela — visível apenas em desktop */}
              <div className={`${gridCols} text-xs text-gray-400 uppercase tracking-wider font-medium px-6 py-3 bg-light/30 border-b border-gray-100 mt-4 hidden lg:grid`}>
                <span>Certificado</span>
                <span>Cliente</span>
                <span>Produto</span>
                <span>Compra</span>
                <span>Validade</span>
                <span>Status</span>
                <span className="text-right">Ações</span>
              </div>

              {/* Linhas — desktop: grid, mobile: card */}
              {garantias.map((g) => (
                <div key={g.id}>
                  {/* Desktop row */}
                  <div className={`${gridCols} px-6 py-4 border-b border-gray-50 hover:bg-light/20 transition-colors duration-200 items-center hidden lg:grid`}>
                    <span className="text-sm font-medium text-primary">{g.certificado}</span>
                    <span className="text-sm text-gray-600 truncate pr-2">{g.cliente?.nome}</span>
                    <span className="text-sm text-gray-500 truncate pr-2">{g.produto?.nome}</span>
                    <span className="text-xs text-gray-400">{formatDateBR(g.produto?.data_compra)}</span>
                    <span className="text-xs text-gray-400">{formatDateBR(g.garantia?.termino)}</span>
                    <StatusBadge status={g.status} />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDetalhe(g)}
                        className="p-2 rounded-xl hover:bg-light text-gray-400 hover:text-primary transition-all cursor-pointer"
                        title="Ver detalhes"
                      >
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(g.id)}
                        disabled={baixandoPdf === g.id}
                        className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all cursor-pointer disabled:opacity-50"
                        title="Baixar PDF"
                      >
                        <HiOutlineDownload className={`w-4 h-4 ${baixandoPdf === g.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleReenviarWhatsApp(g.id)}
                        disabled={reenviando === g.id}
                        className="p-2 rounded-xl hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all cursor-pointer disabled:opacity-50"
                        title="Reenviar WhatsApp"
                      >
                        <HiOutlineChatAlt className={`w-4 h-4 ${reenviando === g.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={() => setExcluirConfirm(g)}
                        className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                        title="Excluir garantia"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="lg:hidden px-4 py-4 border-b border-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-primary">{g.certificado}</span>
                      <StatusBadge status={g.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{g.cliente?.nome}</p>
                    <p className="text-sm text-gray-500 truncate mb-2">{g.produto?.nome}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                      <span>Compra: {formatDateBR(g.produto?.data_compra)}</span>
                      <span>Validade: {formatDateBR(g.garantia?.termino)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetalhe(g)}
                        className="p-2 rounded-xl hover:bg-light text-gray-400 hover:text-primary transition-all cursor-pointer"
                      >
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(g.id)}
                        disabled={baixandoPdf === g.id}
                        className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <HiOutlineDownload className={`w-4 h-4 ${baixandoPdf === g.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleReenviarWhatsApp(g.id)}
                        disabled={reenviando === g.id}
                        className="p-2 rounded-xl hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <HiOutlineChatAlt className={`w-4 h-4 ${reenviando === g.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={() => setExcluirConfirm(g)}
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
            /* Estado vazio */
            <div className="flex flex-col items-center justify-center py-16">
              <HiOutlineSearch className="w-16 h-16 text-gray-200" />
              <p className="text-gray-400 text-sm mt-4">Nenhuma garantia encontrada</p>
              <p className="text-gray-300 text-xs">Tente ajustar os filtros</p>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DE DETALHES ─── */}
      {detalhe && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-primary">Detalhes da Garantia</h3>
                <StatusBadge status={detalhe.status} />
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
              {/* Certificado em destaque */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-lg font-bold text-primary">{detalhe.certificado}</span>
                <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-xl border border-primary/20">
                  Certificado MDA
                </span>
              </div>

              {/* Dados do Cliente */}
              <div className="bg-light/50 rounded-2xl p-4 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Dados do Cliente</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Nome:</span> <span className="font-medium text-primary">{detalhe.cliente?.nome}</span></p>
                  <p><span className="text-gray-400">CPF:</span> <span className="font-medium text-primary">{maskCPF(detalhe.cliente?.cpf || '')}</span></p>
                  <p><span className="text-gray-400">Telefone:</span> <span className="font-medium text-primary">{detalhe.cliente?.telefone}</span></p>
                  <p><span className="text-gray-400">E-mail:</span> <span className="font-medium text-primary">{detalhe.cliente?.email || '—'}</span></p>
                  {detalhe.cliente?.endereco && (
                    <p><span className="text-gray-400">Endereço:</span> <span className="font-medium text-primary">{detalhe.cliente.endereco}, {detalhe.cliente.numero} - {detalhe.cliente.bairro}, {detalhe.cliente.cidade}/{detalhe.cliente.uf}</span></p>
                  )}
                </div>
              </div>

              {/* Dados do Produto */}
              <div className="bg-light/50 rounded-2xl p-4 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Dados do Produto</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Produto:</span> <span className="font-medium text-primary">{detalhe.produto?.nome}</span></p>
                  <p><span className="text-gray-400">Série:</span> <span className="font-medium text-primary">{detalhe.produto?.serie || '—'}</span></p>
                  <p><span className="text-gray-400">Categoria:</span> <span className="font-medium text-primary">{detalhe.produto?.categoria}</span></p>
                  <p><span className="text-gray-400">Valor:</span> <span className="font-medium text-primary">R$ {Number(detalhe.produto?.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                  <p><span className="text-gray-400">Loja:</span> <span className="font-medium text-primary">{detalhe.produto?.loja}</span></p>
                  <p><span className="text-gray-400">Data da Compra:</span> <span className="font-medium text-primary">{formatDateBR(detalhe.produto?.data_compra)}</span></p>
                </div>
              </div>

              {/* Cobertura */}
              <div className="bg-light/50 rounded-2xl p-4 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Cobertura</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Tipo:</span> <span className="font-medium text-primary">{detalhe.garantia?.tipo}</span></p>
                  <p><span className="text-gray-400">Período:</span> <span className="font-medium text-primary">{detalhe.garantia?.periodo} meses</span></p>
                  <p><span className="text-gray-400">Início:</span> <span className="font-medium text-primary">{formatDateBR(detalhe.garantia?.inicio)}</span></p>
                  <p><span className="text-gray-400">Término:</span> <span className="font-medium text-primary">{formatDateBR(detalhe.garantia?.termino)}</span></p>
                </div>
              </div>

              {/* Cupom */}
              {detalhe.cupom && (
                <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Cupom de Desconto</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-accent">{detalhe.cupom.codigo}</span>
                    <span className="bg-accent text-white text-sm font-bold px-3 py-1 rounded-xl">
                      {Number(detalhe.cupom.percentual)}% OFF
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="p-6 pt-0">
              <div className="flex flex-col sm:flex-row sm:flex-nowrap gap-2">
                <button
                  onClick={() => handleDownloadPDF(detalhe.id)}
                  disabled={baixandoPdf === detalhe.id}
                  className="h-10 bg-blue-500 text-white rounded-2xl px-3.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-blue-600 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <HiOutlineDownload className="w-4 h-4" />
                  {baixandoPdf === detalhe.id ? 'Baixando...' : 'PDF'}
                </button>
                <button
                  onClick={() => handleReenviarWhatsApp(detalhe.id)}
                  disabled={reenviando === detalhe.id}
                  className="h-10 bg-emerald-500 text-white rounded-2xl px-3.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <HiOutlineChatAlt className="w-4 h-4" />
                  {reenviando === detalhe.id ? 'Enviando...' : 'WhatsApp'}
                </button>
                <button
                  onClick={() => handleGerarCupom(detalhe.cliente?.id, detalhe.id)}
                  disabled={gerandoCupom === detalhe.id}
                  className="h-10 bg-purple-500 text-white rounded-2xl px-3.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-purple-600 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {gerandoCupom === detalhe.id ? 'Gerando...' : 'Cupom'}
                </button>
                <button
                  onClick={() => { setDetalhe(null); setTermoEscolhaAberto(detalhe) }}
                  className="h-10 bg-amber-500 text-white rounded-2xl px-3.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all cursor-pointer whitespace-nowrap"
                >
                  <HiOutlineDocumentText className="w-4 h-4" />
                  Termo
                </button>
                <button
                  onClick={() => { setDetalhe(null); setExcluirConfirm(detalhe) }}
                  className="h-10 border border-red-300 text-red-500 rounded-2xl px-3.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all cursor-pointer whitespace-nowrap sm:ml-auto"
                >
                  <HiOutlineTrash className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ─── */}
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
              <h3 className="text-lg font-bold text-dark mb-2">Excluir Garantia</h3>
              <p className="text-sm text-gray-500">
                Tem certeza que deseja excluir a garantia{' '}
                <span className="font-semibold text-primary">{excluirConfirm.certificado}</span>{' '}
                do cliente{' '}
                <span className="font-semibold text-primary">{excluirConfirm.cliente?.nome}</span>?
              </p>
              <p className="text-xs text-red-400 mt-2">
                Esta ação não pode ser desfeita. Todas as mensagens e cupons relacionados também serão excluídos.
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

      {/* ─── MODAL ESCOLHA TIPO TERMO ─── */}
      {termoEscolhaAberto && (
        <TermoEscolhaModal
          garantia={termoEscolhaAberto}
          onClose={() => setTermoEscolhaAberto(null)}
          onEscolha={handleTermoEscolha}
        />
      )}

      {/* ─── MODAL TERMO PRESENCIAL ─── */}
      {termoPresencialAberto && (
        <TermoRetiradaModal
          garantia={termoPresencialAberto}
          onClose={() => setTermoPresencialAberto(null)}
          onSuccess={() => carregarGarantias(pagina, filtros)}
          tipoFluxo={termoTipoFluxo}
        />
      )}
    </div>
  )
}

export default ConsultaGarantias
