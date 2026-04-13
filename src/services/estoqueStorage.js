import { getJSON, setJSON } from '../utils/localStorage'

const KEY = 'mimos_hub_produtos'

export function getProdutos() {
  return getJSON(KEY, [])
}

export function getProdutoById(id) {
  return getProdutos().find(p => p.id === id) || null
}

export function salvarProduto(produto) {
  const produtos = getProdutos()
  const novo = {
    ...produto,
    id: produto.id || crypto.randomUUID(),
    criadoEm: produto.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  }
  produtos.push(novo)
  setJSON(KEY, produtos)
  return novo
}

export function atualizarProduto(id, dados) {
  const produtos = getProdutos()
  const idx = produtos.findIndex(p => p.id === id)
  if (idx === -1) return null
  produtos[idx] = { ...produtos[idx], ...dados, atualizadoEm: new Date().toISOString() }
  setJSON(KEY, produtos)
  return produtos[idx]
}

export function removerProduto(id) {
  const produtos = getProdutos().filter(p => p.id !== id)
  setJSON(KEY, produtos)
}

export function buscarProdutos(termo) {
  if (!termo) return getProdutos()
  const t = termo.toLowerCase()
  return getProdutos().filter(p =>
    p.nome?.toLowerCase().includes(t) ||
    p.sku?.toLowerCase().includes(t) ||
    p.categoria?.toLowerCase().includes(t)
  )
}

export function getProdutosBaixoEstoque() {
  return getProdutos().filter(p => p.qtdEstoque <= (p.limiteMinimo || 5))
}

export function getEstatisticas() {
  const produtos = getProdutos()
  const total = produtos.length
  const baixoEstoque = produtos.filter(p => p.qtdEstoque <= (p.limiteMinimo || 5)).length
  const ticketMedio = produtos.length > 0
    ? produtos.reduce((sum, p) => sum + (p.canais?.lojaFisica?.precoFinal || 0), 0) / produtos.length
    : 0
  const margemMedia = produtos.length > 0
    ? produtos.reduce((sum, p) => sum + (p.canais?.lojaFisica?.margemReal || 0), 0) / produtos.length
    : 0
  return { total, baixoEstoque, ticketMedio, margemMedia }
}

export function getMargemPorCanal() {
  const produtos = getProdutos()
  const canais = ['lojaFisica', 'shopee', 'mercadoLivre', 'amazon', 'tiktok']
  const nomes = { lojaFisica: 'Loja Física', shopee: 'Shopee', mercadoLivre: 'Mercado Livre', amazon: 'Amazon', tiktok: 'TikTok Shop' }

  return canais.map(canal => {
    const produtosCanal = produtos.filter(p => p.canais?.[canal]?.ativo)
    const margem = produtosCanal.length > 0
      ? produtosCanal.reduce((sum, p) => sum + (p.canais[canal].margemReal || 0), 0) / produtosCanal.length
      : 0
    return { canal: nomes[canal], margem: parseFloat(margem.toFixed(1)), qtdProdutos: produtosCanal.length }
  })
}
