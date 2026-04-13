import api from './api'

export async function criarVenda(dados) {
  const { data } = await api.post('/vendas/', dados)
  return data
}

export async function listarVendas(params = {}) {
  const { data } = await api.get('/vendas/', { params })
  return data
}

export async function obterVenda(id) {
  const { data } = await api.get(`/vendas/${id}`)
  return data
}

export async function obterEstatisticas() {
  const { data } = await api.get('/vendas/stats')
  return data
}

export async function cancelarVenda(id) {
  const { data } = await api.put(`/vendas/${id}/cancelar`)
  return data
}

export async function vincularGarantia(vendaId, itemId, garantiaId) {
  const { data } = await api.put(`/vendas/${vendaId}/itens/${itemId}/garantia`, { garantia_id: garantiaId })
  return data
}
