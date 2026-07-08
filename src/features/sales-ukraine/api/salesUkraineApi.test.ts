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
  searchSalesUkraineClients,
  shiftOrderItemsCurrent,
  updateSaleDiscount,
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

  it('normalizes bundled invoice document aliases returned without URL suffix', async () => {
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: 'http://example.test/payment.xlsx',
      PdfDocumentURL: 'http://example.test/payment.pdf',
      InvoiceDocument: 'http://example.test/invoice.xlsx',
      PdfInvoiceDocument: 'http://example.test/invoice.pdf',
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

  it('normalizes PZ document aliases returned by the PDF print endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'http://example.test/pz.pdf',
      XlsxDocument: 'http://example.test/pz.xlsx',
    })

    await expect(getSalePzDocument('sale-net-id')).resolves.toEqual({
      excelUrl: null,
      invoiceExcelUrl: null,
      invoicePdfUrl: null,
      isAcceptedToPacking: false,
      pdfUrl: 'https://example.test/pz.pdf',
    })
  })

  it('treats the generic PZ document URL as PDF because the endpoint is PDF-only in the UI', async () => {
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: 'http://example.test/pz.pdf',
    })

    await expect(getSalePzDocument('sale-net-id')).resolves.toEqual({
      excelUrl: null,
      invoiceExcelUrl: null,
      invoicePdfUrl: null,
      isAcceptedToPacking: false,
      pdfUrl: 'https://example.test/pz.pdf',
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

  it('does not call the client search endpoint for blank client search values', async () => {
    await expect(searchSalesUkraineClients('   ')).resolves.toEqual([])

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('searches clients through the targeted clients endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'client-1' }])

    await expect(searchSalesUkraineClients(' конкорд ')).resolves.toEqual([{ NetUid: 'client-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 50,
        offset: 0,
        value: 'конкорд',
      },
      signal: undefined,
    })
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

  it('returns the updated sale from the one-time discount endpoint', async () => {
    const sale = {
      NetUid: 'sale-net-id',
      Order: { OrderItems: [{ Id: 1, OneTimeDiscount: 12 }] },
    }

    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'sale-net-id', Order: { OrderItems: [{ Id: 1, OneTimeDiscount: 12 }] } } })

    await expect(updateSaleDiscount(sale)).resolves.toEqual({
      NetUid: 'sale-net-id',
      Order: { OrderItems: [{ Id: 1, OneTimeDiscount: 12 }] },
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/discount/update', {
      body: sale,
      method: 'POST',
    })
  })
})
