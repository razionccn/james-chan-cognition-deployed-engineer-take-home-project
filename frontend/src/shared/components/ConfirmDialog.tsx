import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'

/**
 * Confirmation modal for consequential actions. Optionally collects a
 * free-text reason, which is passed to `onConfirm`. `requireReason` makes the
 * reason mandatory; `collectReason` shows the field but keeps it optional.
 *
 * Keyboard: Escape cancels this dialog (not whatever is underneath it) unless `busy`; Tab cycles
 * inside the dialog; focus returns to the element that opened it.
 */
const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  requireReason = false,
  collectReason = requireReason,
  reasonLabel = 'Reason',
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  confirmVariant?: ButtonProps['variant']
  requireReason?: boolean
  collectReason?: boolean
  reasonLabel?: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    if (first && !panel?.contains(document.activeElement)) first.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        if (!busy) onCancel()
        return
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) return
        const firstItem = items[0]
        const lastItem = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault()
          firstItem.focus()
        } else if (!panel.contains(document.activeElement)) {
          e.preventDefault()
          firstItem.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      opener?.focus?.()
    }
  }, [open, busy, onCancel])
  if (!open) return null
  const reasonMissing = requireReason && reason.trim().length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={busy ? undefined : onCancel} aria-hidden />
      <div ref={panelRef} className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        {description && <div className="mt-2 text-sm text-slate-600">{description}</div>}
        {(collectReason || requireReason) && (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            {reasonLabel}
            {requireReason && <span className="text-red-600"> *</span>}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Explain the decision for the audit trail…"
            />
          </label>
        )}
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={() => onConfirm(reason.trim())} disabled={reasonMissing} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
