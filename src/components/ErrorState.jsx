import { HiOutlineExclamationCircle } from 'react-icons/hi'

const ErrorState = ({ mensagem = 'Ocorreu um erro ao carregar os dados.', onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
      <HiOutlineExclamationCircle className="w-8 h-8 text-red-400" />
    </div>
    <p className="text-gray-500 text-sm text-center max-w-xs">{mensagem}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 bg-accent text-white px-5 py-2 rounded-2xl text-sm font-medium hover:shadow-lg hover:shadow-accent/30 transition-all cursor-pointer"
      >
        Tentar novamente
      </button>
    )}
  </div>
)

export default ErrorState
