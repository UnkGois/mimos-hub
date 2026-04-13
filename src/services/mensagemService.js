import api from './api'

export async function listar(params = {}) {
  const { data } = await api.get('/mensagens/', { params })
  return data
}

export async function enviar(garantiaId, tipo) {
  const { data } = await api.post('/mensagens/enviar', {
    garantia_id: garantiaId,
    tipo,
  })
  return data
}

export async function reenviar(mensagemId) {
  const { data } = await api.post(`/mensagens/${mensagemId}/reenviar`)
  return data
}

export async function editar(mensagemId, conteudo, reenviar = false) {
  const { data } = await api.put(`/mensagens/${mensagemId}`, { conteudo, reenviar })
  return data
}

export async function excluir(mensagemId) {
  await api.delete(`/mensagens/${mensagemId}`)
}
