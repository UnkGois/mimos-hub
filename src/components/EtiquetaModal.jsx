import { useState, useEffect, useRef, useCallback } from 'react'
import { HiOutlineX, HiOutlinePrinter } from 'react-icons/hi'
import JsBarcode from 'jsbarcode'
import { formatarMoeda } from '../utils/calculos'

const PAPEIS = [
  { id: '33x21-3col', label: '33×21mm — 3 colunas (110mm)', largura: 110, colunas: 3, etW: 33, etH: 21 },
  { id: '33x21-2col', label: '33×21mm — 2 colunas', largura: 70, colunas: 2, etW: 33, etH: 21 },
  { id: '33x21-1col', label: '33×21mm — 1 coluna', largura: 40, colunas: 1, etW: 33, etH: 21 },
  { id: '40x25-3col', label: '40×25mm — 3 colunas', largura: 120, colunas: 3, etW: 40, etH: 25 },
  { id: '50x30-2col', label: '50×30mm — 2 colunas', largura: 100, colunas: 2, etW: 50, etH: 30 },
  { id: '50x30-1col', label: '50×30mm — 1 coluna', largura: 50, colunas: 1, etW: 50, etH: 30 },
]

const NOME_CANAL = {
  lojaFisica: 'Loja Física',
  shopee: 'Shopee',
  mercadoLivre: 'Mercado Livre',
  amazon: 'Amazon',
  tiktok: 'TikTok Shop',
}

const CANAIS_KEYS = ['lojaFisica', 'shopee', 'mercadoLivre', 'amazon', 'tiktok']

