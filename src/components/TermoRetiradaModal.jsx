import { useState } from 'react'
import {
  HiOutlineX,
  HiOutlineCheckCircle,
  HiOutlineDownload,
  HiOutlineChatAlt2,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
} from 'react-icons/hi'
import SignaturePad from './SignaturePad'
import * as termoService from '../services/termoService'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const formatCurrency = (v) => {
  const num = Number(v)
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const maskCPF = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const maskPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

const TermoRetiradaModal = ({ garantia, onClose, onSuccess, tipoFluxo = 'presencial' }) => {
  const toast = useToast()
  const { user } = useAuth()

  // preview | terceiro_form | assinatura_cliente | assinatura_operador | concluido
  const [step, setStep] = useState('preview')
  const [assinaturaCliente, setAssinaturaCliente] = useState(null)
  const [assinaturaOperador, setAssinaturaOperador] = useState(null)
  const [termoId, setTermoId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false)

  // Dados do terceiro
  const [terceiro, setTerceiro] = useState({
    nome: '',
    cpf: '',
    rg: '',
    telefone: '',
    relacao: '',
  })
  const [terceiroErros, setTerceiroErros] = useState({})

  const isTerceiro = tipoFluxo === 'terceiro'
  const cliente = garantia.cliente
  const produto = garantia.produto

  const enderecoCompleto = [
    cliente.endereco && cliente.numero
      ? `${cliente.endereco}, ${cliente.numero}`
      : cliente.endereco || '',
    cliente.bairro,
    cliente.cidade && cliente.uf ? `${cliente.cidade}/${cliente.uf}` : cliente.cidade || '',
  ]
    .filter(Boolean)
    .join(' - ') || 'Não informado'

  const handleNextFromPreview = () => {
    if (isTerceiro) {
      setStep('terceiro_form')
    } else {
      setStep('assinatura_cliente')
    }
  }

  const validarTerceiro = () => {
    const e = {}
    if (!terceiro.nome.trim()) e.nome = 'Nome é obrigatório'
    if (!terceiro.cpf.replace(/\D/g, '') || terceiro.cpf.replace(/\D/g, '').length < 11) e.cpf = 'CPF inválido'
    if (!terceiro.telefone.replace(/\D/g, '') || terceiro.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Telefone inválido'
    if (!terceiro.relacao.trim()) e.relacao = 'Informe a relação com a cliente'
    setTerceiroErros(e)
    return Object.keys(e).length === 0
  }

  const handleNextFromTerceiro = () => {
    if (validarTerceiro()) {
      setStep('assinatura_cliente')
    }
  }

  const handleClienteSign = (base64) => {
    setAssinaturaCliente(base64)
    setStep('assinatura_operador')
  }

  const handleOperadorSign = async (base64) => {
    setAssinaturaOperador(base64)
    setLoading(true)
    let success = false
    try {
      const payload = {
        garantia_id: garantia.id,
        assinatura_cliente: assinaturaCliente,
        assinatura_operador: base64,
        tipo_fluxo: tipoFluxo,
      }
      if (isTerceiro) {
        payload.terceiro_nome = terceiro.nome.trim()
        payload.terceiro_cpf = terceiro.cpf
        payload.terceiro_rg = terceiro.rg.trim()
        payload.terceiro_telefone = terceiro.telefone
        payload.terceiro_relacao = terceiro.relacao.trim()
      }
      const result = await termoService.criarPresencial(payload)
      setTermoId(result.id)
      setStep('concluido')
      success = true
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erro ao gerar termo de retirada.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
    // Chamar onSuccess fora do try-catch para evitar false error toasts
    if (success) {
      try { onSuccess?.() } catch { /* ignorar erro de reload */ }
    }
  }

  const handleDownload = async () => {
    if (!termoId) return
    try {
      await termoService.downloadPDF(termoId)
    } catch {
      toast.error('Erro ao baixar PDF.')
    }
  }

  const handleEnviarWhatsApp = async () => {
    if (!termoId) return
    setEnviandoWhatsApp(true)
    try {
      await termoService.enviarWhatsApp(termoId)
      toast.success('Termo enviado via WhatsApp!')
    } catch {
      toast.error('Erro ao enviar via WhatsApp.')
    } finally {
      setEnviandoWhatsApp(false)
    }
  }

  const inputBase = 'w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all'
  const inputError = 'border-red-300 focus:border-red-400 focus:ring-red-400/20'

  const signatureLabel = isTerceiro ? terceiro.nome || 'Pessoa Autorizada' : cliente.nome

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-primary">
              {step === 'preview' && 'Termo de Retirada'}
              {step === 'terceiro_form' && 'Dados do Terceiro Autorizado'}
              {step === 'assinatura_cliente' && (isTerceiro ? 'Assinatura do Terceiro' : 'Assinatura da Cliente')}
              {step === 'assinatura_operador' && 'Assinatura do Operador'}
              {step === 'concluido' && 'Termo Concluído'}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {step === 'preview' && 'Revise os dados antes de assinar'}
              {step === 'terceiro_form' && 'Preencha os dados da pessoa autorizada'}
              {step === 'assinatura_cliente' && (isTerceiro ? `${terceiro.nome || 'Terceiro'} deve assinar abaixo` : 'Passe o dispositivo para a cliente assinar')}
              {step === 'assinatura_operador' && 'Agora assine como operador(a)'}
              {step === 'concluido' && `Certificado ${garantia.certificado}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* ─── STEP: Preview ─── */}
        {step === 'preview' && (
          <div className="p-6">
            <div className="bg-light/50 rounded-2xl p-5 mb-5">
              {isTerceiro ? (
                <>
                  <p className="text-xs uppercase tracking-wider text-amber-600 font-bold mb-3">
                    Termo de Retirada de Produto por Terceiro Autorizado
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Eu, <span className="font-semibold text-primary">{terceiro.nome || '[Nome do Terceiro]'}</span>,
                    portador(a) do CPF nº <span className="font-semibold">{terceiro.cpf || '[CPF]'}</span>
                    {terceiro.rg && <>, RG nº <span className="font-semibold">{terceiro.rg}</span></>}
                    {terceiro.telefone && <>, telefone <span className="font-semibold">{terceiro.telefone}</span></>},
                    declaro que fui devidamente autorizado(a) pelo(a) Sr(a).{' '}
                    <span className="font-semibold text-primary">{cliente.nome}</span>, titular da compra,
                    a comparecer à loja MDA - Mimos de Alice Joias e realizar a retirada do produto
                    abaixo descrito em seu nome.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">
                    Declaro que o produto se encontra em perfeitas condições de uso e conservação,
                    e que recebi todas as orientações necessárias quanto ao uso, conservação e
                    cuidados com o mesmo.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">
                    Assumo total responsabilidade pela guarda e entrega do produto ao titular da compra,
                    bem como confirmo que possuo autorização expressa para esta retirada.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Dados do Titular da Compra</p>
                      <div className="space-y-1 text-sm">
                        <div><span className="text-gray-400">Nome: </span><span className="font-medium text-gray-700">{cliente.nome}</span></div>
                        <div><span className="text-gray-400">CPF: </span><span className="font-medium text-gray-700">{maskCPF(cliente.cpf)}</span></div>
                        {cliente.telefone && <div><span className="text-gray-400">Telefone: </span><span className="font-medium text-gray-700">{cliente.telefone}</span></div>}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-amber-200">
                      <p className="text-xs uppercase tracking-wider text-amber-600 font-semibold mb-2">Dados da Pessoa Autorizada</p>
                      <div className="space-y-1 text-sm">
                        <div><span className="text-gray-400">Nome: </span><span className="font-medium text-gray-700">{terceiro.nome || '-'}</span></div>
                        <div><span className="text-gray-400">CPF: </span><span className="font-medium text-gray-700">{terceiro.cpf || '-'}</span></div>
                        {terceiro.rg && <div><span className="text-gray-400">RG: </span><span className="font-medium text-gray-700">{terceiro.rg}</span></div>}
                        {terceiro.telefone && <div><span className="text-gray-400">Telefone: </span><span className="font-medium text-gray-700">{terceiro.telefone}</span></div>}
                        {terceiro.relacao && <div><span className="text-gray-400">Relação: </span><span className="font-medium text-gray-700">{terceiro.relacao}</span></div>}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mt-4">
                    A retirada foi realizada de forma voluntária e em pleno acordo entre as partes.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Pelo presente termo, eu, <span className="font-semibold text-primary">{cliente.nome}</span>,
                    portador(a) do CPF nº <span className="font-semibold">{maskCPF(cliente.cpf)}</span>,
                    residente em <span className="font-semibold">{enderecoCompleto}</span>,
                    declaro que compareci à loja MDA - Mimos de Alice Joias e realizei a retirada
                    do produto abaixo descrito, o qual se encontra em perfeitas condições de uso e conservação.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">
                    Declaro ainda que recebi todas as orientações necessárias quanto ao uso,
                    conservação e cuidados com o produto, bem como estou ciente dos termos e
                    condições da garantia vinculada a esta aquisição.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">
                    A retirada foi realizada de forma voluntária e em pleno acordo entre as partes.
                  </p>
                </>
              )}
            </div>

            <div className="bg-light/30 rounded-2xl p-4 mb-4">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Dados do Produto</p>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Produto: </span>
                  <span className="font-medium text-gray-700">{produto.nome}</span>
                </div>
                <div>
                  <span className="text-gray-400">Categoria: </span>
                  <span className="font-medium text-gray-700">{produto.categoria}</span>
                </div>
                <div>
                  <span className="text-gray-400">Valor: </span>
                  <span className="font-medium text-gray-700">{formatCurrency(produto.valor)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Data Compra: </span>
                  <span className="font-medium text-gray-700">{formatDate(produto.data_compra)}</span>
                </div>
                {produto.serie && (
                  <div>
                    <span className="text-gray-400">Nº Série: </span>
                    <span className="font-medium text-gray-700">{produto.serie}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Certificado: </span>
                  <span className="font-medium text-primary">{garantia.certificado}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleNextFromPreview}
                className="flex-1 bg-accent text-white px-5 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isTerceiro ? 'Dados do Terceiro' : 'Prosseguir para Assinaturas'}
                <HiOutlineArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Formulário Terceiro ─── */}
        {step === 'terceiro_form' && (
          <div className="p-6">
            <div className="bg-amber-50 rounded-2xl p-3 mb-5 flex items-center gap-2">
              <span className="text-amber-500 text-lg">👤</span>
              <p className="text-sm text-amber-700">
                Preencha os dados da pessoa autorizada a retirar o produto em nome de <span className="font-semibold">{cliente.nome}</span>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Nome Completo <span className="text-red-400">*</span>
                </label>
                <input
                  value={terceiro.nome}
                  onChange={(e) => { setTerceiro(p => ({ ...p, nome: e.target.value })); setTerceiroErros(p => ({ ...p, nome: '' })) }}
                  placeholder="Nome completo do terceiro"
                  className={`${inputBase} ${terceiroErros.nome ? inputError : ''}`}
                />
                {terceiroErros.nome && <p className="text-red-400 text-xs mt-1">{terceiroErros.nome}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    CPF <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={terceiro.cpf}
                    onChange={(e) => { setTerceiro(p => ({ ...p, cpf: maskCPF(e.target.value) })); setTerceiroErros(p => ({ ...p, cpf: '' })) }}
                    placeholder="000.000.000-00"
                    className={`${inputBase} ${terceiroErros.cpf ? inputError : ''}`}
                  />
                  {terceiroErros.cpf && <p className="text-red-400 text-xs mt-1">{terceiroErros.cpf}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">RG</label>
                  <input
                    value={terceiro.rg}
                    onChange={(e) => setTerceiro(p => ({ ...p, rg: e.target.value }))}
                    placeholder="Número do RG"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Telefone <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={terceiro.telefone}
                    onChange={(e) => { setTerceiro(p => ({ ...p, telefone: maskPhone(e.target.value) })); setTerceiroErros(p => ({ ...p, telefone: '' })) }}
                    placeholder="(00) 00000-0000"
                    className={`${inputBase} ${terceiroErros.telefone ? inputError : ''}`}
                  />
                  {terceiroErros.telefone && <p className="text-red-400 text-xs mt-1">{terceiroErros.telefone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Relação <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={terceiro.relacao}
                    onChange={(e) => { setTerceiro(p => ({ ...p, relacao: e.target.value })); setTerceiroErros(p => ({ ...p, relacao: '' })) }}
                    placeholder="Ex: Mãe, Esposo, Amiga..."
                    className={`${inputBase} ${terceiroErros.relacao ? inputError : ''}`}
                  />
                  {terceiroErros.relacao && <p className="text-red-400 text-xs mt-1">{terceiroErros.relacao}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('preview')}
                className="flex-1 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <HiOutlineArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                onClick={handleNextFromTerceiro}
                className="flex-1 bg-accent text-white px-5 py-3 rounded-2xl shadow-lg shadow-accent/30 hover:shadow-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Prosseguir para Assinaturas
                <HiOutlineArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Assinatura Cliente / Terceiro ─── */}
        {step === 'assinatura_cliente' && (
          <div className="p-6">
            <div className="bg-amber-50 rounded-2xl p-3 mb-5 flex items-center gap-2">
              <span className="text-amber-500 text-lg">👆</span>
              <p className="text-sm text-amber-700">
                {isTerceiro
                  ? <>Passe o dispositivo para <span className="font-semibold">{terceiro.nome}</span> (terceiro autorizado) assinar abaixo</>
                  : <>Passe o dispositivo para <span className="font-semibold">{cliente.nome}</span> assinar abaixo</>
                }
              </p>
            </div>

            <SignaturePad
              label={signatureLabel}
              onConfirm={handleClienteSign}
              onClear={() => {}}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep(isTerceiro ? 'terceiro_form' : 'preview')}
                className="flex-1 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <HiOutlineArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Assinatura Operador ─── */}
        {step === 'assinatura_operador' && (
          <div className="p-6">
            <div className="bg-blue-50 rounded-2xl p-3 mb-5 flex items-center gap-2">
              <span className="text-blue-500 text-lg">✍️</span>
              <p className="text-sm text-blue-700">
                Agora é sua vez! Assine como operador(a) responsável.
              </p>
            </div>

            <SignaturePad
              label={user?.nome || 'Operador'}
              onConfirm={handleOperadorSign}
              onClear={() => {}}
              disabled={loading}
            />

            {loading && (
              <div className="text-center mt-4">
                <p className="text-sm text-gray-400">Gerando termo de retirada...</p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep('assinatura_cliente')}
                disabled={loading}
                className="flex-1 bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <HiOutlineArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: Concluído ─── */}
        {step === 'concluido' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <HiOutlineCheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h4 className="text-lg font-bold text-primary mb-2">Termo Gerado com Sucesso!</h4>
            <p className="text-sm text-gray-500 mb-2">
              O termo de retirada foi assinado por ambas as partes.
            </p>
            <div className="bg-emerald-50 rounded-xl p-3 mb-5 flex items-center gap-2">
              <HiOutlineChatAlt2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-700">
                O PDF foi enviado automaticamente via WhatsApp.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDownload}
                className="w-full bg-primary text-white px-5 py-3 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <HiOutlineDownload className="w-4 h-4" />
                Baixar PDF
              </button>

              <button
                onClick={handleEnviarWhatsApp}
                disabled={enviandoWhatsApp}
                className="w-full bg-emerald-500/80 text-white px-5 py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <HiOutlineChatAlt2 className="w-4 h-4" />
                {enviandoWhatsApp ? 'Reenviando...' : 'Reenviar via WhatsApp'}
              </button>

              <button
                onClick={onClose}
                className="w-full bg-gray-100 text-gray-500 px-5 py-3 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TermoRetiradaModal
