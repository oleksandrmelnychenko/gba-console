import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportAccountingCashFlowDocument } from './accountingCashFlowApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('accountingCashFlowApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('accepts the shared export document shapes returned by the server', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/cash-flow.pdf',
      XlsxDocument: 'https://example.test/cash-flow.xlsx',
    })

    await expect(
      exportAccountingCashFlowDocument({
        from: '2026-07-01',
        netId: 'client-1',
        to: '2026-07-08',
      }),
    ).resolves.toEqual({
      DocumentURL: 'https://example.test/cash-flow.xlsx',
      PdfDocumentURL: 'https://example.test/cash-flow.pdf',
    })
  })

  it('fails loudly when the export endpoint does not return a document URL', async () => {
    apiRequestMock.mockResolvedValueOnce({})

    await expect(
      exportAccountingCashFlowDocument({
        from: '2026-07-01',
        netId: 'client-1',
        to: '2026-07-08',
      }),
    ).rejects.toThrow('Не вдалося сформувати документ взаєморозрахунків')
  })
})
