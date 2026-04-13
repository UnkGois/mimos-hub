import api from './api'

export async function login(email, senha) {
  const { data } = await api.post('/auth/login', { email, senha })
  return data
}

export async function getMe() {
  const { data } = await api.get('/auth/me')
  return data
}

export async function updateProfile(dados) {
  const { data } = await api.put('/auth/perfil', dados)
  return data
}
