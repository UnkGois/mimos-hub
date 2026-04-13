import { useState, useEffect } from 'react'
import { HiOutlineCube, HiOutlineExclamation, HiOutlineTrendingUp, HiOutlineChartBar } from 'react-icons/hi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getEstatisticas, getMargensPorCanal, getProdutos, getAlertasEstoque } from '../services/produtoService'
import { formatarMoeda } from '../utils/calculos'

const CORES_CANAIS = ['#E05297', '#EE4D2D', '#FFE600', '#FF9900', '#000000']

export default function DashboardEstoque() {
  const [stats, setStats] = useState({ total: 0, baixo_estoque: 0, ticket_medio: 0, margem_media: 0 })
  const [margens, setMargens] = useState([])
  const [recentes, setRecentes] = useState([])
  const [alertas, setAlertas] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [s, m, p, a] = await Promise.all([
          getEstatisticas(),
          getMargensPorCanal(),
          getProdutos({ limit: 10 }),
          getAlertasEstoque(),
        ])
        setStats(s)
        setMargens(m)
        setRecentes(p.items || [])
        setAlertas(a)
      } catch {
        // Falha silenciosa
      }
    }
    load()
  }, [])

  const kpis = [
    { label: 'Produtos Cadastrados', valor: stats.total, icon: HiOutlineCube, cor: 'from-primary to-accent' },
    { label: 'Estoque Baixo', valor: `${stats.baixo_estoque} produtos`, icon: HiOutlineExclamation, cor: 'from-amber-400 to-orange-500' },
    { label: 'Ticket Médio', valor: formatarMoeda(stats.ticket_medio), icon: HiOutlineTrendingUp, cor: 'from-emerald-400 to-emerald-600' },
    { label: 'Margem Média', valor: `${(stats.margem_media || 0).toFixed(1)}%`, icon: HiOutlineChartBar, cor: 'from-blue-400 to-blue-600' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard — Estoque & Precificação</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.cor} flex items-center justify-center`}>
                <kpi.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-gray-500">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{kpi.valor}</p>
          </div>
        ))}
      </div>

      {/* Gráfico + Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Gráfico Margem por Canal */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Margem Média por Canal</h2>
          {margens.some(m => m.qtd_produtos > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={margens} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="canal" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="margem" radius={[6, 6, 0, 0]}>
                  {margens.map((_, i) => (
                    <Cell key={i} fill={CORES_CANAIS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>Cadastre produtos para ver as margens por canal</p>
            </div>
          )}
        </div>

        {/* Últimos Produtos */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Últimos Produtos</h2>
          {recentes.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {recentes.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{p.nome}</p>
                    <p className="text-xs text-gray-400">{p.categoria} • {p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{formatarMoeda((p.canais?.find(c => c.canal === 'lojaFisica'))?.preco_final || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>Nenhum produto cadastrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Alertas de Estoque */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Alertas de Estoque</h2>
        {alertas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Produto</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">SKU</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Qtd Atual</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Limite Mín.</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 ${p.qtd_estoque === 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <td className="py-2 px-3 font-medium text-gray-800">{p.nome}</td>
                    <td className="py-2 px-3 text-gray-500">{p.sku}</td>
                    <td className="py-2 px-3 text-center font-semibold">{p.qtd_estoque}</td>
                    <td className="py-2 px-3 text-center text-gray-500">{p.limite_minimo}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${p.qtd_estoque === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.qtd_estoque === 0 ? 'Crítico' : 'Baixo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">Nenhum alerta de estoque no momento</p>
        )}
      </div>
    </div>
  )
}
