import type { Environment } from '../api'

const ENV_STYLES: Record<Environment, string> = {
  development: 'bg-sky-100 text-sky-800 ring-sky-200',
  staging: 'bg-amber-100 text-amber-800 ring-amber-200',
  production: 'bg-rose-100 text-rose-800 ring-rose-200',
}

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ENV_STYLES[environment]}`}
      data-testid="environment-badge"
    >
      {environment}
    </span>
  )
}

export function StateBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
      data-testid="state-badge"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  )
}
