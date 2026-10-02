import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getManagementBalanceCapabilities } from '../api/managementBalanceApi'
import { managementBalanceCapability, managementBalanceCatalogueEntry } from '../data/managementBalance.test-fixtures'
import { ManagementBalanceCatalogueLaunch } from './ManagementBalanceCatalogueLaunch'
vi.mock('../api/managementBalanceApi', () => ({ getManagementBalanceCapabilities: vi.fn() }))
const open = vi.fn(() => true)
beforeEach(() => { open.mockClear(); vi.mocked(getManagementBalanceCapabilities).mockReset() })
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><ManagementBalanceCatalogueLaunch report={managementBalanceCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}
it('opens the current OUR variant only after an exact executable capability', async () => {
  vi.mocked(getManagementBalanceCapabilities).mockResolvedValue(managementBalanceCapability()); render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити місячну дебіторку' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(managementBalanceCapability()); expect(getManagementBalanceCapabilities).toHaveBeenCalledWith('monthlyReceivables', 'owner-a', expect.any(AbortSignal))
})
it('does not read without permission and never turns an unavailable runtime flag on', async () => {
  const capability = managementBalanceCapability(); capability.RuntimeImplemented = false
  vi.mocked(getManagementBalanceCapabilities).mockResolvedValue(capability); const view = render(launcher(false))
  expect(getManagementBalanceCapabilities).not.toHaveBeenCalled(); view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити місячну дебіторку' })); expect(open).not.toHaveBeenCalled(); expect(capability.RuntimeImplemented).toBe(false)
})
it('aborts old-owner capability and ignores its late executable response', async () => {
  let resolve!: (value: ReturnType<typeof managementBalanceCapability>) => void
  vi.mocked(getManagementBalanceCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...managementBalanceCapability(), RuntimeImplemented: false })
  const view = render(launcher()), signal = vi.mocked(getManagementBalanceCapabilities).mock.calls[0][1]
  view.rerender(launcher(true, 'owner-b')); expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.'); await act(async () => { resolve(managementBalanceCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити місячну дебіторку' }) as HTMLButtonElement).disabled).toBe(true); expect(open).not.toHaveBeenCalled()
})
it('offers an explicit capability retry after failure and rejects the wrong Source definition', async () => {
  vi.mocked(getManagementBalanceCapabilities).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ ...managementBalanceCapability(),
    SourceIdentity: { ...managementBalanceCapability().SourceIdentity, DefinitionSha256: 'wrong' } } as unknown as ReturnType<typeof managementBalanceCapability>)
  render(launcher()); fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getManagementBalanceCapabilities).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Відкрити місячну дебіторку' }) as HTMLButtonElement).disabled).toBe(true)
})
