// Bug 4: a failed list refresh must be visible even when stale rows are kept on screen.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/shared/components'
import { ApiError } from '@/shared/api/client'
import { KycQueuePage } from '../KycQueuePage'

vi.mock('@/shared/persona/PersonaContext', () => ({
  usePersona: () => ({ current: { id: 'vic.viewer', name: 'Vic', role: 'viewer' }, personas: [], setCurrentId: () => {} }),
}))
vi.mock('../api', () => ({ kycApi: { listCases: vi.fn(), getCase: vi.fn(), reviewCase: vi.fn() } }))
import { kycApi } from '../api'

const row = {
  id: 'KYC-1001', customer_name: 'Alice Alpha', customer_email: 'a@example.com', country: 'GB', account_type: 'individual',
  risk_level: 'low', status: 'pending', submitted_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', assigned_reviewer: null,
}

describe('KycQueuePage refresh failure', () => {
  it('keeps the last rows but shows a refresh error with retry when a refetch fails', async () => {
    const listCases = kycApi.listCases as unknown as ReturnType<typeof vi.fn>
    listCases.mockResolvedValueOnce({ items: [row], total: 1 }).mockRejectedValueOnce(new ApiError(0, 'network', 'Backend unreachable'))
    render(
      <MemoryRouter>
        <ToastProvider>
          <KycQueuePage />
        </ToastProvider>
      </MemoryRouter>,
    )
    await act(async () => {})
    expect(screen.getByText('Alice Alpha')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'approved')
    await act(async () => {})
    expect(screen.getByText('Alice Alpha')).toBeInTheDocument() // stale rows kept
    const alert = screen.getByRole('alert', { name: /refresh/i })
    expect(alert).toHaveTextContent('Backend unreachable')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
