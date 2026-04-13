import api from './api'

// Despesas Fixas
export async function getDespesasFixas() {
  const { data } = await api.get('/despesas/fixas')
  return data
}

export async function salvarDespesasFixas(despesas) {
  const { data } = await api.put('/despesas/fixas', despesas)
  return data
}

export async function criarDespesaFixa(despesa) {
  const { data } = await api.post('/despesas/fixas', despesa)
  return data
}

export async function atualizarDespesaFixa(id, despesa) {
  const { data } = await api.put(`/despesas/fixas/${id}`, despesa)
  return data
}

export async function excluirDespesaFixa(id) {
  const { data } = await api.delete(`/despesas/fixas/${id}`)
  return data
}

// Despesas Variáveis
export async function getDespesasVariaveis() {
  const { data } = await api.get('/despesas/variaveis')
  return data
}

export async function salvarDespesasVariaveis(despesas) {
  const { data } = await api.put('/despesas/variaveis', despesas)
  return data
}

export async function criarDespesaVariavel(despesa) {
  const { data } = await api.post('/despesas/variaveis', despesa)
  return data
}

export async function atualizarDespesaVariavel(id, despesa) {
  const { data } = await api.put(`/despesas/variaveis/${id}`, despesa)
  return data
}

export async function excluirDespesaVariavel(id) {
  const { data } = await api.delete(`/despesas/variaveis/${id}`)
  return data
}

// Break-Even
export async function calcularBreakEven(params) {
  const { data } = await api.post('/despesas/break-even', params)
  return data
}
