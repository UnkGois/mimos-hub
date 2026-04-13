import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  HiOutlineChartBar,
  HiOutlineDocumentAdd,
  HiOutlineSearch,
  HiOutlineChatAlt2,
  HiOutlineGift,
  HiOutlineClipboardCheck,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineSparkles,
  HiOutlinePencil,
  HiOutlineCamera,
  HiOutlineX,
  HiOutlineCube,
  HiOutlinePlusCircle,
  HiOutlineCalculator,
  HiOutlineCog,
  HiOutlineChartSquareBar,
  HiOutlineShoppingCart,
  HiOutlineReceiptTax,
  HiOutlineUserGroup,
  HiOutlineStatusOnline,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { isValidEmail } from '../utils/validators'
import LogoBranco from '../assets/BrancoMDA.svg'
import LogoRosa from '../assets/RosaMDA.svg'

// Seções de navegação
const navSections = [
  {
    label: 'Painel',
    links: [
      { to: '/', label: 'Dashboard', icon: HiOutlineChartBar, end: true },
    ],
  },
  {
    label: 'Vendas',
    links: [
      { to: '/pdv', label: 'PDV', icon: HiOutlineShoppingCart },
      { to: '/live-shop', label: 'Live Shop', icon: HiOutlineStatusOnline },
      { to: '/vendas-live', label: 'Vendas Live', icon: HiOutlineReceiptTax },
      { to: '/vendas', label: 'Histórico PDV', icon: HiOutlineReceiptTax },
      { to: '/clientes', label: 'Clientes', icon: HiOutlineUserGroup },
    ],
  },
  {
    label: 'Garantias',
    links: [
      { to: '/garantias/nova', label: 'Nova Garantia', icon: HiOutlineDocumentAdd },
      { to: '/garantias', label: 'Consultar', icon: HiOutlineSearch, end: true },
      { to: '/termos', label: 'Termos de Retirada', icon: HiOutlineClipboardCheck },
    ],
  },
  {
    label: 'Estoque',
    links: [
      { to: '/estoque/dashboard', label: 'Dashboard', icon: HiOutlineChartSquareBar },
      { to: '/estoque', label: 'Inventário', icon: HiOutlineCube, end: true },
      { to: '/estoque/novo', label: 'Adicionar Produto', icon: HiOutlinePlusCircle },
    ],
  },
  {
    label: 'Comunicação',
    links: [
      { to: '/mensagens', label: 'Mensagens', icon: HiOutlineChatAlt2 },
      { to: '/cupons', label: 'Cupons', icon: HiOutlineGift },
    ],
  },
]

