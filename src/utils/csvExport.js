import Papa from 'papaparse'

export function exportarCSV(produtos, nomeArquivo = 'estoque_mda.csv') {
  const dados = produtos.map(p => ({
    'Nome': p.nome,
    'SKU': p.sku,
    'Categoria': p.categoria,
    'Qtd Estoque': p.qtdEstoque,
    'Limite Mínimo': p.limiteMinimo,
    'Custo Total (R$)': (p.custoTotal || 0).toFixed(2),
    'Preço Loja Física (R$)': (p.canais?.lojaFisica?.precoFinal || 0).toFixed(2),
    'Preço Shopee (R$)': (p.canais?.shopee?.precoFinal || 0).toFixed(2),
    'Preço Mercado Livre (R$)': (p.canais?.mercadoLivre?.precoFinal || 0).toFixed(2),
    'Preço Amazon (R$)': (p.canais?.amazon?.precoFinal || 0).toFixed(2),
    'Preço TikTok (R$)': (p.canais?.tiktok?.precoFinal || 0).toFixed(2),
    'Status': p.qtdEstoque === 0 ? 'Esgotado' : p.qtdEstoque <= p.limiteMinimo ? 'Baixo' : 'OK',
  }))

  const csv = '\uFEFF' + Papa.unparse(dados, { delimiter: ';' })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
