import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportResaleAvailabilities } from './resalesApi'

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
})
