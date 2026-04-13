import api from './api'

export async function getConfiguracoes() {
  const { data } = await api.get('/configuracoes/')
  return data
}

export async function salvarConfiguracoes(config) {
  const { data } = await api.put('/configuracoes/', config)
  return data
}
