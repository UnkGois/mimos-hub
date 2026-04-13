import { memo } from 'react'
import { HiArrowSmUp, HiArrowSmDown } from 'react-icons/hi'

// Card de métrica premium — bordas suaves, gradientes, animação hover
const MetricCard = memo(({ titulo, valor, icone: Icone, corDe, corPara, variacao }) => {
  const temVariacao = variacao !== undefined && variacao !== null
  const positivo = temVariacao && variacao >= 0

  return (
    <div className="bg-white rounded-3xl shadow-lg shadow-gray-100/80 border border-gray-100/50 p-6 hover:shadow-xl hover:shadow-gray-200/60 hover:scale-[1.02] transition-all duration-500 ease-out">
      {/* Topo: ícone + badge de variação */}
      <div className="flex justify-between items-start">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${corDe} ${corPara} flex items-center justify-center shadow-md`}>
          <Icone className="w-[26px] h-[26px] text-white" />
        </div>

        {temVariacao && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2.5 py-1 rounded-xl border ${
              positivo
                ? 'bg-green-50 text-green-500 border-green-100'
                : 'bg-red-50 text-red-500 border-red-100'
            }`}
          >
            {positivo ? (
              <HiArrowSmUp className="w-3.5 h-3.5" />
            ) : (
              <HiArrowSmDown className="w-3.5 h-3.5" />
            )}
            {positivo ? '+' : ''}
            {variacao}%
          </span>
        )}
      </div>

      {/* Inferior: valor + título */}
      <div className="mt-4">
        <p className="text-3xl font-bold text-primary tracking-tight">{valor}</p>
        <p className="text-sm text-gray-400 font-medium mt-1">{titulo}</p>
        {temVariacao && <p className="text-xs text-gray-300 mt-0.5">vs mês anterior</p>}
      </div>
    </div>
  )
})

export default MetricCard
