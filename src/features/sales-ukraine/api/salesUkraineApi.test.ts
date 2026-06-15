import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getSaleActForEditingHistoryDocument,
  getSaleActProtocolEditDocument,
  getSaleById,
  getSaleInvoiceDocument,
  getSaleInvoiceHistoryDocument,
  getSalePaymentDocument,
  getSalePzDocument,
  getSaleShipmentListDocument,
  getSaleShipmentListHistoryDocument,
  getShiftedSaleById,
  shiftOrderItemsCurrent,
} from './salesUkraineApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sales Ukraine document request contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it.each([
    ['current invoice', () => getSaleInvoiceDocument('sale-net-id'), '/sales/get/last/document', { netId: 'sale-net-id' }],
    ['shipment list', () => getSaleShipmentListDocument('sale-net-id'), '/sales/shipment/list/print/documents', { netId: 'sale-net-id' }],
    ['payment document', () => getSalePaymentDocument('sale-net-id'), '/sales/get/payment/document', { netId: 'sale-net-id' }],
    ['PZ document', () => getSalePzDocument('sale-net-id'), '/sales/get/document/pz', { netId: 'sale-net-id' }],
    [
      'invoice history',
      () => getSaleInvoiceHistoryDocument('sale-net-id', 'history-net-id'),
      '/sales/get/document/history',
      { historyNetId: 'history-net-id', netId: 'sale-net-id' },
    ],
    [
      'current act edit',
      () => getSaleActProtocolEditDocument('sale-net-id'),
      '/sales/get/shifted/document',
      { netId: 'sale-net-id' },
    ],
    [
      'act edit history',
      () => getSaleActForEditingHistoryDocument('sale-net-id', 'history-net-id'),
      '/sales/get/shifted/hisotry/document',
      { historyNetId: 'history-net-id', netId: 'sale-net-id' },
    ],
    [
      'shipment list history',
      () => getSaleShipmentListHistoryDocument('sale-net-id', 'history-net-id'),
      '/sales/shipment/list/print/documents/history',
      { historyNetId: 'history-net-id', netId: 'sale-net-id' },
    ],
  ])('requests %s through the legacy-compatible endpoint', async (_label, request, path, query) => {
    apiRequestMock.mockResolvedValueOnce({ PdfDocumentURL: 'https://example.test/document.pdf' })

    await request()

    expect(apiRequestMock).toHaveBeenCalledWith(path, { query })
  })

  it('normalizes bundled payment and invoice document URLs', async () => {
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: 'http://example.test/payment.xlsx',
      PdfDocumentURL: 'http://example.test/payment.pdf',
      InvoiceDocumentURL: 'http://example.test/invoice.xlsx',
      PdfInvoiceDocumentURL: 'http://example.test/invoice.pdf',
      IsAcceptedToPacking: true,
    })

    await expect(getSalePaymentDocument('sale-net-id')).resolves.toEqual({
      excelUrl: 'https://example.test/payment.xlsx',
      invoiceExcelUrl: 'https://example.test/invoice.xlsx',
      invoicePdfUrl: 'https://example.test/invoice.pdf',
      isAcceptedToPacking: true,
      pdfUrl: 'https://example.test/payment.pdf',
    })
  })

  it('loads the edit-shift sale through the shifted legacy endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Sale: {
        NetUid: 'sale-net-id',
        Order: { OrderItems: [] },
      },
    })

    await expect(getShiftedSaleById('sale-net-id')).resolves.toEqual({
      NetUid: 'sale-net-id',
      Order: { OrderItems: [] },
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/get/shifted', { query: { netId: 'sale-net-id' } })
  })

  it('loads sale by id from the sale statistic envelope', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Sale: {
        NetUid: 'sale-net-id',
        Order: { OrderItems: [{ NetUid: 'order-item-1' }] },
      },
    })

    await expect(getSaleById('sale-net-id')).resolves.toEqual({
      NetUid: 'sale-net-id',
      Order: { OrderItems: [{ NetUid: 'order-item-1' }] },
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/get', { query: { netId: 'sale-net-id' } })
  })

  it('posts edit-shift payload to the current shift endpoint', async () => {
    const sale = { NetUid: 'sale-net-id' }

    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'updated-sale-net-id' } })

    await expect(shiftOrderItemsCurrent(sale)).resolves.toEqual({ NetUid: 'updated-sale-net-id' })

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/items/shift/current', {
      body: sale,
      method: 'POST',
    })
  })
})
