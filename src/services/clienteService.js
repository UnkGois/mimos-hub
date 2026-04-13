import api from './api'

export async function buscarPorCPF(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '')
  const { data } = await api.get(`/clientes/cpf/${cpfLimpo}`)
  return data
}

export async function listar(params = {}) {
  const { data } = await api.get('/clientes/', { params })
  return data
}

export async function obter(id) {
  const { data } = await api.get(`/clientes/${id}`)
  return data
}

export async function criar(dados) {
  const { data } = await api.post('/clientes/', dados)
  return data
}

export async function atualizar(id, dados) {
  const { data } = await api.put(`/clientes/${id}`, dados)
  return data
}

export async function obterHistorico(id) {
  const { data } = await api.get(`/clientes/${id}/historico`)
  return data
}

export async function enviarCodigoVerificacao(telefone) {
  const { data } = await api.post('/clientes/verificar-telefone', { telefone })
  return data
}

export async function confirmarCodigo(telefone, codigo, clienteId = null) {
  const { data } = await api.post('/clientes/confirmar-codigo', { telefone, codigo, cliente_id: clienteId })
  return data
}
