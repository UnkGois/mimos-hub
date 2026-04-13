import { removeMask } from '../utils/masks'

// Busca endereço na API ViaCEP a partir do CEP informado
// Retorna { logradouro, bairro, localidade, uf } ou null se inválido/erro
const fetchAddress = async (cep) => {
  const digits = removeMask(cep)
  if (digits.length !== 8) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    const data = await response.json()

    if (data.erro) return null

    return {
      logradouro: data.logradouro,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
    }
  } catch {
    return null
  }
}

export default fetchAddress
