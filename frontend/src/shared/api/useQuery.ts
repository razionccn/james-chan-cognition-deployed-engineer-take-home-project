import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './client'

/** `data` is kept during refetch so lists do not flash empty. */
export type QueryState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; error: ApiError; data?: T }
  | { status: 'success'; data: T }

/**
 * Minimal data-fetching hook: tracks loading / error / success and exposes
 * `refetch`. `deps` re-runs the query (e.g. when filters change).
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ status: 'loading', data: s.data }))
    fetcher().then(
      (data) => !cancelled && setState({ status: 'success', data }),
      (error) =>
        !cancelled &&
        setState((s) => ({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError(0, 'unknown', String(error)),
          data: s.data,
        })),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, refetch }
}
