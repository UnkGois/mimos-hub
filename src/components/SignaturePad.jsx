import { useRef, useEffect, useState, useCallback } from 'react'

const SignaturePad = ({ onConfirm, onClear, label = '', disabled = false }) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [mode, setMode] = useState('draw') // draw | type
  const [typedName, setTypedName] = useState('')
  const lastPoint = useRef(null)
  const dpr = useRef(window.devicePixelRatio || 1)

  // Inicializar canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = 180

    canvas.width = w * dpr.current
    canvas.height = h * dpr.current
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr.current, dpr.current)

    // Fundo branco
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    // Linha pontilhada de assinatura
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#D1D5DB'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, h * 0.72)
    ctx.lineTo(w - 20, h * 0.72)
    ctx.stroke()
    ctx.setLineDash([])

    // Texto "Assine aqui" centralizado
    ctx.fillStyle = '#D1D5DB'
    ctx.font = '12px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Assine aqui', w / 2, h * 0.72 + 16)
    ctx.textAlign = 'start'
  }, [])

  // Renderizar nome digitado no canvas
  const renderTypedName = useCallback((name) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = 180

    canvas.width = w * dpr.current
    canvas.height = h * dpr.current
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr.current, dpr.current)

    // Fundo branco
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    // Linha pontilhada
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#D1D5DB'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, h * 0.72)
    ctx.lineTo(w - 20, h * 0.72)
    ctx.stroke()
    ctx.setLineDash([])

    if (name.trim()) {
      // Desenhar nome em cursiva
      const fontSize = Math.min(36, (w - 40) / (name.length * 0.45))
      ctx.fillStyle = '#333333'
      ctx.font = `${fontSize}px 'Dancing Script', cursive`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(name, w / 2, h * 0.68)
      ctx.textAlign = 'start'
      ctx.textBaseline = 'alphabetic'
    }
  }, [])

  useEffect(() => {
    if (mode === 'draw') {
      initCanvas()
    }
    const handleResize = () => {
      if (mode === 'draw' && !hasContent) initCanvas()
      if (mode === 'type') renderTypedName(typedName)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [initCanvas, hasContent, mode, renderTypedName, typedName])

  const getPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const startDraw = (e) => {
    if (disabled || mode !== 'draw') return
    e.preventDefault()
    setIsDrawing(true)
    const point = getPoint(e)
    lastPoint.current = point

    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (e) => {
    if (!isDrawing || disabled || mode !== 'draw') return
    e.preventDefault()
    const point = getPoint(e)
    const ctx = canvasRef.current.getContext('2d')

    if (lastPoint.current) {
      const midX = (lastPoint.current.x + point.x) / 2
      const midY = (lastPoint.current.y + point.y) / 2
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(midX, midY)
    }

    lastPoint.current = point
    if (!hasContent) setHasContent(true)
  }

  const endDraw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    setIsDrawing(false)
    lastPoint.current = null
  }

  const handleClear = () => {
    setHasContent(false)
    setTypedName('')
    lastPoint.current = null
    initCanvas()
    onClear?.()
  }

  const handleModeSwitch = (newMode) => {
    setMode(newMode)
    setHasContent(false)
    setTypedName('')
    lastPoint.current = null
    if (newMode === 'draw') {
      setTimeout(() => initCanvas(), 10)
    } else {
      setTimeout(() => renderTypedName(''), 10)
    }
  }

  const handleTypedNameChange = (e) => {
    const name = e.target.value
    setTypedName(name)
    setHasContent(name.trim().length > 0)
    renderTypedName(name)
  }

  const handleConfirm = () => {
    if (!hasContent) return
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    // Remove o prefixo data:image/png;base64,
    const base64 = dataUrl.split(',')[1]
    onConfirm?.(base64)
  }

  const canConfirm = mode === 'draw' ? hasContent : typedName.trim().length > 0

  return (
    <div className="w-full">
      {/* Toggle desenhar / digitar */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => handleModeSwitch('draw')}
          className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all cursor-pointer ${
            mode === 'draw'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Desenhar
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('type')}
          className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all cursor-pointer ${
            mode === 'type'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Digitar Nome
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-white"
      >
        <canvas
          ref={canvasRef}
          className={`w-full ${mode === 'draw' ? 'touch-none cursor-crosshair' : 'pointer-events-none'}`}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {/* Input para nome digitado */}
      {mode === 'type' && (
        <div className="mt-3">
          <input
            type="text"
            value={typedName}
            onChange={handleTypedNameChange}
            placeholder="Digite seu nome completo"
            disabled={disabled}
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
          />
          {typedName.trim() && (
            <p className="text-center text-xs text-gray-400 mt-1.5">
              Preview da assinatura acima
            </p>
          )}
        </div>
      )}

      {label && (
        <p className="text-center text-sm font-medium text-primary mt-2">{label}</p>
      )}

      <div className="flex gap-3 mt-3">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 bg-gray-100 text-gray-500 px-5 py-2.5 rounded-2xl hover:bg-gray-200 text-sm font-medium transition-all cursor-pointer"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || disabled}
          className="flex-1 bg-accent text-white px-6 py-2.5 rounded-2xl shadow-md shadow-accent/20 hover:shadow-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar Assinatura
        </button>
      </div>
    </div>
  )
}

export default SignaturePad
