import { getJSON, setJSON } from '../utils/localStorage'

const KEY = 'mimos_hub_configuracoes'

const DEFAULTS = {
  empresa: {
    nome: 'Mimos de Alice Joias',
    cnpj: '',
    endereco: '',
    telefone: '',
    email: '',
  },
  categorias: ['Anel', 'Brinco', 'Colar', 'Pulseira', 'Tornozeleira', 'Conjunto'],
  tiposBanho: [
    { nome: 'Ouro 18k', valorGrama: 0 },
    { nome: 'Ródio', valorGrama: 0 },
    { nome: 'Ouro Rosé', valorGrama: 0 },
    { nome: 'Prata', valorGrama: 0 },
    { nome: 'Ouro Branco', valorGrama: 0 },
  ],
  alertaEstoque: {
    limiteMinimoPadrao: 5,
    alertaVisualDashboard: true,
    alertaEmail: false,
  },
  taxasPadrao: {
    lojaFisica: { imposto: 6, margem: 100 },
    shopee: { comissao: 14, taxaFixa: 4, freteGratis: true, comissaoFreteGratis: 20, imposto: 6, margem: 80 },
    mercadoLivre: { tipoAnuncio: 'Premium', comissao: 16, taxaFixa: 6, imposto: 6, margem: 80 },
    amazon: { comissao: 15, taxaItem: 0, assinaturaMensal: 19, imposto: 6, margem: 80 },
    tiktok: { comissao: 6, taxaItem: 2, comissaoAfiliado: 0, imposto: 6, margem: 80 },
  },
}

export function getConfig() {
  const saved = getJSON(KEY)
  if (!saved) return { ...DEFAULTS }
  return { ...DEFAULTS, ...saved }
}

export function saveConfig(config) {
  setJSON(KEY, config)
}

export function getCategorias() {
  return getConfig().categorias
}

export function getTiposBanho() {
  return getConfig().tiposBanho
}

export function getTaxasPadrao() {
  return getConfig().taxasPadrao
}

export function getAlertaEstoque() {
  return getConfig().alertaEstoque
}
