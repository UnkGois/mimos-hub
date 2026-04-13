import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlineShoppingCart, HiOutlineCheckCircle, HiOutlineBan,
  HiOutlineChatAlt2, HiOutlineRefresh, HiOutlineCalendar,
  HiOutlineTrendingUp, HiOutlineSearch, HiOutlineBell,
  HiOutlineShieldCheck, HiOutlineClipboardCheck,
} from 'react-icons/hi'
import { listarReservas, atualizarStatus, reenviarWhatsApp, obterEstatisticas, notificarRetirada } from '../services/reservaService'
import { formatarMoeda } from '../utils/calculos'
import { maskPhone } from '../utils/masks'
import { useToast } from '../components/Toast'
import { useNavigate } from 'react-router-dom'

const STATUS_CONFIG = {
  Reservado: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reservado' },
  AguardandoPagamento: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Aguardando Pgto' },
  Pago: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Pago' },
  Cancelado: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
  Expirado: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Expirado' },
}

const PERIODOS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: '7dias', label: '7 dias' },
  { key: 'mes', label: 'Mês' },
  { key: 'custom', label: 'Período' },
]

export default function VendasLiveShop() {
  const toast = useToast()
  const navigate = useNavigate()

  const [reservas, setReservas] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [filtroData, setFiltroData] = useState('hoje')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('todos')
  const [busca, setBusca] = useState('')
  const [skip, setSkip] = useState(0)
  const limit = 30

  const calcDatas = (periodo) => {
    const hoje = new Date()
    const fmt = d => d.toISOString().split('T')[0]
    switch (periodo) {
      case 'hoje': return { inicio: fmt(hoje), fim: fmt(hoje) }
      case 'ontem': { const d = new Date(hoje); d.setDate(d.getDate() - 1); return { inicio: fmt(d), fim: fmt(d) } }
      case '7dias': { const d = new Date(hoje); d.setDate(d.getDate() - 6); return { inicio: fmt(d), fim: fmt(hoje) } }
      case 'mes': return { inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: fmt(hoje) }
      default: return { inicio: dataInicio, fim: dataFim }
    }
  }

  const carregar = useCallback(async () => {
    try {
      const params = { skip, limit }
      if (busca) params.busca = busca
      if (abaAtiva === 'pendentes') params.status = 'Reservado'
      else if (abaAtiva === 'aguardando') params.status = 'AguardandoPagamento'
      else if (abaAtiva === 'pagos') params.status = 'Pago'
      else if (abaAtiva === 'cancelados') params.status = 'Cancelado'
      else if (abaAtiva === 'expirados') params.status = 'Expirado'
      const data = await listarReservas(params)
      setReservas(data.items || [])
      setTotal(data.total || 0)
    } catch { /* silencioso */ }
  }, [abaAtiva, busca, skip])

  const carregarStats = useCallback(async () => {
    try {
      const datas = calcDatas(filtroData)
      const params = {}
      if (datas.inicio) params.data_inicio = datas.inicio
      if (datas.fim) params.data_fim = datas.fim
      setStats(await obterEstatisticas(params))
    } catch { /* silencioso */ }
  }, [filtroData, dataInicio, dataFim])

  useEffect(() => { carregar(); carregarStats() }, [carregar, carregarStats])

  const handleStatus = async (id, novoStatus) => {
    try {
      await atualizarStatus(id, novoStatus)
      toast.success(`Status: ${novoStatus}`)
      carregar()
      carregarStats()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  const handleNotificar = async (id) => {
    try {
      await notificarRetirada(id)
      toast.success('Cliente notificado!')
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao notificar') }
  }

  const handleReenviar = async (id, statusAtual) => {
    try {
      if (statusAtual === 'Cancelado' || statusAtual === 'Expirado') {
        await atualizarStatus(id, 'Reservado')
      }
      await reenviarWhatsApp(id)
      toast.success('Reenviado! Status: Reservado')
      carregar()
      carregarStats()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao reenviar') }
  }

  const formatData = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const inputCls = 'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vendas Live Shop</h1>
          <p className="text-sm text-gray-400">Acompanhe as reservas e conversões das lives</p>
        </div>
        <button onClick={() => navigate('/live-shop')}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors shadow-sm cursor-pointer">
          <HiOutlineShoppingCart className="w-5 h-5" /> Abrir Live Shop
        </button>
      </div>

      {/* Filtro de data */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <HiOutlineCalendar className="w-5 h-5 text-gray-400" />
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => { setFiltroData(p.key); setSkip(0) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                filtroData === p.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}>{p.label}</button>
          ))}
          {filtroData === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
              <span className="text-gray-400">até</span>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>
      </div>

      {/* Métricas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.pagos}</p>
            <p className="text-xs text-gray-400">Pagos</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pendentes}</p>
            <p className="text-xs text-gray-400">Pendentes</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.cancelados}</p>
            <p className="text-xs text-gray-400">Cancelados</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{stats.expirados}</p>
            <p className="text-xs text-gray-400">Expirados (auto)</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-primary/20 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.taxa_conversao}%</p>
            <p className="text-xs text-gray-400">Conversão</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-center text-white">
            <p className="text-2xl font-bold">{formatarMoeda(stats.faturamento)}</p>
            <p className="text-xs opacity-80">Faturamento</p>
          </div>
        </div>
      )}

      {/* Filtros + Busca */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={busca} onChange={e => { setBusca(e.target.value); setSkip(0) }}
              placeholder="Buscar por código, nome ou produto..."
              className={`w-full pl-10 ${inputCls}`} />
          </div>
          <div className="flex gap-1">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'pendentes', label: 'Pendentes' },
              { key: 'aguardando', label: 'Aguardando' },
              { key: 'pagos', label: 'Pagos' },
              { key: 'cancelados', label: 'Cancelados' },
              { key: 'expirados', label: 'Expirados' },
            ].map(a => (
              <button key={a.key} onClick={() => { setAbaAtiva(a.key); setSkip(0) }}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  abaAtiva === a.key ? 'bg-primary text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}>{a.label}</button>
            ))}
          </div>
          <button onClick={() => { carregar(); carregarStats() }} className="p-2 text-gray-400 hover:text-primary cursor-pointer">
            <HiOutlineRefresh className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {reservas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Código</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Produto</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Cliente</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Tipo</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Valor</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Data</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map(r => {
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.Reservado
                  const criado = new Date(r.criado_em)
                  const agora = new Date()
                  const diffH = Math.floor((agora - criado) / (1000 * 60 * 60))
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-gray-600">{r.codigo}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-800">{r.produto_nome}</p>
                        <p className="text-xs text-gray-400">{r.quantidade}x {formatarMoeda(r.produto_preco)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-800">{r.cliente_nome || '—'}</p>
                        <p className="text-xs text-gray-400">{r.cliente_telefone ? maskPhone(r.cliente_telefone) : r.cliente_instagram || ''}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.tipo_entrega === 'entrega' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{r.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">
                        {formatarMoeda(r.produto_preco * r.quantidade)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        {r.status === 'Reservado' && diffH > 0 && (
                          <p className="text-[10px] text-amber-500 mt-0.5">Há {diffH}h</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400">{formatData(r.criado_em)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {(r.status === 'Reservado' || r.status === 'AguardandoPagamento') && (
                            <>
                              <button onClick={() => handleStatus(r.id, 'Pago')}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 cursor-pointer">
                                <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Pago
                              </button>
                              <button onClick={() => handleStatus(r.id, 'Cancelado')}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 cursor-pointer">
                                <HiOutlineBan className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            </>
                          )}
                          {r.status === 'Pago' && (
                            <>
                              {r.cliente_telefone && (
                                <button onClick={() => handleNotificar(r.id)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-600 text-xs font-medium hover:bg-purple-100 cursor-pointer">
                                  <HiOutlineBell className="w-3.5 h-3.5" />
                                  {r.tipo_entrega === 'entrega' ? 'Enviado' : 'Pronto'}
                                </button>
                              )}
                              <button onClick={() => {
                                const params = new URLSearchParams({
                                  produto_nome: r.produto_nome,
                                  produto_valor: r.produto_preco,
                                  produto_categoria: 'Joias',
                                  loja: 'MDA - Mimos de Alice Joias - Loja Física',
                                  data_compra: new Date(r.criado_em).toISOString().split('T')[0],
                                })
                                if (r.cliente_nome) params.set('nome', r.cliente_nome)
                                if (r.cliente_telefone) params.set('telefone', r.cliente_telefone)
                                if (r.cliente_cpf) params.set('cpf', r.cliente_cpf)
                                navigate(`/garantias/nova?${params.toString()}`)
                              }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 cursor-pointer">
                                <HiOutlineShieldCheck className="w-3.5 h-3.5" /> Garantia
                              </button>
                            </>
                          )}
                          {r.cliente_telefone && r.status !== 'Pago' && (
                            <button onClick={() => handleReenviar(r.id, r.status)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 cursor-pointer">
                              <HiOutlineChatAlt2 className="w-3.5 h-3.5" /> Reenviar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <HiOutlineShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">Nenhuma reserva encontrada</p>
          </div>
        )}
      </div>

      {/* Paginação */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Anterior</button>
          <span className="px-4 py-2 text-sm text-gray-500">{Math.floor(skip / limit) + 1} de {Math.ceil(total / limit)}</span>
          <button onClick={() => setSkip(skip + limit)} disabled={skip + limit >= total}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Próxima</button>
        </div>
      )}
    </div>
  )
}
