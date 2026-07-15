import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  addOrderItem,
  convertVatSaleAndGetPaymentDocument,
  deleteOrderItem,
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
  switchSale,
  updateMergedSale,
  updateOrderItem,
  updateSale,
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
    const operationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'updated-sale-net-id' } })

    await expect(shiftOrderItemsCurrent(sale, { operationId })).resolves.toEqual({ NetUid: 'updated-sale-net-id' })

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/items/shift/current', {
      body: { ...sale, OperationNetUid: operationId },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it('switches a sale with the mandatory stable operation key', async () => {
    const operationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'sale-net-id' } })

    await expect(switchSale('sale-net-id', 'agreement-net-id', { operationId })).resolves.toEqual({
      NetUid: 'sale-net-id',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/switch', {
      headers: { 'Idempotency-Key': operationId },
      method: 'PATCH',
      query: { clientAgreementNetId: 'agreement-net-id', saleNetId: 'sale-net-id' },
    })
  })

  it('returns the updated sale from the one-time discount endpoint', async () => {
    const sale = {
      NetUid: 'sale-net-id',
      Order: { OrderItems: [{ Id: 1, OneTimeDiscount: 12 }] },
    }
    const operationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'sale-net-id', Order: { OrderItems: [{ Id: 1, OneTimeDiscount: 12 }] } } })

    await expect(updateSaleDiscount(sale, { operationId })).resolves.toEqual({
      NetUid: 'sale-net-id',
      Order: { OrderItems: [{ Id: 1, OneTimeDiscount: 12 }] },
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/discount/update', {
      body: { ...sale, OperationNetUid: operationId },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it('sends one authoritative operation id in the add body and idempotency header', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'item-1' })

    await addOrderItem(
      'agreement-1',
      'sale-1',
      { NetUid: '00000000-0000-0000-0000-000000000000', Product: { Id: 7 }, Qty: 2 },
      { operationId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/items/new', {
      body: {
        NetUid: '00000000-0000-0000-0000-000000000000',
        OperationNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        Product: { Id: 7 },
        Qty: 2,
      },
      headers: { 'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      method: 'POST',
      query: { clientAgreementNetId: 'agreement-1', saleNetId: 'sale-1' },
    })
    const request = apiRequestMock.mock.calls[0]?.[1]

    expect((request?.body as { OperationNetUid?: string }).OperationNetUid).toBe(
      new Headers(request?.headers).get('Idempotency-Key'),
    )
  })

  it('uses the same explicit operation contract for update and delete', async () => {
    apiRequestMock.mockResolvedValue(null)
    const operation = { operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }

    await updateOrderItem({ NetUid: 'item-1', Qty: 3 }, operation)
    await deleteOrderItem('item-1', operation)

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/orders/items/update', {
      body: {
        NetUid: 'item-1',
        OperationNetUid: operation.operationId,
        Qty: 3,
      },
      headers: { 'Idempotency-Key': operation.operationId },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/orders/items/delete', {
      headers: { 'Idempotency-Key': operation.operationId },
      method: 'DELETE',
      query: { orderItemNetId: 'item-1' },
    })
  })

  it('sends the canonical merged operation marker equal to the idempotency header', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await updateMergedSale(
      { NetUid: 'sale-1', Order: { OrderItems: [{ NetUid: 'item-1' }] } },
      { operationId: 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC' },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/update/merged', {
      body: {
        NetUid: 'sale-1',
        OperationNetUid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        Order: { OrderItems: [{ NetUid: 'item-1' }] },
      },
      headers: { 'Idempotency-Key': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      method: 'POST',
    })
    const request = apiRequestMock.mock.calls[0]?.[1]

    expect((request?.body as { OperationNetUid?: string }).OperationNetUid).toBe(
      new Headers(request?.headers).get('Idempotency-Key'),
    )
  })

  it('requires the canonical operation marker for the full sale update endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce(null)
    const operationId = 'DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD'

    await updateSale(
      { IsAcceptedToPacking: true, NetUid: 'sale-1' },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/update', {
      body: {
        IsAcceptedToPacking: true,
        NetUid: 'sale-1',
        OperationNetUid: operationId.toLowerCase(),
      },
      headers: { 'Idempotency-Key': operationId.toLowerCase() },
      method: 'POST',
    })
  })

  it('sends the VAT file mutation key in both the header and serialized sale', async () => {
    const operationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    apiRequestMock.mockResolvedValueOnce({ PdfDocumentURL: 'https://example.test/payment.pdf' })

    await convertVatSaleAndGetPaymentDocument(
      { NetUid: 'sale-1' },
      null,
      { operationId },
    )

    const request = apiRequestMock.mock.calls[0]?.[1]
    const body = request?.body as FormData
    const serializedSale = JSON.parse(String(body.get('sale'))) as { OperationNetUid?: string }

    expect(serializedSale.OperationNetUid).toBe(operationId)
    expect(new Headers(request?.headers).get('Idempotency-Key')).toBe(operationId)
  })
})
