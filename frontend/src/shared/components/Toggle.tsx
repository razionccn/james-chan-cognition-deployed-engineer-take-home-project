import { cx } from './cx'

/**
 * Generic on/off switch for boolean fields. Controlled; the parent decides
 * whether the change is confirmed or sent to the backend.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  busy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  busy?: boolean
}) {
  const inactive = disabled || busy
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={inactive}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        inactive && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition', checked ? 'translate-x-5' : 'translate-x-0.5')}
      />
    </button>
  )
}
