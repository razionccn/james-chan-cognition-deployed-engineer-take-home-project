import { useEffect } from 'react'
import type { FeatureFlagDetail, Persona } from '../api'
import { formatDateTime } from '../format'
import { EnvironmentBadge, StateBadge } from './Badges'

interface Props {
  flagId: string
  flag: FeatureFlagDetail | null
  loading: boolean
  error: string | null
  persona: Persona
  canToggleRole: boolean
  onClose: () => void
  onRetry: () => void
  onRequestToggle: (nextEnabled: boolean) => void
}

export function FlagDetailPanel({ flagId, flag, loading, error, persona, canToggleRole, onClose, onRetry, onRequestToggle }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canToggle = !!flag && flag.editable && canToggleRole

  return (
    <aside
      data-testid="flag-detail-panel"
      aria-label="Flag detail"
      className="fixed bottom-0 right-0 top-16 z-30 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div className="min-w-0">
          {flag ? (
            <>
              <h2 className="truncate text-lg font-semibold text-slate-900">{flag.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{flag.id}</span>
                <EnvironmentBadge environment={flag.environment} />
                <StateBadge enabled={flag.enabled} />
              </div>
            </>
          ) : (
            <h2 className="text-lg font-semibold text-slate-900">
              Flag <span className="font-mono text-base text-slate-500">{flagId}</span>
            </h2>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && !flag && (
          <p data-testid="detail-loading" className="text-sm text-slate-500">
            Loading flag…
          </p>
        )}
        {error && !flag && (
          <div data-testid="detail-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
            <p className="font-medium">Could not load this flag</p>
            <p className="mt-1">{error}</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm hover:bg-rose-50">
              Retry
            </button>
          </div>
        )}

        {flag && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</dt>
                <dd className="mt-1 text-sm text-slate-800">{flag.description}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Environment</dt>
                <dd className="mt-1">
                  <EnvironmentBadge environment={flag.environment} />
                  {!flag.editable && <span className="ml-2 text-xs text-slate-500">locked</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">State</dt>
                <dd className="mt-1">
                  <StateBadge enabled={flag.enabled} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last updated</dt>
                <dd className="mt-1 text-sm text-slate-800" title={flag.updated_at}>
                  {formatDateTime(flag.updated_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated by</dt>
                <dd className="mt-1 text-sm text-slate-800">{flag.updated_by}</dd>
              </div>
            </dl>

            <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Flag state</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Acting as <strong>{persona.name}</strong> ({persona.role})
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.enabled}
                  aria-label={flag.enabled ? 'Disable flag' : 'Enable flag'}
                  data-testid="toggle-switch"
                  disabled={!canToggle}
                  onClick={() => canToggle && onRequestToggle(!flag.enabled)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    flag.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  } ${canToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {!flag.editable && (
                <p data-testid="locked-notice" className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <span aria-hidden="true">🔒</span>
                  <span>
                    <strong>Locked.</strong> Flags in <code>production</code> cannot be modified through this panel; changes go through the release process.
                  </span>
                </p>
              )}
              {flag.editable && !canToggleRole && (
                <p data-testid="readonly-notice" className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <strong>Read-only.</strong> Your persona has the <code>{persona.role}</code> role; only <code>reviewer</code> personas can toggle flags.
                </p>
              )}
              {canToggle && (
                <p className="mt-3 text-xs text-slate-500">
                  Switching asks for confirmation and an optional reason before calling the API.
                </p>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">Audit history</h3>
              {flag.audit_events.length === 0 ? (
                <p data-testid="audit-empty" className="mt-2 text-sm text-slate-500">
                  No changes recorded yet.
                </p>
              ) : (
                <ol data-testid="audit-list" className="mt-3 space-y-3">
                  {flag.audit_events.map((ev) => (
                    <li key={ev.id} data-testid="audit-item" className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <StateBadge enabled={ev.previous_enabled} />
                          <span aria-hidden="true" className="text-slate-400">
                            →
                          </span>
                          <StateBadge enabled={ev.new_enabled} />
                        </span>
                        <time dateTime={ev.created_at} title={ev.created_at} className="text-xs text-slate-500">
                          {formatDateTime(ev.created_at)}
                        </time>
                      </div>
                      <p className="mt-2 text-slate-700">
                        <span className="font-medium">{ev.actor_name}</span>{' '}
                        <span className="font-mono text-xs text-slate-500">({ev.actor_id})</span> {ev.action}d this flag
                      </p>
                      <p className={`mt-1 text-xs ${ev.reason ? 'text-slate-600' : 'italic text-slate-400'}`}>
                        {ev.reason ? `Reason: ${ev.reason}` : 'No reason given'}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  )
}
