import type { ReactNode } from 'react'
import { formatDateTime } from '@/shared/format'

export interface AuditTimelineEntry {
  id: string | number
  /** e.g. "Approved by Ana Okafor" */
  title: ReactNode
  /** ISO timestamp */
  at: string
  /** e.g. "Pending → Approved" */
  change?: ReactNode
  reason?: string | null
}

/** Newest-first list of audit events, as returned by an app's `audit_events`. */
export function AuditTimeline({ entries, emptyText = 'No changes recorded yet.' }: { entries: AuditTimelineEntry[]; emptyText?: string }) {
  if (entries.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{emptyText}</p>
  }
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-800">{e.title}</span>
            <time className="text-xs text-slate-500" dateTime={e.at}>
              {formatDateTime(e.at)}
            </time>
          </div>
          {e.change && <p className="mt-1 text-xs text-slate-500">{e.change}</p>}
          {e.reason && <p className="mt-2 text-sm text-slate-700">“{e.reason}”</p>}
        </li>
      ))}
    </ol>
  )
}
