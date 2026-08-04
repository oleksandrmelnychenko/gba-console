import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getSpecificationDownloadUrls,
  uploadProductSpecificationForInvoice,
} from './protocolSpecificationApi'

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

  it('submits the customs declaration date with a specification import', async () => {
    apiRequestMock.mockResolvedValueOnce({ SuccessfullyUpdatedProducts: [] })
    const file = new File(['sheet'], 'customs.xlsx')

    await uploadProductSpecificationForInvoice(
      'invoice-net-id',
      {
        CustomsValue: 2,
        Duty: 3,
        EndRow: 10,
        Price: 4,
        Qty: 5,
        SpecificationCode: 6,
        StartRow: 2,
        VATValue: 7,
        VendorCode: 1,
      },
      '2026-08-01',
      file,
    )

    const [, options] = apiRequestMock.mock.calls[0] ?? []
    const formData = options?.body as FormData

    expect(formData.get('dateCustomDeclaration')).toBe('2026-08-01')
    expect(formData.get('file')).toBe(file)
  })
})
