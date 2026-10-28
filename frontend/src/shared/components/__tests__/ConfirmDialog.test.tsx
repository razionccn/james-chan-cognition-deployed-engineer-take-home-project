import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'

const base = { open: true, title: 'Approve KYC-1001?', confirmLabel: 'Approve', onCancel: () => {} }

describe('ConfirmDialog reason field', () => {
  it('requireReason: shows the field, disables confirm until a non-blank reason is typed, trims it', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} requireReason onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Approve' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), '   ')
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), 'Documents verified ')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('Documents verified')
  })

  it('collectReason: shows the field but confirm works with an empty reason', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} collectReason onConfirm={onConfirm} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Approve' })
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('neither flag: no reason field is rendered', () => {
    render(<ConfirmDialog {...base} onConfirm={() => {}} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('resets the reason when reopened', async () => {
    const { rerender } = render(<ConfirmDialog {...base} requireReason onConfirm={() => {}} />)
    await userEvent.type(screen.getByRole('textbox'), 'stale')
    rerender(<ConfirmDialog {...base} open={false} requireReason onConfirm={() => {}} />)
    rerender(<ConfirmDialog {...base} requireReason onConfirm={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })
})
