import { removeMask } from './masks'

// Valida CPF com cálculo real dos dígitos verificadores
const isValidCPF = (cpf) => {
  const digits = removeMask(cpf)
  if (digits.length !== 11) return false
  // Rejeita sequências com todos os dígitos iguais
  if (/^(\d)\1+$/.test(digits)) return false

  // Primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[9])) return false

  // Segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  return remainder === parseInt(digits[10])
}

// Valida formato de e-mail
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// Valida telefone (10 dígitos fixo ou 11 dígitos celular)
const isValidPhone = (phone) => {
  const digits = removeMask(phone)
  return digits.length === 10 || digits.length === 11
}

// Valida CEP (exatamente 8 dígitos)
const isValidCEP = (cep) => removeMask(cep).length === 8

// Valida campo obrigatório (não vazio, não só espaços)
const isRequired = (value) => {
  if (value === null || value === undefined) return false
  return String(value).trim().length > 0
}

// Valida data no formato DD/MM/AAAA (coerente e não futura)
const isValidDate = (dateStr) => {
  const digits = removeMask(dateStr)
  if (digits.length !== 8) return false

  const day = parseInt(digits.slice(0, 2), 10)
  const month = parseInt(digits.slice(2, 4), 10)
  const year = parseInt(digits.slice(4, 8), 10)

  // Verifica limites básicos
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  if (year < 1900 || year > 2100) return false

  // Verifica se o dia é válido para o mês (incluindo bisexto)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return false

  // Não pode ser data futura
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date <= today
}

const validators = {
  isValidCPF,
  isValidEmail,
  isValidPhone,
  isValidCEP,
  isRequired,
  isValidDate,
}

export { isValidCPF, isValidEmail, isValidPhone, isValidCEP, isRequired, isValidDate }
export default validators
