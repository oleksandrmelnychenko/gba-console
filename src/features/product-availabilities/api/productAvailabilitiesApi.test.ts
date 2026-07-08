import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportProductAvailabilities } from './productAvailabilitiesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productAvailabilitiesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('exports availability documents with PDF-first aliases preserved', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/availabilities.pdf',
      XlsxDocument: 'https://example.test/availabilities.xlsx',
    })

    await expect(exportProductAvailabilities({
      from: '2026-06-30T00:00:00',
      storageNetId: 'storage-1',
      to: '2026-07-07T23:59:59',
      vendorCode: ' SEM ',
    })).resolves.toEqual({
      DocumentURL: 'https://example.test/availabilities.xlsx',
      PdfDocumentURL: 'https://example.test/availabilities.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/availability/filtered/export', {
      query: {
        from: '2026-06-30T00:00:00',
        storageNetId: 'storage-1',
        to: '2026-07-07T23:59:59',
        vendorCode: 'SEM',
      },
    })
  })
})
