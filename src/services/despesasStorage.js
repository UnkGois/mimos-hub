import { getJSON, setJSON } from '../utils/localStorage'

const KEY_FIXAS = 'mimos_hub_despesas_fixas'
const KEY_VARIAVEIS = 'mimos_hub_despesas_variaveis'

const DESPESAS_FIXAS_PADRAO = [
  { id: '1', nome: 'Aluguel', valor: 0 },
  { id: '2', nome: 'Condomínio', valor: 0 },
  { id: '3', nome: 'Energia Elétrica', valor: 0 },
  { id: '4', nome: 'Água', valor: 0 },
  { id: '5', nome: 'Internet / Telefone', valor: 0 },
  { id: '6', nome: 'Salários + Encargos', valor: 0 },
  { id: '7', nome: 'Pró-labore', valor: 0 },
  { id: '8', nome: 'Contador', valor: 0 },
  { id: '9', nome: 'Sistema / Software', valor: 0 },
  { id: '10', nome: 'Seguro', valor: 0 },
  { id: '11', nome: 'Marketing / Ads', valor: 0 },
  { id: '12', nome: 'Assinatura Amazon Seller', valor: 19 },
]

const DESPESAS_VARIAVEIS_PADRAO = [
  { id: '1', nome: 'Embalagem para envio', tipo: 'fixo', valor: 2.50 },
  { id: '2', nome: 'Sacola / Caixa loja', tipo: 'fixo', valor: 1.00 },
  { id: '3', nome: 'Maquininha', tipo: 'percentual', valor: 2.5 },
  { id: '4', nome: 'Material de marketing', tipo: 'fixo', valor: 0.50 },
]

export function getDespesasFixas() {
  return getJSON(KEY_FIXAS, DESPESAS_FIXAS_PADRAO)
}

export function saveDespesasFixas(despesas) {
  setJSON(KEY_FIXAS, despesas)
}

export function getDespesasVariaveis() {
  return getJSON(KEY_VARIAVEIS, DESPESAS_VARIAVEIS_PADRAO)
}

export function saveDespesasVariaveis(despesas) {
  setJSON(KEY_VARIAVEIS, despesas)
}

export function getTotalFixas() {
  return getDespesasFixas().reduce((sum, d) => sum + (d.valor || 0), 0)
}

export function getTotalVariaveisPorUnidade(ticketMedio = 65) {
  return getDespesasVariaveis().reduce((sum, d) => {
    if (d.tipo === 'percentual') return sum + (ticketMedio * d.valor / 100)
    return sum + (d.valor || 0)
  }, 0)
}
