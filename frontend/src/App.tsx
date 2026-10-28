import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getFlag, getMeta, listFlags, toggleFlag, PERSONAS } from './api'
import type { FeatureFlag, FeatureFlagDetail, Meta, Persona } from './api'
import { FlagDetailPanel } from './components/FlagDetailPanel'
import { FlagsTable } from './components/FlagsTable'
import { Toast, type ToastMessage } from './components/Toast'
import { ToggleDialog } from './components/ToggleDialog'
import { useUrlState } from './urlState'

const PERSONA_KEY = 'feature_flags.persona'

function loadPersona(): Persona {
  const saved = window.localStorage.getItem(PERSONA_KEY)
  return PERSONAS.find((p) => p.id === saved) ?? PERSONAS[0]
}

export default function App() {
  const [url, setUrl] = useUrlState()
  const [persona, setPersona] = useState<Persona>(loadPersona)
  const [meta, setMeta] = useState<Meta | null>(null)

  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listVersion, setListVersion] = useState(0)

  const [detail, setDetail] = useState<FeatureFlagDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)

  const [dialogNext, setDialogNext] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const [searchDraft, setSearchDraft] = useState(url.filters.q ?? '')
  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    window.localStorage.setItem(PERSONA_KEY, persona.id)
  }, [persona])

  useEffect(() => {
    getMeta(persona.id)
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [persona.id])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    listFlags(url.filters, persona.id)
      .then((r) => {
        if (cancelled) return
        setFlags(r.items)
      })
      .catch((e: ApiError) => {
        if (cancelled) return
        setListError(e.message)
      })
      .finally(() => !cancelled && setListLoading(false))
    return () => {
      cancelled = true
    }
  }, [url.filters.q, url.filters.environment, url.filters.enabled, persona.id, listVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!url.flag) {
      setDetail(null)
      setDetailError(null)
      return
    }
    let cancelled = false
    const flagId = url.flag
    setDetailLoading(true)
    setDetailError(null)
    setDetail((prev) => (prev && prev.id === flagId ? prev : null))
    getFlag(flagId, persona.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: ApiError) => !cancelled && setDetailError(e.message))
      .finally(() => !cancelled && setDetailLoading(false))
    return () => {
      cancelled = true
    }
  }, [url.flag, persona.id, detailVersion])

  const onSearchChange = (value: string) => {
    setSearchDraft(value)
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setUrl({ filters: { q: value } }, { replace: true }), 250)
  }

  const closePanel = useCallback(() => {
    setDialogNext(null)
    setUrl({ flag: null })
  }, [setUrl])

  const canToggleRole = useMemo(
    () => (meta ? meta.roles_that_can_toggle.includes(persona.role) : persona.role === 'reviewer'),
    [meta, persona.role],
  )

  const confirmToggle = async (reason: string) => {
    if (!detail || dialogNext === null) return
    setSubmitting(true)
    setDialogError(null)
    try {
      const updated = await toggleFlag(detail.id, dialogNext, reason, persona.id)
      setDetail(updated)
      setFlags((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)))
      setDialogNext(null)
      setToast({
        id: Date.now(),
        kind: 'success',
        text: `${updated.name} (${updated.environment}) is now ${updated.enabled ? 'enabled' : 'disabled'}.`,
      })
    } catch (e) {
      const err = e as ApiError
      setDialogError(err.message)
      if (err.status === 409 || err.status === 404) setDetailVersion((v) => v + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const environments = meta?.environments.map((e) => e.id) ?? ['development', 'staging', 'production']
  const hasFilters = !!(url.filters.q || url.filters.environment || url.filters.enabled)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Fintech Operations Console</p>
            <h1 className="text-xl font-semibold text-slate-900">Feature-Flag Admin Panel</h1>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Persona</span>
            <select
              data-testid="persona-select"
              value={persona.id}
              onChange={(e) => setPersona(PERSONAS.find((p) => p.id === e.target.value) ?? PERSONAS[0])}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {PERSONAS.map((p) => (
                <option key={p.id || 'none'} value={p.id}>
                  {p.name} — {p.role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input
              type="search"
              data-testid="search-input"
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Flag name or id, e.g. checkout or FF-2001"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Environment</span>
            <select
              data-testid="environment-filter"
              value={url.filters.environment ?? ''}
              onChange={(e) => setUrl({ filters: { environment: e.target.value as typeof url.filters.environment } })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All environments</option>
              {environments.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">State</span>
            <select
              data-testid="state-filter"
              value={url.filters.enabled ?? ''}
              onChange={(e) => setUrl({ filters: { enabled: e.target.value as typeof url.filters.enabled } })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All states</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchDraft('')
                setUrl({ filters: { q: '', environment: '', enabled: '' } })
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto text-sm text-slate-500" data-testid="result-count">
            {listLoading ? '…' : `${flags.length} flag${flags.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <FlagsTable
          flags={flags}
          selectedId={url.flag}
          loading={listLoading}
          error={listError}
          onRetry={() => setListVersion((v) => v + 1)}
          onSelect={(id) => setUrl({ flag: id })}
        />
      </main>

      {url.flag && (
        <FlagDetailPanel
          flagId={url.flag}
          flag={detail}
          loading={detailLoading}
          error={detailError}
          persona={persona}
          canToggleRole={canToggleRole}
          onClose={closePanel}
          onRetry={() => setDetailVersion((v) => v + 1)}
          onRequestToggle={(next) => {
            setDialogError(null)
            setDialogNext(next)
          }}
        />
      )}

      {detail && dialogNext !== null && (
        <ToggleDialog
          flag={detail}
          nextEnabled={dialogNext}
          submitting={submitting}
          error={dialogError}
          onConfirm={confirmToggle}
          onCancel={() => {
            if (!submitting) {
              setDialogNext(null)
              setDialogError(null)
            }
          }}
        />
      )}

      <Toast toast={toast} onDismiss={useCallback(() => setToast(null), [])} />
    </div>
  )
}
