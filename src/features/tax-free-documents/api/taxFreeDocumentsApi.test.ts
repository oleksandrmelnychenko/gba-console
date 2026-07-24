import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createAdvancePaymentFromTaxFree,
  createIncomePaymentFromTaxFree,
  getTaxFreeCarrier,
  getTaxFreeDocuments,
  getTaxFreePrintDocument,
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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/taxfree/all/filtered', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/carriers/statham/get', {
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
    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/taxfree/documents/printing/get', {
      query: {
        netId: 'tax-free-1',
      },
    })
  })

  it('delegates Tax Free advance creation with a client agreement', async () => {
    const payload = {
      Amount: 100,
      ClientAgreement: { Id: 12 },
      Comment: '',
      FromDate: '2026-07-24T00:00:00.000Z',
      Organization: { Id: 1 },
      VatAmount: 20,
      VatPercent: 20,
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'advance-1' })

    await createAdvancePaymentFromTaxFree('tax-free-1', payload)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/advance/new', {
      method: 'POST',
      query: {
        taxFreeNetId: 'tax-free-1',
      },
      body: payload,
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
      '/payments/orders/income/new/taxfree',
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
})
