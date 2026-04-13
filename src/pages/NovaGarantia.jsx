import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  HiOutlineUser,
  HiOutlineCube,
  HiOutlineShieldCheck,
  HiOutlineDocumentAdd,
  HiOutlineStar,
  HiOutlineSparkles,
  HiOutlineCheck,
  HiOutlineClipboardCopy,
} from 'react-icons/hi'
import { maskCPF, maskPhone, maskCEP, maskCurrency, removeMask } from '../utils/masks'
import { isRequired, isValidCPF, isValidPhone, isValidEmail, isValidCEP } from '../utils/validators'
import { useToast } from '../components/Toast'
import fetchAddress from '../services/viaCep'
import * as clienteService from '../services/clienteService'
import * as garantiaService from '../services/garantiaService'
import * as mensagemService from '../services/mensagemService'

// Lista de estados brasileiros
const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

const CATEGORIAS = ['Joias']

const LOCAIS_COMPRA = [
  'Loja Física',
  'Online - WhatsApp',
  'Online - Mercado Livre',
  'Online - Shopee',
  'Online - TikTok Shop',
]

// Estilos reutilizáveis
const inputBase = 'w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200'
const inputError = 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
const inputDisabled = 'bg-gray-50 text-gray-500 cursor-not-allowed'
const labelBase = 'block text-sm font-medium text-gray-600 mb-1.5'
const selectArrow = "appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_1rem_center] pr-10"

// Calcula data de término da garantia
const calcularTermino = (dataInicio, meses) => {
  if (!dataInicio || !meses) return ''
  const date = new Date(dataInicio + 'T00:00:00')
  date.setMonth(date.getMonth() + parseInt(meses, 10))
  return date.toISOString().split('T')[0]
}

// Formata data ISO para DD/MM/AAAA
const formatDateBR = (isoDate) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

// Percentual de desconto baseado no total de compras
const calcularDesconto = (totalCompras) => {
  if (totalCompras < 2) return 0
  if (totalCompras === 2) return 5
  if (totalCompras === 3) return 8
  if (totalCompras === 4) return 10
  return 12
}

