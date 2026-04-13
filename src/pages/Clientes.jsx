import { useState, useEffect } from 'react'
import { HiOutlineSearch, HiOutlineUserAdd, HiOutlineX, HiOutlinePencil, HiOutlineCheckCircle } from 'react-icons/hi'
import { listar, criar, atualizar } from '../services/clienteService'
import { useToast } from '../components/Toast'
import { maskCPF, maskPhone, maskCEP, removeMask } from '../utils/masks'
import { isValidCPF, isValidEmail } from '../utils/validators'
import DrawerPanel from '../components/DrawerPanel'
import WhatsAppVerify, { WhatsAppIcon } from '../components/WhatsAppVerify'

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

export default function Clientes() {
  const toast = useToast()
  const [clientes, setClientes] = useState([])
  const [total, setTotal] = useState(0)
  const [busca, setBusca] = useState('')
  const [skip, setSkip] = useState(0)
  const limit = 20

  const [selecionado, setSelecionado] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    cpf: '', nome: '', telefone: '', email: '',
    data_nascimento: '', cep: '', endereco: '', numero: '',
    complemento: '', bairro: '', cidade: '', uf: '',
  })
  const [erros, setErros] = useState({})

  const carregar = async () => {
    try {
      const params = { skip, limit }
      if (busca) params.nome = busca
      const data = await listar(params)
      setClientes(data.items || [])
      setTotal(data.total || 0)
    } catch { /* silencioso */ }
  }

  useEffect(() => { carregar() }, [busca, skip])

  const resetForm = () => {
    setForm({ cpf: '', nome: '', telefone: '', email: '', data_nascimento: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' })
    setErros({})
    setEditando(null)
  }

  const abrirNovo = () => {
    resetForm()
    setModalAberto(true)
  }

  const abrirEditar = (cliente) => {
    setEditando(cliente)
    setForm({
      cpf: maskCPF(cliente.cpf || ''),
      nome: cliente.nome || '',
      telefone: maskPhone(cliente.telefone || ''),
      email: cliente.email || '',
      data_nascimento: cliente.data_nascimento || '',
      cep: maskCEP(cliente.cep || ''),
      endereco: cliente.endereco || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      cidade: cliente.cidade || '',
      uf: cliente.uf || '',
    })
    setErros({})
    setModalAberto(true)
    setSelecionado(null)
  }

  const validar = () => {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (!removeMask(form.cpf)) e.cpf = 'CPF obrigatório'
    else if (!isValidCPF(form.cpf)) e.cpf = 'CPF inválido'
    if (!removeMask(form.telefone)) e.telefone = 'Telefone obrigatório'
    if (form.email && !isValidEmail(form.email)) e.email = 'Email inválido'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const handleSalvar = async () => {
    if (!validar()) return
    setSalvando(true)
    try {
      const dados = {
        cpf: removeMask(form.cpf),
        nome: form.nome.trim(),
        telefone: removeMask(form.telefone),
        email: form.email || null,
        data_nascimento: form.data_nascimento || null,
        cep: removeMask(form.cep) || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
      }
      if (editando) {
        await atualizar(editando.id, dados)
        toast.success('Cliente atualizado!')
      } else {
        await criar(dados)
        toast.success('Cliente cadastrado!')
      }
      setModalAberto(false)
      resetForm()
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar cliente')
    } finally { setSalvando(false) }
  }

  // Buscar CEP
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

  const formatCPF = (cpf) => {
    if (!cpf) return ''
    const c = cpf.replace(/\D/g, '')
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatPhone = (tel) => {
    if (!tel) return ''
    const t = tel.replace(/\D/g, '')
    if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    return t.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
        <button onClick={abrirNovo} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors shadow-sm cursor-pointer">
          <HiOutlineUserAdd className="w-5 h-5" /> Novo Cliente
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Buscar por nome..." value={busca}
            onChange={e => { setBusca(e.target.value); setSkip(0) }}
            className={`pl-10 ${inputCls}`} />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {clientes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Nome</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">CPF</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Telefone</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Email</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Compras</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Cidade</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.id} onClick={() => setSelecionado(c)} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-800">{c.nome}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">{formatCPF(c.cpf)}</td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        {c.whatsapp_verificado ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600" title="WhatsApp verificado">
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <WhatsAppIcon className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        {formatPhone(c.telefone)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{c.email || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.total_compras >= 3 ? 'bg-emerald-100 text-emerald-700' :
                        c.total_compras >= 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>{c.total_compras}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{c.cidade ? `${c.cidade}/${c.uf}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <HiOutlineUserAdd className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* Paginação */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Anterior</button>
          <span className="px-4 py-2 text-sm text-gray-500">{Math.floor(skip / limit) + 1} de {Math.ceil(total / limit)}</span>
          <button onClick={() => setSkip(skip + limit)} disabled={skip + limit >= total}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Próxima</button>
        </div>
      )}

      {/* Drawer detalhes */}
      <DrawerPanel open={!!selecionado} onClose={() => setSelecionado(null)} title={selecionado?.nome || ''}>
        {selecionado && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400">CPF</p><p className="text-sm font-mono">{formatCPF(selecionado.cpf)}</p></div>
              <div>
                <p className="text-xs text-gray-400">Telefone</p>
                <p className="text-sm flex items-center gap-1.5"><WhatsAppIcon className="w-3.5 h-3.5 text-green-500" />{formatPhone(selecionado.telefone)}</p>
              </div>
              <div><p className="text-xs text-gray-400">Email</p><p className="text-sm">{selecionado.email || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Nascimento</p><p className="text-sm">{selecionado.data_nascimento ? new Date(selecionado.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p></div>
              <div><p className="text-xs text-gray-400">Compras</p><p className="text-sm font-semibold">{selecionado.total_compras}</p></div>
              <div><p className="text-xs text-gray-400">Desde</p><p className="text-sm">{new Date(selecionado.criado_em).toLocaleDateString('pt-BR')}</p></div>
            </div>

            {(selecionado.endereco || selecionado.cidade) && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Endereço</p>
                <p className="text-sm text-gray-600">
                  {[selecionado.endereco, selecionado.numero, selecionado.complemento].filter(Boolean).join(', ')}
                  {selecionado.bairro && ` — ${selecionado.bairro}`}
                </p>
                <p className="text-sm text-gray-600">{[selecionado.cidade, selecionado.uf].filter(Boolean).join('/')} {selecionado.cep && `— CEP ${maskCEP(selecionado.cep)}`}</p>
              </div>
            )}

            {/* Verificar WhatsApp */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2">Verificar WhatsApp</p>
              <WhatsAppVerify
                telefone={selecionado.telefone}
                clienteId={selecionado.id}
                verificado={selecionado.whatsapp_verificado}
                onVerified={() => { setSelecionado(prev => ({ ...prev, whatsapp_verificado: true })); carregar() }}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => abrirEditar(selecionado)}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-colors text-sm cursor-pointer flex items-center justify-center gap-1.5">
                <HiOutlinePencil className="w-4 h-4" /> Editar
              </button>
            </div>
          </div>
        )}
      </DrawerPanel>

      {/* Modal Cadastro/Edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{editando ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                <p className="text-sm text-gray-400 mt-0.5">Preencha os dados do cliente</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Dados pessoais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>CPF *</label>
                  <input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: maskCPF(e.target.value) }))}
                    placeholder="000.000.000-00" className={`${inputCls} ${erros.cpf ? 'border-red-300' : ''}`} />
                  {erros.cpf && <p className="text-red-500 text-xs mt-1">{erros.cpf}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Nome Completo *</label>
                  <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome do cliente" className={`${inputCls} ${erros.nome ? 'border-red-300' : ''}`} />
                  {erros.nome && <p className="text-red-500 text-xs mt-1">{erros.nome}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Telefone *</label>
                  <div className="flex gap-2 items-center">
                    <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: maskPhone(e.target.value) }))}
                      placeholder="(00) 00000-0000" className={`flex-1 ${inputCls} ${erros.telefone ? 'border-red-300' : ''}`} />
                    <WhatsAppVerify
                      telefone={form.telefone}
                      clienteId={editando?.id}
                      verificado={editando?.whatsapp_verificado}
                    />
                  </div>
                  {erros.telefone && <p className="text-red-500 text-xs mt-1">{erros.telefone}</p>}
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@exemplo.com" className={`${inputCls} ${erros.email ? 'border-red-300' : ''}`} />
                  {erros.email && <p className="text-red-500 text-xs mt-1">{erros.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Data de Nascimento</label>
                  <input type="date" value={form.data_nascimento} onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              {/* Endereço */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">Endereço</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>CEP</label>
                    <input value={form.cep} onChange={e => { const v = maskCEP(e.target.value); setForm(p => ({ ...p, cep: v })); handleCep(v) }}
                      placeholder="00000-000" className={inputCls} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Endereço</label>
                    <input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))}
                      placeholder="Rua, Avenida..." className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Número</label>
                    <input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))}
                      placeholder="Nº" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <label className={labelCls}>Complemento</label>
                    <input value={form.complemento} onChange={e => setForm(p => ({ ...p, complemento: e.target.value }))}
                      placeholder="Apto, Sala..." className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Bairro</label>
                    <input value={form.bairro} onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Cidade</label>
                    <input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>UF</label>
                    <input value={form.uf} onChange={e => setForm(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                      placeholder="SP" maxLength={2} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleSalvar} disabled={salvando}
                  className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primaryDark transition-all cursor-pointer disabled:opacity-50">
                  {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
