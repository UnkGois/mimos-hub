import api from './api'

export async function criarReserva(dados) {
  const { data } = await api.post('/reservas/', dados)
  return data
}

export async function listarReservas(params = {}) {
  const { data } = await api.get('/reservas/', { params })
  return data
}

export async function atualizarStatus(id, status) {
  const { data } = await api.put(`/reservas/${id}/status`, { status })
  return data
}

export async function reenviarWhatsApp(id) {
  const { data } = await api.post(`/reservas/${id}/reenviar-whatsapp`)
  return data
}

export async function enviarCheckoutCliente(telefone) {
  const { data } = await api.post(`/reservas/enviar-checkout-cliente?telefone=${telefone}`)
  return data
}

export async function notificarRetirada(id) {
  const { data } = await api.post(`/reservas/${id}/notificar-retirada`)
  return data
}

export async function obterEstatisticas(params = {}) {
  const { data } = await api.get('/reservas/stats', { params })
  return data
}
