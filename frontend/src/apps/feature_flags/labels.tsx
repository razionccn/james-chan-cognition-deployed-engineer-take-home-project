import { StatusBadge, type BadgeTone } from '@/shared/components'
import type { Environment } from './types'

const environmentTone: Record<Environment, BadgeTone> = { development: 'neutral', staging: 'info', production: 'warning' }
export const environmentLabel: Record<Environment, string> = { development: 'Development', staging: 'Staging', production: 'Production' }

export const environmentOptions = (Object.keys(environmentLabel) as Environment[]).map((v) => ({ value: v, label: environmentLabel[v] }))
export const stateOptions = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
]

export function EnvironmentPill({ environment }: { environment: Environment }) {
  return <StatusBadge tone={environmentTone[environment]} label={environmentLabel[environment]} />
}

export function StatePill({ enabled }: { enabled: boolean }) {
  return <StatusBadge tone={enabled ? 'success' : 'neutral'} label={enabled ? 'Enabled' : 'Disabled'} />
}
