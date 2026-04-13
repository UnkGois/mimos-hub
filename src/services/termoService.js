import api from './api'

export async function criar(dados) {
  const { data } = await api.post('/termos/', dados)
  return data
}

export async function criarDireto({ reserva_id, venda_id, tipo_fluxo = 'presencial' }) {
  const params = new URLSearchParams()
  if (reserva_id) params.set('reserva_id', reserva_id)
  if (venda_id) params.set('venda_id', venda_id)
  params.set('tipo_fluxo', tipo_fluxo)
  const { data } = await api.post(`/termos/direto?${params.toString()}`)
  return data
}

export async function criarPresencial(dados) {
  const { data } = await api.post('/termos/presencial', dados)
  return data
}

export async function listarPorGarantia(garantiaId) {
  const { data } = await api.get(`/termos/garantia/${garantiaId}`)
  return data
}

export async function listarTodos(params = {}) {
  const { data } = await api.get('/termos/todos', { params })
  return data
}

export async function obterMetricas() {
  const { data } = await api.get('/termos/metricas')
  return data
}

export async function assinarOperador(termoId, assinatura) {
  const { data } = await api.post(`/termos/${termoId}/assinar-operador`, { assinatura })
  return data
}

export async function enviarWhatsApp(termoId) {
  const { data } = await api.post(`/termos/${termoId}/enviar-whatsapp`)
  return data
}

export async function excluir(termoId) {
  await api.delete(`/termos/${termoId}`)
}

export async function downloadPDF(termoId) {
  const response = await api.get(`/termos/${termoId}/pdf`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  const filename =
    response.headers['content-disposition']
      ?.split('filename=')[1]
      ?.replace(/"/g, '') || `Termo_Retirada_${termoId}.pdf`
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
