import { useEffect, useRef, useState } from 'react'
import type { FeatureFlagDetail } from '../api'
import { EnvironmentBadge } from './Badges'

interface Props {
  flag: FeatureFlagDetail
  nextEnabled: boolean
  submitting: boolean
  error: string | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}

const REASON_MAX = 500

export function ToggleDialog({ flag, nextEnabled, submitting, error, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  const verb = nextEnabled ? 'Enable' : 'Disable'
  const tooLong = reason.length > REASON_MAX

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={() => !submitting && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="toggle-dialog-title"
        data-testid="toggle-dialog"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="toggle-dialog-title" className="text-lg font-semibold">
          {verb} flag?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You are about to <strong>{verb.toLowerCase()}</strong>{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{flag.name}</code> ({flag.id}) in{' '}
          <EnvironmentBadge environment={flag.environment} />. This is recorded in the audit history.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="toggle-reason">
          Reason <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="toggle-reason"
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          disabled={submitting}
          placeholder="Why are you changing this flag?"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
        />
        <div className={`mt-1 text-right text-xs ${tooLong ? 'text-rose-600' : 'text-slate-400'}`}>
          {reason.length}/{REASON_MAX}
        </div>

        {error && (
          <div role="alert" data-testid="dialog-error" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-toggle"
            onClick={() => onConfirm(reason)}
            disabled={submitting || tooLong}
            className={`rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 ${
              nextEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            {submitting ? 'Saving…' : `${verb} flag`}
          </button>
        </div>
      </div>
    </div>
  )
}
