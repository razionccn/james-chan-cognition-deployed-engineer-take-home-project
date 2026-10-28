import { KycQueuePage } from './kyc/KycQueuePage'
import { RequestAppPage } from './request/RequestAppPage'
import type { ComponentType } from 'react'

/**
 * Every internal app registers here. The AppShell builds sidebar navigation
 * from this list and App.tsx mounts each app's routes under `path`.
 *
 * To add an app: create `src/apps/<id>/` with a root page component, then
 * append an entry below.
 */
export interface AppDefinition {
  id: string
  name: string
  description: string
  path: string
  Page: ComponentType
}

export const appRegistry: AppDefinition[] = [
  {
    id: 'kyc',
    name: 'KYC Review Queue',
    description: 'Review identity-verification cases: approve, reject or escalate with an audited reason.',
    path: '/kyc',
    Page: KycQueuePage,
  },
  {
    id: 'request',
    name: 'Request New App',
    description: 'Describe an internal tool in plain language and get a validated specification for engineering review.',
    path: '/request',
    Page: RequestAppPage,
  },
]
