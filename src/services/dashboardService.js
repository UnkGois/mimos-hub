import api from './api'

export async function obterMetricas() {
  const { data } = await api.get('/dashboard/metricas')
  return data
}

export async function obterRecentes() {
  const { data } = await api.get('/dashboard/recentes')
  return data
}

export async function obterVencimentos(dias = 30) {
  const { data } = await api.get('/dashboard/vencimentos', { params: { dias } })
  return data
}
