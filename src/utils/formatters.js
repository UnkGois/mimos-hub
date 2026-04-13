import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Formatação de valores monetários
const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

// Formatação de datas
const formatarData = (data) => {
  if (!data) return ''
  const date = typeof data === 'string' ? parseISO(data) : data
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

const formatarDataHora = (data) => {
  if (!data) return ''
  const date = typeof data === 'string' ? parseISO(data) : data
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

// Formatação de CPF
const formatarCPF = (cpf) => {
  const numeros = cpf.replace(/\D/g, '')
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// Formatação de telefone
const formatarTelefone = (tel) => {
  const numeros = tel.replace(/\D/g, '')
  if (numeros.length === 11) {
    return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

export { formatarMoeda, formatarData, formatarDataHora, formatarCPF, formatarTelefone }
