import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getSalesMarginCapabilities } from '../api/salesMarginApi'
import { salesMarginCapability, salesMarginCatalogueEntry } from '../data/salesMargin.test-fixtures'
import { SalesMarginCatalogueLaunch } from './SalesMarginCatalogueLaunch'

vi.mock('../api/salesMarginApi', () => ({ getSalesMarginCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getSalesMarginCapabilities).mockReset())
const open = vi.fn(() => true)
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><SalesMarginCatalogueLaunch report={salesMarginCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens only after the exact executable server capability is available', async () => {
  const capability = salesMarginCapability()
  open.mockClear(); vi.mocked(getSalesMarginCapabilities).mockResolvedValue(capability)
  render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити місячну маржу' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does not read a capability without permission and keeps an unavailable capability disabled', async () => {
  open.mockClear(); vi.mocked(getSalesMarginCapabilities).mockResolvedValue({ ...salesMarginCapability(), Executable: false })
  const view = render(launcher(false))
  expect(getSalesMarginCapabilities).not.toHaveBeenCalled()
  view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити місячну маржу' }))
  expect(open).not.toHaveBeenCalled()
})

it('aborts an old caller capability and ignores its deferred completion', async () => {
  let resolve!: (value: ReturnType<typeof salesMarginCapability>) => void
  vi.mocked(getSalesMarginCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...salesMarginCapability(), Executable: false })
  const view = render(launcher())
  const signal = vi.mocked(getSalesMarginCapabilities).mock.calls[0][0]!
  view.rerender(launcher(true, 'owner-b'))
  expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  await act(async () => { resolve(salesMarginCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити місячну маржу' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getSalesMarginCapabilities).toHaveBeenCalledTimes(2)
})
