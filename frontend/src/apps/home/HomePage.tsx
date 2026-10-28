import { Link } from 'react-router-dom'
import { appRegistry } from '@/apps/registry'
import { EmptyState, PageHeader } from '@/shared/components'

export function HomePage() {
  return (
    <>
      <PageHeader
        title="Fintech Operations Console"
        description="Internal tools built on a shared application shell, component library and API conventions."
      />
      {appRegistry.length === 0 ? (
        <EmptyState
          title="No applications installed yet"
          description="Add an app under src/apps and register it in src/apps/registry.ts."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appRegistry.map((app) => (
            <Link
              key={app.id}
              to={app.path}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <div className="text-base font-semibold text-slate-900">{app.name}</div>
              <p className="mt-1 text-sm text-slate-500">{app.description}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