// Navegação reutilizada entre desktop e mobile
const SidebarNav = ({ onLinkClick }) => (
  <>
    <nav className="flex flex-col gap-1 px-4 flex-1 overflow-y-auto">
      {navSections.map((section, si) => (
        <div key={section.label}>
          {si > 0 && <div className="mx-2 my-3 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />}
          <p className="px-5 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-300">{section.label}</p>
          {section.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onLinkClick}
              className={({ isActive }) =>
                `group flex items-center gap-4 px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ease-in-out ${
                  isActive
                    ? 'bg-gradient-to-r from-light to-primary/10 text-primary font-semibold shadow-sm shadow-primary/10 border-l-4 border-primary'
                    : 'text-gray-400 hover:bg-light/70 hover:text-dark'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon
                    className={`w-[22px] h-[22px] transition-colors duration-300 ${
                      isActive ? 'text-primary' : 'group-hover:text-dark/60'
                    }`}
                  />
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>

    {/* Separador decorativo */}
    <div className="mx-6 my-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

    {/* Configurações */}
    <div className="px-4 mb-3">
      <NavLink
        to="/configuracoes"
        onClick={onLinkClick}
        className={({ isActive }) =>
          `group flex items-center gap-4 px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ease-in-out ${
            isActive
              ? 'bg-gradient-to-r from-light to-primary/10 text-primary font-semibold shadow-sm shadow-primary/10 border-l-4 border-primary'
              : 'text-gray-400 hover:bg-light/70 hover:text-dark'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <HiOutlineCog
              className={`w-[22px] h-[22px] transition-colors duration-300 ${
                isActive ? 'text-primary' : 'group-hover:text-dark/60'
              }`}
            />
            Configurações
          </>
        )}
      </NavLink>
    </div>

    {/* Rodapé */}
    <div className="px-6 pb-6">
      <div className="bg-light/50 rounded-2xl p-4">
        <HiOutlineSparkles className="w-4 h-4 text-primary mb-1" />
        <p className="text-xs font-semibold text-primary/60">Mimos de Alice</p>
        <p className="text-xs text-gray-300 mt-1">v1.0.0</p>
      </div>
    </div>
  </>
)

// Layout principal — visual premium com bordas suaves
const MainLayout = () => {
  const { user, logout, updateProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Dropdown de perfil
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Modal editar perfil
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', cargo: '' })
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Escape fecha modal, dropdown e sidebar mobile
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (modalOpen) setModalOpen(false)
        else if (dropdownOpen) setDropdownOpen(false)
        else if (sidebarOpen) setSidebarOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [modalOpen, dropdownOpen, sidebarOpen])

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
    navigate('/login')
  }

  const handleOpenEdit = () => {
    setDropdownOpen(false)
    setForm({
      nome: user?.nome || '',
      email: user?.email || '',
      cargo: user?.cargo || '',
    })
    setErros({})
    setModalOpen(true)
  }

  const handleSave = async () => {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome é obrigatório'
    if (!form.email.trim()) e.email = 'Email é obrigatório'
    else if (!isValidEmail(form.email)) e.email = 'Email inválido'
    setErros(e)
    if (Object.keys(e).length > 0) return

    setSalvando(true)
    try {
      await updateProfile({
        nome: form.nome.trim(),
        email: form.email.trim(),
        cargo: form.cargo.trim(),
      })
      setModalOpen(false)
      toast.success('Perfil atualizado!')
    } catch {
      toast.error('Erro ao atualizar perfil.')
    } finally {
      setSalvando(false)
    }
  }

  const inputBase = 'w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200'
  const inputError = 'border-red-300 focus:border-red-400 focus:ring-red-400/20'

  return (
    <div className="min-h-screen bg-surface">
      {/* ─── Header ─── */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-white z-50 px-8 flex items-center justify-between border-b border-gray-200">
        {/* Lado esquerdo */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-all duration-300 cursor-pointer"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <HiOutlineMenu className="w-6 h-6" />
          </button>

          <img src={LogoRosa} alt="MDA - Mimos de Alice" className="h-16" />

        </div>

        {/* Lado direito — avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-4 cursor-pointer rounded-2xl p-1.5 -m-1.5 hover:bg-gray-100 transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-accent/30">
              <span className="text-sm font-bold text-white">
                {user?.nome?.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="hidden md:block text-left">
              <p className="text-sm text-gray-700 font-medium">{user?.nome}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 min-w-[280px] z-50 overflow-hidden animate-[scale-in_0.15s_ease-out] origin-top-right">
              {/* Topo do dropdown */}
              <div className="bg-light/50 p-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center shadow-md shadow-accent/20">
                  <span className="text-2xl font-bold text-white">
                    {user?.nome?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-semibold text-primary text-center mt-2">{user?.nome}</p>
                <p className="text-xs text-gray-400 text-center">{user?.email}</p>
              </div>

              {/* Menu */}
              <div className="p-2">
                <button
                  onClick={handleOpenEdit}
                  className="w-full px-4 py-3 rounded-xl hover:bg-light flex items-center gap-3 text-sm text-gray-600 hover:text-primary transition-all cursor-pointer"
                >
                  <HiOutlinePencil className="w-4 h-4" />
                  Editar Perfil
                </button>

                <div className="border-t border-gray-100 mx-2 my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 rounded-xl hover:bg-red-50 flex items-center gap-3 text-sm text-red-400 hover:text-red-500 transition-all cursor-pointer"
                >
                  <HiOutlineLogout className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── Sidebar desktop ─── */}
      <aside className="hidden md:flex fixed left-0 top-20 w-72 h-[calc(100vh-5rem)] bg-white rounded-r-3xl shadow-xl shadow-gray-200/50 flex-col pt-8 pb-6 z-40">
        <SidebarNav />
      </aside>

      {/* ─── Sidebar mobile: overlay ─── */}
      <div
        className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ─── Sidebar mobile: painel ─── */}
      <aside
        className={`md:hidden fixed left-0 top-0 w-72 h-full bg-white z-50 rounded-r-3xl shadow-2xl flex flex-col transform transition-transform duration-500 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo mobile dentro da sidebar */}
        <div className="pt-6 px-6 mb-6">
          <img src={LogoRosa} alt="MDA - Mimos de Alice" className="h-10" />
        </div>

        <SidebarNav onLinkClick={() => setSidebarOpen(false)} />
      </aside>

      {/* ─── Área de conteúdo ─── */}
      <main className="md:ml-72 mt-20 min-h-[calc(100vh-5rem)] bg-surface p-6 md:p-8">
        <Outlet />
      </main>

      {/* ─── Modal Editar Perfil ─── */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-dark">Editar Perfil</h3>
                <p className="text-sm text-gray-400 mt-0.5">Atualize suas informações</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-6">
              {/* Avatar */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-accent/20">
                  <span className="text-3xl font-bold text-white">
                    {form.nome?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-white shadow-md flex items-center justify-center">
                  <HiOutlineCamera className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>

              {/* Campos */}
              <div className="flex flex-col gap-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Nome Completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.nome}
                    onChange={(e) => { setForm((f) => ({ ...f, nome: e.target.value })); setErros((er) => ({ ...er, nome: '' })) }}
                    placeholder="Seu nome"
                    className={`${inputBase} ${erros.nome ? inputError : ''}`}
                  />
                  {erros.nome && <p className="text-red-400 text-xs mt-1">{erros.nome}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErros((er) => ({ ...er, email: '' })) }}
                    placeholder="seu@email.com"
                    className={`${inputBase} ${erros.email ? inputError : ''}`}
                  />
                  {erros.email && <p className="text-red-400 text-xs mt-1">{erros.email}</p>}
                </div>

                {/* Cargo */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Cargo/Função
                  </label>
                  <input
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                    placeholder="Ex: Operador, Gerente..."
                    className={inputBase}
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-500 px-6 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={salvando}
                  className="flex-1 bg-accent text-white px-6 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MainLayout
