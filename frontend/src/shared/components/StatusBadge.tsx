import { cx } from './cx'

/** Semantic colours; apps map domain values to a tone in their labels.tsx. */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'danger' | 'warning'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
}

/**
 * Generic status pill. Apps map their domain values to a tone + label, e.g.
 * `<StatusBadge tone="success" label="Approved" />`.
 */
export function StatusBadge({ tone = 'neutral', label, className }: { tone?: BadgeTone; label: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}
