import type { ReactNode } from 'react'
import { Button } from './Button'

/** Spinner placeholder while a query is in flight. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden />
      {label}
    </div>
  )
}

/** Friendly empty result, optionally with a call-to-action. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  )
}

/**
 * Inline alert for a refetch that failed while earlier data is still on screen, so stale rows or
 * details are never shown as if they were fresh. Use when `query.status === 'error' && query.data`.
 */
export function RefreshError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" aria-label="Refresh failed" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>
        <span className="font-medium">Refresh failed:</span> {message} Showing the last data that loaded.
      </span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

/** Failed query: shows the backend's message verbatim and an optional retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center" role="alert">
      <p className="text-sm font-medium text-red-800">Something went wrong</p>
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
