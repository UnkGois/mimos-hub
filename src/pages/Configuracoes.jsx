import { useState, useEffect, lazy, Suspense } from 'react'
import { HiOutlinePlusCircle, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi'
import { getConfiguracoes, salvarConfiguracoes } from '../services/configuracaoService'

const CalculadoraDespesas = lazy(() => import('./CalculadoraDespesas'))

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const TABS = [
  { key: 'empresa', label: 'Dados da Empresa' },
  { key: 'taxas', label: 'Taxas por Canal' },
  { key: 'alertas', label: 'Alertas de Estoque' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'banhos', label: 'Tipos de Banho' },
  { key: 'despesas', label: 'Calculadora Despesas' },
]

export default function Configuracoes() {
  const [config, setConfig] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('empresa')
  const [salvo, setSalvo] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    getConfiguracoes().then(data => {
      setConfig(data)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [])

  const update = (path, value) => {
    setConfig(prev => {
      const novo = { ...prev }
      const keys = path.split('.')
      let obj = novo
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] }
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
      return novo
    })
  }

  const handleSalvar = async () => {
    try {
      await salvarConfiguracoes(config)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    } catch (err) {
      alert('Erro ao salvar configurações')
    }
  }

  if (carregando || !config) {
    return <div className="flex items-center justify-center min-h-[40vh]"><div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <button onClick={handleSalvar} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors shadow-sm">
          {salvo ? <><HiOutlineCheck className="w-5 h-5" /> Salvo!</> : 'Salvar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setAbaAtiva(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${abaAtiva === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Dados da Empresa */}
      {abaAtiva === 'empresa' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Dados da Empresa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome da Loja</label>
              <input type="text" value={config.empresa.nome} onChange={e => update('empresa.nome', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CNPJ</label>
              <input type="text" value={config.empresa.cnpj} onChange={e => update('empresa.cnpj', e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Endereço</label>
              <input type="text" value={config.empresa.endereco} onChange={e => update('empresa.endereco', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input type="text" value={config.empresa.telefone} onChange={e => update('empresa.telefone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="text" value={config.empresa.email} onChange={e => update('empresa.email', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* Taxas por Canal */}
      {abaAtiva === 'taxas' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Taxas Padrão por Canal</h2>
          <p className="text-sm text-gray-500 mb-4">Esses valores serão usados como padrão ao cadastrar novos produtos.</p>

          <div className="space-y-6">
            {/* Loja Física */}
            <div className="border border-gray-100 rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-3">Loja Física</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Imposto (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.lojaFisica.imposto}
                    onChange={e => update('taxas_padrao.lojaFisica.imposto', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Margem Padrão (%)</label>
                  <input type="number" step="1" value={config.taxas_padrao.lojaFisica.margem}
                    onChange={e => update('taxas_padrao.lojaFisica.margem', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Shopee */}
            <div className="border border-gray-100 rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-3">Shopee</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Comissão (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.shopee.comissao}
                    onChange={e => update('taxas_padrao.shopee.comissao', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Taxa Fixa (R$)</label>
                  <input type="number" step="0.01" value={config.taxas_padrao.shopee.taxaFixa}
                    onChange={e => update('taxas_padrao.shopee.taxaFixa', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Imposto (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.shopee.imposto}
                    onChange={e => update('taxas_padrao.shopee.imposto', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Margem Padrão (%)</label>
                  <input type="number" step="1" value={config.taxas_padrao.shopee.margem}
                    onChange={e => update('taxas_padrao.shopee.margem', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Mercado Livre */}
            <div className="border border-gray-100 rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-3">Mercado Livre</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Comissão (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.mercadoLivre.comissao}
                    onChange={e => update('taxas_padrao.mercadoLivre.comissao', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Taxa Fixa (R$)</label>
                  <input type="number" step="0.01" value={config.taxas_padrao.mercadoLivre.taxaFixa}
                    onChange={e => update('taxas_padrao.mercadoLivre.taxaFixa', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Imposto (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.mercadoLivre.imposto}
                    onChange={e => update('taxas_padrao.mercadoLivre.imposto', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Margem Padrão (%)</label>
                  <input type="number" step="1" value={config.taxas_padrao.mercadoLivre.margem}
                    onChange={e => update('taxas_padrao.mercadoLivre.margem', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Amazon */}
            <div className="border border-gray-100 rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-3">Amazon</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Comissão (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.amazon.comissao}
                    onChange={e => update('taxas_padrao.amazon.comissao', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Assinatura Mensal (R$)</label>
                  <input type="number" step="0.01" value={config.taxas_padrao.amazon.assinaturaMensal}
                    onChange={e => update('taxas_padrao.amazon.assinaturaMensal', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Imposto (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.amazon.imposto}
                    onChange={e => update('taxas_padrao.amazon.imposto', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Margem Padrão (%)</label>
                  <input type="number" step="1" value={config.taxas_padrao.amazon.margem}
                    onChange={e => update('taxas_padrao.amazon.margem', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* TikTok */}
            <div className="border border-gray-100 rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-3">TikTok Shop</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Comissão (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.tiktok.comissao}
                    onChange={e => update('taxas_padrao.tiktok.comissao', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Taxa por Item (R$)</label>
                  <input type="number" step="0.01" value={config.taxas_padrao.tiktok.taxaItem}
                    onChange={e => update('taxas_padrao.tiktok.taxaItem', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Imposto (%)</label>
                  <input type="number" step="0.1" value={config.taxas_padrao.tiktok.imposto}
                    onChange={e => update('taxas_padrao.tiktok.imposto', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Margem Padrão (%)</label>
                  <input type="number" step="1" value={config.taxas_padrao.tiktok.margem}
                    onChange={e => update('taxas_padrao.tiktok.margem', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Estoque */}
      {abaAtiva === 'alertas' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuração de Alertas</h2>
          <div className="space-y-4">
            <div className="max-w-xs">
              <label className={labelCls}>Limite mínimo padrão (unidades)</label>
              <input type="number" step="1" min="0" value={config.alerta_estoque.limiteMinimoPadrao}
                onChange={e => update('alerta_estoque.limiteMinimoPadrao', parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${config.alerta_estoque.alertaVisualDashboard ? 'bg-primary' : 'bg-gray-300'}`}
                onClick={() => update('alerta_estoque.alertaVisualDashboard', !config.alerta_estoque.alertaVisualDashboard)}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.alerta_estoque.alertaVisualDashboard ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700">Exibir alerta visual no Dashboard</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${config.alerta_estoque.alertaEmail ? 'bg-primary' : 'bg-gray-300'}`}
                onClick={() => update('alerta_estoque.alertaEmail', !config.alerta_estoque.alertaEmail)}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.alerta_estoque.alertaEmail ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <span className="text-sm text-gray-700">Notificação por e-mail</span>
                <span className="text-xs text-gray-400 block">Em breve</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Categorias */}
      {abaAtiva === 'categorias' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Categorias de Produto</h2>
          <div className="space-y-2">
            {config.categorias.map((cat, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="text" value={cat} onChange={e => {
                  const novas = [...config.categorias]
                  novas[i] = e.target.value
                  update('categorias', novas)
                }} className={`flex-1 ${inputCls}`} />
                <button onClick={() => update('categorias', config.categorias.filter((_, j) => j !== i))}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => update('categorias', [...config.categorias, ''])}
            className="mt-3 flex items-center gap-2 text-primary text-sm font-medium hover:underline">
            <HiOutlinePlusCircle className="w-4 h-4" /> Adicionar Categoria
          </button>
        </div>
      )}

      {/* Tipos de Banho */}
      {abaAtiva === 'banhos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Tipos de Banho</h2>
          <p className="text-sm text-gray-500 mb-4">Configure o preço da grama para cada tipo de banho. Esse valor será preenchido automaticamente ao cadastrar produtos.</p>
          <div className="space-y-2">
            {config.tipos_banho.map((tipo, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="text" value={tipo.nome} onChange={e => {
                  const novos = [...config.tipos_banho]
                  novos[i] = { ...novos[i], nome: e.target.value }
                  update('tipos_banho', novos)
                }} placeholder="Nome do banho" className={`flex-1 ${inputCls}`} />
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$/g</span>
                  <input type="number" step="0.01" min="0" value={tipo.valorGrama || ''} onChange={e => {
                    const novos = [...config.tipos_banho]
                    novos[i] = { ...novos[i], valorGrama: parseFloat(e.target.value) || 0 }
                    update('tipos_banho', novos)
                  }} className={`pl-12 ${inputCls}`} />
                </div>
                <button onClick={() => update('tipos_banho', config.tipos_banho.filter((_, j) => j !== i))}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => update('tipos_banho', [...config.tipos_banho, { nome: '', valorGrama: 0 }])}
            className="mt-3 flex items-center gap-2 text-primary text-sm font-medium hover:underline">
            <HiOutlinePlusCircle className="w-4 h-4" /> Adicionar Tipo de Banho
          </button>
        </div>
      )}

      {/* Aba Despesas */}
      {abaAtiva === 'despesas' && (
        <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>}>
          <CalculadoraDespesas />
        </Suspense>
      )}
    </div>
  )
}
