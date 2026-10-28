/**
 * DEV-ONLY simulated identity. Lets the demo switch between a reviewer and a
 * read-only viewer so the backend's authorization rules can be exercised.
 * This is not authentication; see README "Known limitations".
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setPersonaProvider } from '../api/client'

/** Mirrors backend/app/core/personas.py; roles are global, not per app. */
export interface Persona {
  id: string
  name: string
  role: 'reviewer' | 'viewer'
}

interface PersonaContextValue {
  personas: Persona[]
  current: Persona | null
  setCurrentId: (id: string) => void
}

const STORAGE_KEY = 'console.demoPersona'
const PersonaContext = createContext<PersonaContextValue | null>(null)

/** Loads personas from /api/personas, persists the choice in localStorage and feeds the API client header. */
export function PersonaProvider({ children }: { children: ReactNode }) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [currentId, setCurrentId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? '')

  useEffect(() => {
    setPersonaProvider(() => currentId || null)
    localStorage.setItem(STORAGE_KEY, currentId)
  }, [currentId])

  useEffect(() => {
    api
      .get<{ personas: Persona[] }>('/api/personas')
      .then((r) => {
        setPersonas(r.personas)
        if (!r.personas.some((p) => p.id === currentId)) {
          setCurrentId(r.personas[0]?.id ?? '')
        }
      })
      .catch(() => setPersonas([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<PersonaContextValue>(
    () => ({
      personas,
      current: personas.find((p) => p.id === currentId) ?? null,
      setCurrentId,
    }),
    [personas, currentId],
  )
  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
}

/** Current persona + switcher; `current?.role === 'reviewer'` is the UX-only gate for write controls. */
export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext)
  if (!ctx) throw new Error('usePersona must be used within PersonaProvider')
  return ctx
}
