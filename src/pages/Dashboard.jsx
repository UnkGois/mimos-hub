import { useState, useEffect } from 'react'
import {
  HiOutlineShoppingCart,
  HiOutlineCash,
  HiOutlineTrendingUp,
  HiOutlineCalendar,
  HiOutlineChartBar,
} from 'react-icons/hi'
import { listarVendas, obterEstatisticas } from '../services/vendaService'
import { formatarMoeda } from '../utils/calculos'

const PERIODOS = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7dias', label: '7 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes_passado', label: 'Mês passado' },
  { key: 'ano', label: 'Este ano' },
  { key: 'custom', label: 'Personalizado' },
]

const FORMA_LABEL = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  pix: 'PIX',
}

function calcularDatas(periodo) {
  const hoje = new Date()
  const fmt = (d) => d.toISOString().split('T')[0]

  switch (periodo) {
    case 'hoje':
      return { inicio: fmt(hoje), fim: fmt(hoje) }
    case '7dias': {
      const d = new Date(hoje)
      d.setDate(d.getDate() - 6)
      return { inicio: fmt(d), fim: fmt(hoje) }
    }
    case 'mes':
      return { inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: fmt(hoje) }
    case 'mes_passado': {
      const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const ultimo = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
      return { inicio: fmt(primeiro), fim: fmt(ultimo) }
    }
    case 'ano':
      return { inicio: fmt(new Date(hoje.getFullYear(), 0, 1)), fim: fmt(hoje) }
    default:
      return { inicio: '', fim: '' }
  }
}

const Dashboard = () => {
  const [periodo, setPeriodo] = useState('hoje')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [vendas, setVendas] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // Métricas calculadas do período
  const [metricasPeriodo, setMetricasPeriodo] = useState({ total: 0, faturamento: 0, ticket: 0, qtdItens: 0 })

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [statsData] = await Promise.all([obterEstatisticas()])
      setStats(statsData)

      const datas = periodo === 'custom'
        ? { inicio: customInicio, fim: customFim }
        : calcularDatas(periodo)

      const params = { limit: 200 }
      if (datas.inicio) params.data_inicio = datas.inicio
      if (datas.fim) params.data_fim = datas.fim

      const data = await listarVendas(params)
      const items = (data.items || []).filter(v => v.status === 'Concluida')
      setVendas(items)

      const faturamento = items.reduce((s, v) => s + parseFloat(v.total), 0)
      const qtdItens = items.reduce((s, v) => s + (v.itens?.length || 0), 0)
      setMetricasPeriodo({
        total: items.length,
        faturamento,
        ticket: items.length > 0 ? faturamento / items.length : 0,
        qtdItens,
      })
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarDados() }, [periodo])

  // Contagem por forma de pagamento
  const porFormaPagamento = vendas.reduce((acc, v) => {
    acc[v.forma_pagamento] = (acc[v.forma_pagamento] || { qtd: 0, total: 0 })
    acc[v.forma_pagamento].qtd += 1
    acc[v.forma_pagamento].total += parseFloat(v.total)
    return acc
  }, {})

  // Últimas 10 vendas do período
  const ultimasVendas = vendas.slice(0, 10)

  const formatData = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const inputCls = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-400">Resumo de vendas e desempenho</p>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <HiOutlineCalendar className="w-5 h-5 text-gray-400" />
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                periodo === p.key
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
          {periodo === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className={inputCls} />
              <span className="text-gray-400">até</span>
              <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className={inputCls} />
              <button onClick={carregarDados} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium cursor-pointer">Filtrar</button>
            </div>
          )}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary to-pink-400 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <HiOutlineShoppingCart className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-80">Vendas</p>
              <p className="text-3xl font-bold">{loading ? '...' : metricasPeriodo.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-400 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <HiOutlineCash className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-80">Faturamento</p>
              <p className="text-3xl font-bold">{loading ? '...' : formatarMoeda(metricasPeriodo.faturamento)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-400 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <HiOutlineTrendingUp className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-80">Ticket Médio</p>
              <p className="text-3xl font-bold">{loading ? '...' : formatarMoeda(metricasPeriodo.ticket)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-400 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <HiOutlineChartBar className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm opacity-80">Itens Vendidos</p>
              <p className="text-3xl font-bold">{loading ? '...' : metricasPeriodo.qtdItens}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendas por forma de pagamento */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Por Forma de Pagamento</h3>
          {Object.keys(porFormaPagamento).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(porFormaPagamento)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([forma, dados]) => {
                  const pct = metricasPeriodo.faturamento > 0 ? (dados.total / metricasPeriodo.faturamento * 100) : 0
                  return (
                    <div key={forma}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{FORMA_LABEL[forma] || forma}</span>
                        <span className="font-semibold text-gray-800">{formatarMoeda(dados.total)} <span className="text-xs text-gray-400">({dados.qtd})</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Sem vendas no período</p>
          )}
        </div>

        {/* Resumo geral (dados gerais do sistema) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo Geral</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Total de vendas (geral)</span>
              <span className="text-sm font-bold text-gray-800">{stats?.total_vendas || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Vendas hoje</span>
              <span className="text-sm font-bold text-emerald-600">{stats?.vendas_hoje || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Faturamento hoje</span>
              <span className="text-sm font-bold text-emerald-600">{formatarMoeda(stats?.faturamento_hoje || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Faturamento mês</span>
              <span className="text-sm font-bold text-gray-800">{formatarMoeda(stats?.faturamento_mes || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Ticket médio</span>
              <span className="text-sm font-bold text-gray-800">{formatarMoeda(stats?.ticket_medio || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">Pagamento mais usado</span>
              <span className="text-sm font-bold text-primary">{FORMA_LABEL[stats?.forma_pagamento_mais_usada] || '—'}</span>
            </div>
          </div>
        </div>

        {/* Últimas vendas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Últimas Vendas</h3>
          {ultimasVendas.length > 0 ? (
            <div className="space-y-2">
              {ultimasVendas.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.cliente_nome || 'Venda anônima'}</p>
                    <p className="text-xs text-gray-400">{formatData(v.criado_em)} · {v.itens?.length || 0} itens</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{formatarMoeda(v.total)}</p>
                    <p className="text-xs text-gray-400">{FORMA_LABEL[v.forma_pagamento]}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Sem vendas no período</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
