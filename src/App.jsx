import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './layouts/MainLayout'

// Lazy loading das páginas
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NovaGarantia = lazy(() => import('./pages/NovaGarantia'))
const ConsultaGarantias = lazy(() => import('./pages/ConsultaGarantias'))
const Mensagens = lazy(() => import('./pages/Mensagens'))
const Cupons = lazy(() => import('./pages/Cupons'))
const TermosRetirada = lazy(() => import('./pages/TermosRetirada'))
const AssinarTermo = lazy(() => import('./pages/AssinarTermo'))
const DashboardEstoque = lazy(() => import('./pages/DashboardEstoque'))
const Estoque = lazy(() => import('./pages/Estoque'))
const AdicionarProduto = lazy(() => import('./pages/AdicionarProduto'))
const CalculadoraDespesas = lazy(() => import('./pages/CalculadoraDespesas'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const PDV = lazy(() => import('./pages/PDV'))
const Clientes = lazy(() => import('./pages/Clientes'))
const VendasPage = lazy(() => import('./pages/Vendas'))

// Fallback de carregamento
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent" />
  </div>
)

// Componente raiz do sistema MDA
const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/assinar/:token" element={<AssinarTermo />} />

            {/* Rotas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/garantias/nova" element={<NovaGarantia />} />
                <Route path="/termos" element={<TermosRetirada />} />
                <Route path="/garantias" element={<ConsultaGarantias />} />
                <Route path="/mensagens" element={<Mensagens />} />
                <Route path="/cupons" element={<Cupons />} />
                <Route path="/estoque/dashboard" element={<DashboardEstoque />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/estoque/novo" element={<AdicionarProduto />} />
                <Route path="/pdv" element={<PDV />} />
                <Route path="/vendas" element={<VendasPage />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/despesas" element={<CalculadoraDespesas />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
