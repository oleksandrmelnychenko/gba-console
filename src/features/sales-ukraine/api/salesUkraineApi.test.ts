import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  acceptSaleForPacking,
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
  unlockSale,
  updateMergedSale,
  updateOrderItem,
  updateSale,
  updateSaleDiscount,
} from './salesUkraineApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const paymentDocumentOperation = {
  operationId: '9b316272-8d8c-4d6d-95a4-6eea9a79d7d6',
}

describe('sales Ukraine document request contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('accepts an invoiced sale for packing through the dedicated idempotent endpoint', async () => {
    const saleNetId = 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae'
    const acceptedSale = { IsAcceptedToPacking: true, NetUid: saleNetId }

    apiRequestMock.mockResolvedValueOnce(acceptedSale)

    await expect(acceptSaleForPacking(saleNetId, paymentDocumentOperation)).resolves.toEqual(acceptedSale)

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/accept-for-packing', {
      headers: { 'Idempotency-Key': paymentDocumentOperation.operationId },
      method: 'PATCH',
      query: { netId: saleNetId },
      signal: undefined,
    })
  })

  it('returns the unlocked sale supplied by the mutation response', async () => {
    const saleNetId = 'dc8d6ccc-e2f3-4011-a73f-9be8a570b2ae'
    const unlockedSale = { IsAcceptedToPacking: true, IsLocked: false, NetUid: saleNetId }

    apiRequestMock.mockResolvedValueOnce(unlockedSale)

    await expect(unlockSale(saleNetId, paymentDocumentOperation)).resolves.toEqual(unlockedSale)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/unlock', {
      headers: { 'Idempotency-Key': paymentDocumentOperation.operationId },
      method: 'PATCH',
      query: { netId: saleNetId },
      signal: undefined,
    })
  })

  it.each([
    ['current invoice', () => getSaleInvoiceDocument('sale-net-id'), '/sales/get/last/document', { netId: 'sale-net-id' }],
    ['shipment list', () => getSaleShipmentListDocument('sale-net-id'), '/sales/shipment/list/print/documents', { netId: 'sale-net-id' }],
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

    await expect(getSalePaymentDocument('sale-net-id', paymentDocumentOperation)).resolves.toEqual({
      excelUrl: 'https://example.test/payment.xlsx',
      invoiceExcelUrl: 'https://example.test/invoice.xlsx',
      invoicePdfUrl: 'https://example.test/invoice.pdf',
      isAcceptedToPacking: true,
      pdfUrl: 'https://example.test/payment.pdf',
    })
  })

  it('sends a stable idempotency key when payment document generation is an explicit console operation', async () => {
    apiRequestMock.mockResolvedValueOnce({})

    await getSalePaymentDocument('sale-net-id', {
      operationId: '9B316272-8D8C-4D6D-95A4-6EEA9A79D7D6',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/get/payment/document', {
      headers: {
        'Idempotency-Key': '9b316272-8d8c-4d6d-95a4-6eea9a79d7d6',
      },
      query: { netId: 'sale-net-id' },
    })
  })

  it('requires an operation before either payment-document request reaches the API client', async () => {
    const getWithoutOperation = () => {
      // @ts-expect-error Payment-document generation requires an operation.
      return getSalePaymentDocument('sale-net-id')
    }
    const convertWithoutOperation = () => {
      // @ts-expect-error Payment-document finalization requires an operation.
      return convertVatSaleAndGetPaymentDocument({ NetUid: 'sale-net-id' }, null)
    }

    await expect(getWithoutOperation()).rejects.toThrow()
    await expect(convertWithoutOperation()).rejects.toThrow()
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('normalizes bundled invoice document aliases returned without URL suffix', async () => {
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: 'http://example.test/payment.xlsx',
      PdfDocumentURL: 'http://example.test/payment.pdf',
      InvoiceDocument: 'http://example.test/invoice.xlsx',
      PdfInvoiceDocument: 'http://example.test/invoice.pdf',
      IsAcceptedToPacking: true,
    })

    await expect(getSalePaymentDocument('sale-net-id', paymentDocumentOperation)).resolves.toEqual({
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
    const saleNetUid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const agreementNetUid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: saleNetUid } })

    await expect(switchSale(saleNetUid, agreementNetUid, { operationId })).resolves.toEqual({
      NetUid: saleNetUid,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/switch', {
      headers: { 'Idempotency-Key': operationId },
      method: 'PATCH',
      query: { clientAgreementNetId: agreementNetUid, saleNetId: saleNetUid },
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
    const agreementNetUid = '11111111-1111-4111-8111-111111111111'
    const saleNetUid = '22222222-2222-4222-8222-222222222222'
    const productNetUid = '33333333-3333-4333-8333-333333333333'

    await addOrderItem(
      agreementNetUid,
      saleNetUid,
      {
        NetUid: '00000000-0000-0000-0000-000000000000',
        Product: { Id: 7, NetUid: productNetUid },
        Qty: 2,
      },
      { operationId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/items/new', {
      body: {
        NetUid: '00000000-0000-0000-0000-000000000000',
        OperationNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        Product: { Id: 7, NetUid: productNetUid },
        Qty: 2,
      },
      headers: { 'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      method: 'POST',
      query: { clientAgreementNetId: agreementNetUid, saleNetId: saleNetUid },
    })
    const request = apiRequestMock.mock.calls[0]?.[1]

    expect((request?.body as { OperationNetUid?: string }).OperationNetUid).toBe(
      new Headers(request?.headers).get('Idempotency-Key'),
    )
  })

  it('uses the same explicit operation contract for update and delete', async () => {
    apiRequestMock.mockResolvedValue(null)
    const operation = { operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
    const orderItemNetUid = '11111111-1111-4111-8111-111111111111'

    await updateOrderItem({ NetUid: orderItemNetUid, Qty: 3 }, operation)
    await deleteOrderItem(orderItemNetUid, operation)

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/orders/items/update', {
      body: {
        NetUid: orderItemNetUid,
        OperationNetUid: operation.operationId,
        Qty: 3,
      },
      headers: { 'Idempotency-Key': operation.operationId },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/orders/items/delete', {
      headers: { 'Idempotency-Key': operation.operationId },
      method: 'DELETE',
      query: { orderItemNetId: orderItemNetUid },
    })
  })

  it.each([
    [{ NetUid: '', Qty: 1 }, 'Позиція товару не має збереженого ідентифікатора'],
    [{ NetUid: '00000000-0000-0000-0000-000000000000', Qty: 1 }, 'Позиція товару не має збереженого ідентифікатора'],
    [{ NetUid: '11111111-1111-4111-8111-111111111111', Qty: 0 }, 'Кількість товару має бути більшою за нуль'],
    [{ NetUid: '11111111-1111-4111-8111-111111111111', Qty: Number.NaN }, 'Кількість товару має бути більшою за нуль'],
  ])('blocks an invalid order-item update before the API boundary', async (orderItem, message) => {
    await expect(updateOrderItem(orderItem, {
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })).rejects.toThrow(message)
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it.each(['', 'not-a-guid', '00000000-0000-0000-0000-000000000000'])(
    'blocks an invalid order-item delete before the API boundary',
    async (orderItemNetUid) => {
      await expect(deleteOrderItem(orderItemNetUid, {
        operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      })).rejects.toThrow('Позиція товару не має збереженого ідентифікатора')
      expect(apiRequestMock).not.toHaveBeenCalled()
    },
  )

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

  it('polls the durable operation instead of submitting the finalized sale twice', async () => {
    vi.useFakeTimers()
    const operationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    apiRequestMock
      .mockResolvedValueOnce({
        IsCompleted: false,
        OperationNetUid: operationId,
        Status: 'processing',
      })
      .mockResolvedValueOnce({
        InvoiceDocumentURL: 'https://example.test/invoice.xlsx',
        PdfInvoiceDocumentURL: 'https://example.test/invoice.pdf',
        Status: 'completed',
      })

    try {
      const resultPromise = convertVatSaleAndGetPaymentDocument(
        { NetUid: 'sale-1' },
        null,
        { operationId },
      )
      await vi.advanceTimersByTimeAsync(1_000)

      await expect(resultPromise).resolves.toMatchObject({
        invoiceExcelUrl: 'https://example.test/invoice.xlsx',
        invoicePdfUrl: 'https://example.test/invoice.pdf',
      })
      expect(apiRequestMock).toHaveBeenCalledTimes(2)
      expect(apiRequestMock.mock.calls[1]).toEqual([
        '/sales/update/get/payment/document',
        { query: { operationNetUid: operationId } },
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})
