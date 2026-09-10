import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportDraftRecoveryPanel, ReportDraftStatus } from './ReportDraftRecoveryPanel'

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

describe('report draft recovery choice', () => {
  it('explains recovery without automatically invoking either choice', () => {
    const onRestore = vi.fn(), onDiscard = vi.fn()
    render(<ReportDraftRecoveryPanel canRestore onRestore={onRestore} onDiscard={onDiscard} />, { wrapper: Providers })
    expect(screen.getByRole('region', { name: 'Незбережена чернетка' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Незбережена чернетка' })).toBeTruthy()
    expect(screen.getByText('Відновлення поверне лише налаштування. Щоб отримати звіт, натисніть «Сформувати».')).toBeTruthy()
    expect(onRestore).not.toHaveBeenCalled()
    expect(onDiscard).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Сформувати' })).toBeNull()
  })

  it('restores only after the explicit action', async () => {
    const onRestore = vi.fn(), onDiscard = vi.fn()
    render(<ReportDraftRecoveryPanel canRestore onRestore={onRestore} onDiscard={onDiscard} />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('button', { name: 'Відновити чернетку' }))
    expect(onRestore).toHaveBeenCalledOnce()
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('blocks restore when permission or stored data disallows it, while retaining discard', async () => {
    const onRestore = vi.fn(), onDiscard = vi.fn()
    render(<ReportDraftRecoveryPanel canRestore={false} error="Чернетка пошкоджена." onRestore={onRestore} onDiscard={onDiscard} />, { wrapper: Providers })
    expect(screen.getByRole('alert').textContent).toContain('Чернетка пошкоджена.')
    await userEvent.click(screen.getByRole('button', { name: 'Відновити чернетку' }))
    await userEvent.click(screen.getByRole('button', { name: 'Відкинути чернетку' }))
    expect(onRestore).not.toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('shows loading and blocks restore/retry without trapping a user who discards', async () => {
    const onRestore = vi.fn(), onDiscard = vi.fn(), onRetry = vi.fn()
    render(<ReportDraftRecoveryPanel canRestore loading error="Набори даних недоступні." onRestore={onRestore} onDiscard={onDiscard} onRetry={onRetry} />, { wrapper: Providers })
    expect(screen.getByRole('region', { name: 'Незбережена чернетка' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('Завантаження наборів даних…')
    await userEvent.click(screen.getByRole('button', { name: 'Відновити чернетку' }))
    await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
    await userEvent.click(screen.getByRole('button', { name: 'Відкинути чернетку' }))
    expect(onRestore).not.toHaveBeenCalled()
    expect(onRetry).not.toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('lets the host retry a failed dataset load', async () => {
    const onRetry = vi.fn()
    render(<ReportDraftRecoveryPanel canRestore={false} error="Набори даних недоступні." onRestore={vi.fn()} onDiscard={vi.fn()} onRetry={onRetry} />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not offer retry without a failure or handler', () => {
    const { rerender } = render(<ReportDraftRecoveryPanel canRestore onRestore={vi.fn()} onDiscard={vi.fn()} onRetry={vi.fn()} />, { wrapper: Providers })
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull()
    rerender(<ReportDraftRecoveryPanel canRestore={false} error="Чернетка недоступна." onRestore={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull()
  })

  it('renders the retained timestamp and omits an invalid timestamp', () => {
    const savedAt = '2026-09-10T09:15:00Z'
    const { container, rerender } = render(<ReportDraftRecoveryPanel savedAt={savedAt} canRestore onRestore={vi.fn()} onDiscard={vi.fn()} />, { wrapper: Providers })
    expect(container.querySelector('time')?.dateTime).toBe(savedAt)
    expect(container.querySelector('time')?.textContent).toContain('10.09.26')
    rerender(<ReportDraftRecoveryPanel savedAt="not-a-date" canRestore onRestore={vi.fn()} onDiscard={vi.fn()} />)
    expect(container.querySelector('time')).toBeNull()
  })
})

describe('report draft status and one-level undo', () => {
  it('renders nothing before there is a saved draft, notice or undo checkpoint', () => {
    const { container } = render(<ReportDraftStatus canUndo={false} onUndo={vi.fn()} />, { wrapper: Providers })
    expect(container.querySelector('section')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('confirms only a timestamp-backed save and preserves a supplied storage notice', () => {
    const { rerender } = render(<ReportDraftStatus savedAt="2026-09-10T09:15:00Z" notice="Останні зміни не вдалося зберегти." canUndo={false} onUndo={vi.fn()} />, { wrapper: Providers })
    expect(screen.getByText(/Чернетка збережена в цій вкладці/)).toBeTruthy()
    expect(screen.getByText('Останні зміни не вдалося зберегти.')).toBeTruthy()
    rerender(<ReportDraftStatus savedAt="invalid" notice="Останні зміни не вдалося зберегти." canUndo={false} onUndo={vi.fn()} />)
    expect(screen.queryByText(/Чернетка збережена в цій вкладці/)).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Останні зміни не вдалося зберегти.')
  })

  it('offers undo without claiming that a draft was saved', async () => {
    const onUndo = vi.fn()
    render(<ReportDraftStatus canUndo onUndo={onUndo} />, { wrapper: Providers })
    expect(screen.queryByText(/Чернетка збережена в цій вкладці/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Повернути попередні налаштування' }))
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('honors the disabled state for undo', async () => {
    const onUndo = vi.fn()
    render(<ReportDraftStatus canUndo disabled onUndo={onUndo} />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('button', { name: 'Повернути попередні налаштування' }))
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('does not repeat undo when the host consumes the checkpoint on the first click', async () => {
    const onUndo = vi.fn()
    function Host() {
      const [canUndo, setCanUndo] = useState(true)
      return <ReportDraftStatus canUndo={canUndo} onUndo={() => { onUndo(); setCanUndo(false) }} />
    }
    render(<Host />, { wrapper: Providers })
    await userEvent.dblClick(screen.getByRole('button', { name: 'Повернути попередні налаштування' }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Повернути попередні налаштування' })).toBeNull()
  })
})
