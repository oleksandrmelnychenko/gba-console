import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getSupplierDebtCapabilities } from '../api/supplierDebtApi'
import { supplierDebtCapability, supplierDebtCatalogueEntry } from '../data/supplierDebt.test-fixtures'
import { SupplierDebtCatalogueLaunch } from './SupplierDebtCatalogueLaunch'

vi.mock('../api/supplierDebtApi', () => ({ getSupplierDebtCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getSupplierDebtCapabilities).mockReset())
const open = vi.fn(() => true)
function launcher(enabled = true, callerKey = 'owner-a') {
  return <MantineProvider env="test"><I18nProvider><SupplierDebtCatalogueLaunch report={supplierDebtCatalogueEntry()}
    enabled={enabled} disabled={false} callerKey={callerKey} onOpen={open} /></I18nProvider></MantineProvider>
}

it('opens only after the exact executable server capability is available', async () => {
  const capability = supplierDebtCapability()
  open.mockClear(); vi.mocked(getSupplierDebtCapabilities).mockResolvedValue(capability)
  render(launcher())
  const button = screen.getByRole('button', { name: 'Відкрити заборгованість постачальникам' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('does not read a capability without permission and keeps an unavailable capability disabled', async () => {
  open.mockClear(); vi.mocked(getSupplierDebtCapabilities).mockResolvedValue({ ...supplierDebtCapability(), RuntimeImplemented: false })
  const view = render(launcher(false))
  expect(getSupplierDebtCapabilities).not.toHaveBeenCalled()
  view.rerender(launcher())
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити заборгованість постачальникам' }))
  expect(open).not.toHaveBeenCalled()
})

it('aborts an old caller capability and ignores its deferred completion', async () => {
  let resolve!: (value: ReturnType<typeof supplierDebtCapability>) => void
  vi.mocked(getSupplierDebtCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ ...supplierDebtCapability(), RuntimeImplemented: false })
  const view = render(launcher())
  const signal = vi.mocked(getSupplierDebtCapabilities).mock.calls[0][0]!
  view.rerender(launcher(true, 'owner-b'))
  expect(signal.aborted).toBe(true)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  await act(async () => { resolve(supplierDebtCapability()) })
  expect((screen.getByRole('button', { name: 'Відкрити заборгованість постачальникам' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getSupplierDebtCapabilities).toHaveBeenCalledTimes(2)
})
