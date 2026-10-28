// Record-safety regression tests (TEMPLATE_AUDIT follow-up): a detail panel must never show, or
// act on, a record other than the one currently selected. API calls are deferred promises so the
// in-between states are deterministic.
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/shared/components'
import { ApiError } from '@/shared/api/client'
import { CaseDetailPanel } from '../CaseDetailPanel'
import type { KycCaseDetail } from '../types'

vi.mock('@/shared/persona/PersonaContext', () => ({
  usePersona: () => ({ current: { id: 'ana.reviewer', name: 'Ana Okafor', role: 'reviewer' }, personas: [], setCurrentId: () => {} }),
}))
vi.mock('../api', () => ({ kycApi: { getCase: vi.fn(), reviewCase: vi.fn() } }))
import { kycApi } from '../api'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function caseDetail(id: string, name: string): KycCaseDetail {
  return {
    id, customer_name: name, customer_email: `${id}@example.com`, country: 'GB', account_type: 'individual', risk_level: 'low',
    status: 'pending', submitted_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', assigned_reviewer: null,
    findings: [], audit_events: [], allowed_actions: ['approve', 'reject', 'escalate'],
  }
}

const A = caseDetail('KYC-1001', 'Alice Alpha')
const B = caseDetail('KYC-1002', 'Bob Bravo')
const getCase = kycApi.getCase as unknown as ReturnType<typeof vi.fn>
const reviewCase = kycApi.reviewCase as unknown as ReturnType<typeof vi.fn>

function renderPanel(caseId: string | null, onClose = vi.fn()) {
  const utils = render(
    <ToastProvider>
      <CaseDetailPanel caseId={caseId} onClose={onClose} onChanged={() => {}} />
    </ToastProvider>,
  )
  const rerenderWith = (id: string | null) =>
    utils.rerender(
      <ToastProvider>
        <CaseDetailPanel caseId={id} onClose={onClose} onChanged={() => {}} />
      </ToastProvider>,
    )
  return { ...utils, rerenderWith, onClose }
}

beforeEach(() => {
  getCase.mockReset()
  reviewCase.mockReset()
})

describe('CaseDetailPanel record safety', () => {
  it('Bug 1: while B is loading, nothing of A (details or action buttons) is shown', async () => {
    const a = deferred<KycCaseDetail>()
    const b = deferred<KycCaseDetail>()
    getCase.mockImplementation((id: string) => (id === A.id ? a.promise : b.promise))
    const { rerenderWith } = renderPanel(A.id)
    await act(async () => a.resolve(A))
    expect(screen.getByText('Alice Alpha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()

    rerenderWith(B.id)
    expect(screen.queryByText('Alice Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText(A.id)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.getByText(/Loading case/)).toBeInTheDocument()

    await act(async () => b.resolve(B))
    expect(screen.getByText('Bob Bravo')).toBeInTheDocument()
  })

  it('Bug 1: when B fails to load, A is not shown in its place — the error state is', async () => {
    getCase.mockImplementation((id: string) => (id === A.id ? Promise.resolve(A) : Promise.reject(new ApiError(404, 'not_found', 'Case not found'))))
    const { rerenderWith } = renderPanel(A.id)
    await act(async () => {})
    expect(screen.getByText('Alice Alpha')).toBeInTheDocument()
    rerenderWith(B.id)
    await act(async () => {})
    expect(screen.queryByText('Alice Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Case not found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('Bug 2: closing the panel cancels an unsubmitted confirmation', async () => {
    getCase.mockResolvedValue(A)
    const { rerenderWith } = renderPanel(A.id)
    await act(async () => {})
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(screen.getByText(`Approve ${A.id}?`)).toBeInTheDocument()
    rerenderWith(null)
    expect(screen.queryByText(`Approve ${A.id}?`)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Bug 3: changing the selected record cancels the pending action; nothing is ever submitted against B', async () => {
    getCase.mockImplementation((id: string) => Promise.resolve(id === A.id ? A : B))
    const { rerenderWith } = renderPanel(A.id)
    await act(async () => {})
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'Looks fine')
    rerenderWith(B.id)
    await act(async () => {})
    expect(screen.queryByText(`Approve ${A.id}?`)).not.toBeInTheDocument()
    expect(screen.queryByText(`Approve ${B.id}?`)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(reviewCase).not.toHaveBeenCalled()
  })

  it('Bug 3: a confirmed action targets the record it was started on, even if props change mid-flight', async () => {
    getCase.mockImplementation((id: string) => Promise.resolve(id === A.id ? A : B))
    reviewCase.mockResolvedValue({ ...A, status: 'approved', allowed_actions: [] })
    const { rerenderWith } = renderPanel(A.id)
    await act(async () => {})
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'Looks fine')
    const dialogApprove = screen.getAllByRole('button', { name: 'Approve' }).at(-1)!
    await userEvent.click(dialogApprove)
    rerenderWith(B.id)
    await act(async () => {})
    expect(reviewCase).toHaveBeenCalledTimes(1)
    expect(reviewCase.mock.calls[0][0]).toBe(A.id)
  })

  it('Bug 5: Escape with the confirmation open closes only the confirmation, not the panel', async () => {
    getCase.mockResolvedValue(A)
    const { onClose } = renderPanel(A.id)
    await act(async () => {})
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByText(`Approve ${A.id}?`)).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Bug 4: a failed refetch of the same record shows a visible refresh error instead of silently keeping stale data', async () => {
    getCase.mockResolvedValueOnce(A).mockRejectedValueOnce(new ApiError(0, 'network', 'Network down'))
    reviewCase.mockRejectedValue(new ApiError(409, 'invalid_transition', 'Already approved'))
    renderPanel(A.id)
    await act(async () => {})
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'Looks fine')
    await userEvent.click(screen.getAllByRole('button', { name: 'Approve' }).at(-1)!)
    await act(async () => {})
    expect(screen.getByText(/Network down/)).toBeInTheDocument()
    expect(screen.getByRole('alert', { name: /refresh/i })).toBeInTheDocument()
  })
})
