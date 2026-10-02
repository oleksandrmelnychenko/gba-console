import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getEmployeeGrossProfitCapabilities } from '../api/employeeGrossProfitApi'
import { employeeGrossProfitCapability, employeeGrossProfitCatalogueEntry } from '../data/employeeGrossProfit.test-fixtures'
import { EmployeeGrossProfitCatalogueLaunch } from './EmployeeGrossProfitCatalogueLaunch'

vi.mock('../api/employeeGrossProfitApi', () => ({ getEmployeeGrossProfitCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getEmployeeGrossProfitCapabilities).mockReset())
const open = vi.fn(() => true)
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><EmployeeGrossProfitCatalogueLaunch report={employeeGrossProfitCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}

it('does not load caller-scoped capability before an authenticated caller exists', () => {
  render(<MantineProvider env="test"><I18nProvider><EmployeeGrossProfitCatalogueLaunch report={employeeGrossProfitCatalogueEntry()}
    enabled disabled={false} callerKey={null} onOpen={open} /></I18nProvider></MantineProvider>)
  expect(getEmployeeGrossProfitCapabilities).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Відкрити прибуток на співробітника' }) as HTMLButtonElement).disabled).toBe(true)
})

it('opens only after the exact executable server capability is available', async () => {
  const capability = employeeGrossProfitCapability()
  open.mockClear(); vi.mocked(getEmployeeGrossProfitCapabilities).mockResolvedValue(capability)
  render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити прибуток на співробітника' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
  expect(getEmployeeGrossProfitCapabilities).toHaveBeenCalledWith('owner-a', expect.any(AbortSignal))
})

it('does not read a capability without permission and keeps an unavailable capability disabled', async () => {
  open.mockClear(); vi.mocked(getEmployeeGrossProfitCapabilities).mockResolvedValue({ ...employeeGrossProfitCapability(), RuntimeImplemented: false })
  const view = render(launcher(false))
  expect(getEmployeeGrossProfitCapabilities).not.toHaveBeenCalled()
  view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити прибуток на співробітника' }))
  expect(open).not.toHaveBeenCalled()
})

it('aborts an old caller capability and ignores its deferred completion', async () => {
  let resolve!: (value: ReturnType<typeof employeeGrossProfitCapability>) => void
  vi.mocked(getEmployeeGrossProfitCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...employeeGrossProfitCapability(), RuntimeImplemented: false })
  const view = render(launcher())
  const signal = vi.mocked(getEmployeeGrossProfitCapabilities).mock.calls[0][1]!
  view.rerender(launcher(true, 'owner-b'))
  expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  await act(async () => { resolve(employeeGrossProfitCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити прибуток на співробітника' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getEmployeeGrossProfitCapabilities).toHaveBeenCalledTimes(2)
})
