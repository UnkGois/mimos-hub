// Skeleton de carregamento reutilizável
const LoadingSkeleton = ({ linhas = 5, tipo = 'tabela' }) => {
  if (tipo === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-200" />
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded-xl w-16 mb-2" />
                <div className="h-3 bg-gray-100 rounded-lg w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded-lg w-32 mb-6" />
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-3">
          <div className="h-3 bg-gray-100 rounded-lg flex-1" />
          <div className="h-3 bg-gray-100 rounded-lg w-24" />
          <div className="h-3 bg-gray-100 rounded-lg w-20" />
          <div className="h-5 bg-gray-100 rounded-xl w-16" />
        </div>
      ))}
    </div>
  )
}

export default LoadingSkeleton
