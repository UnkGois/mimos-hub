import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { HiOutlineCheckCircle, HiOutlineTruck, HiOutlineShoppingBag } from 'react-icons/hi'
import { formatarMoeda } from '../utils/calculos'
import { maskCPF, maskPhone, maskCEP, removeMask } from '../utils/masks'
import axios from 'axios'
import LogoRosa from '../assets/RosaMDA.svg'

const apiPublic = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`,
  timeout: 15000,
})

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-300 focus:border-pink-400 outline-none'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

export default function Checkout() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  // IDs selecionados para pagar
  const [selecionados, setSelecionados] = useState(new Set())

  const [form, setForm] = useState({
    nome: '', cpf: '', telefone: '',
    cep: '', endereco: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '', observacao: '',
    forma_pagamento: 'pix',
    cartao_nome: '', cartao_numero: '', cartao_validade: '', cartao_cvv: '',
    cartao_parcelas: '1',
  })

  const maskCartao = (v) => v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19)
  const maskValidade = (v) => {
    const n = v.replace(/\D/g, '').slice(0, 4)
    if (n.length >= 3) return `${n.slice(0, 2)}/${n.slice(2)}`
    return n
  }

  useEffect(() => {
    const carregar = async () => {
      try {
        const { data } = await apiPublic.get(`/reservas/checkout/${token}`)
        setDados(data)
        // Selecionar todos por padrão
        setSelecionados(new Set(data.itens.map(i => i.id)))
        setForm(prev => ({
          ...prev,
          nome: data.cliente_nome || '',
          telefone: data.cliente_telefone ? maskPhone(data.cliente_telefone) : '',
          cpf: data.cliente_cpf ? maskCPF(data.cliente_cpf) : '',
          cep: data.cliente_cep ? maskCEP(data.cliente_cep) : '',
          endereco: data.cliente_endereco || '',
          numero: data.cliente_numero || '',
          complemento: data.cliente_complemento || '',
          bairro: data.cliente_bairro || '',
          cidade: data.cliente_cidade || '',
          uf: data.cliente_uf || '',
        }))
      } catch (err) {
        if (err.response?.status === 404) setErro('Checkout não encontrado ou já finalizado.')
        else setErro('Erro ao carregar checkout.')
      } finally { setLoading(false) }
    }
    carregar()
  }, [token])

  const toggleItem = (id) => {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const totalSelecionado = dados
    ? dados.itens.filter(i => selecionados.has(i.id)).reduce((s, i) => s + parseFloat(i.total), 0)
    : 0

  const precisaEndereco = dados?.tipo_entrega === 'entrega'

  const handleCep = async (cep) => {
    const limpo = removeMask(cep)
    if (limpo.length !== 8) return
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await resp.json()
      if (!data.erro) {
        setForm(prev => ({ ...prev, endereco: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', uf: data.uf || '' }))
      }
    } catch { /* silencioso */ }
  }

  const handleSubmit = async () => {
    if (selecionados.size === 0) { setErroForm('Selecione pelo menos um produto'); return }
    if (!form.nome.trim()) { setErroForm('Informe seu nome completo'); return }
    if (removeMask(form.telefone).length < 10) { setErroForm('Informe seu telefone'); return }
    if (precisaEndereco) {
      if (removeMask(form.cep).length < 8) { setErroForm('Informe o CEP'); return }
      if (!form.endereco.trim()) { setErroForm('Informe o endereço'); return }
      if (!form.numero.trim()) { setErroForm('Informe o número'); return }
    }
    if (form.forma_pagamento === 'cartao_credito') {
      if (!form.cartao_nome.trim()) { setErroForm('Informe o nome no cartão'); return }
      if (form.cartao_numero.replace(/\s/g, '').length < 16) { setErroForm('Número do cartão inválido'); return }
      if (form.cartao_validade.length < 5) { setErroForm('Validade do cartão inválida'); return }
      if (form.cartao_cvv.length < 3) { setErroForm('CVV inválido'); return }
    }

    setErroForm('')
    setEnviando(true)
    try {
      await apiPublic.post(`/reservas/checkout/${token}`, {
        reserva_ids: [...selecionados],
        nome: form.nome.trim(),
        cpf: removeMask(form.cpf),
        telefone: removeMask(form.telefone),
        cep: precisaEndereco ? removeMask(form.cep) : null,
        endereco: precisaEndereco ? form.endereco.trim() : null,
        numero: precisaEndereco ? form.numero.trim() : null,
        complemento: form.complemento.trim() || null,
        bairro: precisaEndereco ? form.bairro.trim() : null,
        cidade: precisaEndereco ? form.cidade.trim() : null,
        uf: precisaEndereco ? form.uf.trim() : null,
        observacao: form.observacao.trim() || null,
        forma_pagamento: form.forma_pagamento,
        cartao_nome: form.cartao_nome || null,
        cartao_numero: form.cartao_numero ? `****${form.cartao_numero.replace(/\s/g, '').slice(-4)}` : null,
        cartao_parcelas: form.forma_pagamento === 'cartao_credito' ? parseInt(form.cartao_parcelas) : null,
        cancelar_restante: true,
      })
      setSucesso(true)
    } catch (err) {
      setErroForm(err.response?.data?.detail || 'Erro ao finalizar checkout')
    } finally { setEnviando(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-pink-500 border-t-transparent" />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-8 text-center">
          <img src={LogoRosa} alt="MDA" className="h-12 mx-auto mb-4" />
          <p className="text-red-500 font-semibold">{erro}</p>
        </div>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-8 text-center">
          <img src={LogoRosa} alt="MDA" className="h-12 mx-auto mb-4" />
          <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
            <HiOutlineCheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Checkout Concluído!</h2>
          <p className="text-gray-500 text-sm mb-4">
            {form.forma_pagamento === 'pix'
              ? 'Enviamos os dados do PIX no seu WhatsApp. Após o pagamento, envie o comprovante na conversa.'
              : `Pagamento no cartão ${form.cartao_numero || ''} em ${form.cartao_parcelas}x será processado. Enviamos a confirmação no seu WhatsApp.`}
          </p>
          <p className="text-lg font-bold text-pink-600">{formatarMoeda(totalSelecionado)}</p>
          <p className="text-xs text-gray-400 mt-1">{selecionados.size} produto{selecionados.size > 1 ? 's' : ''}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <img src={LogoRosa} alt="MDA - Mimos de Alice" className="h-14 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-800">Finalizar Compra</h1>
          <p className="text-sm text-gray-400">Selecione os produtos e preencha seus dados</p>
        </div>

        {/* Lista de produtos — selecionáveis */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <HiOutlineShoppingBag className="w-4 h-4 text-pink-500" />
            {dados.itens.length > 1 ? `Seus Produtos (${dados.itens.length})` : 'Seu Produto'}
          </h3>
          {dados.itens.length > 1 && (
            <p className="text-xs text-gray-400 mb-3">Selecione os produtos que deseja pagar agora. Os não selecionados ficarão reservados por tempo limitado.</p>
          )}
          <div className="space-y-2">
            {dados.itens.map(item => {
              const selected = selecionados.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                    selected ? 'border-pink-400 bg-pink-50/50' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-pink-500 bg-pink-500' : 'border-gray-300'
                  }`}>
                    {selected && <HiOutlineCheckCircle className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.produto_nome}</p>
                    <p className="text-xs text-gray-400">{item.codigo} · {item.quantidade}x</p>
                  </div>
                  <p className="text-sm font-bold text-pink-600 flex-shrink-0">{formatarMoeda(item.total)}</p>
                </button>
              )
            })}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
            <span className="text-lg font-black text-pink-600">{formatarMoeda(totalSelecionado)}</span>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Dados Pessoais</h3>
          <div>
            <label className={labelCls}>Nome Completo *</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>CPF</label>
              <input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp *</label>
              <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" className={inputCls} />
            </div>
          </div>

          {/* Endereço — só se entrega */}
          {precisaEndereco && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 pt-2 flex items-center gap-2">
                <HiOutlineTruck className="w-4 h-4" /> Endereço de Entrega
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>CEP *</label>
                  <input value={form.cep} onChange={e => { const v = maskCEP(e.target.value); setForm(p => ({ ...p, cep: v })); handleCep(v) }}
                    placeholder="00000-000" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Endereço *</label>
                  <input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Número *</label>
                  <input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Complemento</label>
                  <input value={form.complemento} onChange={e => setForm(p => ({ ...p, complemento: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Bairro *</label>
                  <input value={form.bairro} onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Cidade *</label>
                  <input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>UF *</label>
                  <input value={form.uf} onChange={e => setForm(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observação</label>
                <textarea value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} rows={2} placeholder="Ex: Portaria 24h..." className={inputCls} />
              </div>
            </>
          )}

          {/* Aviso dos não selecionados */}
          {dados.itens.length > 1 && selecionados.size < dados.itens.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Os {dados.itens.length - selecionados.size} produto{dados.itens.length - selecionados.size > 1 ? 's' : ''} não selecionado{dados.itens.length - selecionados.size > 1 ? 's' : ''} será{dados.itens.length - selecionados.size > 1 ? 'ão' : ''} cancelado{dados.itens.length - selecionados.size > 1 ? 's' : ''} automaticamente.
            </div>
          )}

          {/* Pagamento */}
          <h3 className="text-sm font-semibold text-gray-700 pt-2">Forma de Pagamento</h3>
          <div className="grid grid-cols-2 gap-3">
            {[{ key: 'pix', label: 'PIX' }, { key: 'cartao_credito', label: 'Cartão de Crédito' }].map(f => (
              <button key={f.key} onClick={() => setForm(p => ({ ...p, forma_pagamento: f.key }))}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border-2 ${
                  form.forma_pagamento === f.key ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600'
                }`}>{f.label}</button>
            ))}
          </div>

          {/* Campos do cartão */}
          {form.forma_pagamento === 'cartao_credito' && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div>
                <label className={labelCls}>Nome no Cartão *</label>
                <input value={form.cartao_nome} onChange={e => setForm(p => ({ ...p, cartao_nome: e.target.value.toUpperCase() }))}
                  placeholder="Como está no cartão" className={`${inputCls} uppercase`} />
              </div>
              <div>
                <label className={labelCls}>Número do Cartão *</label>
                <input value={form.cartao_numero} onChange={e => setForm(p => ({ ...p, cartao_numero: maskCartao(e.target.value) }))}
                  placeholder="0000 0000 0000 0000" maxLength={19} className={inputCls} inputMode="numeric" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Validade *</label>
                  <input value={form.cartao_validade} onChange={e => setForm(p => ({ ...p, cartao_validade: maskValidade(e.target.value) }))}
                    placeholder="MM/AA" maxLength={5} className={inputCls} inputMode="numeric" />
                </div>
                <div>
                  <label className={labelCls}>CVV *</label>
                  <input value={form.cartao_cvv} onChange={e => setForm(p => ({ ...p, cartao_cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="000" maxLength={4} className={inputCls} inputMode="numeric" type="password" />
                </div>
                <div>
                  <label className={labelCls}>Parcelas</label>
                  <select value={form.cartao_parcelas} onChange={e => setForm(p => ({ ...p, cartao_parcelas: e.target.value }))} className={inputCls}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? 'à vista' : `de ${formatarMoeda(totalSelecionado / n)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {form.forma_pagamento === 'pix' && (
            <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700">
              Ao finalizar, enviaremos os dados do PIX no seu WhatsApp para pagamento.
            </div>
          )}

          {erroForm && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{erroForm}</div>
          )}

          <button onClick={handleSubmit} disabled={enviando || selecionados.size === 0}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-pink-500/30 transition-all cursor-pointer disabled:opacity-50">
            {enviando ? 'Finalizando...' : `Finalizar — ${formatarMoeda(totalSelecionado)}`}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">MDA - Mimos de Alice Joias &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
