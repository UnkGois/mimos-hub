import { useState, useMemo, useEffect, useRef } from 'react'
import { HiOutlinePlusCircle, HiOutlineTrash } from 'react-icons/hi'
import { getDespesasFixas, salvarDespesasFixas, getDespesasVariaveis, salvarDespesasVariaveis, calcularBreakEven as apiBreakEven } from '../services/despesaService'
import { formatarMoeda } from '../utils/calculos'
import GaugeChart from '../components/GaugeChart'

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

export default function CalculadoraDespesas() {
  const [fixas, setFixas] = useState([])
  const [variaveis, setVariaveis] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [f, v] = await Promise.all([getDespesasFixas(), getDespesasVariaveis()])
        setFixas(f)
        setVariaveis(v)
      } catch (err) {
        console.error('Erro ao carregar despesas:', err)
      } finally {
        setCarregando(false)
      }
    }
    load()
  }, [])

  // Parâmetros
  const [ticketMedio, setTicketMedio] = useState(65)
  const [margemContribuicao, setMargemContribuicao] = useState(50)
  const [diasFuncionamento, setDiasFuncionamento] = useState(26)
  const [horario, setHorario] = useState('9h–18h')

  const [lucroDesejado, setLucroDesejado] = useState(3000)

  // Simulador
  const [simAluguel, setSimAluguel] = useState(null)
  const [simTicket, setSimTicket] = useState(null)
  const [simFuncionario, setSimFuncionario] = useState(0)
  const [simMargem, setSimMargem] = useState(null)

  const isFinite = (v) => v !== Infinity && !isNaN(v)

  const totalFixas = useMemo(() => {
    let total = fixas.reduce((sum, d) => sum + (d.valor || 0), 0)
    if (simAluguel !== null) {
      const aluguelAtual = fixas.find(d => d.nome === 'Aluguel')?.valor || 0
      total = total - aluguelAtual + simAluguel
    }
    total += simFuncionario || 0
    return total
  }, [fixas, simAluguel, simFuncionario])

  const totalVariaveisPorUnidade = useMemo(() => {
    const tk = simTicket ?? ticketMedio
    return variaveis.reduce((sum, d) => {
      if (d.tipo === 'percentual') return sum + (tk * d.valor / 100)
      return sum + (d.valor || 0)
    }, 0)
  }, [variaveis, ticketMedio, simTicket])

  const breakEven = useMemo(() => {
    const tk = simTicket ?? ticketMedio
    const mg = simMargem ?? margemContribuicao
    const contribuicao = (tk * mg / 100) - totalVariaveisPorUnidade
    if (contribuicao <= 0) return { vendasMes: Infinity, vendasDia: Infinity, faturamento: Infinity }
    const vendasMes = Math.ceil(totalFixas / contribuicao)
    return {
      vendasMes,
      vendasDia: Math.ceil(vendasMes / diasFuncionamento),
      faturamento: vendasMes * tk,
    }
  }, [totalFixas, totalVariaveisPorUnidade, ticketMedio, margemContribuicao, diasFuncionamento, simTicket, simMargem])

  const metaLucro = useMemo(() => {
    const tk = simTicket ?? ticketMedio
    const mg = simMargem ?? margemContribuicao
    const contribuicao = (tk * mg / 100) - totalVariaveisPorUnidade
    if (contribuicao <= 0) return { vendasMes: Infinity, vendasDia: Infinity, faturamento: Infinity }
    const totalNecessario = totalFixas + lucroDesejado
    const vendasMes = Math.ceil(totalNecessario / contribuicao)
    return {
      vendasMes,
      vendasDia: Math.ceil(vendasMes / diasFuncionamento),
      faturamento: vendasMes * tk,
      vendasAMais: vendasMes - (isFinite(breakEven.vendasMes) ? breakEven.vendasMes : 0),
    }
  }, [totalFixas, totalVariaveisPorUnidade, ticketMedio, margemContribuicao, diasFuncionamento, simTicket, simMargem, lucroDesejado, breakEven])

  // Debounce save — atualiza localmente e salva em batch no backend
  const saveFixasTimeout = useRef(null)
  const saveVariaveisTimeout = useRef(null)

  const updateFixa = (id, field, value) => {
    const novas = fixas.map(d => d.id === id ? { ...d, [field]: value } : d)
    setFixas(novas)
    clearTimeout(saveFixasTimeout.current)
    saveFixasTimeout.current = setTimeout(() => {
      salvarDespesasFixas(novas.map(d => ({ nome: d.nome, valor: d.valor }))).catch(() => {})
    }, 1000)
  }

  const addFixa = () => {
    setFixas(prev => [...prev, { id: Date.now(), nome: '', valor: 0 }])
  }

  const removeFixa = (id) => {
    const novas = fixas.filter(d => d.id !== id)
    setFixas(novas)
    salvarDespesasFixas(novas.map(d => ({ nome: d.nome, valor: d.valor }))).catch(() => {})
  }

  const updateVariavel = (id, field, value) => {
    const novas = variaveis.map(d => d.id === id ? { ...d, [field]: value } : d)
    setVariaveis(novas)
    clearTimeout(saveVariaveisTimeout.current)
    saveVariaveisTimeout.current = setTimeout(() => {
      salvarDespesasVariaveis(novas.map(d => ({ nome: d.nome, tipo: d.tipo, valor: d.valor }))).catch(() => {})
    }, 1000)
  }

  const addVariavel = () => {
    setVariaveis(prev => [...prev, { id: Date.now(), nome: '', tipo: 'fixo', valor: 0 }])
  }

  const removeVariavel = (id) => {
    const novas = variaveis.filter(d => d.id !== id)
    setVariaveis(novas)
    salvarDespesasVariaveis(novas.map(d => ({ nome: d.nome, tipo: d.tipo, valor: d.valor }))).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Calculadora de Despesas — Loja Física</h1>

      {/* Despesas Fixas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Despesas Fixas (mensais)</h2>
        <div className="space-y-2">
          {fixas.map(d => (
            <div key={d.id} className="flex items-center gap-3">
              <input type="text" value={d.nome} onChange={e => updateFixa(d.id, 'nome', e.target.value)} placeholder="Nome da despesa" className={`flex-1 ${inputCls}`} />
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                <input type="number" step="0.01" min="0" value={d.valor || ''} onChange={e => updateFixa(d.id, 'valor', parseFloat(e.target.value) || 0)}
                  className={`pl-9 ${inputCls}`} />
              </div>
              <button onClick={() => removeFixa(d.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addFixa} className="mt-3 flex items-center gap-2 text-primary text-sm font-medium hover:underline">
          <HiOutlinePlusCircle className="w-4 h-4" /> Adicionar Despesa Fixa
        </button>
        <div className="mt-4 bg-primary/10 rounded-xl p-4 border border-primary/20">
          <p className="text-sm text-gray-500">Subtotal Fixo</p>
          <p className="text-2xl font-bold text-gray-800">{formatarMoeda(fixas.reduce((s, d) => s + (d.valor || 0), 0))} / mês</p>
        </div>
      </div>

      {/* Despesas Variáveis */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Despesas Variáveis (por venda)</h2>
        <div className="space-y-2">
          {variaveis.map(d => (
            <div key={d.id} className="flex items-center gap-3">
              <input type="text" value={d.nome} onChange={e => updateVariavel(d.id, 'nome', e.target.value)} placeholder="Nome" className={`flex-1 ${inputCls}`} />
              <select value={d.tipo} onChange={e => updateVariavel(d.id, 'tipo', e.target.value)} className={`w-32 ${inputCls}`}>
                <option value="fixo">R$ por un.</option>
                <option value="percentual">% sobre venda</option>
              </select>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{d.tipo === 'fixo' ? 'R$' : '%'}</span>
                <input type="number" step="0.01" min="0" value={d.valor || ''} onChange={e => updateVariavel(d.id, 'valor', parseFloat(e.target.value) || 0)}
                  className={`pl-9 ${inputCls}`} />
              </div>
              <button onClick={() => removeVariavel(d.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addVariavel} className="mt-3 flex items-center gap-2 text-primary text-sm font-medium hover:underline">
          <HiOutlinePlusCircle className="w-4 h-4" /> Adicionar Despesa Variável
        </button>
      </div>

      {/* Parâmetros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Parâmetros de Cálculo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Médio (R$)</label>
            <input type="number" step="0.01" min="0" value={ticketMedio} onChange={e => setTicketMedio(parseFloat(e.target.value) || 0)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Margem Média de Contribuição (%)</label>
            <input type="number" step="0.1" min="0" max="100" value={margemContribuicao} onChange={e => setMargemContribuicao(parseFloat(e.target.value) || 0)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lucro Desejado / Mês (R$)</label>
            <input type="number" step="100" min="0" value={lucroDesejado} onChange={e => setLucroDesejado(parseFloat(e.target.value) || 0)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dias de Funcionamento / Mês</label>
            <input type="number" step="1" min="1" max="31" value={diasFuncionamento} onChange={e => setDiasFuncionamento(parseInt(e.target.value) || 26)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Funcionamento</label>
            <input type="text" value={horario} onChange={e => setHorario(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Resultado Break-Even */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Resultado — Ponto de Equilíbrio</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-6 text-white text-center">
            <p className="text-sm opacity-80">Vendas Necessárias / Mês</p>
            <p className="text-4xl font-bold mt-2">{isFinite(breakEven.vendasMes) ? breakEven.vendasMes : '—'}</p>
            <p className="text-xs opacity-70 mt-1">vendas</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white text-center">
            <p className="text-sm opacity-80">Vendas Necessárias / Dia</p>
            <p className="text-4xl font-bold mt-2">~{isFinite(breakEven.vendasDia) ? breakEven.vendasDia : '—'}</p>
            <p className="text-xs opacity-70 mt-1">vendas</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white text-center">
            <p className="text-sm opacity-80">Faturamento Mínimo / Mês</p>
            <p className="text-3xl font-bold mt-2">{isFinite(breakEven.faturamento) ? formatarMoeda(breakEven.faturamento) : '—'}</p>
            <p className="text-xs opacity-70 mt-1">para cobrir despesas</p>
          </div>
        </div>

        {/* Gauge */}
        <div className="flex justify-center">
          <GaugeChart valor={100} meta={100} label={isFinite(breakEven.faturamento) ? `Meta: ${formatarMoeda(breakEven.faturamento)}/mês` : 'Preencha as despesas'} />
        </div>

        {isFinite(breakEven.faturamento) && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Sua loja precisa faturar no mínimo <strong>{formatarMoeda(breakEven.faturamento)}/mês</strong> para não ter prejuízo
          </p>
        )}
      </div>

      {/* Meta de Lucro */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Meta de Lucro — {formatarMoeda(lucroDesejado)}/mês</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white text-center">
            <p className="text-sm opacity-80">Vendas Necessárias / Mês</p>
            <p className="text-4xl font-bold mt-2">{isFinite(metaLucro.vendasMes) ? metaLucro.vendasMes : '—'}</p>
            <p className="text-xs opacity-70 mt-1">vendas</p>
          </div>
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white text-center">
            <p className="text-sm opacity-80">Vendas Necessárias / Dia</p>
            <p className="text-4xl font-bold mt-2">~{isFinite(metaLucro.vendasDia) ? metaLucro.vendasDia : '—'}</p>
            <p className="text-xs opacity-70 mt-1">vendas</p>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white text-center">
            <p className="text-sm opacity-80">Faturamento Necessário / Mês</p>
            <p className="text-3xl font-bold mt-2">{isFinite(metaLucro.faturamento) ? formatarMoeda(metaLucro.faturamento) : '—'}</p>
            <p className="text-xs opacity-70 mt-1">para lucrar {formatarMoeda(lucroDesejado)}</p>
          </div>
        </div>

        {isFinite(metaLucro.vendasMes) && isFinite(breakEven.vendasMes) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p>
              Para lucrar <strong>{formatarMoeda(lucroDesejado)}/mês</strong>, você precisa fazer <strong>{metaLucro.vendasAMais} vendas a mais</strong> além do ponto de equilíbrio ({breakEven.vendasMes} vendas).
              Isso significa faturar <strong>{formatarMoeda(metaLucro.faturamento - breakEven.faturamento)} a mais</strong> do que o mínimo.
            </p>
          </div>
        )}
      </div>

      {/* Simulador E se... */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Simulador "E se..."</h2>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Se o aluguel subir para...</span>
              <span className="font-semibold">{simAluguel !== null ? formatarMoeda(simAluguel) : 'Atual'}</span>
            </div>
            <input type="range" min="500" max="5000" step="100" value={simAluguel ?? (fixas.find(d => d.nome === 'Aluguel')?.valor || 0)}
              onChange={e => setSimAluguel(parseFloat(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-gray-400"><span>R$ 500</span><span>R$ 5.000</span></div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Se o ticket médio for...</span>
              <span className="font-semibold">{simTicket !== null ? formatarMoeda(simTicket) : 'Atual'}</span>
            </div>
            <input type="range" min="20" max="200" step="5" value={simTicket ?? ticketMedio}
              onChange={e => setSimTicket(parseFloat(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-gray-400"><span>R$ 20</span><span>R$ 200</span></div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Se eu contratar mais 1 pessoa...</span>
              <span className="font-semibold">{simFuncionario > 0 ? `+ ${formatarMoeda(simFuncionario)}` : 'Nenhum'}</span>
            </div>
            <input type="range" min="0" max="3000" step="100" value={simFuncionario}
              onChange={e => setSimFuncionario(parseFloat(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-gray-400"><span>R$ 0</span><span>R$ 3.000</span></div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Se a margem média for...</span>
              <span className="font-semibold">{simMargem !== null ? `${simMargem}%` : 'Atual'}</span>
            </div>
            <input type="range" min="20" max="80" step="1" value={simMargem ?? margemContribuicao}
              onChange={e => setSimMargem(parseFloat(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-gray-400"><span>20%</span><span>80%</span></div>
          </div>

          <button onClick={() => { setSimAluguel(null); setSimTicket(null); setSimFuncionario(0); setSimMargem(null) }}
            className="text-sm text-primary hover:underline">Resetar simulação</button>
        </div>
      </div>
    </div>
  )
}
