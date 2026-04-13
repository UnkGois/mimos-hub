import { useState, useEffect, useMemo } from 'react'
import { HiOutlineSearch, HiOutlineDownload, HiOutlinePlusCircle, HiOutlineCube, HiOutlinePrinter, HiOutlineTrash } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import { getProdutos, excluirProduto } from '../services/produtoService'
import { getConfiguracoes } from '../services/configuracaoService'
import { formatarMoeda } from '../utils/calculos'
import { exportarCSV } from '../utils/csvExport'
import MarginBadge from '../components/MarginBadge'
import DrawerPanel from '../components/DrawerPanel'
import EtiquetaModal from '../components/EtiquetaModal'

export default function Estoque() {
  const navigate = useNavigate()
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [selecionado, setSelecionado] = useState(null)
  const [etiquetaProduto, setEtiquetaProduto] = useState(null)
  const [selecionados, setSelecionados] = useState(new Set())
  const [categorias, setCategorias] = useState([])

  const carregarProdutos = async () => {
    try {
      const params = {}
      if (busca) params.busca = busca
      if (filtroCategoria) params.categoria = filtroCategoria
      if (filtroStatus) params.status = filtroStatus
      const data = await getProdutos(params)
      setProdutos(data.items || [])
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
    }
  }

  useEffect(() => {
    carregarProdutos()
    getConfiguracoes().then(c => setCategorias(c.categorias || [])).catch(() => {})
  }, [])

  useEffect(() => { carregarProdutos() }, [busca, filtroCategoria, filtroStatus])

  const filtrados = produtos

  const statusProduto = (p) => {
    if (p.qtd_estoque === 0) return { label: 'Esgotado', cls: 'bg-red-100 text-red-700' }
    if (p.qtd_estoque <= (p.limite_minimo || 5)) return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700' }
    return { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' }
  }

  const rowBg = (p) => {
    if (p.qtd_estoque === 0) return 'bg-red-50/50'
    if (p.qtd_estoque <= (p.limite_minimo || 5)) return 'bg-amber-50/50'
    return ''
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover este produto?')) return
    try {
      await excluirProduto(id)
      await carregarProdutos()
      setSelecionado(null)
    } catch (err) {
      console.error('Erro ao excluir:', err)
    }
  }

  const handleDeleteLote = async () => {
    if (selecionados.size === 0) return
    if (!confirm(`Deseja remover ${selecionados.size} produto${selecionados.size > 1 ? 's' : ''}?`)) return
    try {
      await Promise.all([...selecionados].map(id => excluirProduto(id)))
      setSelecionados(new Set())
      await carregarProdutos()
    } catch (err) {
      console.error('Erro ao excluir em lote:', err)
    }
  }

  const getProdutosSelecionados = () => produtos.filter(p => selecionados.has(p.id))

  const getCanalByKey = (p, key) => p.canais?.find(c => c.canal === key)

  const imgUrl = (p) => {
    if (!p.imagem_url) return null
    if (p.imagem_url.startsWith('http')) return p.imagem_url
    const base = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`
    return `${base.replace(/\/api$/, '')}${p.imagem_url}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Inventário</h1>
        <button onClick={() => navigate('/estoque/novo')} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors shadow-sm">
          <HiOutlinePlusCircle className="w-5 h-5" /> Adicionar Produto
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar por nome, SKU ou categoria..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-sm" />
          </div>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white">
            <option value="">Todas categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white">
            <option value="">Todos status</option>
            <option value="OK">OK</option>
            <option value="Baixo">Baixo</option>
            <option value="Esgotado">Esgotado</option>
          </select>
          <button onClick={() => exportarCSV(filtrados)} className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors text-gray-600">
            <HiOutlineDownload className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={() => setEtiquetaProduto(selecionados.size > 0 ? getProdutosSelecionados() : produtos[0])}
            disabled={produtos.length === 0}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-50"
          >
            <HiOutlinePrinter className="w-4 h-4" />
            {selecionados.size > 0 ? `Etiquetas (${selecionados.size})` : 'Etiquetas'}
          </button>
          {selecionados.size > 0 && (
            <button
              onClick={handleDeleteLote}
              className="flex items-center gap-2 border border-red-200 px-4 py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors text-red-600"
            >
              <HiOutlineTrash className="w-4 h-4" />
              Excluir ({selecionados.size})
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtrados.length > 0 && selecionados.size === filtrados.length}
                      onChange={e => {
                        if (e.target.checked) setSelecionados(new Set(filtrados.map(p => p.id)))
                        else setSelecionados(new Set())
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 cursor-pointer accent-primary"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Produto</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">SKU</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Categoria</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Estoque</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Limite</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Custo</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Preço Loja</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const st = statusProduto(p)
                  return (
                    <tr key={p.id} onClick={() => setSelecionado(p)} className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50/50 transition-colors ${rowBg(p)} ${selecionados.has(p.id) ? 'bg-primary/5' : ''}`}>
                      <td className="py-3 px-3 w-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selecionados.has(p.id)}
                          onChange={e => {
                            const novo = new Set(selecionados)
                            if (e.target.checked) novo.add(p.id)
                            else novo.delete(p.id)
                            setSelecionados(novo)
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {imgUrl(p) ? (
                            <img src={imgUrl(p)} alt={p.nome} className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 p-0.5 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <HiOutlineCube className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <span className="font-medium text-gray-800 truncate max-w-[160px]">{p.nome}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">{p.sku}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{p.categoria}</span>
                      </td>
                      <td className={`py-3 px-4 text-center font-semibold ${p.qtd_estoque === 0 ? 'text-red-600' : p.qtd_estoque <= (p.limite_minimo || 5) ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {p.qtd_estoque}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500">{p.limite_minimo}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatarMoeda(p.custo_total)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatarMoeda(getCanalByKey(p, 'lojaFisica')?.preco_final || 0)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <HiOutlineCube className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">Nenhum produto encontrado</p>
            <p className="text-gray-400 text-sm mt-1">Adicione seu primeiro produto para começar</p>
            <button onClick={() => navigate('/estoque/novo')} className="mt-4 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors">
              Adicionar Produto
            </button>
          </div>
        )}
      </div>

      {/* Drawer de detalhes */}
      <DrawerPanel open={!!selecionado} onClose={() => setSelecionado(null)} title={selecionado?.nome || ''}>
        {selecionado && (
          <div className="space-y-6">
            {imgUrl(selecionado) && (
              <div className="w-full h-48 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                <img src={imgUrl(selecionado)} alt={selecionado.nome} className="max-w-full max-h-full object-contain p-2" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400">SKU</p><p className="font-mono text-sm">{selecionado.sku}</p></div>
              <div><p className="text-xs text-gray-400">Categoria</p><p className="text-sm">{selecionado.categoria}</p></div>
              <div><p className="text-xs text-gray-400">Estoque</p><p className="text-sm font-semibold">{selecionado.qtd_estoque}</p></div>
              <div><p className="text-xs text-gray-400">Limite Mínimo</p><p className="text-sm">{selecionado.limite_minimo}</p></div>
            </div>

            <div className="bg-primary/10 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Custo Total do Produto</p>
              <p className="text-xl font-bold text-gray-800">{formatarMoeda(selecionado.custo_total)}</p>
            </div>

            {selecionado.descricao && (
              <div><p className="text-xs text-gray-400">Descrição</p><p className="text-sm text-gray-600">{selecionado.descricao}</p></div>
            )}

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Preços por Canal</h3>
              <div className="space-y-2">
                {[
                  { key: 'lojaFisica', nome: 'Loja Física' },
                  { key: 'shopee', nome: 'Shopee' },
                  { key: 'mercadoLivre', nome: 'Mercado Livre' },
                  { key: 'amazon', nome: 'Amazon' },
                  { key: 'tiktok', nome: 'TikTok Shop' },
                ].map(({ key, nome }) => {
                  const canal = getCanalByKey(selecionado, key)
                  if (!canal?.ativo) return null
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-600">{nome}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatarMoeda(canal.preco_final)}</span>
                        <MarginBadge margem={canal.margem_real} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => { navigate('/estoque/novo', { state: { editarProduto: selecionado } }); setSelecionado(null) }}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors text-sm">
                Editar
              </button>
              <button onClick={() => setEtiquetaProduto(selecionado)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-semibold flex items-center gap-1.5">
                <HiOutlinePrinter className="w-4 h-4" />
                Etiqueta
              </button>
              <button onClick={() => handleDelete(selecionado.id)}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-semibold">
                Excluir
              </button>
            </div>
          </div>
        )}
      </DrawerPanel>

      {/* Modal de etiquetas */}
      <EtiquetaModal
        open={!!etiquetaProduto}
        onClose={() => setEtiquetaProduto(null)}
        produtosIniciais={Array.isArray(etiquetaProduto) ? etiquetaProduto : etiquetaProduto ? [etiquetaProduto] : []}
        todosProdutos={produtos}
      />
    </div>
  )
}
