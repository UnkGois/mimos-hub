import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HiOutlineStar, HiOutlinePhotograph, HiOutlineX } from 'react-icons/hi'
import { criarProduto, atualizarProduto, uploadImagemProduto } from '../services/produtoService'
import { getConfiguracoes } from '../services/configuracaoService'
import { calcularCustoProduto, calcularPrecoSugeridoLojaFisica, calcularPrecoSugeridoMarketplace, calcularTaxasCanal, calcularMargemReal, calcularLucroPorPeca, formatarMoeda, corMargem, bgCorMargem } from '../utils/calculos'
import MarginBadge from '../components/MarginBadge'

const CANAIS_CONFIG = [
  { key: 'lojaFisica', nome: 'Loja Física' },
  { key: 'shopee', nome: 'Shopee' },
  { key: 'mercadoLivre', nome: 'Mercado Livre' },
  { key: 'amazon', nome: 'Amazon' },
  { key: 'tiktok', nome: 'TikTok Shop' },
]

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

// Prefixos de categoria para geração automática de SKU
const CATEGORIA_PREFIXO = {
  'Anel': 'ANL',
  'Brinco': 'BRI',
  'Colar': 'COL',
  'Pulseira': 'PUL',
  'Tornozeleira': 'TOR',
  'Conjunto': 'CNJ',
}

// Palavras ignoradas na geração do SKU
const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'com', 'para', 'por', 'e', 'a', 'o', 'as', 'os', 'um', 'uma'])

function gerarSku(categoria, nome) {
  const prefixo = CATEGORIA_PREFIXO[categoria] || categoria.substring(0, 3).toUpperCase()

  const palavras = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove caracteres especiais
    .split(/\s+/)
    .filter(p => p.length > 0 && !STOP_WORDS.has(p.toLowerCase()))
    .slice(0, 2)
    .map(p => p.substring(0, 3).toUpperCase())

  const sufixo = palavras.length > 0 ? palavras.join('-') : ''
  const rand = String(Math.floor(Math.random() * 900) + 100)

  return sufixo ? `${prefixo}-${sufixo}-${rand}` : `${prefixo}-${rand}`
}

