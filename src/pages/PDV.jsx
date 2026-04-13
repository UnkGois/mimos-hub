import { useState, useEffect, useRef, useCallback } from 'react'
import {
  HiOutlineSearch, HiOutlineTrash, HiOutlinePlus, HiOutlineMinus,
  HiOutlineCash, HiOutlineCreditCard, HiOutlineQrcode, HiOutlineTag,
  HiOutlineUser, HiOutlineShoppingCart, HiOutlinePlusCircle, HiOutlineX, HiOutlineCheckCircle,
} from 'react-icons/hi'
import { getProdutos } from '../services/produtoService'
import { criarVenda } from '../services/vendaService'
import { buscarPorCPF, criar as criarCliente } from '../services/clienteService'
import { validar as validarCupom, listar as listarCupons } from '../services/cupomService'
import { formatarMoeda } from '../utils/calculos'
import { maskCPF, maskPhone, removeMask } from '../utils/masks'
import { useToast } from '../components/Toast'
import VendaSucessoModal from '../components/VendaSucessoModal'
import WhatsAppVerify, { WhatsAppIcon } from '../components/WhatsAppVerify'

const FORMAS = [
  { key: 'pix', label: 'PIX', icon: HiOutlineQrcode, cor: 'from-teal-500 to-teal-600' },
  { key: 'cartao_credito', label: 'Crédito', icon: HiOutlineCreditCard, cor: 'from-blue-500 to-blue-600' },
  { key: 'cartao_debito', label: 'Débito', icon: HiOutlineCreditCard, cor: 'from-violet-500 to-violet-600' },
  { key: 'dinheiro', label: 'Dinheiro', icon: HiOutlineCash, cor: 'from-emerald-500 to-emerald-600' },
]

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

