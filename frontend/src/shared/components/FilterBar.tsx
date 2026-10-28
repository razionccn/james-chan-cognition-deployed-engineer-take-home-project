import type { ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
}

/** Horizontal toolbar that holds a search box plus any number of select filters. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">{children}</div>
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
}) {
  return (
    <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  )
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  allLabel?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
