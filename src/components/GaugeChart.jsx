import { PieChart, Pie, Cell } from 'recharts'

export default function GaugeChart({ valor, meta, label }) {
  const porcentagem = meta > 0 ? Math.min((valor / meta) * 100, 200) : 0
  const angulo = Math.min(porcentagem, 200)

  const data = [
    { value: Math.min(angulo, 100), color: angulo < 100 ? '#EF4444' : '#22C55E' },
    { value: angulo > 100 ? Math.min(angulo - 100, 30) : 0, color: '#F59E0B' },
    { value: angulo > 130 ? angulo - 130 : 0, color: '#22C55E' },
    { value: Math.max(200 - angulo, 0), color: '#F3F4F6' },
  ].filter(d => d.value > 0)

  return (
    <div className="flex flex-col items-center">
      <PieChart width={240} height={140}>
        <Pie
          data={data}
          cx={120}
          cy={130}
          startAngle={180}
          endAngle={0}
          innerRadius={70}
          outerRadius={100}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
      <p className="text-2xl font-bold text-gray-800 -mt-4">{porcentagem.toFixed(0)}%</p>
      {label && <p className="text-sm text-gray-500 mt-1">{label}</p>}
    </div>
  )
}
