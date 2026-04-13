import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`

const publicApi = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export async function obterTermo(token) {
  const { data } = await publicApi.get(`/termos/publico/${token}`)
  return data
}

export async function assinarCliente(token, assinatura) {
  const { data } = await publicApi.post(`/termos/publico/${token}/assinar`, { assinatura })
  return data
}
