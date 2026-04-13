import { useState, useEffect, useRef } from 'react'
import {
  HiOutlineSearch, HiOutlineShoppingCart, HiOutlineCheckCircle,
  HiOutlineX, HiOutlineChatAlt2, HiOutlinePlusCircle, HiOutlineRefresh,
} from 'react-icons/hi'
import { getProdutos } from '../services/produtoService'
import { criarReserva, listarReservas, atualizarStatus, reenviarWhatsApp } from '../services/reservaService'
import { buscarPorCPF, listar as listarClientes } from '../services/clienteService'
import { formatarMoeda } from '../utils/calculos'
import { maskPhone, maskCPF, removeMask } from '../utils/masks'
import { useToast } from '../components/Toast'

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

const STATUS_CONFIG = {
  Reservado: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reservado' },
  Pago: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Pago' },
  Cancelado: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
  Expirado: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Expirado' },
}

export default function LiveShop() {
  const toast = useToast()
  const numRef = useRef(null)

  // Produtos
  const [produtos, setProdutos] = useState([])
  const [buscaProduto, setBuscaProduto] = useState('')

  // Reserva rápida
  const [produtoSelecionado, setProdutoSelecionado] = useState(null)
  const [quantidade, setQuantidade] = useState(1)
  const [tipoEntrega, setTipoEntrega] = useState('retirada')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteCpf, setClienteCpf] = useState('')
  const [clienteInstagram, setClienteInstagram] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [clienteEncontrado, setClienteEncontrado] = useState(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [sugestoesCliente, setSugestoesCliente] = useState([])
  const [showSugestoes, setShowSugestoes] = useState(false)

  // Produto avulso
  const [modalAvulso, setModalAvulso] = useState(false)
  const [avulsoNome, setAvulsoNome] = useState('')
  const [avulsoPreco, setAvulsoPreco] = useState('')

  // Reservas recentes (últimas 5)
  const [reservas, setReservas] = useState([])

  // Carregar produtos
  useEffect(() => {
    getProdutos({ limit: 200 }).then(data => setProdutos(data.items || [])).catch(() => {})
    carregarReservas()
  }, [])

  const carregarReservas = async () => {
    try {
      const data = await listarReservas({ limit: 5 })
      setReservas(data.items || [])
    } catch { /* silencioso */ }
  }

  // Preço lojaFisica
  const getPreco = (p) => {
    const canal = p.canais?.find(c => c.canal === 'lojaFisica' && c.ativo)
    return canal?.preco_final || p.custo_total || 0
  }

  // Imagem
  const imgUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    const base = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`
    return `${base.replace(/\/api$/, '')}${url}`
  }

  // Buscar clientes por nome com debounce - mostra dropdown
  useEffect(() => {
    if (clienteNome.length < 2 || clienteEncontrado) { setSugestoesCliente([]); return }
    const timer = setTimeout(async () => {
      setBuscandoCliente(true)
      try {
        const data = await listarClientes({ nome: clienteNome, limit: 10 })
        const items = data.items || []
        setSugestoesCliente(items)
        setShowSugestoes(items.length > 0)
      } catch { setSugestoesCliente([]) }
      finally { setBuscandoCliente(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [clienteNome, clienteEncontrado])

  // Buscar cliente por CPF com debounce
  useEffect(() => {
    const cpf = removeMask(clienteCpf)
    if (cpf.length < 11 || clienteEncontrado) return
    setBuscandoCliente(true)
    const timer = setTimeout(async () => {
      try {
        const data = await buscarPorCPF(cpf)
        if (data) selecionarCliente(data)
      } catch { /* não encontrado */ }
      finally { setBuscandoCliente(false) }
    }, 500)
    return () => clearTimeout(timer)
  }, [clienteCpf])

  // Buscar cliente por telefone com debounce
  useEffect(() => {
    const tel = removeMask(clienteTelefone)
    if (tel.length < 10 || clienteEncontrado) return
    setBuscandoCliente(true)
    const timer = setTimeout(async () => {
      try {
        const data = await listarClientes({ limit: 50 })
        const encontrado = (data.items || []).find(c => c.telefone === tel)
        if (encontrado) selecionarCliente(encontrado)
      } catch { /* silencioso */ }
      finally { setBuscandoCliente(false) }
    }, 500)
    return () => clearTimeout(timer)
  }, [clienteTelefone])

  const selecionarCliente = (c) => {
    setClienteEncontrado(c)
    setClienteNome(c.nome)
    if (c.telefone) setClienteTelefone(maskPhone(c.telefone))
    if (c.cpf) setClienteCpf(maskCPF(c.cpf))
    setSugestoesCliente([])
    setShowSugestoes(false)
  }

  const addProdutoAvulso = () => {
    if (!avulsoNome.trim() || !avulsoPreco || parseFloat(avulsoPreco) <= 0) {
      toast.error('Preencha nome e preço')
      return
    }
    setProdutoSelecionado({
      id: null,
      nome: avulsoNome.trim(),
      sku: 'AVULSO',
      categoria: 'Avulso',
      qtd_estoque: 999,
      canais: [{ canal: 'lojaFisica', ativo: true, preco_final: parseFloat(avulsoPreco) }],
      _avulso: true,
      _preco: parseFloat(avulsoPreco),
    })
    setQuantidade(1)
    setAvulsoNome('')
    setAvulsoPreco('')
    setModalAvulso(false)
  }

  const limparCliente = () => {
    setClienteEncontrado(null)
    setClienteNome('')
    setClienteTelefone('')
    setClienteCpf('')
    setClienteInstagram('')
    setSugestoesCliente([])
    setShowSugestoes(false)
  }

  // Contar vendas por produto (das reservas)
  const vendasPorProduto = reservas.reduce((acc, r) => {
    if (r.produto_id) acc[r.produto_id] = (acc[r.produto_id] || 0) + r.quantidade
    return acc
  }, {})

  // Top mais vendidos (máximo 4, com estoque)
  const produtosMaisVendidos = Object.entries(vendasPorProduto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => produtos.find(p => p.id === parseInt(id)))
    .filter(Boolean)

  // Filtrar produtos por busca
  const produtosFiltrados = produtos.filter(p => {
    if (!buscaProduto) return false
    const q = buscaProduto.toLowerCase()
    return (
      p.nome.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      String(p.id).includes(q)
    )
  })

  // O que exibir: se buscando → resultados da busca, senão → mais vendidos + último selecionado
  const produtosExibidos = buscaProduto
    ? produtosFiltrados
    : produtosMaisVendidos.length > 0
      ? produtosMaisVendidos
      : produtos.filter(p => p.qtd_estoque > 0).slice(0, 4)

  // Selecionar produto por número (ID) ou clique
  const selecionarPorNumero = (num) => {
    const p = produtos.find(pr => pr.id === parseInt(num))
    if (p) {
      setProdutoSelecionado(p)
      setQuantidade(1)
    } else {
      toast.error(`Produto #${num} não encontrado`)
    }
  }

  // Enviar reserva
  const handleReservar = async () => {
    if (!produtoSelecionado) { toast.error('Selecione um produto'); return }
    if (!clienteNome.trim()) { toast.error('Informe o nome do cliente'); return }
    if (!clienteTelefone || removeMask(clienteTelefone).length < 10) {
      toast.error('Informe o telefone (WhatsApp) do cliente')
      return
    }

    setEnviando(true)
    try {
      const isAvulso = produtoSelecionado._avulso
      const dados = {
        produto_id: isAvulso ? null : produtoSelecionado.id,
        produto_nome_avulso: isAvulso ? produtoSelecionado.nome : null,
        produto_preco_avulso: isAvulso ? produtoSelecionado._preco : null,
        quantidade,
        tipo_entrega: tipoEntrega,
        cliente_nome: clienteEncontrado ? clienteEncontrado.nome : (clienteNome || null),
        cliente_telefone: clienteEncontrado ? clienteEncontrado.telefone : (clienteTelefone ? removeMask(clienteTelefone) : null),
        cliente_cpf: clienteEncontrado ? clienteEncontrado.cpf : (clienteCpf ? removeMask(clienteCpf) : null),
        cliente_instagram: clienteInstagram || null,
      }
      const reserva = await criarReserva(dados)

      if (tipoEntrega === 'entrega') {
        toast.success(`Reserva ${reserva.codigo} criada! Link de checkout enviado via WhatsApp.`)
      } else if (reserva.whatsapp_enviado === 'enviado') {
        toast.success(`Reserva ${reserva.codigo} criada e PIX enviado via WhatsApp!`)
      } else {
        toast.success(`Reserva ${reserva.codigo} criada!`)
      }

      // Reset
      setProdutoSelecionado(null)
      setQuantidade(1)
      setTipoEntrega('retirada')
      setClienteNome('')
      setClienteTelefone('')
      setClienteCpf('')
      setClienteInstagram('')
      setClienteEncontrado(null)
      setSugestoesCliente([])
      setShowSugestoes(false)
      carregarReservas()

      // Atualizar estoque
      setProdutos(prev => prev.map(p =>
        p.id === produtoSelecionado.id
          ? { ...p, qtd_estoque: p.qtd_estoque - quantidade }
          : p
      ))

      numRef.current?.focus()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar reserva')
    } finally { setEnviando(false) }
  }

  const handleCancelar = async (id) => {
    try {
      await atualizarStatus(id, 'Cancelado')
      toast.success('Pedido cancelado')
      carregarReservas()
      getProdutos({ limit: 200 }).then(data => setProdutos(data.items || []))
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  const handleReenviar = async (id) => {
    try {
      await atualizarStatus(id, 'Reservado')
      await reenviarWhatsApp(id)
      toast.success('Reenviado! Status voltou para Pendente')
      carregarReservas()
      getProdutos({ limit: 200 }).then(data => setProdutos(data.items || []))
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao reenviar') }
  }

  const handlePago = async (id) => {
    try {
      await atualizarStatus(id, 'Pago')
      toast.success('Pagamento confirmado!')
      carregarReservas()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  const formatData = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* ─── Coluna Esquerda: Produtos ─── */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Live Shop</h1>
            <p className="text-sm text-gray-400">Selecione o produto e envie a reserva via WhatsApp</p>
          </div>
          <button onClick={() => setModalAvulso(true)}
            className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">
            <HiOutlinePlusCircle className="w-4 h-4" /> Produto Avulso
          </button>
        </div>

        {/* Busca rápida por número */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={numRef}
              type="text"
              value={buscaProduto}
              onChange={e => setBuscaProduto(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && /^\d+$/.test(buscaProduto.trim())) {
                  selecionarPorNumero(buscaProduto.trim())
                  setBuscaProduto('')
                }
              }}
              placeholder="Digite o nº do produto ou busque por nome... (Enter para selecionar)"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Grid de produtos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-y-auto p-4">
          {!buscaProduto && (
            <p className="text-xs text-gray-400 mb-3">
              {produtosMaisVendidos.length > 0 ? 'Mais vendidos' : 'Produtos disponíveis'} — busque por nome ou nº para ver todos
            </p>
          )}
          {buscaProduto && (
            <p className="text-xs text-gray-400 mb-3">
              {produtosFiltrados.length} resultado{produtosFiltrados.length !== 1 ? 's' : ''} para "{buscaProduto}"
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {produtosExibidos.map(p => (
              <button
                key={p.id}
                onClick={() => { setProdutoSelecionado(p); setQuantidade(1) }}
                className={`relative rounded-xl border-2 p-3 transition-all cursor-pointer text-left ${
                  produtoSelecionado?.id === p.id
                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/20'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                {/* Número do produto */}
                <span className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
                  {p.id}
                </span>

                {imgUrl(p.imagem_url) ? (
                  <img src={imgUrl(p.imagem_url)} className="w-full h-20 object-contain bg-gray-50 rounded-lg mb-2" />
                ) : (
                  <div className="w-full h-20 bg-gray-50 rounded-lg mb-2 flex items-center justify-center">
                    <HiOutlineShoppingCart className="w-8 h-8 text-gray-300" />
                  </div>
                )}

                <p className="text-xs font-medium text-gray-800 truncate">{p.nome}</p>
                <p className="text-sm font-bold text-primary mt-1">{formatarMoeda(getPreco(p))}</p>
                <div className="flex justify-between items-center mt-1 text-[10px]">
                  {vendasPorProduto[p.id] > 0 ? (
                    <span className="text-primary font-semibold">{vendasPorProduto[p.id]} vendido{vendasPorProduto[p.id] > 1 ? 's' : ''}</span>
                  ) : <span />}
                  <span className={`font-medium ${
                    p.qtd_estoque <= 0 ? 'text-red-500' :
                    p.qtd_estoque <= 3 ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    Est: {p.qtd_estoque}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Coluna Direita: Reserva + Histórico ─── */}
      <div className="w-[380px] flex flex-col gap-4">
        {/* Formulário de reserva */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Novo Pedido</h3>

          {/* Produto selecionado */}
          {produtoSelecionado ? (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3">
              <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {produtoSelecionado.id}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{produtoSelecionado.nome}</p>
                <p className="text-xs text-primary font-bold">{formatarMoeda(getPreco(produtoSelecionado))}</p>
              </div>
              <button onClick={() => setProdutoSelecionado(null)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer">
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 mb-3 text-center text-sm text-gray-400">
              Digite o nº do produto ou clique para selecionar
            </div>
          )}

          {/* Quantidade */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade</label>
            <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputCls} />
          </div>

          {/* Tipo de entrega */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipoEntrega('retirada')}
                className={`py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border-2 ${
                  tipoEntrega === 'retirada' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'
                }`}>
                Retirada
              </button>
              <button onClick={() => setTipoEntrega('entrega')}
                className={`py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border-2 ${
                  tipoEntrega === 'entrega' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500'
                }`}>
                Entrega
              </button>
            </div>
            {tipoEntrega === 'entrega' && (
              <p className="text-xs text-amber-600 mt-1">O cliente receberá um link de checkout para preencher os dados de entrega.</p>
            )}
          </div>

          {/* Dados do cliente */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Dados do cliente</p>
              {buscandoCliente && (
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Cliente selecionado */}
            {clienteEncontrado ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-800">{clienteEncontrado.nome}</p>
                  <p className="text-xs text-emerald-600">{maskPhone(clienteEncontrado.telefone)} {clienteEncontrado.cpf && `· ${maskCPF(clienteEncontrado.cpf)}`}</p>
                </div>
                <button onClick={limparCliente} className="p-1 text-emerald-400 hover:text-red-500 cursor-pointer">
                  <HiOutlineX className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Campo nome com dropdown de sugestões */}
                <div className="relative">
                  <input value={clienteNome}
                    onChange={e => { setClienteNome(e.target.value); setClienteEncontrado(null) }}
                    onFocus={() => sugestoesCliente.length > 0 && setShowSugestoes(true)}
                    placeholder="Nome completo *" className={inputCls} />

                  {showSugestoes && sugestoesCliente.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-48 overflow-y-auto">
                      {sugestoesCliente.map(c => (
                        <button key={c.id} onClick={() => selecionarCliente(c)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 text-left">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{c.nome}</p>
                            <p className="text-xs text-gray-400">{maskPhone(c.telefone)} {c.cidade && `· ${c.cidade}/${c.uf}`}</p>
                          </div>
                          <span className="text-xs text-gray-400">{c.total_compras} compras</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input value={clienteTelefone} onChange={e => setClienteTelefone(maskPhone(e.target.value))}
                  placeholder="WhatsApp (00) 00000-0000 *" className={inputCls} />
                <input value={clienteInstagram} onChange={e => setClienteInstagram(e.target.value)}
                  placeholder="@instagram (opcional)" className={inputCls} />
                <input value={clienteCpf} onChange={e => { setClienteCpf(maskCPF(e.target.value)); setClienteEncontrado(null) }}
                  placeholder="CPF (opcional)" className={inputCls} />
              </>
            )}
          </div>

          {/* Total */}
          {produtoSelecionado && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-xl font-black text-primary">
                {formatarMoeda(getPreco(produtoSelecionado) * quantidade)}
              </span>
            </div>
          )}

          {/* Botão reservar */}
          <button
            onClick={handleReservar}
            disabled={!produtoSelecionado || enviando}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {enviando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <HiOutlineChatAlt2 className="w-5 h-5" />
                {tipoEntrega === 'entrega' ? 'Enviar Pedido + Checkout' : 'Enviar Pedido + PIX'}
              </>
            )}
          </button>
        </div>

        {/* Últimas Atualizações */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col">
          <div className="px-4 pt-4 pb-2 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">Últimas Atualizações</h3>
            <button onClick={carregarReservas} className="p-1 text-gray-400 hover:text-primary cursor-pointer">
              <HiOutlineRefresh className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {reservas.length > 0 ? reservas.map(r => {
              const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.Reservado
              const acaoTexto = {
                Reservado: 'Novo pedido criado',
                AguardandoPagamento: 'Checkout preenchido',
                Pago: 'Pagamento confirmado',
                Cancelado: 'Pedido cancelado',
                Expirado: 'Expirado automaticamente',
              }
              return (
                <div key={r.id} className={`border rounded-xl p-3 ${
                  r.status === 'Pago' ? 'border-emerald-200 bg-emerald-50/30' :
                  r.status === 'Cancelado' ? 'border-red-200 bg-red-50/30' :
                  r.status === 'Expirado' ? 'border-gray-200 bg-gray-50/30' :
                  'border-gray-100'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.produto_nome}</p>
                      <p className="text-xs text-gray-500">{r.cliente_nome || '—'}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} flex-shrink-0`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-xs text-gray-400">{acaoTexto[r.status]} · {formatData(r.criado_em)}</span>
                    <span className="text-xs font-mono text-gray-400">{r.codigo}</span>
                  </div>
                  {r.status !== 'Pago' && (
                    <div className="flex gap-1.5 mt-2">
                      {(r.status === 'Reservado' || r.status === 'AguardandoPagamento') && (
                        <button onClick={() => handlePago(r.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 cursor-pointer">
                          <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Pago
                        </button>
                      )}
                      {r.cliente_telefone && (
                        <button onClick={() => handleReenviar(r.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 cursor-pointer">
                          <HiOutlineChatAlt2 className="w-3.5 h-3.5" /> Reenviar
                        </button>
                      )}
                      {(r.status === 'Reservado' || r.status === 'AguardandoPagamento') && (
                        <button onClick={() => handleCancelar(r.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 cursor-pointer">
                          <HiOutlineX className="w-3.5 h-3.5" /> Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            }) : (
              <div className="text-center py-8 text-gray-400">
                <HiOutlineShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhuma atualização ainda</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Produto Avulso */}
      {modalAvulso && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalAvulso(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Produto Avulso</h3>
                <p className="text-sm text-gray-400">Produto que não está no estoque</p>
              </div>
              <button onClick={() => setModalAvulso(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 cursor-pointer">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto *</label>
                <input value={avulsoNome} onChange={e => setAvulsoNome(e.target.value)}
                  placeholder="Ex: Brinco Especial Live" className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$) *</label>
                <input type="number" step="0.01" min="0" value={avulsoPreco}
                  onChange={e => setAvulsoPreco(e.target.value)}
                  placeholder="0,00" className={inputCls}
                  onKeyDown={e => e.key === 'Enter' && addProdutoAvulso()} />
              </div>
              <button onClick={addProdutoAvulso}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primaryDark transition-colors cursor-pointer">
                Selecionar Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
