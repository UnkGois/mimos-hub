import { useState, useEffect } from 'react'
import { HiOutlineCheckCircle } from 'react-icons/hi'
import { enviarCodigoVerificacao, confirmarCodigo } from '../services/clienteService'
import { removeMask } from '../utils/masks'

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

export default function WhatsAppVerify({ telefone, clienteId, verificado: verificadoInicial, onVerified }) {
  const [step, setStep] = useState('idle')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')

  // Sincronizar com prop verificado
  useEffect(() => {
    if (verificadoInicial) setStep('verificado')
    else setStep('idle')
  }, [verificadoInicial])

  const handleEnviar = async () => {
    const tel = removeMask(telefone)
    if (tel.length < 10) { setErro('Telefone inválido'); return }
    setStep('enviando')
    setErro('')
    setCodigo('')
    try {
      const res = await enviarCodigoVerificacao(tel)
      if (res.enviado) {
        setStep('aguardando')
      } else {
        setErro('Falha ao enviar')
        setStep('idle')
      }
    } catch {
      setErro('Erro ao enviar')
      setStep('idle')
    }
  }

  const handleConfirmar = async () => {
    if (codigo.length < 6) { setErro('Digite os 6 dígitos'); return }
    setErro('')
    try {
      const res = await confirmarCodigo(removeMask(telefone), codigo, clienteId)
      if (res.verificado) {
        setStep('verificado')
        onVerified?.()
      } else {
        setErro(res.motivo || 'Código incorreto')
      }
    } catch {
      setErro('Erro ao verificar')
    }
  }

  // Já verificado
  if (step === 'verificado') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600" title="WhatsApp verificado">
        <WhatsAppIcon className="w-4 h-4" />
        <HiOutlineCheckCircle className="w-4 h-4" />
      </span>
    )
  }

  // Aguardando código
  if (step === 'aguardando') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Código enviado via WhatsApp:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={codigo}
            onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className={`flex-1 text-center text-lg font-mono tracking-widest ${inputCls}`}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleConfirmar()}
          />
          <button onClick={handleConfirmar}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors cursor-pointer">
            OK
          </button>
        </div>
        <div className="flex justify-between items-center">
          {erro && <p className="text-red-500 text-xs">{erro}</p>}
          <button onClick={handleEnviar} className="text-xs text-primary hover:underline cursor-pointer ml-auto">Reenviar</button>
        </div>
      </div>
    )
  }

  // Botão inicial (só ícone)
  return (
    <div>
      <button
        onClick={handleEnviar}
        disabled={step === 'enviando' || !telefone || removeMask(telefone).length < 10}
        title="Verificar WhatsApp"
        className="p-2.5 rounded-xl text-green-600 hover:bg-green-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {step === 'enviando'
          ? <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          : <WhatsAppIcon className="w-5 h-5" />
        }
      </button>
      {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
    </div>
  )
}

export { WhatsAppIcon }
