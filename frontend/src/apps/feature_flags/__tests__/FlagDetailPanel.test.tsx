// Record-safety regression tests for the flag panel (same invariants as CaseDetailPanel.test.tsx).
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/shared/components'
import { FlagDetailPanel } from '../FlagDetailPanel'
import type { FeatureFlagDetail } from '../types'

vi.mock('@/shared/persona/PersonaContext', () => ({
  usePersona: () => ({ current: { id: 'ana.reviewer', name: 'Ana Okafor', role: 'reviewer' }, personas: [], setCurrentId: () => {} }),
}))
vi.mock('../api', () => ({ featureFlagsApi: { getFlag: vi.fn(), toggleFlag: vi.fn() } }))
import { featureFlagsApi } from '../api'

function flag(id: string, name: string): FeatureFlagDetail {
  return { id, name, description: 'd', environment: 'staging', enabled: false, updated_at: '2026-10-01T09:00:00Z', updated_by: 'Seed', editable: true, audit_events: [] }
}
const A = flag('FF-1001', 'alpha.flag')
const B = flag('FF-1002', 'bravo.flag')
const getFlag = featureFlagsApi.getFlag as unknown as ReturnType<typeof vi.fn>
const toggleFlag = featureFlagsApi.toggleFlag as unknown as ReturnType<typeof vi.fn>

function renderPanel(flagId: string | null, onClose = vi.fn()) {
  const ui = (id: string | null) => (
    <ToastProvider>
      <FlagDetailPanel flagId={id} onClose={onClose} onChanged={() => {}} />
    </ToastProvider>
  )
  const utils = render(ui(flagId))
  return { rerenderWith: (id: string | null) => utils.rerender(ui(id)), onClose }
}

beforeEach(() => {
  getFlag.mockReset()
  toggleFlag.mockReset()
})

describe('FlagDetailPanel record safety', () => {
  it('Bug 1: while B loads, A is not shown and its toggle is not available', async () => {
    let resolveB!: (v: FeatureFlagDetail) => void
    getFlag.mockImplementation((id: string) => (id === A.id ? Promise.resolve(A) : new Promise<FeatureFlagDetail>((r) => (resolveB = r))))
    const { rerenderWith } = renderPanel(A.id)
    await act(async () => {})
    expect(screen.getByRole('switch')).toBeInTheDocument()
    rerenderWith(B.id)
    expect(screen.queryByText('alpha.flag')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    await act(async () => resolveB(B))
    expect(screen.getAllByText('bravo.flag').length).toBeGreaterThan(0)
  })

  it('Bug 2/3/5: pending toggle is cancelled on record change and on close; Escape closes the dialog only', async () => {
    getFlag.mockImplementation((id: string) => Promise.resolve(id === A.id ? A : B))
    const { rerenderWith, onClose } = renderPanel(A.id)
    await act(async () => {})
    await userEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Enable alpha.flag?')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByText('Enable alpha.flag?')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('switch'))
    rerenderWith(B.id)
    await act(async () => {})
    expect(screen.queryByText(/Enable .*\?/)).not.toBeInTheDocument()
    expect(toggleFlag).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('switch'))
    rerenderWith(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
