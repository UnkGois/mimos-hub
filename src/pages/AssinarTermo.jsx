import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineClock } from 'react-icons/hi'
import SignaturePad from '../components/SignaturePad'
import * as termoPublicoService from '../services/termoPublicoService'
import LogoRosa from '../assets/RosaMDA.svg'

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const AssinarTermo = () => {
  const { token } = useParams()
  const [termo, setTermo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [concordo, setConcordo] = useState(false)
  const [assinando, setAssinando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    termoPublicoService
      .obterTermo(token)
      .then((data) => setTermo(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setErro('Link de assinatura não encontrado.')
        } else if (err.response?.status === 410) {
          setErro('Este link de assinatura expirou.')
        } else {
          setErro('Erro ao carregar termo de retirada.')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleAssinar = async (base64) => {
    setAssinando(true)
    try {
      await termoPublicoService.assinarCliente(token, base64)
      setSucesso(true)
    } catch {
      setErro('Erro ao registrar assinatura. Tente novamente.')
    } finally {
      setAssinando(false)
    }
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF0F3] to-white flex items-center justify-center">
        <div className="text-center">
          <img src={LogoRosa} alt="MDA" className="h-12 mx-auto mb-4" />
          <div className="w-8 h-8 border-3 border-[#E05297] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Carregando...</p>
        </div>
      </div>
    )
  }

  // ─── Erro ───
  if (erro && !termo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF0F3] to-white">
        <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <img src={LogoRosa} alt="MDA" className="h-8" />
          <span className="text-sm font-medium text-[#E05297]">Termo de Retirada</span>
        </header>
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <HiOutlineExclamationCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Link Indisponível</h2>
          <p className="text-sm text-gray-500">{erro}</p>
        </main>
      </div>
    )
  }

  // ─── Sucesso após assinar ───
  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF0F3] to-white">
        <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <img src={LogoRosa} alt="MDA" className="h-8" />
          <span className="text-sm font-medium text-[#E05297]">Termo de Retirada</span>
        </header>
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-[#E05297] mb-2">Assinatura Registrada!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Você receberá o termo assinado no seu WhatsApp em instantes.
          </p>
          <div className="bg-[#FFF0F3] rounded-2xl p-6">
            <p className="text-sm text-gray-600">
              Obrigada pela confiança! 💎🩷
            </p>
            <p className="text-xs text-gray-400 mt-2">
              MDA - Mimos de Alice Joias
            </p>
            <p className="text-xs text-gray-400">
              www.mimosdealicejoias.com.br
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ─── Já assinado ───
  if (termo.assinatura_cliente_presente) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF0F3] to-white">
        <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <img src={LogoRosa} alt="MDA" className="h-8" />
          <span className="text-sm font-medium text-[#E05297]">Termo de Retirada</span>
        </header>
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Termo Já Assinado</h2>
          <p className="text-sm text-gray-500">
            Este termo já foi assinado. Aguarde a finalização pelo operador.
          </p>
        </main>
      </div>
    )
  }

  // ─── Expirado ───
  if (termo.expirado || termo.status === 'Expirado') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF0F3] to-white">
        <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <img src={LogoRosa} alt="MDA" className="h-8" />
          <span className="text-sm font-medium text-[#E05297]">Termo de Retirada</span>
        </header>
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <HiOutlineClock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Link Expirado</h2>
          <p className="text-sm text-gray-500">
            Este link de assinatura expirou. Entre em contato com a loja para solicitar um novo.
          </p>
        </main>
      </div>
    )
  }

  // ─── Página principal de assinatura ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF0F3] to-white">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <img src={LogoRosa} alt="MDA" className="h-8" />
        <div>
          <p className="text-sm font-medium text-[#E05297]">Termo de Retirada</p>
          <p className="text-xs text-gray-400">MDA - Mimos de Alice Joias</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Resumo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Resumo</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Cliente</span>
              <span className="font-medium text-gray-700">{termo.cliente_nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CPF</span>
              <span className="font-medium text-gray-700">{termo.cliente_cpf_masked}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Produto</span>
              <span className="font-medium text-gray-700">{termo.produto_nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Valor</span>
              <span className="font-medium text-gray-700">{termo.produto_valor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Certificado</span>
              <span className="font-semibold text-[#E05297]">{termo.certificado}</span>
            </div>
            {termo.data_compra && (
              <div className="flex justify-between">
                <span className="text-gray-400">Data Compra</span>
                <span className="font-medium text-gray-700">{formatDate(termo.data_compra)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dados do terceiro autorizado */}
        {termo.is_terceiro && termo.terceiro_nome && (
          <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 p-5">
            <p className="text-xs uppercase tracking-wider text-amber-600 font-semibold mb-3">Pessoa Autorizada (Terceiro)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Nome</span>
                <span className="font-medium text-gray-700">{termo.terceiro_nome}</span>
              </div>
              {termo.terceiro_cpf && (
                <div className="flex justify-between">
                  <span className="text-gray-400">CPF</span>
                  <span className="font-medium text-gray-700">{termo.terceiro_cpf}</span>
                </div>
              )}
              {termo.terceiro_relacao && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Relação</span>
                  <span className="font-medium text-gray-700">{termo.terceiro_relacao}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Texto do termo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Termo de Retirada</p>
          <div className="max-h-48 overflow-y-auto pr-2">
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {termo.texto_termo}
            </p>
          </div>
        </div>

        {/* Checkbox concordo */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={concordo}
            onChange={(e) => setConcordo(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#E05297] focus:ring-[#E05297] cursor-pointer"
          />
          <span className="text-sm text-gray-600">
            Li e concordo com os termos acima descritos
          </span>
        </label>

        {/* Assinatura */}
        {concordo && (
          <div className="animate-[fade-in_0.3s_ease-out]">
            <p className="text-sm text-gray-500 mb-3">
              Assine com o dedo no espaço abaixo:
            </p>
            <SignaturePad
              label={termo.is_terceiro && termo.terceiro_nome ? termo.terceiro_nome : termo.cliente_nome}
              onConfirm={handleAssinar}
              onClear={() => {}}
              disabled={assinando}
            />
            {assinando && (
              <p className="text-center text-sm text-gray-400 mt-3">Registrando assinatura...</p>
            )}
          </div>
        )}

        {/* Erro inline */}
        {erro && termo && (
          <div className="bg-red-50 rounded-2xl p-3 flex items-center gap-2">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{erro}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-gray-300">MDA - Mimos de Alice Joias</p>
          <p className="text-xs text-gray-300">www.mimosdealicejoias.com.br</p>
        </div>
      </main>
    </div>
  )
}

export default AssinarTermo
