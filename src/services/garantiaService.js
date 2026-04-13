import api from './api'

export async function listar(params = {}) {
  const { data } = await api.get('/garantias/', { params })
  return data
}

export async function criar(dados) {
  const { data } = await api.post('/garantias/', dados)
  return data
}

export async function obterStats() {
  const { data } = await api.get('/garantias/stats')
  return data
}

export async function obter(id) {
  const { data } = await api.get(`/garantias/${id}`)
  return data
}

export async function downloadPDF(id) {
  const response = await api.get(`/garantias/${id}/pdf`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  const filename = response.headers['content-disposition']
    ?.split('filename=')[1]
    ?.replace(/"/g, '') || `garantia-${id}.pdf`
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function atualizarStatus(id, status) {
  const { data } = await api.put(`/garantias/${id}/status`, { status })
  return data
}

export async function excluir(id) {
  const { data } = await api.delete(`/garantias/${id}`)
  return data
}
