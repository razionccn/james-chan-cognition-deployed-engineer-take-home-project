import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  kind: 'success' | 'error'
  text: string
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onDismiss, 5000)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        data-testid="toast"
        className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ${
          toast.kind === 'success'
            ? 'bg-emerald-600 text-white ring-emerald-700'
            : 'bg-rose-600 text-white ring-rose-700'
        }`}
      >
        <span>{toast.text}</span>
        <button type="button" onClick={onDismiss} className="rounded px-1 text-white/80 hover:text-white" aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  )
}
