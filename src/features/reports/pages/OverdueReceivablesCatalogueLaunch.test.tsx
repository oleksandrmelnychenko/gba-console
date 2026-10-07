import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOverdueReceivablesCapabilities } from '../api/overdueReceivablesApi'
import { overdueReceivablesCapability, overdueReceivablesCatalogueEntry } from '../data/overdueReceivables.test-fixtures'
import { OverdueReceivablesCatalogueLaunch } from './OverdueReceivablesCatalogueLaunch'

vi.mock('../api/overdueReceivablesApi', () => ({ getOverdueReceivablesCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getOverdueReceivablesCapabilities).mockReset())
const open = vi.fn(() => true)
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><OverdueReceivablesCatalogueLaunch report={overdueReceivablesCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens only after the exact executable server capability is available', async () => {
  const capability = overdueReceivablesCapability()
  open.mockClear(); vi.mocked(getOverdueReceivablesCapabilities).mockResolvedValue(capability)
  render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити прострочену дебіторку' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does not read a capability without permission and keeps an unavailable capability disabled', async () => {
  open.mockClear(); vi.mocked(getOverdueReceivablesCapabilities).mockResolvedValue({ ...overdueReceivablesCapability(), RuntimeImplemented: false })
  const view = render(launcher(false))
  expect(getOverdueReceivablesCapabilities).not.toHaveBeenCalled()
  view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити прострочену дебіторку' }))
  expect(open).not.toHaveBeenCalled()
})

it('aborts an old caller capability and ignores its deferred completion', async () => {
  let resolve!: (value: ReturnType<typeof overdueReceivablesCapability>) => void
  vi.mocked(getOverdueReceivablesCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...overdueReceivablesCapability(), RuntimeImplemented: false })
  const view = render(launcher())
  const signal = vi.mocked(getOverdueReceivablesCapabilities).mock.calls[0][0]!
  view.rerender(launcher(true, 'owner-b'))
  expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  await act(async () => { resolve(overdueReceivablesCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити прострочену дебіторку' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getOverdueReceivablesCapabilities).toHaveBeenCalledTimes(2)
})
