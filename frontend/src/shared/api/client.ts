/**
 * Typed HTTP client shared by every app.
 *
 * - All requests go to `/api/...` (proxied to FastAPI by Vite in dev).
 * - The DEV-ONLY simulated persona is sent as `X-Demo-User`.
 * - Backend errors of shape `{ error: { code, message } }` are surfaced as `ApiError`
 *   so pages can show the backend's message verbatim.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

let personaProvider: () => string | null = () => null

/** Called once by the PersonaProvider so the client can attach the header. */
export function setPersonaProvider(fn: () => string | null) {
  personaProvider = fn
}

/** `{ q: 'x', status: '' }` → `?q=x` (empty/undefined/null are dropped). */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const persona = personaProvider()
  if (persona) headers.set('X-Demo-User', persona)

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the backend. Is the API server running?')
  }

  if (!res.ok) {
    let code = 'http_error'
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.error) {
        code = body.error.code ?? code
        message = body.error.message ?? message
      } else if (body?.detail) {
        // FastAPI request-validation errors
        message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        code = 'validation_error'
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** The two verbs the console uses; add put/patch/delete here when an app needs them. */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}
