import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineExclamationCircle,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import LogoBranco from '../assets/BrancoMDA.svg'
import LogoRosa from '../assets/RosaMDA.svg'

// Página de login — tela dividida com branding MDA
const Login = () => {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [carregando, setCarregando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const validar = () => {
    const novosErros = {}
    if (!email.trim()) novosErros.email = 'Informe seu e-mail'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) novosErros.email = 'E-mail inválido'
    if (!senha.trim()) novosErros.senha = 'Informe sua senha'
    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErroGeral('')
    if (!validar()) return

    try {
      setCarregando(true)
      await login(email, senha)
      navigate('/')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Credenciais inválidas. Verifique seu e-mail e senha.'
      setErroGeral(msg)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Lado esquerdo — branding */}
      <div className="hidden md:flex md:w-1/2 bg-white relative flex-col items-center justify-center overflow-hidden">
        {/* Pattern de fundo sutil */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #E05297 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 text-center px-8">
          <img src={LogoRosa} alt="MDA - Mimos de Alice" className="h-28 mx-auto" />

        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="w-full md:w-1/2 bg-surface flex flex-col items-center justify-center px-6 py-12">
        {/* Logo mobile */}
        <div className="md:hidden text-center mb-10">
          <img src={LogoRosa} alt="MDA - Mimos de Alice" className="h-16 mx-auto" />
        </div>

        <div className="w-full max-w-[400px]">
          {/* Títulos */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-dark">Acesse sua conta</h2>
            <p className="text-sm text-gray-500 mt-1">Entre com suas credenciais</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo e-mail */}
            <div>
              <label className="block text-sm font-medium text-dark/80 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErros((prev) => ({ ...prev, email: '' })) }}
                  placeholder="seu@email.com"
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border bg-white text-dark placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-1 focus:shadow-sm ${
                    erros.email
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-primary focus:ring-primary'
                  }`}
                />
              </div>
              {erros.email && <p className="text-red-500 text-sm mt-1">{erros.email}</p>}
            </div>

            {/* Campo senha */}
            <div>
              <label className="block text-sm font-medium text-dark/80 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErros((prev) => ({ ...prev, senha: '' })) }}
                  placeholder="Sua senha"
                  className={`w-full pl-10 pr-12 py-3 rounded-lg border bg-white text-dark placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-1 focus:shadow-sm ${
                    erros.senha
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:border-primary focus:ring-primary'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {mostrarSenha
                    ? <HiOutlineEyeOff className="w-5 h-5" />
                    : <HiOutlineEye className="w-5 h-5" />
                  }
                </button>
              </div>
              {erros.senha && <p className="text-red-500 text-sm mt-1">{erros.senha}</p>}
            </div>

            {/* Erro geral */}
            {erroGeral && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                <HiOutlineExclamationCircle className="w-5 h-5 shrink-0" />
                <span>{erroGeral}</span>
              </div>
            )}

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primaryDark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {carregando ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-10">
            MDA - Mimos de Alice &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
