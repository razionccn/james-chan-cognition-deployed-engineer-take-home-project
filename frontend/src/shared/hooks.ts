import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Returns `value` after it has been stable for `ms` milliseconds (search-as-you-type). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/**
 * One URL search parameter as state (e.g. `?case=KYC-1001`), so the selected
 * record is shareable and survives a reload. Other parameters are preserved.
 */
export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(name)
  const set = (next: string | null) => {
    const copy = new URLSearchParams(params)
    if (next) copy.set(name, next)
    else copy.delete(name)
    setParams(copy, { replace: false })
  }
  return [value, set]
}
