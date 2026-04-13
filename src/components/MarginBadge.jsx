export default function MarginBadge({ margem }) {
  const valor = parseFloat(margem || 0)
  let classes = 'bg-red-100 text-red-700'
  if (valor >= 50) classes = 'bg-emerald-100 text-emerald-700'
  else if (valor >= 30) classes = 'bg-amber-100 text-amber-700'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
      {valor.toFixed(1)}%
    </span>
  )
}