export default function PDV() {
  const toast = useToast()
  const buscaRef = useRef(null)

  // Carrinho
  const [carrinho, setCarrinho] = useState([])

  // Busca produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [showResultados, setShowResultados] = useState(false)

  // Cliente
  const [cpf, setCpf] = useState('')
  const [cliente, setCliente] = useState(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clienteNaoEncontrado, setClienteNaoEncontrado] = useState(false)
  const [modalCliente, setModalCliente] = useState(false)
  const [clienteForm, setClienteForm] = useState({ nome: '', telefone: '' })
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  // Cupom
  const [cupomCodigo, setCupomCodigo] = useState('')
  const [cupomValidado, setCupomValidado] = useState(null)
  const [cuponsAtivos, setCuponsAtivos] = useState([])
  const [showCupons, setShowCupons] = useState(false)
  const [carregandoCupons, setCarregandoCupons] = useState(false)
  const cupomRef = useRef(null)

  // Produto avulso modal
  const [modalAvulso, setModalAvulso] = useState(false)
  const [avulsoNome, setAvulsoNome] = useState('')
  const [avulsoPreco, setAvulsoPreco] = useState('')
  const [avulsoCategoria, setAvulsoCategoria] = useState('Joias')

  // Desconto manual
  const [descontoManual, setDescontoManual] = useState(0)
  const [descontoTipo, setDescontoTipo] = useState('valor') // 'valor' ou 'percentual'
  const [descontoMotivo, setDescontoMotivo] = useState('')

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState(null)
  const [valorRecebido, setValorRecebido] = useState('')

  // Estado
  const [finalizando, setFinalizando] = useState(false)
  const [vendaSucesso, setVendaSucesso] = useState(null)

  // Foco na busca ao montar
  useEffect(() => { buscaRef.current?.focus() }, [])

  // Buscar produtos com debounce
  useEffect(() => {
    if (buscaProduto.length < 2) { setResultados([]); return }
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await getProdutos({ busca: buscaProduto, limit: 10 })
        setResultados(data.items || [])
        setShowResultados(true)
      } catch { setResultados([]) }
      finally { setBuscando(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaProduto])

  // Buscar cliente por CPF
  const handleBuscarCliente = async () => {
    const cpfLimpo = removeMask(cpf)
    if (cpfLimpo.length < 11) return
    setBuscandoCliente(true)
    setClienteNaoEncontrado(false)
    try {
      const data = await buscarPorCPF(cpfLimpo)
      setCliente(data)
      setClienteNaoEncontrado(false)
      toast.success(`Cliente: ${data.nome}`)
    } catch {
      setCliente(null)
      setClienteNaoEncontrado(true)
    } finally { setBuscandoCliente(false) }
  }

  // Cadastrar cliente rápido
  const handleCadastrarCliente = async () => {
    if (!clienteForm.nome.trim() || !clienteForm.telefone.trim()) {
      toast.error('Preencha nome e telefone')
      return
    }
    setSalvandoCliente(true)
    try {
      const data = await criarCliente({
        cpf: removeMask(cpf),
        nome: clienteForm.nome.trim(),
        telefone: removeMask(clienteForm.telefone),
      })
      setCliente(data)
      setClienteNaoEncontrado(false)
      setModalCliente(false)
      setClienteForm({ nome: '', telefone: '' })
      toast.success(`Cliente cadastrado: ${data.nome}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao cadastrar')
    } finally { setSalvandoCliente(false) }
  }

  // Carregar cupons ativos
  const handleCarregarCupons = async () => {
    if (cuponsAtivos.length > 0) { setShowCupons(true); return }
    setCarregandoCupons(true)
    try {
      const data = await listarCupons({ limit: 50 })
      const ativos = (data.items || []).filter(c => {
        const status = c.status || (c.usado ? 'Usado' : c.desativado ? 'Desativado' : new Date(c.validade) < new Date() ? 'Expirado' : 'Ativo')
        return status === 'Ativo'
      })
      setCuponsAtivos(ativos)
      setShowCupons(true)
    } catch { setCuponsAtivos([]) }
    finally { setCarregandoCupons(false) }
  }

  const selecionarCupom = (cupom) => {
    setCupomCodigo(cupom.codigo)
    setShowCupons(false)
    setCupomValidado({ valido: true, motivo: `Cupom válido — ${cupom.tipo_desconto === 'valor' ? `R$ ${parseFloat(cupom.valor_desconto || 0).toFixed(2)}` : `${cupom.percentual}%`} de desconto`, cupom })
  }

  // Validar cupom
  const handleValidarCupom = async () => {
    if (!cupomCodigo.trim()) return
    try {
      const data = await validarCupom(cupomCodigo.trim())
      setCupomValidado(data)
      if (data.valido) toast.success(data.motivo)
      else toast.error(data.motivo)
    } catch { toast.error('Cupom não encontrado') }
  }

  // Preço do produto (canal lojaFisica)
  const getPreco = (produto) => {
    const canal = produto.canais?.find(c => c.canal === 'lojaFisica' && c.ativo)
    return canal?.preco_final || produto.custo_total || 0
  }

  // Adicionar ao carrinho
  const addProduto = (produto) => {
    const existente = carrinho.find(i => i.produto_id === produto.id)
    if (existente) {
      if (existente.quantidade >= produto.qtd_estoque) {
        toast.error('Estoque insuficiente')
        return
      }
      setCarrinho(prev => prev.map(i =>
        i.produto_id === produto.id
          ? { ...i, quantidade: i.quantidade + 1, subtotal: i.preco_unitario * (i.quantidade + 1) }
          : i
      ))
    } else {
      if (produto.qtd_estoque <= 0) {
        toast.error('Produto sem estoque')
        return
      }
      setCarrinho(prev => [...prev, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        produto_sku: produto.sku,
        produto_categoria: produto.categoria,
        preco_unitario: getPreco(produto),
        quantidade: 1,
        subtotal: getPreco(produto),
        estoque: produto.qtd_estoque,
        imagem_url: produto.imagem_url,
      }])
    }
    setBuscaProduto('')
    setShowResultados(false)
    buscaRef.current?.focus()
  }

  // Adicionar produto avulso (não cadastrado)
  const addProdutoAvulso = () => {
    if (!avulsoNome.trim() || !avulsoPreco || parseFloat(avulsoPreco) <= 0) {
      toast.error('Preencha nome e preço')
      return
    }
    const preco = parseFloat(avulsoPreco)
    setCarrinho(prev => [...prev, {
      produto_id: null,
      produto_nome: avulsoNome.trim(),
      produto_sku: null,
      produto_categoria: avulsoCategoria,
      preco_unitario: preco,
      quantidade: 1,
      subtotal: preco,
      estoque: 999,
      imagem_url: null,
    }])
    setAvulsoNome('')
    setAvulsoPreco('')
    setAvulsoCategoria('Joias')
    setModalAvulso(false)
    buscaRef.current?.focus()
  }

  const updateQtd = (index, delta) => {
    setCarrinho(prev => prev.map((item, i) => {
      if (i !== index) return item
      const novaQtd = Math.max(1, Math.min(item.estoque || 999, item.quantidade + delta))
      return { ...item, quantidade: novaQtd, subtotal: item.preco_unitario * novaQtd }
    }))
  }

  const removerItem = (index) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index))
  }

  // Cálculos
  const subtotal = carrinho.reduce((s, i) => s + i.subtotal, 0)
  const descontoCupom = cupomValidado?.valido && cupomValidado.cupom
    ? cupomValidado.cupom.tipo_desconto === 'percentual'
      ? subtotal * (cupomValidado.cupom.percentual / 100)
      : parseFloat(cupomValidado.cupom.valor_desconto || 0)
    : 0
  const descontoManualValor = descontoTipo === 'percentual'
    ? subtotal * (descontoManual / 100)
    : descontoManual
  const total = Math.max(0, subtotal - descontoCupom - descontoManualValor)
  const troco = formaPagamento === 'dinheiro' && valorRecebido
    ? Math.max(0, parseFloat(valorRecebido) - total)
    : 0

  const podeFinalizarPagamento = formaPagamento && (
    formaPagamento !== 'dinheiro' || (parseFloat(valorRecebido) >= total)
  )
  const podeFinalizar = carrinho.length > 0 && formaPagamento && podeFinalizarPagamento

  // Finalizar venda
  const handleFinalizar = async () => {
    if (!podeFinalizar) return
    setFinalizando(true)
    try {
      const dados = {
        cliente_id: cliente?.id || null,
        cupom_codigo: cupomValidado?.valido ? cupomCodigo.trim() : null,
        desconto_manual: descontoManualValor,
        desconto_manual_motivo: descontoMotivo ? `${descontoMotivo}${descontoTipo === 'percentual' ? ` (${descontoManual}%)` : ''}` : null,
        forma_pagamento: formaPagamento,
        valor_recebido: formaPagamento === 'dinheiro' ? parseFloat(valorRecebido) : null,
        itens: carrinho.map(i => ({
          produto_id: i.produto_id,
          produto_nome: i.produto_nome,
          produto_sku: i.produto_sku,
          produto_categoria: i.produto_categoria,
          preco_unitario: i.preco_unitario,
          quantidade: i.quantidade,
        })),
      }
      const venda = await criarVenda(dados)
      setVendaSucesso(venda)
      toast.success('Venda concluída!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao finalizar venda')
    } finally { setFinalizando(false) }
  }

  // Nova venda (reset)
  const resetPDV = () => {
    setCarrinho([])
    setCpf('')
    setCliente(null)
    setClienteNaoEncontrado(false)
    setCupomCodigo('')
    setCupomValidado(null)
    setCuponsAtivos([])
    setShowCupons(false)
    setDescontoManual(0)
    setDescontoTipo('valor')
    setDescontoMotivo('')
    setFormaPagamento(null)
    setValorRecebido('')
    setVendaSucesso(null)
    buscaRef.current?.focus()
  }

  // Atalhos de teclado e fechar dropdowns
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') { e.preventDefault(); buscaRef.current?.focus() }
      if (e.key === 'Escape') { setShowResultados(false); setShowCupons(false) }
    }
    const clickHandler = (e) => {
      if (cupomRef.current && !cupomRef.current.closest('.relative')?.contains(e.target)) {
        setShowCupons(false)
      }
    }
    document.addEventListener('keydown', handler)
    document.addEventListener('mousedown', clickHandler)
    return () => { document.removeEventListener('keydown', handler); document.removeEventListener('mousedown', clickHandler) }
  }, [])

  // URL da imagem do produto
  const imgUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    const base = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`
    return `${base.replace(/\/api$/, '')}${url}`
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* ─── Coluna Esquerda: Produtos + Carrinho ─── */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">PDV</h1>
          <button onClick={resetPDV} className="text-sm text-primary hover:underline cursor-pointer">Limpar tudo</button>
        </div>

        {/* Busca */}
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={buscaRef}
            type="text"
            value={buscaProduto}
            onChange={e => setBuscaProduto(e.target.value)}
            onFocus={() => resultados.length > 0 && setShowResultados(true)}
            placeholder="Buscar produto por nome ou SKU... (F2)"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
          {buscando && <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />}

          {/* Botão produto avulso */}
          {buscaProduto.length >= 2 && resultados.length === 0 && !buscando && (
            <button
              onClick={() => { setAvulsoNome(buscaProduto); setModalAvulso(true); setBuscaProduto(''); setShowResultados(false) }}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer text-sm text-gray-600"
            >
              <HiOutlinePlusCircle className="w-5 h-5 text-primary" />
              <span>Produto não encontrado? <strong className="text-primary">Adicionar "{buscaProduto}" como avulso</strong></span>
            </button>
          )}

          {/* Resultados dropdown */}
          {showResultados && resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-72 overflow-y-auto">
              {resultados.map(p => (
                <button
                  key={p.id}
                  onClick={() => addProduto(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0"
                >
                  {imgUrl(p.imagem_url) ? (
                    <img src={imgUrl(p.imagem_url)} className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 p-0.5 flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <HiOutlineShoppingCart className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800">{p.nome}</p>
                    <p className="text-xs text-gray-400">{p.sku} · Estoque: {p.qtd_estoque}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{formatarMoeda(getPreco(p))}</span>
                </button>
              ))}
              <button
                onClick={() => { setAvulsoNome(''); setModalAvulso(true); setShowResultados(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer border-t border-gray-100 text-sm text-primary"
              >
                <HiOutlinePlusCircle className="w-5 h-5" />
                Adicionar produto avulso
              </button>
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col">
          {carrinho.length > 0 ? (
            <>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Produto</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Preço</th>
                      <th className="text-center py-3 px-4 text-gray-500 font-medium">Qtd</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Subtotal</th>
                      <th className="py-3 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrinho.map((item, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-800">{item.produto_nome}</p>
                          <p className="text-xs text-gray-400">{item.produto_sku}</p>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">{formatarMoeda(item.preco_unitario)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQtd(i, -1)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                              <HiOutlineMinus className="w-4 h-4 text-gray-500" />
                            </button>
                            <span className="w-8 text-center font-semibold">{item.quantidade}</span>
                            <button onClick={() => updateQtd(i, 1)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                              <HiOutlinePlus className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatarMoeda(item.subtotal)}</td>
                        <td className="py-3 px-2">
                          <button onClick={() => removerItem(i)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 rounded-b-2xl">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{carrinho.reduce((s, i) => s + i.quantidade, 0)} itens</span>
                  <span className="font-bold text-lg text-gray-800">{formatarMoeda(subtotal)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
              <HiOutlineShoppingCart className="w-16 h-16 mb-3 text-gray-300" />
              <p className="text-lg">Carrinho vazio</p>
              <p className="text-sm mt-1">Busque e adicione produtos acima</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Coluna Direita: Pagamento ─── */}
      <div className="w-[380px] flex flex-col gap-4">
        {/* Cliente */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineUser className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Cliente</h3>
            {cliente && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{cliente.nome}</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(maskCPF(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && handleBuscarCliente()}
              placeholder="CPF do cliente (opcional)"
              className={`flex-1 ${inputCls}`}
            />
            <button onClick={handleBuscarCliente} disabled={buscandoCliente}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50">
              Buscar
            </button>
          </div>
          {cliente && (
            <div className="mt-2 space-y-1.5">
              <div className="text-xs text-gray-500 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  {cliente.whatsapp_verificado ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600">
                      <WhatsAppIcon className="w-3 h-3" />
                      <HiOutlineCheckCircle className="w-3 h-3" />
                    </span>
                  ) : (
                    <WhatsAppIcon className="w-3 h-3 text-gray-400" />
                  )}
                  {cliente.telefone}
                </span>
                <span>{cliente.total_compras || 0} compras</span>
              </div>
              {!cliente.whatsapp_verificado && (
                <WhatsAppVerify
                  telefone={cliente.telefone}
                  clienteId={cliente.id}
                  onVerified={() => setCliente(prev => ({ ...prev, whatsapp_verificado: true }))}
                />
              )}
            </div>
          )}
          {clienteNaoEncontrado && !cliente && (
            <div className="mt-2 flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
              <span className="text-xs text-amber-700">Cliente não encontrado</span>
              <button
                onClick={() => { setModalCliente(true); setClienteForm({ nome: '', telefone: '' }) }}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Cadastrar agora
              </button>
            </div>
          )}
        </div>

        {/* Cupom */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineTag className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Cupom de Desconto</h3>
          </div>
          <div className="flex gap-2">
            <input
              ref={cupomRef}
              type="text"
              value={cupomCodigo}
              onChange={e => { setCupomCodigo(e.target.value.toUpperCase()); setCupomValidado(null) }}
              onFocus={handleCarregarCupons}
              onKeyDown={e => e.key === 'Enter' && handleValidarCupom()}
              placeholder="Clique para ver cupons ou digite o código"
              className={`flex-1 ${inputCls}`}
            />
            <button onClick={handleValidarCupom}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">
              Validar
            </button>
          </div>

          {/* Dropdown cupons ativos */}
          {showCupons && !cupomValidado && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-60 overflow-y-auto">
              {carregandoCupons ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">Carregando...</div>
              ) : cuponsAtivos.length > 0 ? (
                <>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                    {cuponsAtivos.length} cupom{cuponsAtivos.length > 1 ? 'ns' : ''} ativo{cuponsAtivos.length > 1 ? 's' : ''}
                  </div>
                  {cuponsAtivos.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selecionarCupom(c)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <div className="text-left">
                        <p className="text-sm font-mono font-medium text-gray-800">{c.codigo}</p>
                        <p className="text-xs text-gray-400">{c.cliente_nome || 'Cliente'} · Validade: {new Date(c.validade).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">
                        {c.tipo_desconto === 'valor' ? formatarMoeda(c.valor_desconto) : `${c.percentual}%`}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">Nenhum cupom ativo</div>
              )}
              <button
                onClick={() => setShowCupons(false)}
                className="w-full px-4 py-2 text-xs text-gray-400 hover:text-gray-600 text-center border-t border-gray-100 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}

          {cupomValidado && (
            <div className={`mt-2 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center justify-between ${
              cupomValidado.valido ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              <div>
                {cupomValidado.motivo}
                {cupomValidado.valido && descontoCupom > 0 && (
                  <span className="block font-bold mt-0.5">-{formatarMoeda(descontoCupom)}</span>
                )}
              </div>
              {cupomValidado.valido && (
                <button
                  onClick={() => { setCupomCodigo(''); setCupomValidado(null) }}
                  className="p-1 hover:bg-emerald-100 rounded-lg cursor-pointer"
                >
                  <HiOutlineX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desconto Manual */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Desconto Manual</h3>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => { setDescontoTipo('valor'); setDescontoManual(0) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${descontoTipo === 'valor' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
              >R$</button>
              <button
                onClick={() => { setDescontoTipo('percentual'); setDescontoManual(0) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${descontoTipo === 'percentual' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
              >%</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                {descontoTipo === 'valor' ? 'R$' : '%'}
              </span>
              <input
                type="number" step={descontoTipo === 'percentual' ? '1' : '0.01'} min="0"
                max={descontoTipo === 'percentual' ? '100' : undefined}
                value={descontoManual || ''}
                onChange={e => setDescontoManual(parseFloat(e.target.value) || 0)}
                placeholder={descontoTipo === 'valor' ? '0,00' : '0'}
                className={`pl-9 ${inputCls}`}
              />
            </div>
            <input
              type="text"
              value={descontoMotivo}
              onChange={e => setDescontoMotivo(e.target.value)}
              placeholder="Motivo"
              className={inputCls}
            />
          </div>
          {descontoTipo === 'percentual' && descontoManual > 0 && subtotal > 0 && (
            <p className="text-xs text-emerald-600 mt-1.5 font-medium">
              = {formatarMoeda(subtotal * descontoManual / 100)} de desconto
            </p>
          )}
        </div>

        {/* Resumo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{formatarMoeda(subtotal)}</span>
          </div>
          {descontoCupom > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Cupom</span>
              <span>-{formatarMoeda(descontoCupom)}</span>
            </div>
          )}
          {descontoManualValor > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Desconto{descontoTipo === 'percentual' ? ` (${descontoManual}%)` : ''}</span>
              <span>-{formatarMoeda(descontoManualValor)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
            <span className="text-lg font-bold text-gray-800">Total</span>
            <span className="text-2xl font-black text-primary">{formatarMoeda(total)}</span>
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pagamento</h3>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map(f => (
              <button
                key={f.key}
                onClick={() => setFormaPagamento(f.key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  formaPagamento === f.key
                    ? `bg-gradient-to-r ${f.cor} text-white shadow-lg`
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <f.icon className="w-5 h-5" />
                {f.label}
              </button>
            ))}
          </div>

          {/* Troco (dinheiro) */}
          {formaPagamento === 'dinheiro' && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                <input
                  type="number" step="0.01" min="0"
                  value={valorRecebido}
                  onChange={e => setValorRecebido(e.target.value)}
                  placeholder="Valor recebido"
                  className={`pl-9 ${inputCls}`}
                  autoFocus
                />
              </div>
              {troco > 0 && (
                <div className="flex justify-between text-sm font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                  <span>Troco</span>
                  <span>{formatarMoeda(troco)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botão finalizar */}
        <button
          onClick={handleFinalizar}
          disabled={!podeFinalizar || finalizando}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg hover:bg-primaryDark transition-all shadow-lg shadow-primary/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {finalizando ? 'Finalizando...' : `Finalizar Venda — ${formatarMoeda(total)}`}
        </button>
      </div>

      {/* Modal Cadastro Rápido Cliente */}
      {modalCliente && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalCliente(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Cadastrar Cliente</h3>
                <p className="text-sm text-gray-400 mt-0.5">CPF: {cpf}</p>
              </div>
              <button onClick={() => setModalCliente(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={clienteForm.nome}
                  onChange={e => setClienteForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome do cliente"
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp) *</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={clienteForm.telefone}
                    onChange={e => setClienteForm(p => ({ ...p, telefone: maskPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    className={`flex-1 ${inputCls}`}
                  />
                  <WhatsAppVerify telefone={clienteForm.telefone} />
                </div>
              </div>
              <button
                onClick={handleCadastrarCliente}
                disabled={salvandoCliente}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primaryDark transition-colors cursor-pointer disabled:opacity-50"
              >
                {salvandoCliente ? 'Salvando...' : 'Cadastrar e Selecionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Produto Avulso */}
      {modalAvulso && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalAvulso(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Produto Avulso</h3>
                <p className="text-sm text-gray-400 mt-0.5">Adicionar produto não cadastrado</p>
              </div>
              <button onClick={() => setModalAvulso(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  value={avulsoNome}
                  onChange={e => setAvulsoNome(e.target.value)}
                  placeholder="Ex: Brinco personalizado"
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={avulsoPreco}
                      onChange={e => setAvulsoPreco(e.target.value)}
                      placeholder="0,00"
                      className={`pl-9 ${inputCls}`}
                      onKeyDown={e => e.key === 'Enter' && addProdutoAvulso()}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select value={avulsoCategoria} onChange={e => setAvulsoCategoria(e.target.value)} className={inputCls}>
                    {['Joias', 'Anel', 'Brinco', 'Colar', 'Pulseira', 'Tornozeleira', 'Conjunto', 'Outros'].map(c =>
                      <option key={c} value={c}>{c}</option>
                    )}
                  </select>
                </div>
              </div>
              <button
                onClick={addProdutoAvulso}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primaryDark transition-colors cursor-pointer"
              >
                Adicionar ao Carrinho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso */}
      <VendaSucessoModal
        open={!!vendaSucesso}
        onClose={() => setVendaSucesso(null)}
        venda={vendaSucesso}
        onNovaVenda={resetPDV}
      />
    </div>
  )
}
