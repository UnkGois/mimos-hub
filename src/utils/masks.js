// Remove qualquer caractere que não seja dígito numérico
const removeMask = (value) => String(value ?? '').replace(/\D/g, '')

// Máscara de CPF: 000.000.000-00
const maskCPF = (value) => {
  const digits = removeMask(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

// Máscara de telefone: (00) 00000-0000 (celular) ou (00) 0000-0000 (fixo)
const maskPhone = (value) => {
  const digits = removeMask(value).slice(0, 11)
  if (digits.length <= 10) {
    // Fixo: (00) 0000-0000
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  // Celular: (00) 00000-0000
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

// Máscara de CEP: 00000-000
const maskCEP = (value) => {
  const digits = removeMask(value).slice(0, 8)
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2')
}

// Máscara monetária: R$ 1.234,56 (entrada em centavos inteiros)
const maskCurrency = (value) => {
  const digits = removeMask(value)
  if (!digits) return ''
  const numeric = parseInt(digits, 10) / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric)
}

// Máscara de data: DD/MM/AAAA
const maskDate = (value) => {
  const digits = removeMask(value).slice(0, 8)
  return digits
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
}

const masks = { maskCPF, maskPhone, maskCEP, maskCurrency, maskDate, removeMask }

export { maskCPF, maskPhone, maskCEP, maskCurrency, maskDate, removeMask }
export default masks
