import { createContext, useContext, useState, useEffect } from 'react'
import * as authService from '../services/authService'

const AuthContext = createContext(null)

// Provedor de autenticação MDA
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!user

  // Restaurar sessão: valida token com o backend ao montar
  useEffect(() => {
    const token = localStorage.getItem('mimos_hub_token')
    if (!token) {
      setLoading(false)
      return
    }

    authService.getMe()
      .then((userData) => {
        setUser(userData)
        localStorage.setItem('mimos_hub_user', JSON.stringify(userData))
      })
      .catch(() => {
        localStorage.removeItem('mimos_hub_token')
        localStorage.removeItem('mimos_hub_user')
      })
      .finally(() => setLoading(false))
  }, [])

  // Login real via API
  const login = async (email, senha) => {
    setLoading(true)
    try {
      const data = await authService.login(email, senha)
      localStorage.setItem('mimos_hub_token', data.access_token)
      localStorage.setItem('mimos_hub_user', JSON.stringify(data.usuario))
      setUser(data.usuario)
      return data.usuario
    } finally {
      setLoading(false)
    }
  }

  // Atualiza perfil do usuário via API
  const updateProfile = async (dados) => {
    const updated = await authService.updateProfile(dados)
    setUser(updated)
    localStorage.setItem('mimos_hub_user', JSON.stringify(updated))
    return updated
  }

  // Logout — limpa state e localStorage
  const logout = () => {
    setUser(null)
    localStorage.removeItem('mimos_hub_token')
    localStorage.removeItem('mimos_hub_user')
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para consumir o contexto de autenticação
const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export { AuthProvider, useAuth }
export default AuthContext
