import { HiOutlineX, HiOutlineCheckCircle, HiOutlineShieldCheck, HiOutlineClipboardCheck, HiOutlinePlusCircle } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import { formatarMoeda } from '../utils/calculos'

const FORMA_LABEL = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  pix: 'PIX',
}

export default function VendaSucessoModal({ open, onClose, venda, onNovaVenda }) {
  const navigate = useNavigate()

  if (!open || !venda) return null

  const gerarGarantiaUrl = (item) => {
    const params = new URLSearchParams({
      produto_nome: item.produto_nome,
      produto_valor: item.preco_unitario,
      produto_categoria: item.produto_categoria || 'Joias',
      loja: 'MDA - Mimos de Alice Joias - Loja Física',
      data_compra: new Date().toISOString().split('T')[0],
    })
    if (venda.cliente_nome) params.set('nome', venda.cliente_nome)
    return `/garantias/nova?${params.toString()}`
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-0 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <HiOutlineCheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Venda Concluída!</h3>
              <p className="text-sm text-gray-400">{venda.codigo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Resumo */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatarMoeda(venda.subtotal)}</span>
            </div>
            {parseFloat(venda.desconto_cupom) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Cupom ({venda.cupom_codigo})</span>
                <span>-{formatarMoeda(venda.desconto_cupom)}</span>
              </div>
            )}
            {parseFloat(venda.desconto_manual) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Desconto manual</span>
                <span>-{formatarMoeda(venda.desconto_manual)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatarMoeda(venda.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Pagamento</span>
              <span>{FORMA_LABEL[venda.forma_pagamento] || venda.forma_pagamento}</span>
            </div>
            {parseFloat(venda.troco) > 0 && (
              <div className="flex justify-between text-sm text-amber-600 font-semibold">
                <span>Troco</span>
                <span>{formatarMoeda(venda.troco)}</span>
              </div>
            )}
          </div>

          {/* Itens — Gerar garantia */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Gerar documentos por item:</p>
            <div className="space-y-2">
              {venda.itens.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.produto_nome}</p>
                    <p className="text-xs text-gray-400">{item.quantidade}x {formatarMoeda(item.preco_unitario)}</p>
                  </div>
                  <button
                    onClick={() => navigate(gerarGarantiaUrl(item))}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primaryDark bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <HiOutlineShieldCheck className="w-4 h-4" />
                    Garantia
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={() => { onClose(); onNovaVenda?.() }}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primaryDark transition-colors cursor-pointer"
            >
              <HiOutlinePlusCircle className="w-5 h-5" />
              Nova Venda
            </button>
            <button
              onClick={() => navigate('/vendas')}
              className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
