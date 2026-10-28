import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

/**
 * Shared form controls. Keep them dumb: value/onChange in, label/help/error out.
 * Validation rules live in the backend; these only display what it returns
 * (or simple client-side hints).
 */

const inputBase =
  'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500'
const borderFor = (error?: string | null) => (error ? 'border-rose-400 focus:border-rose-400' : 'border-slate-300 focus:border-blue-500')

export function FormField({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  help?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('space-y-1', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-600" role="alert">{error}</p>
      ) : help ? (
        <p className="text-xs text-slate-500">{help}</p>
      ) : null}
    </div>
  )
}

interface BaseProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  help?: ReactNode
  error?: string | null
  className?: string
}

export function TextField({
  label,
  value,
  onChange,
  required,
  help,
  error,
  className,
  ...rest
}: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'>) {
  const id = useId()
  return (
    <FormField label={label} htmlFor={id} required={required} help={help} error={error} className={className}>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cx(inputBase, borderFor(error))}
        {...rest}
      />
    </FormField>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  required,
  help,
  error,
  className,
  rows = 3,
  ...rest
}: BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className'>) {
  const id = useId()
  return (
    <FormField label={label} htmlFor={id} required={required} help={help} error={error} className={className}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cx(inputBase, borderFor(error))}
        {...rest}
      />
    </FormField>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  help,
  error,
  className,
  ...rest
}: BaseProps & {
  options: Array<{ value: string; label: string }>
  placeholder?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'className'>) {
  const id = useId()
  return (
    <FormField label={label} htmlFor={id} required={required} help={help} error={error} className={className}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cx(inputBase, borderFor(error))}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormField>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
  disabled,
  className,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cx('flex items-start justify-between gap-4', className)}>
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          checked ? 'bg-emerald-600' : 'bg-slate-300',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={cx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

export function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  help,
  error,
  columns = 2,
  className,
}: {
  label: string
  options: Array<{ value: string; label: string; description?: string }>
  value: string[]
  onChange: (value: string[]) => void
  help?: ReactNode
  error?: string | null
  columns?: 1 | 2 | 3
  className?: string
}) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <FormField label={label} help={help} error={error} className={className}>
      <div className={cx('grid gap-2', columns === 1 && 'grid-cols-1', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span>
              <span className="font-medium text-slate-800">{o.label}</span>
              {o.description && <span className="block text-xs text-slate-500">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </FormField>
  )
}

/** Comma/newline separated free-text list → string[] (for "list the fields" style inputs). */
export function parseList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
