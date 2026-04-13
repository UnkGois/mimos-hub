import { useState, useEffect } from 'react'
import {
  HiOutlineX,
  HiOutlinePencilAlt,
  HiOutlineChatAlt2,
  HiOutlineUserAdd,
  HiOutlineDownload,
  HiOutlineRefresh,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineBan,
} from 'react-icons/hi'
import * as termoService from '../services/termoService'

const formatDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

const statusConfig = {
  Pendente: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: HiOutlineClock },
  AguardandoOperador: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: HiOutlinePencilAlt },
  Concluido: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: HiOutlineCheckCircle },
  Expirado: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: HiOutlineBan },
}

const tipoLabel = {
  whatsapp: 'WhatsApp',
  presencial: 'Presencial',
  terceiro: 'Terceiro',
}

const TermoEscolhaModal = ({ garantia, onClose, onEscolha }) => {
  const [termos, setTermos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    termoService
      .listarPorGarantia(garantia.id)
      .then((data) => setTermos(data.items || []))
      .catch(() => setTermos([]))
      .finally(() => setLoading(false))
  }, [garantia.id])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto animate-[scale-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-primary">Termo de Retirada</h3>
            <p className="text-sm text-gray-400 mt-0.5">Certificado {garantia.certificado}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Escolha */}
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">Como deseja coletar a assinatura?</p>

          <div className="grid grid-cols-3 gap-3">
            {/* Presencial */}
            <button
              onClick={() => onEscolha('presencial')}
              className="border-2 border-gray-100 hover:border-primary/30 rounded-2xl p-4 text-center transition-all cursor-pointer hover:bg-light/30 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-2.5">
                <HiOutlinePencilAlt className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-primary">
                Presencial
              </p>
              <p className="text-xs text-gray-400 mt-1">Assina na loja</p>
            </button>

            {/* WhatsApp */}
            <button
              onClick={() => onEscolha('whatsapp')}
              className="border-2 border-gray-100 hover:border-emerald-200 rounded-2xl p-4 text-center transition-all cursor-pointer hover:bg-emerald-50/30 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center mx-auto mb-2.5">
                <HiOutlineChatAlt2 className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600">
                WhatsApp
              </p>
              <p className="text-xs text-gray-400 mt-1">Assina no celular</p>
            </button>

            {/* Terceiro */}
            <button
              onClick={() => onEscolha('terceiro')}
              className="border-2 border-gray-100 hover:border-amber-200 rounded-2xl p-4 text-center transition-all cursor-pointer hover:bg-amber-50/30 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center mx-auto mb-2.5">
                <HiOutlineUserAdd className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-amber-600">
                Terceiro
              </p>
              <p className="text-xs text-gray-400 mt-1">Pessoa autorizada</p>
            </button>
          </div>

          {/* Termos existentes */}
          {!loading && termos.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
                Termos Anteriores
              </p>
              <div className="space-y-2">
                {termos.map((t) => {
                  const cfg = statusConfig[t.status] || statusConfig.Pendente
                  const StatusIcon = cfg.icon
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-4 h-4 ${cfg.text}`} />
                        <div>
                          <p className="text-sm text-gray-600">
                            {tipoLabel[t.tipo_fluxo] || t.tipo_fluxo}
                            {t.terceiro_nome && (
                              <span className="text-xs text-gray-400 ml-1">({t.terceiro_nome})</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{formatDateTime(t.criado_em)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-xl px-2.5 py-1 text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          {t.status === 'AguardandoOperador' ? 'Aguardando' : t.status}
                        </span>
                        {t.status === 'Concluido' && (
                          <button
                            onClick={() => termoService.downloadPDF(t.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-all cursor-pointer"
                            title="Baixar PDF"
                          >
                            <HiOutlineDownload className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="mt-6 flex justify-center">
              <HiOutlineRefresh className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TermoEscolhaModal