function Etiqueta({ produto, preco, etW, etH }) {
  const barcodeRef = useRef(null)
  const small = etH <= 21

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, produto.sku, {
          format: 'CODE128',
          width: small ? 0.7 : 1.2,
          height: small ? 14 : 26,
          displayValue: false,
          margin: 0,
        })
      } catch { /* sku inválido */ }
    }
  }, [produto.sku, small])

  return (
    <td
      className="etiqueta-cell"
      style={{
        width: `${etW}mm`, height: `${etH}mm`,
        border: '0.3mm dashed #bbb', textAlign: 'center',
        verticalAlign: 'middle', padding: small ? '0.5mm' : '1mm',
        overflow: 'hidden',
      }}
    >
      <div className="etiqueta-nome" style={{
        fontSize: small ? '5px' : '7px', fontWeight: 'bold',
        lineHeight: '1.2', overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {produto.nome}
      </div>
      <div className="etiqueta-preco" style={{
        fontSize: small ? '8px' : '13px', fontWeight: 900,
        margin: small ? '0.2mm 0' : '0.5mm 0',
      }}>
        {formatarMoeda(preco)}
      </div>
      <svg ref={barcodeRef} className="etiqueta-barcode" style={{ width: '90%', height: 'auto', display: 'block', margin: '0 auto' }} />
      <div className="etiqueta-sku" style={{
        fontSize: small ? '4px' : '5.5px', color: '#666', marginTop: '0.2mm',
      }}>
        {produto.sku}
      </div>
    </td>
  )
}

function EtiquetaVazia({ etW, etH }) {
  return <td style={{ width: `${etW}mm`, height: `${etH}mm`, border: '0.3mm dashed #ddd' }} />
}

export default function EtiquetaModal({ open, onClose, produtoInicial, produtosIniciais, todosProdutos = [] }) {
  const [papel, setPapel] = useState(PAPEIS[0])
  const [canalPreco, setCanalPreco] = useState('lojaFisica')
  const [linhas, setLinhas] = useState(1)
  const [slots, setSlots] = useState([null, null, null])
  const printRef = useRef(null)
  const selectCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'

  const iniciaisRef = useRef([])

  useEffect(() => {
    if (!open) return
    const iniciais = produtosIniciais || (produtoInicial ? [produtoInicial] : [])
    iniciaisRef.current = iniciais

    let novoPapel = papel
    if (iniciais.length >= 3) novoPapel = PAPEIS.find(p => p.colunas >= 3) || PAPEIS[0]
    else if (iniciais.length === 2 && papel.colunas < 2) novoPapel = PAPEIS.find(p => p.colunas >= 2) || PAPEIS[0]
    setPapel(novoPapel)

    const novosSlots = Array.from({ length: novoPapel.colunas }, (_, i) => iniciais[i]?.id || null)
    setSlots(novosSlots)
    setLinhas(1)
  }, [open])

  // Quando muda o papel manualmente, ajustar slots preservando os existentes
  const handlePapelChange = (novoPapel) => {
    setPapel(novoPapel)
    setSlots(prev => Array.from({ length: novoPapel.colunas }, (_, i) => prev[i] || null))
  }

  const getCanalByKey = (p, key) => p?.canais?.find(c => c.canal === key)
  const getProdutoById = (id) => todosProdutos.find(p => p.id === id)
  const getPreco = (produto) => getCanalByKey(produto, canalPreco)?.preco_final || 0

  const updateSlot = (index, produtoId) => {
    setSlots(prev => {
      const novo = [...prev]
      novo[index] = produtoId ? parseInt(produtoId) : null
      return novo
    })
  }

  // Gerar linhas de etiquetas
  const linhasEtiquetas = []
  for (let l = 0; l < linhas; l++) {
    const row = slots.map(id => {
      const produto = id ? getProdutoById(id) : null
      return { produto, preco: produto ? getPreco(produto) : 0 }
    })
    linhasEtiquetas.push(row)
  }

  const slotsPreenchidos = slots.filter(Boolean).length
  const totalEtiquetas = slotsPreenchidos * linhas

  const handlePrint = useCallback(() => {
    const conteudo = printRef.current
    if (!conteudo) return

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Etiquetas</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; }
@page { size: ${papel.largura}mm auto; margin: 0; }
table { border-collapse: collapse; width: ${papel.largura}mm; }
td {
  width: ${papel.etW}mm;
  height: ${papel.etH}mm;
  text-align: center;
  vertical-align: middle;
  padding: ${papel.etH <= 21 ? '0.3mm' : '1mm'};
  overflow: hidden;
  border: 0.2mm dashed #ccc;
}
.etiqueta-nome {
  font-size: ${papel.etH <= 21 ? '5px' : '7px'};
  font-weight: bold;
  line-height: 1.2;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.etiqueta-preco {
  font-size: ${papel.etH <= 21 ? '8px' : '13px'};
  font-weight: 900;
  margin: ${papel.etH <= 21 ? '0.2mm' : '0.5mm'} 0;
}
.etiqueta-barcode { width: 90%; height: auto; display: block; margin: 0 auto; }
.etiqueta-sku {
  font-size: ${papel.etH <= 21 ? '4px' : '5.5px'};
  color: #666;
  margin-top: 0.2mm;
}
</style>
</head>
<body>
${conteudo.outerHTML}
<script>window.onload = function() { window.print(); window.close(); }<\/script>
</body>
</html>`)
    win.document.close()
  }, [papel])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-0 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Imprimir Etiquetas</h3>
            <p className="text-sm text-gray-400 mt-0.5">Etiqueta {papel.etW}×{papel.etH}mm — {papel.colunas} coluna{papel.colunas > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Config */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
              <select value={papel.id} onChange={e => handlePapelChange(PAPEIS.find(p => p.id === e.target.value))} className={selectCls}>
                {PAPEIS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal de Preço</label>
              <select value={canalPreco} onChange={e => setCanalPreco(e.target.value)} className={selectCls}>
                {CANAIS_KEYS.map(key => <option key={key} value={key}>{NOME_CANAL[key]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repetir (linhas)</label>
              <input type="number" min="1" max="100" value={linhas}
                onChange={e => setLinhas(Math.max(1, parseInt(e.target.value) || 1))} className={selectCls} />
            </div>
          </div>

          {/* Slots de produtos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {papel.colunas === 1 ? 'Produto' : `Produtos na linha (${papel.colunas} por linha)`}
            </label>
            <div className={`grid gap-3 ${papel.colunas === 1 ? 'grid-cols-1' : papel.colunas === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {Array.from({ length: papel.colunas }, (_, i) => {
                const prod = slots[i] ? getProdutoById(slots[i]) : null
                return (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1.5 font-medium">
                      {papel.colunas === 1 ? 'Produto' : `Posição ${i + 1}`}
                    </p>
                    <select value={slots[i] || ''} onChange={e => updateSlot(i, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white">
                      <option value="">— Vazio —</option>
                      {todosProdutos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    {prod && <p className="text-xs text-primary font-semibold mt-1.5">{formatarMoeda(getPreco(prod))}</p>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Preview */}
          {totalEtiquetas > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview — {totalEtiquetas} etiqueta{totalEtiquetas > 1 ? 's' : ''}
              </label>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 overflow-auto max-h-64">
                <table ref={printRef} style={{ borderCollapse: 'collapse', width: `${papel.largura}mm`, margin: '0 auto' }}>
                  <tbody>
                    {linhasEtiquetas.map((row, li) => (
                      <tr key={li}>
                        {row.map((cell, ci) => (
                          cell.produto ? (
                            <Etiqueta key={`${li}-${ci}`} produto={cell.produto} preco={cell.preco} etW={papel.etW} etH={papel.etH} />
                          ) : (
                            <EtiquetaVazia key={`${li}-${ci}`} etW={papel.etW} etH={papel.etH} />
                          )
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Cada etiqueta mede <strong>{papel.etW}×{papel.etH}mm</strong>. Papel com <strong>{papel.colunas} coluna{papel.colunas > 1 ? 's' : ''}</strong>, largura total <strong>{papel.largura}mm</strong>.
          </div>

          <button onClick={handlePrint} disabled={totalEtiquetas === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primaryDark transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <HiOutlinePrinter className="w-5 h-5" />
            Imprimir {totalEtiquetas} Etiqueta{totalEtiquetas !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
