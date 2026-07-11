import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getPzDocumentBySupplyInvoiceId } from './protocolProductIncomeApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('protocol product income API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests the PZ document without unsupported locale or document-type selectors', async () => {
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: 'https://example.test/pz.xlsx',
      PdfDocumentURL: 'https://example.test/pz.pdf',
    })

    await expect(getPzDocumentBySupplyInvoiceId('invoice-net-id')).resolves.toEqual({
      DocumentURL: 'https://example.test/pz.xlsx',
      PdfDocumentURL: 'https://example.test/pz.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/invoices/get/documents/pz', {
      query: { netId: 'invoice-net-id' },
    })
  })
})
