import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportResaleAvailabilities, getResaleClientAgreements } from './resalesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('resales API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('exports resale availability documents with PDF-first aliases preserved', async () => {
    const payload = {
      Amount: 0,
      ExtraChargePercent: 0,
      From: '2026-07-07T12:00:00',
      IncludedProductGroups: [1, 2],
      IncludedSpecificationCodes: ['3403199090'],
      IncludedStorages: [3],
      PossibleAmountDistinct: 0,
      Search: 'SEM',
      To: '2026-07-07T23:59:59',
    }

    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/resale.pdf',
      XlsxDocument: 'https://example.test/resale.xlsx',
    })

    await expect(exportResaleAvailabilities(payload)).resolves.toEqual({
      DocumentURL: 'https://example.test/resale.xlsx',
      PdfDocumentURL: 'https://example.test/resale.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/resales/document/resale', {
      body: payload,
      method: 'POST',
    })
  })

  it('loads selected client agreements without debt aggregates', async () => {
    const controller = new AbortController()
    const agreement = {
      Id: 361078,
      NetUid: 'bfb9f4ab-7868-45af-8cde-ab9ee74a68b1',
      Agreement: {
        ForReSale: true,
        IsActive: true,
        OrganizationId: 365,
      },
    }

    apiRequestMock.mockResolvedValueOnce({ Items: [agreement] })

    await expect(getResaleClientAgreements('client-net-id', controller.signal)).resolves.toEqual([agreement])
    expect(apiRequestMock).toHaveBeenCalledWith('/agreements/client/all', {
      query: {
        includeDebts: false,
        netId: 'client-net-id',
      },
      signal: controller.signal,
    })
  })
})
