import api from './api'

export async function listar(params = {}) {
  const { data } = await api.get('/cupons/', { params })
  return data
}

export async function gerar(clienteId, garantiaId = null) {
  const { data } = await api.post('/cupons/gerar', {
    cliente_id: clienteId,
    garantia_id: garantiaId,
  })
  return data
}

export async function validar(codigo) {
  const { data } = await api.get(`/cupons/validar/${codigo}`)
  return data
}

export async function usar(cupomId) {
  const { data } = await api.put(`/cupons/${cupomId}/usar`)
  return data
}

export async function criarManual(dados) {
  const { data } = await api.post('/cupons/', dados)
  return data
}

export async function atualizarStatus(cupomId, status) {
  const { data } = await api.put(`/cupons/${cupomId}/status`, { status })
  return data
}

export async function excluir(cupomId) {
  await api.delete(`/cupons/${cupomId}`)
}
