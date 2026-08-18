import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  changeTaxFreeDocumentStatus,
  createIncomePaymentFromTaxFree,
  createTaxFreeCashflowArticle,
  getTaxFreeCarrier,
  getTaxFreeDocument,
  getTaxFreeDocuments,
  getTaxFreePrintDocument,
  updateTaxFreeDocument,
} from './taxFreeDocumentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('taxFreeDocumentsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads tax free documents from wrapped collection payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Collection: [
          {
            NetUid: 'tax-free-1',
            TaxFreeItems: null,
          },
        ],
        TotalRowsQty: 5,
      },
    })

    const result = await getTaxFreeDocuments({
      from: '2025-01-01',
      limit: 21,
      offset: 0,
      status: '',
      stathamNetId: '',
      to: '2026-06-08',
      value: '',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/taxfree/registry', {
      query: {
        from: '2025-01-01T00:00:00.000',
        limit: 21,
        offset: 0,
        status: '',
        stathamNetId: '',
        to: '2026-06-08T23:59:59.999',
        value: '',
      },
    })
    expect(result.Total).toBe(5)
    expect(result.Items).toEqual([
      expect.objectContaining({
        NetUid: 'tax-free-1',
        TaxFreeItems: [],
      }),
    ])
  })

  it('loads a carrier from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'carrier-1',
        LastName: 'Driver',
      },
    })

    const result = await getTaxFreeCarrier('carrier-1')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/carriers/statham/tax-free-documents/details', {
      query: {
        netId: 'carrier-1',
      },
    })
    expect(result).toEqual({ NetUid: 'carrier-1', LastName: 'Driver' })
  })

  it('normalizes tax free print document links from wrapped payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        DocumentURL: ' http://example.test/tax-free.xlsx ',
        PdfDocumentURL: 'http://example.test/tax-free.pdf',
      },
    })

    await expect(getTaxFreePrintDocument('tax-free-1')).resolves.toEqual({
      DocumentURL: 'http://example.test/tax-free.xlsx',
      PdfDocumentURL: 'http://example.test/tax-free.pdf',
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/taxfree/document/export', {
      query: {
        netId: 'tax-free-1',
      },
    })
  })

  it('uses one stable idempotency key for Tax Free income creation', async () => {
    const operationId = '33333333-3333-4333-8333-333333333333'
    const payment = {
      Amount: 100,
      ClientAgreement: { Id: 12 },
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'income-1' })

    await createIncomePaymentFromTaxFree(
      'tax-free-1',
      payment,
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/orders/income/tax-free-documents/new',
      {
        body: payment,
        dedupe: false,
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
        query: {
          taxFreeNetId: 'tax-free-1',
        },
      },
    )
  })

  it('uses independently protected details, edit, status and article routes', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ Body: { NetUid: 'tax-free-1', TaxFreeItems: null } })
      .mockResolvedValueOnce({ Body: { NetUid: 'tax-free-1', CustomCode: 'EDIT', TaxFreeItems: [] } })
      .mockResolvedValueOnce({ Body: { NetUid: 'tax-free-1', TaxFreeStatus: 3, TaxFreeItems: [] } })
      .mockResolvedValueOnce({ Body: { NetUid: 'movement-1', OperationName: 'Tax Free' } })

    await expect(getTaxFreeDocument('tax-free-1')).resolves.toEqual({
      NetUid: 'tax-free-1',
      TaxFreeItems: [],
    })
    await updateTaxFreeDocument({ NetUid: 'tax-free-1' })
    await changeTaxFreeDocumentStatus({ NetUid: 'tax-free-1', TaxFreeStatus: 3 })
    await expect(createTaxFreeCashflowArticle('Tax Free')).resolves.toEqual({
      NetUid: 'movement-1',
      OperationName: 'Tax Free',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/order/taxfree/details', {
      query: { netId: 'tax-free-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/order/taxfree/edit', {
      body: { NetUid: 'tax-free-1' },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/supplies/ukraine/order/taxfree/status/change', {
      body: { NetUid: 'tax-free-1', TaxFreeStatus: 3 },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/payments/movements/accounting/new', {
      body: { OperationName: 'Tax Free' },
      method: 'POST',
    })
  })
})
