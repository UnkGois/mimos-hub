export function calcularCustoProduto({ valorCompra = 0, valorGramaBanho = 0, qtdGramas = 0, custoEmbalagem = 0, outrosCustos = 0 }) {
  return valorCompra + (valorGramaBanho * qtdGramas) + custoEmbalagem + outrosCustos
}

export function calcularPrecoSugeridoLojaFisica(custoTotal, impostoPercent, margemPercent) {
  const fatorImposto = 1 - (impostoPercent / 100)
  const fatorMargem = 1 + (margemPercent / 100)
  if (fatorImposto <= 0) return 0
  return (custoTotal / fatorImposto) * fatorMargem
}

export function calcularPrecoSugeridoMarketplace(custoTotal, { comissaoPercent = 0, taxaFixa = 0, custoFrete = 0, freteAbsorvido = true, impostoPercent = 0, margemPercent = 0 }) {
  const frete = freteAbsorvido ? custoFrete : 0
  const divisor = 1 - (comissaoPercent / 100) - (impostoPercent / 100)
  if (divisor <= 0) return 0
  return ((custoTotal + taxaFixa + frete) / divisor) * (1 + margemPercent / 100)
}

export function calcularMargemReal(precoFinal, custoTotal, taxasCanal) {
  if (precoFinal <= 0) return 0
  const lucro = precoFinal - custoTotal - taxasCanal
  return (lucro / precoFinal) * 100
}

export function calcularLucroPorPeca(precoFinal, custoTotal, taxasCanal) {
  return precoFinal - custoTotal - taxasCanal
}

export function calcularTaxasCanal(precoFinal, { comissaoPercent = 0, taxaFixa = 0, custoFrete = 0, freteAbsorvido = true, impostoPercent = 0 }) {
  const comissao = precoFinal * (comissaoPercent / 100)
  const imposto = precoFinal * (impostoPercent / 100)
  const frete = freteAbsorvido ? custoFrete : 0
  return comissao + taxaFixa + frete + imposto
}

export function calcularBreakEven(totalDespesasFixas, ticketMedio, margemContribuicaoPercent, despesaVariavelPorUnidade) {
  const contribuicaoPorVenda = (ticketMedio * margemContribuicaoPercent / 100) - despesaVariavelPorUnidade
  if (contribuicaoPorVenda <= 0) return { vendasMes: Infinity, vendasDia: Infinity, faturamentoMinimo: Infinity }
  const vendasMes = Math.ceil(totalDespesasFixas / contribuicaoPorVenda)
  return {
    vendasMes,
    vendasDia: (dias = 26) => Math.ceil(vendasMes / dias),
    faturamentoMinimo: vendasMes * ticketMedio
  }
}

export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)
}

export function formatarPorcentagem(valor) {
  return `${(valor || 0).toFixed(1)}%`
}

export function corMargem(margem) {
  if (margem >= 50) return 'text-emerald-600'
  if (margem >= 30) return 'text-amber-600'
  return 'text-red-600'
}

export function bgCorMargem(margem) {
  if (margem >= 50) return 'bg-emerald-50 border-emerald-200'
  if (margem >= 30) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}
