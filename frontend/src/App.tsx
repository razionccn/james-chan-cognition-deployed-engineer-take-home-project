import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { appRegistry } from '@/apps/registry'
import { HomePage } from '@/apps/home/HomePage'
import { AppShell } from '@/shared/layout/AppShell'
import { PersonaProvider } from '@/shared/persona/PersonaContext'
import { ToastProvider } from '@/shared/components'

export default function App() {
  return (
    <BrowserRouter>
      <PersonaProvider>
        <ToastProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              {appRegistry.map((app) => (
                <Route key={app.id} path={`${app.path}/*`} element={<app.Page />} />
              ))}
            </Route>
          </Routes>
        </ToastProvider>
      </PersonaProvider>
    </BrowserRouter>
  )
}
