import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSpecificationDownloadUrls } from './protocolSpecificationApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('protocol specification API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('normalizes specification download documents with PDF-first aliases', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/specification.pdf',
      XlsxDocument: 'https://example.test/specification.xlsx',
    })

    await expect(getSpecificationDownloadUrls('pack-list-net-id')).resolves.toEqual({
      DocumentURL: 'https://example.test/specification.xlsx',
      PdfDocumentURL: 'https://example.test/specification.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/packinglists/specification/get', {
      query: {
        netId: 'pack-list-net-id',
      },
    })
  })
})