// Página Nova Garantia — emissão de certificado
const NovaGarantia = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const formRef = useRef(null)

  // Estado do formulário — pré-preenche com query params do PDV
  const [form, setForm] = useState({
    cpf: '', nome: searchParams.get('nome') || '', nascimento: '', telefone: '', email: '',
    cep: '', endereco: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '',
    produto: searchParams.get('produto_nome') || '', serie: '',
    categoria: searchParams.get('produto_categoria') || 'Joias',
    valor: searchParams.get('produto_valor') || '',
    loja: searchParams.get('loja') || '',
    dataCompra: searchParams.get('data_compra') || '',
    periodo: '12',
  })

  const [erros, setErros] = useState({})
  const [clienteRecorrente, setClienteRecorrente] = useState(null)
  const [buscandoCpf, setBuscandoCpf] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [emitindo, setEmitindo] = useState(false)
  const [sucesso, setSucesso] = useState(null)
  const [erroEmissao, setErroEmissao] = useState('')

  const dataTermino = calcularTermino(form.dataCompra, form.periodo)

  // Escape fecha modal de confirmação (se não estiver emitindo)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && modalAberto && !emitindo) setModalAberto(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [modalAberto, emitindo])

  // Atualiza campo do formulário
  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErros((prev) => ({ ...prev, [field]: '' }))
  }

  // Busca cliente por CPF via API
  const buscarCliente = async () => {
    const cpfLimpo = removeMask(form.cpf)
    if (cpfLimpo.length !== 11) return

    setBuscandoCpf(true)
    try {
      const cliente = await clienteService.buscarPorCPF(form.cpf)
      setForm((prev) => ({
        ...prev,
        nome: cliente.nome || prev.nome,
        nascimento: cliente.data_nascimento || prev.nascimento,
        telefone: cliente.telefone ? maskPhone(cliente.telefone) : prev.telefone,
        email: cliente.email || prev.email,
        cep: cliente.cep ? maskCEP(cliente.cep) : prev.cep,
        endereco: cliente.endereco || prev.endereco,
        numero: cliente.numero || prev.numero,
        complemento: cliente.complemento || prev.complemento,
        bairro: cliente.bairro || prev.bairro,
        cidade: cliente.cidade || prev.cidade,
        uf: cliente.uf || prev.uf,
      }))
      setClienteRecorrente(cliente.total_compras)
    } catch {
      // Cliente não encontrado — limpa indicador de recorrente
      setClienteRecorrente(null)
    } finally {
      setBuscandoCpf(false)
    }
  }

  // Busca endereço ao completar CEP
  useEffect(() => {
    const cepDigits = removeMask(form.cep)
    if (cepDigits.length !== 8) return

    let cancelled = false
    setBuscandoCep(true)

    fetchAddress(form.cep).then((addr) => {
      if (cancelled) return
      setBuscandoCep(false)
      if (addr) {
        setForm((prev) => ({
          ...prev,
          endereco: addr.logradouro || prev.endereco,
          bairro: addr.bairro || prev.bairro,
          cidade: addr.localidade || prev.cidade,
          uf: addr.uf || prev.uf,
        }))
      }
    })

    return () => { cancelled = true }
  }, [form.cep])

  // Validação completa de todos os campos
  const validar = () => {
    const e = {}

    if (!isRequired(form.cpf)) e.cpf = 'CPF é obrigatório'
    else if (!isValidCPF(form.cpf)) e.cpf = 'CPF inválido'

    if (!isRequired(form.nome)) e.nome = 'Nome é obrigatório'
    if (!isRequired(form.nascimento)) e.nascimento = 'Data de nascimento é obrigatória'

    if (!isRequired(form.telefone)) e.telefone = 'Telefone é obrigatório'
    else if (!isValidPhone(form.telefone)) e.telefone = 'Telefone inválido'

    if (form.email && !isValidEmail(form.email)) e.email = 'E-mail inválido'

    if (!isRequired(form.cep)) e.cep = 'CEP é obrigatório'
    else if (!isValidCEP(form.cep)) e.cep = 'CEP inválido'

    if (!isRequired(form.endereco)) e.endereco = 'Endereço é obrigatório'
    if (!isRequired(form.numero)) e.numero = 'Número é obrigatório'
    if (!isRequired(form.bairro)) e.bairro = 'Bairro é obrigatório'
    if (!isRequired(form.cidade)) e.cidade = 'Cidade é obrigatória'
    if (!isRequired(form.uf)) e.uf = 'Estado é obrigatório'

    if (!isRequired(form.produto)) e.produto = 'Produto é obrigatório'
    if (!isRequired(form.categoria)) e.categoria = 'Categoria é obrigatória'

    if (!isRequired(form.valor) || form.valor === 'R$ 0,00') e.valor = 'Valor é obrigatório'
    if (!isRequired(form.loja)) e.loja = 'Loja é obrigatória'
    if (!isRequired(form.dataCompra)) e.dataCompra = 'Data da compra é obrigatória'

    if (!isRequired(form.periodo) || parseInt(form.periodo, 10) <= 0) e.periodo = 'Período inválido'

    setErros(e)
    return Object.keys(e).length === 0
  }

  // Abre modal se validação passar
  const handleEmitir = () => {
    if (!validar()) {
      setTimeout(() => {
        const el = formRef.current?.querySelector('[data-error="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    setModalAberto(true)
  }

  // Confirma emissão via API
  const handleConfirmar = async () => {
    setEmitindo(true)
    setErroEmissao('')

    try {
      // Converte valor monetário para número
      const valorNumerico = parseFloat(
        form.valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
      ) || 0

      const payload = {
        cpf: removeMask(form.cpf),
        nome: form.nome.trim(),
        telefone: removeMask(form.telefone),
        data_nascimento: form.nascimento || null,
        email: form.email || null,
        cep: removeMask(form.cep),
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento || null,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        produto_nome: form.produto,
        produto_serie: form.serie || null,
        produto_categoria: form.categoria,
        produto_valor: valorNumerico,
        loja: form.loja,
        data_compra: form.dataCompra,
        periodo_meses: parseInt(form.periodo, 10),
        data_inicio: form.dataCompra,
      }

      const resultado = await garantiaService.criar(payload)

      // Envia mensagem de certificado via WhatsApp
      let whatsappEnviado = false
      try {
        await mensagemService.enviar(resultado.id, 'Certificado')
        whatsappEnviado = true
      } catch {
        toast.error('Certificado emitido, mas falha ao enviar WhatsApp.')
      }

      setSucesso({
        certificado: resultado.certificado,
        cupom: resultado.cupom?.codigo || null,
        desconto: resultado.cupom ? Number(resultado.cupom.percentual) : 0,
        whatsappEnviado,
      })
      setModalAberto(false)
    } catch (err) {
      setErroEmissao(err?.response?.data?.detail || 'Erro ao emitir certificado. Tente novamente.')
    } finally {
      setEmitindo(false)
    }
  }

  // Reseta tudo para nova emissão
  const handleNovaGarantia = () => {
    setForm({
      cpf: '', nome: '', nascimento: '', telefone: '', email: '',
      cep: '', endereco: '', numero: '', complemento: '',
      bairro: '', cidade: '', uf: '',
      produto: '', serie: '', categoria: 'Joias',
      valor: '', loja: '', dataCompra: '',
      periodo: '12',
    })
    setErros({})
    setClienteRecorrente(null)
    setSucesso(null)
    setErroEmissao('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Copia texto para clipboard
  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto).then(() => {
      toast.success('Copiado!')
    })
  }

  // ─── TELA DE SUCESSO ───
  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {/* Ícone animado */}
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center animate-[bounce-in_0.5s_ease-out]">
          <HiOutlineCheck className="w-12 h-12 text-emerald-500" />
        </div>

        <h2 className="text-2xl font-bold text-primary mt-6 text-center">
          Certificado Emitido com Sucesso!
        </h2>

        {/* Card de detalhes */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 mt-6 max-w-md w-full">
          {/* Número do certificado */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Certificado</p>
              <p className="text-lg font-bold text-primary mt-0.5">{sucesso.certificado}</p>
            </div>
            <button
              onClick={() => copiarTexto(sucesso.certificado)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-primary transition-all cursor-pointer"
              title="Copiar"
            >
              <HiOutlineClipboardCopy className="w-5 h-5" />
            </button>
          </div>

          <div className="border-t border-gray-100 pt-3">
            {sucesso.whatsappEnviado ? (
              <p className="text-sm text-emerald-500 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Mensagem enviada via WhatsApp
              </p>
            ) : (
              <p className="text-sm text-amber-500 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Falha ao enviar WhatsApp — reenvie pela consulta
              </p>
            )}
          </div>

          {/* Cupom de desconto */}
          {sucesso.cupom && (
            <div className="bg-accent/10 rounded-2xl p-4 mt-4 border border-accent/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Cupom de Desconto</p>
                  <p className="text-base font-bold text-accent mt-0.5">{sucesso.cupom}</p>
                </div>
                <span className="bg-accent text-white text-sm font-bold px-3 py-1 rounded-xl">
                  {sucesso.desconto}% OFF
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={handleNovaGarantia}
            className="bg-accent text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-all duration-300 cursor-pointer"
          >
            Emitir Nova Garantia
          </button>
          <button
            onClick={() => navigate('/garantias')}
            className="bg-white border border-gray-200 text-gray-600 font-medium px-6 py-3 rounded-2xl hover:bg-gray-50 transition-all duration-300 cursor-pointer"
          >
            Ver no Histórico
          </button>
        </div>
      </div>
    )
  }

  // ─── FORMULÁRIO ───
  return (
    <div ref={formRef}>
      {/* Cabeçalho */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary">Emitir Certificado de Garantia</h2>
        <p className="text-sm text-gray-400 font-light">Preencha todos os dados abaixo</p>
      </div>

      {/* ─── SEÇÃO 1 — Dados do Cliente ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 md:p-8 mb-6">
        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-gray-100">
          <HiOutlineUser className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold text-primary">Dados do Cliente</h3>
        </div>

        {clienteRecorrente !== null && clienteRecorrente > 0 && (
          <div className="bg-accent/10 text-accent rounded-2xl px-4 py-2 text-sm font-medium mb-5 inline-flex items-center gap-1.5">
            <HiOutlineStar className="w-4 h-4" />
            Cliente recorrente ({clienteRecorrente} compras)
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CPF */}
          <div data-error={!!erros.cpf || undefined}>
            <label className={labelBase}>CPF <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <input
                value={form.cpf}
                onChange={(e) => setField('cpf', maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`flex-1 ${inputBase} ${erros.cpf ? inputError : ''}`}
              />
              <button
                type="button"
                onClick={buscarCliente}
                disabled={buscandoCpf}
                className="bg-primary text-white px-4 rounded-2xl hover:bg-primary/90 transition-all duration-200 text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {buscandoCpf ? '...' : 'Buscar'}
              </button>
            </div>
            {erros.cpf && <p className="text-red-400 text-xs mt-1">{erros.cpf}</p>}
          </div>

          {/* Nome */}
          <div data-error={!!erros.nome || undefined}>
            <label className={labelBase}>Nome Completo <span className="text-red-400">*</span></label>
            <input
              value={form.nome}
              onChange={(e) => setField('nome', e.target.value)}
              placeholder="Nome completo"
              className={`${inputBase} ${erros.nome ? inputError : ''}`}
            />
            {erros.nome && <p className="text-red-400 text-xs mt-1">{erros.nome}</p>}
          </div>

          {/* Nascimento */}
          <div data-error={!!erros.nascimento || undefined}>
            <label className={labelBase}>Data de Nascimento <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={form.nascimento}
              onChange={(e) => setField('nascimento', e.target.value)}
              className={`${inputBase} ${erros.nascimento ? inputError : ''}`}
            />
            {erros.nascimento && <p className="text-red-400 text-xs mt-1">{erros.nascimento}</p>}
          </div>

          {/* Telefone */}
          <div data-error={!!erros.telefone || undefined}>
            <label className={labelBase}>Telefone/WhatsApp <span className="text-red-400">*</span></label>
            <input
              value={form.telefone}
              onChange={(e) => setField('telefone', maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={`${inputBase} ${erros.telefone ? inputError : ''}`}
            />
            {erros.telefone && <p className="text-red-400 text-xs mt-1">{erros.telefone}</p>}
          </div>

          {/* E-mail */}
          <div data-error={!!erros.email || undefined}>
            <label className={labelBase}>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="email@exemplo.com"
              className={`${inputBase} ${erros.email ? inputError : ''}`}
            />
            {erros.email && <p className="text-red-400 text-xs mt-1">{erros.email}</p>}
          </div>

          {/* CEP */}
          <div data-error={!!erros.cep || undefined}>
            <label className={labelBase}>CEP <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                value={form.cep}
                onChange={(e) => setField('cep', maskCEP(e.target.value))}
                placeholder="00000-000"
                className={`${inputBase} ${erros.cep ? inputError : ''}`}
              />
              {buscandoCep && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
                </div>
              )}
            </div>
            {erros.cep && <p className="text-red-400 text-xs mt-1">{erros.cep}</p>}
          </div>

          {/* Endereço */}
          <div data-error={!!erros.endereco || undefined}>
            <label className={labelBase}>Endereço <span className="text-red-400">*</span></label>
            <input
              value={form.endereco}
              onChange={(e) => setField('endereco', e.target.value)}
              placeholder="Rua, Avenida..."
              className={`${inputBase} ${erros.endereco ? inputError : ''}`}
            />
            {erros.endereco && <p className="text-red-400 text-xs mt-1">{erros.endereco}</p>}
          </div>

          {/* Número */}
          <div data-error={!!erros.numero || undefined}>
            <label className={labelBase}>Número <span className="text-red-400">*</span></label>
            <input
              value={form.numero}
              onChange={(e) => setField('numero', e.target.value)}
              placeholder="Nº"
              className={`${inputBase} ${erros.numero ? inputError : ''}`}
            />
            {erros.numero && <p className="text-red-400 text-xs mt-1">{erros.numero}</p>}
          </div>

          {/* Complemento */}
          <div>
            <label className={labelBase}>Complemento</label>
            <input
              value={form.complemento}
              onChange={(e) => setField('complemento', e.target.value)}
              placeholder="Apto, Bloco..."
              className={inputBase}
            />
          </div>

          {/* Bairro */}
          <div data-error={!!erros.bairro || undefined}>
            <label className={labelBase}>Bairro <span className="text-red-400">*</span></label>
            <input
              value={form.bairro}
              onChange={(e) => setField('bairro', e.target.value)}
              placeholder="Bairro"
              className={`${inputBase} ${erros.bairro ? inputError : ''}`}
            />
            {erros.bairro && <p className="text-red-400 text-xs mt-1">{erros.bairro}</p>}
          </div>

          {/* Cidade */}
          <div data-error={!!erros.cidade || undefined}>
            <label className={labelBase}>Cidade <span className="text-red-400">*</span></label>
            <input
              value={form.cidade}
              onChange={(e) => setField('cidade', e.target.value)}
              placeholder="Cidade"
              className={`${inputBase} ${erros.cidade ? inputError : ''}`}
            />
            {erros.cidade && <p className="text-red-400 text-xs mt-1">{erros.cidade}</p>}
          </div>

          {/* Estado/UF */}
          <div data-error={!!erros.uf || undefined}>
            <label className={labelBase}>Estado/UF <span className="text-red-400">*</span></label>
            <select
              value={form.uf}
              onChange={(e) => setField('uf', e.target.value)}
              className={`${inputBase} ${selectArrow} ${erros.uf ? inputError : ''}`}
            >
              <option value="">Selecione</option>
              {ESTADOS_BR.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            {erros.uf && <p className="text-red-400 text-xs mt-1">{erros.uf}</p>}
          </div>
        </div>
      </div>

      {/* ─── SEÇÃO 2 — Dados do Produto ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 md:p-8 mb-6">
        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-gray-100">
          <HiOutlineCube className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold text-primary">Dados do Produto</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Produto */}
          <div data-error={!!erros.produto || undefined}>
            <label className={labelBase}>Nome/Modelo do Produto <span className="text-red-400">*</span></label>
            <input
              value={form.produto}
              onChange={(e) => setField('produto', e.target.value)}
              placeholder="Ex: Sofá Retrátil 3 Lugares"
              className={`${inputBase} ${erros.produto ? inputError : ''}`}
            />
            {erros.produto && <p className="text-red-400 text-xs mt-1">{erros.produto}</p>}
          </div>

          {/* Série */}
          <div>
            <label className={labelBase}>Número de Série</label>
            <input
              value={form.serie}
              onChange={(e) => setField('serie', e.target.value)}
              placeholder="Opcional"
              className={inputBase}
            />
          </div>

          {/* Categoria */}
          <div data-error={!!erros.categoria || undefined}>
            <label className={labelBase}>Categoria <span className="text-red-400">*</span></label>
            <select
              value={form.categoria}
              onChange={(e) => setField('categoria', e.target.value)}
              className={`${inputBase} ${selectArrow} ${erros.categoria ? inputError : ''}`}
            >
              <option value="">Selecione a categoria</option>
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {erros.categoria && <p className="text-red-400 text-xs mt-1">{erros.categoria}</p>}
          </div>

          {/* Valor */}
          <div data-error={!!erros.valor || undefined}>
            <label className={labelBase}>Valor do Produto <span className="text-red-400">*</span></label>
            <input
              value={form.valor}
              onChange={(e) => setField('valor', maskCurrency(e.target.value))}
              placeholder="R$ 0,00"
              className={`${inputBase} ${erros.valor ? inputError : ''}`}
            />
            {erros.valor && <p className="text-red-400 text-xs mt-1">{erros.valor}</p>}
          </div>

          {/* Loja */}
          <div data-error={!!erros.loja || undefined}>
            <label className={labelBase}>Local de Compra <span className="text-red-400">*</span></label>
            <select
              value={form.loja}
              onChange={(e) => setField('loja', e.target.value)}
              className={`${inputBase} ${selectArrow} ${erros.loja ? inputError : ''}`}
            >
              <option value="">Selecione o local</option>
              {LOCAIS_COMPRA.map((local) => (
                <option key={local} value={local}>{local}</option>
              ))}
            </select>
            {erros.loja && <p className="text-red-400 text-xs mt-1">{erros.loja}</p>}
          </div>

          {/* Data Compra */}
          <div data-error={!!erros.dataCompra || undefined}>
            <label className={labelBase}>Data da Compra <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={form.dataCompra}
              onChange={(e) => setField('dataCompra', e.target.value)}
              className={`${inputBase} ${erros.dataCompra ? inputError : ''}`}
            />
            {erros.dataCompra && <p className="text-red-400 text-xs mt-1">{erros.dataCompra}</p>}
          </div>
        </div>
      </div>

      {/* ─── SEÇÃO 3 — Dados da Garantia ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 md:p-8 mb-6">
        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-gray-100">
          <HiOutlineShieldCheck className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold text-primary">Dados da Garantia</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Tipo fixo */}
          <div>
            <label className={labelBase}>Tipo de Garantia</label>
            <div className="bg-accent/10 text-accent font-semibold rounded-2xl px-4 py-2.5 inline-flex items-center gap-2">
              <HiOutlineStar className="w-4 h-4" />
              Universal
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Cobertura completa contra defeitos</p>
          </div>

          {/* Período */}
          <div data-error={!!erros.periodo || undefined}>
            <label className={labelBase}>Período de Cobertura <span className="text-red-400">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={form.periodo}
                onChange={(e) => setField('periodo', e.target.value)}
                placeholder="12"
                className={`w-28 ${inputBase} ${erros.periodo ? inputError : ''}`}
              />
              <span className="text-sm text-gray-400">meses</span>
            </div>
            {erros.periodo && <p className="text-red-400 text-xs mt-1">{erros.periodo}</p>}
          </div>

          {/* Início */}
          <div>
            <label className={labelBase}>Data de Início</label>
            <input
              type="text"
              value={form.dataCompra ? formatDateBR(form.dataCompra) : ''}
              disabled
              placeholder="Preenchido pela data da compra"
              className={`${inputBase} ${inputDisabled}`}
            />
          </div>

          {/* Término */}
          <div>
            <label className={labelBase}>Data de Término</label>
            <input
              type="text"
              value={dataTermino ? formatDateBR(dataTermino) : ''}
              disabled
              placeholder="Calculado automaticamente"
              className={`${inputBase} ${inputDisabled}`}
            />
          </div>
        </div>

        {/* Botão de emissão */}
        <div className="flex justify-end mt-8">
          <button
            type="button"
            onClick={handleEmitir}
            className="bg-accent text-white font-semibold px-8 py-3.5 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-all duration-300 flex items-center gap-2 cursor-pointer"
          >
            <HiOutlineDocumentAdd className="w-5 h-5" />
            Emitir Certificado
          </button>
        </div>
      </div>

      {/* ─── MODAL DE CONFIRMAÇÃO ─── */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
          onClick={() => !emitindo && setModalAberto(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-0 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <HiOutlineShieldCheck className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-primary">Confirme os Dados</h3>
              <p className="text-sm text-gray-400 mt-1">Revise antes de emitir o certificado</p>
            </div>

            {/* Corpo */}
            <div className="p-6">
              {/* Bloco Cliente */}
              <div className="bg-light/50 rounded-2xl p-4 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Dados do Cliente</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Nome:</span> <span className="font-medium text-primary">{form.nome}</span></p>
                  <p><span className="text-gray-400">CPF:</span> <span className="font-medium text-primary">{form.cpf}</span></p>
                  <p><span className="text-gray-400">Telefone:</span> <span className="font-medium text-primary">{form.telefone}</span></p>
                  <p><span className="text-gray-400">Endereço:</span> <span className="font-medium text-primary">{form.endereco}, {form.numero} - {form.bairro}, {form.cidade}/{form.uf}</span></p>
                </div>
              </div>

              {/* Bloco Produto */}
              <div className="bg-light/50 rounded-2xl p-4 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Dados do Produto</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Produto:</span> <span className="font-medium text-primary">{form.produto}</span></p>
                  <p><span className="text-gray-400">Categoria:</span> <span className="font-medium text-primary">{form.categoria}</span></p>
                  <p><span className="text-gray-400">Valor:</span> <span className="font-medium text-primary">{form.valor}</span></p>
                  <p><span className="text-gray-400">Loja:</span> <span className="font-medium text-primary">{form.loja}</span></p>
                </div>
              </div>

              {/* Bloco Garantia */}
              <div className="bg-light/50 rounded-2xl p-4 mb-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Dados da Garantia</p>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-gray-400">Tipo:</span> <span className="font-medium text-primary">Universal</span></p>
                  <p><span className="text-gray-400">Período:</span> <span className="font-medium text-primary">{form.periodo} meses</span></p>
                  <p><span className="text-gray-400">Vigência:</span> <span className="font-medium text-primary">{formatDateBR(form.dataCompra)} até {formatDateBR(dataTermino)}</span></p>
                </div>
              </div>

              {/* Aviso de desconto para cliente recorrente */}
              {clienteRecorrente >= 1 && (
                <div className="bg-accent/10 rounded-2xl p-4 mt-2 border border-accent/20 flex items-center gap-3">
                  <HiOutlineSparkles className="w-5 h-5 text-accent shrink-0" />
                  <p className="text-sm text-accent font-medium">
                    {calcularDesconto(clienteRecorrente + 1) > 0
                      ? `Este cliente receberá cupom de ${calcularDesconto(clienteRecorrente + 1)}% de desconto!`
                      : 'Cliente recorrente — cupom gerado na próxima compra!'
                    }
                  </p>
                </div>
              )}

              {/* Erro de emissão */}
              {erroEmissao && (
                <div className="bg-red-50 rounded-2xl p-3 mt-3 text-sm text-red-600 font-medium">
                  {erroEmissao}
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="p-6 pt-2 flex gap-3">
              <button
                onClick={() => setModalAberto(false)}
                disabled={emitindo}
                className="flex-1 bg-gray-100 text-gray-600 font-medium px-6 py-3 rounded-2xl hover:bg-gray-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                Voltar e Revisar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={emitindo}
                className="flex-1 bg-accent text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl transition-all disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
              >
                {emitindo ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Emitindo...
                  </>
                ) : (
                  'Confirmar e Emitir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NovaGarantia
