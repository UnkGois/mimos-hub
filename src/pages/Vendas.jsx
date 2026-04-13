import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiOutlineSearch, HiOutlineShoppingCart, HiOutlineShieldCheck, HiOutlineCash, HiOutlineCreditCard, HiOutlineQrcode } from 'react-icons/hi'
import { listarVendas, obterEstatisticas, cancelarVenda } from '../services/vendaService'
import { formatarMoeda } from '../utils/calculos'
import { useToast } from '../components/Toast'
import DrawerPanel from '../components/DrawerPanel'

const FORMA_LABEL = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  pix: 'PIX',
}
const FORMA_ICON = {
  dinheiro: HiOutlineCash,
  cartao_credito: HiOutlineCreditCard,
  cartao_debito: HiOutlineCreditCard,
  pix: HiOutlineQrcode,
}

export default function Vendas() {
  const navigate = useNavigate()
  const toast = useToast()

  const [vendas, setVendas] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [selecionada, setSelecionada] = useState(null)

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [formaFiltro, setFormaFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [skip, setSkip] = useState(0)
  const limit = 20

  const carregar = useCallback(async () => {
    try {
      const params = { skip, limit }
      if (busca) params.busca = busca
      if (statusFiltro) params.status = statusFiltro
      if (formaFiltro) params.forma_pagamento = formaFiltro
      if (dataInicio) params.data_inicio = dataInicio
      if (dataFim) params.data_fim = dataFim
      const data = await listarVendas(params)
      setVendas(data.items || [])
      setTotal(data.total || 0)
    } catch { /* silencioso */ }
  }, [busca, statusFiltro, formaFiltro, dataInicio, dataFim, skip])

  const carregarStats = useCallback(async () => {
    try { setStats(await obterEstatisticas()) } catch { /* silencioso */ }
  }, [])

  useEffect(() => { carregar(); carregarStats() }, [carregar, carregarStats])

  const handleCancelar = async (id) => {
    if (!confirm('Deseja cancelar esta venda? O estoque será restaurado.')) return
    try {
      await cancelarVenda(id)
      toast.success('Venda cancelada')
      carregar()
      carregarStats()
      setSelecionada(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao cancelar')
    }
  }

  const formatData = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const inputCls = 'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Vendas</h1>
        <button onClick={() => navigate('/pdv')} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors shadow-sm cursor-pointer">
          <HiOutlineShoppingCart className="w-5 h-5" /> Abrir PDV
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400">Vendas Hoje</p>
            <p className="text-2xl font-bold text-gray-800">{stats.vendas_hoje}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400">Faturamento Hoje</p>
            <p className="text-2xl font-bold text-emerald-600">{formatarMoeda(stats.faturamento_hoje)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400">Faturamento Mês</p>
            <p className="text-2xl font-bold text-gray-800">{formatarMoeda(stats.faturamento_mes)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400">Ticket Médio</p>
            <p className="text-2xl font-bold text-gray-800">{formatarMoeda(stats.ticket_medio)}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar por código..." value={busca} onChange={e => { setBusca(e.target.value); setSkip(0) }}
              className={`w-full pl-10 ${inputCls}`} />
          </div>
          <select value={statusFiltro} onChange={e => { setStatusFiltro(e.target.value); setSkip(0) }} className={inputCls}>
            <option value="">Todos status</option>
            <option value="Concluida">Concluída</option>
            <option value="Cancelada">Cancelada</option>
          </select>
          <select value={formaFiltro} onChange={e => { setFormaFiltro(e.target.value); setSkip(0) }} className={inputCls}>
            <option value="">Todos pagamentos</option>
            <option value="pix">PIX</option>
            <option value="cartao_credito">Crédito</option>
            <option value="cartao_debito">Débito</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
          <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setSkip(0) }} className={inputCls} />
          <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setSkip(0) }} className={inputCls} />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {vendas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Código</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Cliente</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Itens</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Total</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Pagamento</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map(v => {
                  const Icon = FORMA_ICON[v.forma_pagamento] || HiOutlineCash
                  return (
                    <tr key={v.id} onClick={() => setSelecionada(v)} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-gray-600">{v.codigo}</td>
                      <td className="py-3 px-4 text-gray-600">{formatData(v.criado_em)}</td>
                      <td className="py-3 px-4 text-gray-800">{v.cliente_nome || '—'}</td>
                      <td className="py-3 px-4 text-center">{v.itens?.length || 0}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatarMoeda(v.total)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Icon className="w-4 h-4" />
                          {FORMA_LABEL[v.forma_pagamento]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.status === 'Concluida' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {v.status === 'Concluida' ? 'Concluída' : 'Cancelada'}
                        </span>
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
            <p className="text-gray-400 text-lg">Nenhuma venda encontrada</p>
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

      {/* Drawer detalhes */}
      <DrawerPanel open={!!selecionada} onClose={() => setSelecionada(null)} title={selecionada?.codigo || ''}>
        {selecionada && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400">Data</p><p className="text-sm">{formatData(selecionada.criado_em)}</p></div>
              <div><p className="text-xs text-gray-400">Operador</p><p className="text-sm">{selecionada.operador_nome}</p></div>
              <div><p className="text-xs text-gray-400">Cliente</p><p className="text-sm">{selecionada.cliente_nome || 'Não informado'}</p></div>
              <div><p className="text-xs text-gray-400">Pagamento</p><p className="text-sm">{FORMA_LABEL[selecionada.forma_pagamento]}</p></div>
            </div>

            <div className="bg-primary/10 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total da Venda</p>
              <p className="text-xl font-bold text-gray-800">{formatarMoeda(selecionada.total)}</p>
              {parseFloat(selecionada.desconto_cupom) > 0 && (
                <p className="text-xs text-emerald-600 mt-1">Cupom: -{formatarMoeda(selecionada.desconto_cupom)} ({selecionada.cupom_codigo})</p>
              )}
              {parseFloat(selecionada.desconto_manual) > 0 && (
                <p className="text-xs text-emerald-600">Desconto: -{formatarMoeda(selecionada.desconto_manual)} {selecionada.desconto_manual_motivo && `(${selecionada.desconto_manual_motivo})`}</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Itens</h3>
              <div className="space-y-2">
                {selecionada.itens?.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.produto_nome}</p>
                      <p className="text-xs text-gray-400">{item.quantidade}x {formatarMoeda(item.preco_unitario)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatarMoeda(item.subtotal)}</span>
                      {!item.garantia_id && selecionada.status === 'Concluida' && (
                        <button
                          onClick={() => {
                            const params = new URLSearchParams({
                              produto_nome: item.produto_nome,
                              produto_valor: item.preco_unitario,
                              produto_categoria: item.produto_categoria || 'Joias',
                              loja: 'MDA - Mimos de Alice Joias - Loja Física',
                              data_compra: new Date(selecionada.criado_em).toISOString().split('T')[0],
                            })
                            if (selecionada.cliente_nome) params.set('nome', selecionada.cliente_nome)
                            navigate(`/garantias/nova?${params.toString()}`)
                          }}
                          className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <HiOutlineShieldCheck className="w-3.5 h-3.5" />
                          Garantia
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              {selecionada.status === 'Concluida' && (
                <button onClick={() => handleCancelar(selecionada.id)}
                  className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-semibold cursor-pointer">
                  Cancelar Venda
                </button>
              )}
            </div>
          </div>
        )}
      </DrawerPanel>
    </div>
  )
}
