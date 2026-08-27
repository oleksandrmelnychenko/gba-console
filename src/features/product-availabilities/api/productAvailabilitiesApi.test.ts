import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportProductAvailabilities, getProductAvailabilities } from './productAvailabilitiesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productAvailabilitiesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads all active warehouse lots when no date range is selected', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Availabilities: [{
        Id: 42,
        Placements: null,
        Qty: 3,
        StorageNetId: 'storage-3',
        VendorCode: '6707-01',
      }],
      Total: 1,
    })

    await expect(getProductAvailabilities({
      limit: 500,
      offset: 0,
      storageNetId: 'storage-3',
      vendorCode: ' 6707-01 ',
    })).resolves.toEqual({
      Availabilities: [{
        Id: 42,
        Placements: [],
        Qty: 3,
        StorageNetId: 'storage-3',
        VendorCode: '6707-01',
      }],
      Total: 1,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/product-availabilities/registry', {
      query: {
        from: undefined,
        limit: 500,
        offset: 0,
        storageNetId: 'storage-3',
        to: undefined,
        vendorCode: '6707-01',
      },
    })
  })

  it('exports availability documents with PDF-first aliases preserved', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/availabilities.pdf',
      XlsxDocument: 'https://example.test/availabilities.xlsx',
    })

    await expect(exportProductAvailabilities({
      from: ' 2026-06-30 ',
      storageNetId: 'storage-1',
      to: ' 2026-07-07 ',
      vendorCode: ' SEM ',
    })).resolves.toEqual({
      DocumentURL: 'https://example.test/availabilities.xlsx',
      PdfDocumentURL: 'https://example.test/availabilities.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/product-availabilities/export', {
      query: {
        from: '2026-06-30',
        storageNetId: 'storage-1',
        to: '2026-07-07',
        vendorCode: 'SEM',
      },
    })
  })
})
