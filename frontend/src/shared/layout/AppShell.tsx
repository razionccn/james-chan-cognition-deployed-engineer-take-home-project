import { NavLink, Outlet } from 'react-router-dom'
import { appRegistry } from '@/apps/registry'
import { usePersona } from '../persona/PersonaContext'
import { cx } from '../components/cx'

/**
 * Console chrome shared by every internal app: brand, sidebar navigation
 * generated from the app registry, and the DEV-ONLY persona switcher.
 */
export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">Fintech Operations Console</div>
          <div className="text-xs text-slate-500">Internal tools</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3" aria-label="Applications">
          <NavItem to="/" label="Home" end />
          {appRegistry.map((app) => (
            <NavItem key={app.id} to={app.path} label={app.name} />
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">Synthetic data only · demo build</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 md:px-6">
          <nav className="flex gap-2 md:hidden" aria-label="Applications (mobile)">
            <NavItem to="/" label="Home" end compact />
            {appRegistry.map((app) => (
              <NavItem key={app.id} to={app.path} label={app.name} compact />
            ))}
          </nav>
          <div className="hidden md:block" />
          <PersonaSwitcher />
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, label, end, compact }: { to: string; label: string; end?: boolean; compact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'block rounded-md text-sm font-medium transition',
          compact ? 'px-2 py-1' : 'px-3 py-2',
          isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      {label}
    </NavLink>
  )
}

function PersonaSwitcher() {
  const { personas, current, setCurrentId } = usePersona()
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-amber-800" title="Simulated identity for demo purposes. Not authentication.">
        Demo persona
      </span>
      <select
        value={current?.id ?? ''}
        onChange={(e) => setCurrentId(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Demo persona"
      >
        {personas.length === 0 && <option value="">(backend unavailable)</option>}
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.role}
          </option>
        ))}
      </select>
    </label>
  )
}
