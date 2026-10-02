import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getManagementReturnsCapabilities } from '../api/managementReturnsApi'
import { managementReturnsCapability, managementReturnsCatalogueEntry } from '../data/managementReturns.test-fixtures'
import { ManagementReturnsCatalogueLaunch } from './ManagementReturnsCatalogueLaunch'
vi.mock('../api/managementReturnsApi', () => ({ getManagementReturnsCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { open.mockClear(); vi.mocked(getManagementReturnsCapabilities).mockReset() })
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><ManagementReturnsCatalogueLaunch report={managementReturnsCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it('opens the current OUR variant only after an exact executable capability', async () => {
  vi.mocked(getManagementReturnsCapabilities).mockResolvedValue(managementReturnsCapability()); render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити управлінські повернення' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(managementReturnsCapability()); expect(getManagementReturnsCapabilities).toHaveBeenCalledWith('owner-a', expect.any(AbortSignal))
})
it('does not read without permission and never turns an unavailable runtime flag on', async () => {
  const capability = managementReturnsCapability(); capability.RuntimeImplemented = false
  vi.mocked(getManagementReturnsCapabilities).mockResolvedValue(capability); const view = render(launcher(false))
  expect(getManagementReturnsCapabilities).not.toHaveBeenCalled(); view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити управлінські повернення' })); expect(open).not.toHaveBeenCalled(); expect(capability.RuntimeImplemented).toBe(false)
})
it('aborts old-owner capability and ignores its late executable response', async () => {
  let resolve!: (value: ReturnType<typeof managementReturnsCapability>) => void
  vi.mocked(getManagementReturnsCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...managementReturnsCapability(), RuntimeImplemented: false })
  const view = render(launcher()), signal = vi.mocked(getManagementReturnsCapabilities).mock.calls[0][1]
  view.rerender(launcher(true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.'); await act(async () => { resolve(managementReturnsCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити управлінські повернення' }) as HTMLButtonElement).disabled).toBe(true); expect(open).not.toHaveBeenCalled()
})
it('offers an explicit capability retry after failure and rejects the wrong Source definition', async () => {
  vi.mocked(getManagementReturnsCapabilities).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ ...managementReturnsCapability(),
    SourceIdentity: { ...managementReturnsCapability().SourceIdentity, DefinitionSha256: 'wrong' } } as ReturnType<typeof managementReturnsCapability>)
  render(launcher()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getManagementReturnsCapabilities).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Відкрити управлінські повернення' }) as HTMLButtonElement).disabled).toBe(true)
})
