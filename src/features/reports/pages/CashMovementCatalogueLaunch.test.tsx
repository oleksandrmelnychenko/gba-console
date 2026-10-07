import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCashMovementCapabilities } from '../api/cashMovementApi'
import { cashMovementCapability, cashMovementCatalogueEntry } from '../data/cashMovement.test-fixtures'
import type { CashMovementKind } from '../data/cashMovement'
import { CashMovementCatalogueLaunch } from './CashMovementCatalogueLaunch'
vi.mock('../api/cashMovementApi', () => ({ getCashMovementCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { vi.mocked(getCashMovementCapabilities).mockReset(); open.mockClear() })
function launcher(kind: CashMovementKind = 'receipts', enabled = true, callerKey = 'owner-a', disabled = false) {
  return <MantineProvider env="test"><I18nProvider><CashMovementCatalogueLaunch report={cashMovementCatalogueEntry(kind)}
    enabled={enabled} disabled={disabled} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it.each(['receipts', 'payouts'] as const)('opens %s only after its exact executable capability', async kind => {
  const capability = cashMovementCapability(kind)
  vi.mocked(getCashMovementCapabilities).mockResolvedValue(capability)
  render(launcher(kind))
  const button = screen.getByRole('button', { name: kind === 'receipts' ? 'Відкрити надходження за квартал' : 'Відкрити виплати за місяць' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
  expect(getCashMovementCapabilities).toHaveBeenCalledWith(kind, expect.any(AbortSignal))
})
it('does not fetch without permission or open with unavailable capability or disabled workspace', async () => {
  vi.mocked(getCashMovementCapabilities).mockResolvedValue({ ...cashMovementCapability(), Executable: false })
  const view = render(launcher('receipts', false))
  expect(getCashMovementCapabilities).not.toHaveBeenCalled()
  view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити надходження за квартал' }))
  expect(open).not.toHaveBeenCalled()
  view.rerender(launcher('receipts', true, 'owner-a', true))
  expect((screen.getByRole('button', { name: 'Відкрити надходження за квартал' }) as HTMLButtonElement).disabled).toBe(true)
})
it('aborts an old caller and ignores its deferred capability', async () => {
  let resolve!: (value: ReturnType<typeof cashMovementCapability>) => void
  vi.mocked(getCashMovementCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...cashMovementCapability(), Executable: false })
  const view = render(launcher())
  const signal = vi.mocked(getCashMovementCapabilities).mock.calls[0][1]!
  view.rerender(launcher('receipts', true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  await act(async () => { resolve(cashMovementCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити надходження за квартал' }) as HTMLButtonElement).disabled).toBe(true)
})
it('isolates quarter and month capability scopes even when the mounted launcher changes form', async () => {
  let resolve!: (value: ReturnType<typeof cashMovementCapability>) => void
  vi.mocked(getCashMovementCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce(cashMovementCapability('payouts'))
  const view = render(launcher())
  const signal = vi.mocked(getCashMovementCapabilities).mock.calls[0][1]!
  view.rerender(launcher('payouts')); expect(signal.aborted).toBe(true)
  const button = screen.getByRole('button', { name: 'Відкрити виплати за місяць' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  await act(async () => { resolve(cashMovementCapability()) })
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(cashMovementCapability('payouts'))
  expect(getCashMovementCapabilities).toHaveBeenCalledTimes(2)
})
