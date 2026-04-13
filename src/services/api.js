import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — injeta JWT em toda requisição
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mimos_hub_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — redireciona para login em 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mimos_hub_token')
      localStorage.removeItem('mimos_hub_user')
      if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/assinar/')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
