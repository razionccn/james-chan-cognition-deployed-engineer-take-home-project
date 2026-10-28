import { useCallback, useEffect, useState } from 'react'
import type { FlagFilters } from './api'

export const ROUTE = '/feature-flags'

export interface UrlState {
  filters: FlagFilters
  flag: string | null
}

function read(): UrlState {
  const p = new URLSearchParams(window.location.search)
  const env = p.get('environment')
  const enabled = p.get('enabled')
  return {
    filters: {
      q: p.get('q') ?? '',
      environment: env === 'development' || env === 'staging' || env === 'production' ? env : '',
      enabled: enabled === 'true' || enabled === 'false' ? enabled : '',
    },
    flag: p.get('flag'),
  }
}

function write(state: UrlState, replace: boolean) {
  const p = new URLSearchParams()
  if (state.filters.q) p.set('q', state.filters.q)
  if (state.filters.environment) p.set('environment', state.filters.environment)
  if (state.filters.enabled) p.set('enabled', state.filters.enabled)
  if (state.flag) p.set('flag', state.flag)
  const qs = p.toString()
  const url = `${ROUTE}${qs ? `?${qs}` : ''}`
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
}

/** Keeps filters + selected flag in the query string so the detail panel URL is shareable. */
export function useUrlState(): [UrlState, (patch: Partial<UrlState>, opts?: { replace?: boolean }) => void] {
  const [state, setState] = useState<UrlState>(() => read())

  useEffect(() => {
    if (window.location.pathname !== ROUTE) write(read(), true)
    const onPop = () => setState(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const update = useCallback((patch: Partial<UrlState>, opts?: { replace?: boolean }) => {
    setState((prev) => {
      const next: UrlState = {
        filters: { ...prev.filters, ...(patch.filters ?? {}) },
        flag: patch.flag === undefined ? prev.flag : patch.flag,
      }
      write(next, opts?.replace ?? false)
      return next
    })
  }, [])

  return [state, update]
}
