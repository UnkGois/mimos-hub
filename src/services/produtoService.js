import api from './api'

export async function getProdutos({ busca, categoria, status, skip = 0, limit = 50 } = {}) {
  const params = {}
  if (busca) params.busca = busca
  if (categoria) params.categoria = categoria
  if (status) params.status = status
  params.skip = skip
  params.limit = limit
  const { data } = await api.get('/produtos', { params })
  return data
}

export async function getProdutoById(id) {
  const { data } = await api.get(`/produtos/${id}`)
  return data
}

export async function criarProduto(produto) {
  const { data } = await api.post('/produtos', produto)
  return data
}

export async function atualizarProduto(id, produto) {
  const { data } = await api.put(`/produtos/${id}`, produto)
  return data
}

export async function uploadImagemProduto(id, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`/produtos/${id}/imagem`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function excluirProduto(id) {
  const { data } = await api.delete(`/produtos/${id}`)
  return data
}

export async function getEstatisticas() {
  const { data } = await api.get('/produtos/stats')
  return data
}

export async function getMargensPorCanal() {
  const { data } = await api.get('/produtos/margens')
  return data
}

export async function getAlertasEstoque() {
  const { data } = await api.get('/produtos/alertas')
  return data
}
