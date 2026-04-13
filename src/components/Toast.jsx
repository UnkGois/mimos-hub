import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineX } from 'react-icons/hi'

const ToastContext = createContext(null)

const TOAST_DURATION = 4000

const toastStyles = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-500',
    text: 'text-emerald-800',
    Icon: HiOutlineCheckCircle,
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
    Icon: HiOutlineExclamationCircle,
  },
}

const ToastItem = ({ toast, onRemove }) => {
  const style = toastStyles[toast.type] || toastStyles.success
  const { Icon } = style

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg ${style.bg} animate-[slide-in_0.3s_ease-out] min-w-[300px] max-w-md`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${style.icon}`} />
      <p className={`text-sm font-medium flex-1 ${style.text}`}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
      >
        <HiOutlineX className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  )
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Container de toasts — canto superior direito */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider')
  }
  return context
}

export default ToastContext