export default function AdicionarProduto() {
  const navigate = useNavigate()
  const location = useLocation()
  const editando = location.state?.editarProduto || null
  const [categorias, setCategorias] = useState(['Anel', 'Brinco', 'Colar', 'Pulseira', 'Tornozeleira', 'Conjunto'])
  const [tiposBanho, setTiposBanho] = useState([])
  const [salvando, setSalvando] = useState(false)

  // Imagem
  const [imagemFile, setImagemFile] = useState(null)
  const [imagemPreview, setImagemPreview] = useState(null)
  const [imagemUrl, setImagemUrl] = useState(null)

  // Seção 1: Info básica
  const [nome, setNome] = useState('')
  const [sku, setSku] = useState('')
  const [skuManual, setSkuManual] = useState(false)
  const [categoria, setCategoria] = useState(categorias[0] || '')
  const [descricao, setDescricao] = useState('')
  const [qtdEstoque, setQtdEstoque] = useState(0)
  const [limiteMinimo, setLimiteMinimo] = useState(5)

  // Seção 2: Custos
  const [valorCompra, setValorCompra] = useState(0)
  const [tipoBanho, setTipoBanho] = useState(tiposBanho[0]?.nome || '')
  const [valorGramaBanho, setValorGramaBanho] = useState(tiposBanho[0]?.valorGrama || 0)
  const [qtdGramas, setQtdGramas] = useState(0)
  const [custoEmbalagem, setCustoEmbalagem] = useState(0)
  const [outrosCustos, setOutrosCustos] = useState(0)

  // Seção 3: Canais
  const [abaAtiva, setAbaAtiva] = useState('lojaFisica')
  const [canais, setCanais] = useState({
    lojaFisica: { ativo: true, imposto: 6, margem: 100, precoFinal: 0 },
    shopee: { ativo: false, comissao: 14, taxaFixa: 4, freteGratis: true, custoFrete: 0, freteAbsorvido: true, imposto: 6, margem: 80, precoFinal: 0 },
    mercadoLivre: { ativo: false, tipoAnuncio: 'Premium', comissao: 16, taxaFixa: 6, custoFrete: 0, freteAbsorvido: true, imposto: 6, margem: 80, precoFinal: 0 },
    amazon: { ativo: false, comissao: 15, taxaItem: 0, custoFrete: 0, freteAbsorvido: false, usarFBA: false, taxaFBA: 0, imposto: 6, margem: 80, precoFinal: 0 },
    tiktok: { ativo: false, comissao: 6, taxaItem: 2, comissaoAfiliado: 0, custoFrete: 0, freteAbsorvido: false, imposto: 6, margem: 80, precoFinal: 0 },
  })

  // Carregar configurações da API
  useEffect(() => {
    getConfiguracoes().then(config => {
      if (config.categorias) setCategorias(config.categorias)
      if (config.tipos_banho) setTiposBanho(config.tipos_banho)
      if (config.taxas_padrao && !editando) {
        const tp = config.taxas_padrao
        setCanais(prev => ({
          ...prev,
          lojaFisica: { ...prev.lojaFisica, imposto: tp.lojaFisica?.imposto ?? 6, margem: tp.lojaFisica?.margem ?? 100 },
          shopee: { ...prev.shopee, comissao: tp.shopee?.comissao ?? 14, taxaFixa: tp.shopee?.taxaFixa ?? 4, imposto: tp.shopee?.imposto ?? 6, margem: tp.shopee?.margem ?? 80 },
          mercadoLivre: { ...prev.mercadoLivre, comissao: tp.mercadoLivre?.comissao ?? 16, taxaFixa: tp.mercadoLivre?.taxaFixa ?? 6, imposto: tp.mercadoLivre?.imposto ?? 6, margem: tp.mercadoLivre?.margem ?? 80 },
          amazon: { ...prev.amazon, comissao: tp.amazon?.comissao ?? 15, imposto: tp.amazon?.imposto ?? 6, margem: tp.amazon?.margem ?? 80 },
          tiktok: { ...prev.tiktok, comissao: tp.tiktok?.comissao ?? 6, taxaItem: tp.tiktok?.taxaItem ?? 2, imposto: tp.tiktok?.imposto ?? 6, margem: tp.tiktok?.margem ?? 80 },
        }))
      }
    }).catch(() => {})
  }, [])

  // Carregar dados se editando
  useEffect(() => {
    if (!editando) return
    setNome(editando.nome || '')
    setSku(editando.sku || '')
    setSkuManual(true)
    if (editando.imagem_url) {
      const baseUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`
      const fullUrl = editando.imagem_url.startsWith('http') ? editando.imagem_url : `${baseUrl.replace(/\/api$/, '')}${editando.imagem_url}`
      setImagemUrl(editando.imagem_url)
      setImagemPreview(fullUrl)
    }
    setCategoria(editando.categoria || categorias[0])
    setDescricao(editando.descricao || '')
    setQtdEstoque(editando.qtd_estoque ?? editando.qtdEstoque ?? 0)
    setLimiteMinimo(editando.limite_minimo ?? editando.limiteMinimo ?? 5)
    setValorCompra(editando.valor_compra ?? editando.custos?.valorCompra ?? 0)
    setTipoBanho(editando.tipo_banho ?? editando.custos?.tipoBanho ?? '')
    setValorGramaBanho(editando.valor_grama_banho ?? editando.custos?.valorGramaBanho ?? 0)
    setQtdGramas(editando.qtd_gramas ?? editando.custos?.qtdGramas ?? 0)
    setCustoEmbalagem(editando.custo_embalagem ?? editando.custos?.custoEmbalagem ?? 0)
    setOutrosCustos(editando.outros_custos ?? editando.custos?.outrosCustos ?? 0)
    if (editando.canais && Array.isArray(editando.canais)) {
      // Canais vêm da API como array — converter para o formato de objeto
      const canaisObj = {}
      editando.canais.forEach(c => {
        const key = c.canal
        if (['lojaFisica', 'shopee', 'mercadoLivre', 'amazon', 'tiktok'].includes(key)) {
          canaisObj[key] = {
            ativo: c.ativo,
            comissao: c.comissao || 0,
            taxaFixa: c.taxa_fixa || 0,
            taxaItem: c.taxa_item || 0,
            imposto: c.imposto || 0,
            margem: c.margem || 0,
            custoFrete: c.custo_frete || 0,
            freteAbsorvido: c.frete_absorvido || false,
            tipoAnuncio: c.tipo_anuncio || undefined,
            usarFBA: c.usar_fba || false,
            taxaFBA: c.taxa_fba || 0,
            comissaoAfiliado: c.comissao_afiliado || 0,
            freteGratis: c.frete_gratis || false,
            precoFinal: c.preco_final || 0,
          }
        }
      })
      setCanais(prev => {
        const merged = { ...prev }
        for (const key of Object.keys(canaisObj)) {
          merged[key] = { ...prev[key], ...canaisObj[key] }
        }
        return merged
      })
    }
  }, [editando])

  // Auto-gerar SKU quando nome ou categoria mudam
  useEffect(() => {
    if (skuManual || editando) return
    if (nome.trim().length >= 3) {
      setSku(gerarSku(categoria, nome))
    } else {
      setSku('')
    }
  }, [nome, categoria, skuManual, editando])

  // Auto-preencher valor da grama ao mudar tipo de banho
  useEffect(() => {
    const tipo = tiposBanho.find(t => t.nome === tipoBanho)
    if (tipo) setValorGramaBanho(tipo.valorGrama)
  }, [tipoBanho])

  const custoTotal = useMemo(() =>
    calcularCustoProduto({ valorCompra, valorGramaBanho, qtdGramas, custoEmbalagem, outrosCustos }),
    [valorCompra, valorGramaBanho, qtdGramas, custoEmbalagem, outrosCustos]
  )

  // Cálculos por canal
  const resultadosCanais = useMemo(() => {
    const res = {}
    // Loja Física
    const lf = canais.lojaFisica
    if (lf.ativo) {
      const sugerido = calcularPrecoSugeridoLojaFisica(custoTotal, lf.imposto, lf.margem)
      const preco = lf.precoFinal || sugerido
      const taxas = preco * (lf.imposto / 100)
      res.lojaFisica = {
        precoSugerido: sugerido,
        precoFinal: preco,
        taxasCanal: taxas,
        margemReal: calcularMargemReal(preco, custoTotal, taxas),
        lucro: calcularLucroPorPeca(preco, custoTotal, taxas),
      }
    }
    // Marketplaces
    for (const key of ['shopee', 'mercadoLivre', 'amazon', 'tiktok']) {
      const c = canais[key]
      if (!c.ativo) continue
      const comissaoTotal = (c.comissao || 0) + (c.comissaoAfiliado || 0)
      const taxaFixaTotal = (c.taxaFixa || 0) + (c.taxaItem || 0) + (c.usarFBA ? (c.taxaFBA || 0) : 0)
      const sugerido = calcularPrecoSugeridoMarketplace(custoTotal, {
        comissaoPercent: comissaoTotal, taxaFixa: taxaFixaTotal, custoFrete: c.custoFrete || 0,
        freteAbsorvido: c.freteAbsorvido, impostoPercent: c.imposto, margemPercent: c.margem,
      })
      const preco = c.precoFinal || sugerido
      const taxas = calcularTaxasCanal(preco, {
        comissaoPercent: comissaoTotal, taxaFixa: taxaFixaTotal, custoFrete: c.custoFrete || 0,
        freteAbsorvido: c.freteAbsorvido, impostoPercent: c.imposto,
      })
      res[key] = {
        precoSugerido: sugerido,
        precoFinal: preco,
        taxasCanal: taxas,
        margemReal: calcularMargemReal(preco, custoTotal, taxas),
        lucro: calcularLucroPorPeca(preco, custoTotal, taxas),
      }
    }
    return res
  }, [canais, custoTotal])

  const updateCanal = (key, field, value) => {
    setCanais(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const numInput = (value, setter) => ({
    type: 'number', step: '0.01', min: '0', value: value ?? '',
    onChange: e => setter(parseFloat(e.target.value) || 0),
    className: inputCls,
  })

  // Melhor canal
  const melhorCanal = useMemo(() => {
    let melhor = null
    for (const [key, r] of Object.entries(resultadosCanais)) {
      if (!melhor || r.margemReal > melhor.margem) {
        melhor = { key, nome: CANAIS_CONFIG.find(c => c.key === key)?.nome, margem: r.margemReal, lucro: r.lucro }
      }
    }
    return melhor
  }, [resultadosCanais])

  const handleSalvar = async () => {
    if (!nome || !sku) return alert('Preencha nome e SKU')
    setSalvando(true)
    try {
      const canaisPayload = Object.entries(canais).map(([key, c]) => ({
        canal: key,
        ativo: c.ativo,
        comissao: c.comissao || 0,
        taxa_fixa: c.taxaFixa || 0,
        taxa_item: c.taxaItem || 0,
        imposto: c.imposto || 0,
        margem: c.margem || 0,
        custo_frete: c.custoFrete || 0,
        frete_absorvido: c.freteAbsorvido || false,
        tipo_anuncio: c.tipoAnuncio || null,
        usar_fba: c.usarFBA || false,
        taxa_fba: c.taxaFBA || 0,
        comissao_afiliado: c.comissaoAfiliado || 0,
        frete_gratis: c.freteGratis || false,
        preco_sugerido: resultadosCanais[key]?.precoSugerido || 0,
        preco_final: resultadosCanais[key]?.precoFinal || c.precoFinal || 0,
        margem_real: resultadosCanais[key]?.margemReal || 0,
        lucro: resultadosCanais[key]?.lucro || 0,
        taxas_canal: resultadosCanais[key]?.taxasCanal || 0,
      }))

      const produto = {
        nome, sku, categoria, descricao,
        qtd_estoque: qtdEstoque,
        limite_minimo: limiteMinimo,
        valor_compra: valorCompra,
        tipo_banho: tipoBanho,
        valor_grama_banho: valorGramaBanho,
        qtd_gramas: qtdGramas,
        custo_embalagem: custoEmbalagem,
        outros_custos: outrosCustos,
        custo_total: custoTotal,
        canais: canaisPayload,
      }

      let produtoSalvo
      if (editando) {
        produtoSalvo = await atualizarProduto(editando.id, produto)
      } else {
        produtoSalvo = await criarProduto(produto)
      }
      if (imagemFile && produtoSalvo?.id) {
        await uploadImagemProduto(produtoSalvo.id, imagemFile)
      }
      navigate('/estoque')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar produto')
    } finally {
      setSalvando(false)
    }
  }

  const renderCanalInfo = (key) => {
    const labels = {
      shopee: 'Na Shopee, compras acima de R$850 com comissão de 14% têm teto de comissão de R$100.',
      mercadoLivre: 'Anúncio Premium: parcelamento em até 12x sem juros, maior visibilidade. Comissão: ~16%. Anúncio Clássico: comissão ~11%, sem parcelamento sem juros.',
      amazon: 'Amazon cobra comissão variável por faixa: até R$100 = 15%, acima de R$100,01 = 10%. A comissão final é composta (não uniforme).',
      tiktok: 'TikTok Shop oferece até 90 dias sem comissão para novos vendedores que completam missões.',
    }
    return labels[key] ? (
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 mt-4">
        ℹ️ {labels[key]}
      </div>
    ) : null
  }

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-800">{editando ? 'Editar Produto' : 'Adicionar Produto'}</h1>

      {/* SEÇÃO 1: Info Básica */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Informações Básicas</h2>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Upload de imagem */}
          <div className="flex-shrink-0">
            <label className={labelCls}>Foto do Produto</label>
            <div className="relative w-36 h-36">
              {imagemPreview ? (
                <>
                  <img src={imagemPreview} alt="Produto" className="w-36 h-36 rounded-2xl object-cover border-2 border-gray-100" />
                  <button
                    type="button"
                    onClick={() => { setImagemFile(null); setImagemPreview(null); setImagemUrl(null) }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer shadow"
                  >
                    <HiOutlineX className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <label className="w-36 h-36 rounded-2xl border-2 border-dashed border-gray-300 hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-primary/5">
                  <HiOutlinePhotograph className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-400 mt-1">Adicionar foto</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files[0]
                      if (!file) return
                      setImagemFile(file)
                      setImagemPreview(URL.createObjectURL(file))
                    }}
                  />
                </label>
              )}
            </div>
          </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nome do Produto *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Brinco Argola Ouro Rosé 3cm" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SKU *</label>
            <div className="relative">
              <input
                type="text"
                value={sku}
                onChange={e => { setSku(e.target.value); setSkuManual(true) }}
                placeholder="Gerado automaticamente"
                className={`${inputCls} pr-20`}
              />
              <button
                type="button"
                onClick={() => { setSkuManual(false); if (nome.trim().length >= 3) setSku(gerarSku(categoria, nome)) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-primary hover:text-primaryDark bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Gerar SKU automaticamente"
              >
                Gerar
              </button>
            </div>
            {!skuManual && sku && (
              <p className="text-xs text-gray-400 mt-1">Gerado automaticamente a partir do nome e categoria</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls}>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Quantidade em Estoque</label>
            <input {...numInput(qtdEstoque, setQtdEstoque)} step="1" />
          </div>
          <div>
            <label className={labelCls}>Limite Mínimo Estoque</label>
            <input {...numInput(limiteMinimo, setLimiteMinimo)} step="1" />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label className={labelCls}>Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} className={inputCls} placeholder="Descrição interna" />
          </div>
        </div>
        </div>
      </div>

      {/* SEÇÃO 2: Custos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Custos de Produção / Aquisição</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Valor de Compra/Fabricação (R$)</label>
            <input {...numInput(valorCompra, setValorCompra)} />
          </div>
          <div>
            <label className={labelCls}>Tipo de Banho</label>
            <select value={tipoBanho} onChange={e => setTipoBanho(e.target.value)} className={inputCls}>
              {tiposBanho.map(t => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Valor da Grama (R$)</label>
            <input {...numInput(valorGramaBanho, setValorGramaBanho)} />
          </div>
          <div>
            <label className={labelCls}>Quantidade de Gramas</label>
            <input {...numInput(qtdGramas, setQtdGramas)} />
          </div>
          <div>
            <label className={labelCls}>Custo da Embalagem (R$)</label>
            <input {...numInput(custoEmbalagem, setCustoEmbalagem)} />
          </div>
          <div>
            <label className={labelCls}>Outros Custos (R$)</label>
            <input {...numInput(outrosCustos, setOutrosCustos)} />
          </div>
        </div>
        <div className="mt-4 bg-primary/10 rounded-xl p-4 border border-primary/20">
          <p className="text-sm text-gray-500">Custo Total do Produto</p>
          <p className="text-2xl font-bold text-gray-800">{formatarMoeda(custoTotal)}</p>
        </div>
      </div>

      {/* SEÇÃO 3: Canais */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Canais de Venda</h2>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 mb-6 overflow-x-auto">
          {CANAIS_CONFIG.map(({ key, nome: n }) => (
            <button key={key} onClick={() => setAbaAtiva(key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${abaAtiva === key ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {n}
              {canais[key].ativo && <span className="ml-1.5 w-2 h-2 inline-block rounded-full bg-emerald-400" />}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        {CANAIS_CONFIG.map(({ key }) => {
          if (abaAtiva !== key) return null
          const c = canais[key]
          const r = resultadosCanais[key]
          return (
            <div key={key} className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-colors ${c.ativo ? 'bg-primary' : 'bg-gray-300'}`}
                  onClick={() => updateCanal(key, 'ativo', !c.ativo)}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${c.ativo ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Vender neste canal</span>
              </label>

              {c.ativo && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {key === 'lojaFisica' ? (
                      <>
                        <div>
                          <label className={labelCls}>Imposto (%)</label>
                          <input {...numInput(c.imposto, v => updateCanal(key, 'imposto', v))} />
                        </div>
                        <div>
                          <label className={labelCls}>Margem de Lucro Desejada (%)</label>
                          <input {...numInput(c.margem, v => updateCanal(key, 'margem', v))} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className={labelCls}>Comissão (%)</label>
                          <input {...numInput(c.comissao, v => updateCanal(key, 'comissao', v))} />
                        </div>
                        {key === 'shopee' && (
                          <div>
                            <label className={labelCls}>Taxa Fixa por Item (R$)</label>
                            <input {...numInput(c.taxaFixa, v => updateCanal(key, 'taxaFixa', v))} />
                          </div>
                        )}
                        {key === 'mercadoLivre' && (
                          <>
                            <div>
                              <label className={labelCls}>Tipo de Anúncio</label>
                              <select value={c.tipoAnuncio} onChange={e => {
                                const tipo = e.target.value
                                updateCanal(key, 'tipoAnuncio', tipo)
                                updateCanal(key, 'comissao', tipo === 'Premium' ? 16 : 11)
                              }} className={inputCls}>
                                <option value="Clássico">Clássico (11%)</option>
                                <option value="Premium">Premium (16%)</option>
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Taxa Fixa por Item (R$)</label>
                              <input {...numInput(c.taxaFixa, v => updateCanal(key, 'taxaFixa', v))} />
                            </div>
                          </>
                        )}
                        {key === 'amazon' && (
                          <>
                            <div>
                              <label className={labelCls}>Taxa por Item (R$)</label>
                              <input {...numInput(c.taxaItem, v => updateCanal(key, 'taxaItem', v))} />
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <div className={`relative w-11 h-6 rounded-full transition-colors ${c.usarFBA ? 'bg-primary' : 'bg-gray-300'}`}
                                  onClick={() => updateCanal(key, 'usarFBA', !c.usarFBA)}>
                                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${c.usarFBA ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                                </div>
                                <span className="text-sm text-gray-700">Usar FBA</span>
                              </label>
                            </div>
                            {c.usarFBA && (
                              <div>
                                <label className={labelCls}>Taxa FBA (R$)</label>
                                <input {...numInput(c.taxaFBA, v => updateCanal(key, 'taxaFBA', v))} />
                              </div>
                            )}
                          </>
                        )}
                        {key === 'tiktok' && (
                          <>
                            <div>
                              <label className={labelCls}>Taxa por Item {'<'} R$79 (R$)</label>
                              <input {...numInput(c.taxaItem, v => updateCanal(key, 'taxaItem', v))} />
                            </div>
                            <div>
                              <label className={labelCls}>Comissão Afiliado (%)</label>
                              <input {...numInput(c.comissaoAfiliado, v => updateCanal(key, 'comissaoAfiliado', v))} />
                            </div>
                          </>
                        )}
                        <div>
                          <label className={labelCls}>Custo do Frete (R$)</label>
                          <input {...numInput(c.custoFrete, v => updateCanal(key, 'custoFrete', v))} />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`relative w-11 h-6 rounded-full transition-colors ${c.freteAbsorvido ? 'bg-primary' : 'bg-gray-300'}`}
                              onClick={() => updateCanal(key, 'freteAbsorvido', !c.freteAbsorvido)}>
                              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${c.freteAbsorvido ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-sm text-gray-700">Frete Grátis para o Cliente</span>
                          </label>
                        </div>
                        <div>
                          <label className={labelCls}>Imposto (%)</label>
                          <input {...numInput(c.imposto, v => updateCanal(key, 'imposto', v))} />
                        </div>
                        <div>
                          <label className={labelCls}>Margem de Lucro Desejada (%)</label>
                          <input {...numInput(c.margem, v => updateCanal(key, 'margem', v))} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Preço de Venda */}
                  {r && (
                    <>
                      <div className="mt-4 bg-white rounded-xl p-4 border-2 border-primary/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                          <div>
                            <label className={labelCls}>Seu Preço de Venda (R$) *</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">R$</span>
                              <input
                                type="number" step="0.01" min="0"
                                value={c.precoFinal || ''}
                                placeholder={r.precoSugerido.toFixed(2)}
                                onChange={e => updateCanal(key, 'precoFinal', parseFloat(e.target.value) || 0)}
                                className="w-full border-2 border-primary/20 rounded-xl pl-10 pr-4 py-3 text-lg font-bold text-gray-800 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-400">Sugerido: <span className="font-semibold text-gray-600">{formatarMoeda(r.precoSugerido)}</span></p>
                            <button
                              type="button"
                              onClick={() => updateCanal(key, 'precoFinal', Math.round(r.precoSugerido * 100) / 100)}
                              className="text-xs font-medium text-primary hover:text-primaryDark bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              Usar sugerido
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Indicadores */}
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className={`rounded-xl p-3 border ${bgCorMargem(r.margemReal)}`}>
                          <p className="text-xs text-gray-500">Margem Real</p>
                          <p className={`text-lg font-bold ${corMargem(r.margemReal)}`}>{r.margemReal.toFixed(1)}%</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-500">Lucro por Peça</p>
                          <p className={`text-lg font-bold ${r.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatarMoeda(r.lucro)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-500">Taxas do Canal</p>
                          <p className="text-lg font-bold text-gray-800">{formatarMoeda(r.taxasCanal)}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {renderCanalInfo(key)}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* SEÇÃO 4: Resumo Comparativo */}
      {Object.keys(resultadosCanais).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumo Comparativo</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Métrica</th>
                  {CANAIS_CONFIG.filter(c => resultadosCanais[c.key]).map(c => (
                    <th key={c.key} className={`text-center py-2 px-3 font-medium ${melhorCanal?.key === c.key ? 'text-primary' : 'text-gray-500'}`}>
                      {melhorCanal?.key === c.key && <HiOutlineStar className="inline w-4 h-4 mr-1" />}
                      {c.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Preço Final', fn: r => formatarMoeda(r.precoFinal) },
                  { label: 'Custo Total', fn: () => formatarMoeda(custoTotal) },
                  { label: 'Taxas do Canal', fn: r => formatarMoeda(r.taxasCanal) },
                  { label: 'Lucro Líquido', fn: r => formatarMoeda(r.lucro), bold: true },
                  { label: 'Margem Real', fn: r => <MarginBadge margem={r.margemReal} />, bold: true },
                ].map(row => (
                  <tr key={row.label} className="border-b border-gray-50">
                    <td className={`py-2.5 px-3 text-gray-600 ${row.bold ? 'font-semibold' : ''}`}>{row.label}</td>
                    {CANAIS_CONFIG.filter(c => resultadosCanais[c.key]).map(c => (
                      <td key={c.key} className={`py-2.5 px-3 text-center ${row.bold ? 'font-semibold' : ''} ${melhorCanal?.key === c.key ? 'bg-primary/5' : ''}`}>
                        {row.fn(resultadosCanais[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {melhorCanal && (
            <div className="mt-4 bg-primary/10 rounded-xl p-4 border border-primary/20 text-center">
              <p className="text-sm text-gray-600">
                <HiOutlineStar className="inline w-4 h-4 text-primary mr-1" />
                <strong>Canal mais rentável:</strong> {melhorCanal.nome} com margem de {melhorCanal.margem.toFixed(1)}% (lucro de {formatarMoeda(melhorCanal.lucro)} por peça)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Botão Salvar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-40">
        <div className="max-w-5xl mx-auto">
          <button onClick={handleSalvar} disabled={salvando}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primaryDark transition-colors shadow-lg disabled:opacity-60">
            {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Salvar Produto'}
          </button>
        </div>
      </div>
    </div>
  )
}
