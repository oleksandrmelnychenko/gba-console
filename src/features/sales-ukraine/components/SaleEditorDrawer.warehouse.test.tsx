import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { theme } from '../../../shared/theme/theme'
import { clearAllSalesPendingMutations } from '../pendingSalesMutationRegistry'
import { installSalesMutationStorageHarness, type SalesMutationStorageHarness } from '../salesMutationStorageTestHarness'
import type { SalesUkraineSale } from '../types'
import { SaleEditorDrawer } from './SaleEditorDrawer'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(), loadSale: vi.fn(), updateSale: vi.fn(), convertVat: vi.fn(), notify: vi.fn(),
}))
vi.mock('../../../shared/api/apiClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/api/apiClient')>(), apiRequest: mocks.apiRequest,
}))
vi.mock('../api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/salesUkraineApi')>(),
  updateSaleFromData: mocks.updateSale, convertVatSaleAndGetPaymentDocument: mocks.convertVat,
}))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ session: { userNetUid: 'USER-A' } }) }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock('../../../shared/i18n/useI18n', () => {
  const t = (value: string) => value
  return { useI18n: () => ({ t }) }
})
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('./SaleDetailsDrawer', () => ({ SaleDetailsDrawer: () => null }))
vi.mock('./MergedSalesDrawer', () => ({ MergedSalesDrawer: () => null }))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({ DataTable: () => null }))

let storage: SalesMutationStorageHarness
let sale: SalesUkraineSale

beforeEach(() => {
  storage = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
  vi.clearAllMocks()
  sale = {
    Id: 10, NetUid: '11111111-1111-4111-8111-111111111111', HasDetails: true,
    BaseLifeCycleStatus: { SaleLifeCycleType: 0 }, RegistrarStorageId: null,
    ClientAgreement: { NetUid: '22222222-2222-4222-8222-222222222222' },
    Order: { OrderSource: 0, OrderItems: [] },
    Transporter: { Id: 1, CssClass: 'self_checkout_item_class' },
  }
  mocks.loadSale.mockImplementation(async () => sale)
  mocks.apiRequest.mockResolvedValue([{ Id: 7, Name: 'Склад А' }, { Id: 9, Name: 'Склад Б' }])
  mocks.updateSale.mockResolvedValue({ message: 'saved', sale })
  mocks.convertVat.mockResolvedValue({ pdfUrl: null, excelUrl: null })
})

afterEach(() => {
  cleanup()
  clearAllSalesPendingMutations()
  storage.dispose()
})

async function openConversion() {
  render(<MantineProvider theme={theme} env="test"><SaleEditorDrawer sale={sale} loadSale={mocks.loadSale} onClose={vi.fn()} /></MantineProvider>)
  const open = await screen.findByRole('button', { name: 'Зробити накладну' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  return screen.findByRole('dialog', { name: 'Зробити накладну' })
}

async function chooseWarehouse(dialog: HTMLElement, name: string) {
  await act(async () => { await Promise.resolve() })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Склад документа' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

async function submitConversion(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Зробити накладну' }))
}

describe('online-shop sale editor document warehouse', () => {
  it.each([false, true])('passes the manager warehouse in the actual VAT=%s conversion request', async isVatSale => {
    sale.IsVatSale = isVatSale
    const dialog = await openConversion()
    await chooseWarehouse(dialog, 'Склад Б')
    await submitConversion(dialog)
    const writer = isVatSale ? mocks.convertVat : mocks.updateSale
    await waitFor(() => expect(writer).toHaveBeenCalledTimes(1))
    expect(writer.mock.calls[0][0]).toMatchObject({ RegistrarStorageId: 9, BaseLifeCycleStatus: { SaleLifeCycleType: 1 } })
    expect(mocks.apiRequest).toHaveBeenCalledWith('/storages/sales-ukraine/edit/document-warehouses',
      expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it.each([0, 2])('blocks posting source %s before creating any mutation without a warehouse', async orderSource => {
    sale.Order = { ...sale.Order, OrderSource: orderSource }
    const dialog = await openConversion()
    await submitConversion(dialog)
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Оберіть склад документа' })))
    expect(mocks.updateSale).not.toHaveBeenCalled()
    expect(mocks.convertVat).not.toHaveBeenCalled()
  })

  it('keeps an existing posted warehouse visible, locked and preserved in the request', async () => {
    sale.ChangedToInvoice = '2026-10-12T10:00:00Z'
    sale.RegistrarStorageId = 7
    const dialog = await openConversion()
    const selector = within(dialog).getByRole('combobox', { name: 'Склад документа' }) as HTMLInputElement
    await waitFor(() => expect(selector.value).toBe('Склад А'))
    expect(selector.disabled).toBe(true)
    await submitConversion(dialog)
    await waitFor(() => expect(mocks.updateSale).toHaveBeenCalledTimes(1))
    expect(mocks.updateSale.mock.calls[0][0].RegistrarStorageId).toBe(7)
  })

  it('preserves the freshly loaded posted warehouse over a stale draft selection', async () => {
    const dialog = await openConversion()
    await chooseWarehouse(dialog, 'Склад Б')
    sale = { ...sale, ChangedToInvoice: '2026-10-12T10:00:00Z', RegistrarStorageId: 7 }
    await submitConversion(dialog)
    await waitFor(() => expect(mocks.updateSale).toHaveBeenCalledTimes(1))
    expect(mocks.updateSale.mock.calls[0][0].RegistrarStorageId).toBe(7)
  })

  it('keeps a historical unknown warehouse unknown when the document was already posted', async () => {
    sale.ChangedToInvoice = '2026-10-12T10:00:00Z'
    const dialog = await openConversion()
    expect((within(dialog).getByRole('combobox', { name: 'Склад документа' }) as HTMLInputElement).disabled).toBe(true)
    await submitConversion(dialog)
    await waitFor(() => expect(mocks.updateSale).toHaveBeenCalledTimes(1))
    expect(mocks.updateSale.mock.calls[0][0].RegistrarStorageId).toBeNull()
  })

  it('reconciles an ambiguous posting with the frozen warehouse and operation key', async () => {
    mocks.updateSale.mockRejectedValueOnce(new ApiError('network unavailable', 503, null))
    const dialog = await openConversion()
    await chooseWarehouse(dialog, 'Склад Б')
    await submitConversion(dialog)
    await waitFor(() => expect(mocks.updateSale).toHaveBeenCalledTimes(1))
    const retry = await within(dialog).findByRole('button', { name: 'Звірити накладну' })
    expect((within(dialog).getByRole('combobox', { name: 'Склад документа' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(retry)
    await waitFor(() => expect(mocks.updateSale).toHaveBeenCalledTimes(2))
    expect(mocks.updateSale.mock.calls[1][0]).toEqual(mocks.updateSale.mock.calls[0][0])
    expect(mocks.updateSale.mock.calls[1][2].operationId).toBe(mocks.updateSale.mock.calls[0][2].operationId)
  })
})
