import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportProductCapitalization, getProductCapitalizations } from './productCapitalizationsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productCapitalizationsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('does not synthesize a total from plain list responses', async () => {
    apiRequestMock.mockResolvedValueOnce([
      { NetUid: 'capitalization-1' },
      { NetUid: 'capitalization-2' },
    ])

    const result = await getProductCapitalizations({
      from: '2026-01-01T00:00:00',
      limit: 2,
      offset: 0,
      to: '2026-01-31T23:59:59',
    })

    expect(result.Items).toHaveLength(2)
    expect(result.Total).toBeNull()
  })

  it('keeps explicit totals from paged responses', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Items: [{ NetUid: 'capitalization-1' }],
      Total: 42,
    })

    const result = await getProductCapitalizations({
      from: '2026-01-01T00:00:00',
      limit: 20,
      offset: 0,
      to: '2026-01-31T23:59:59',
    })

    expect(result.Items).toHaveLength(1)
    expect(result.Total).toBe(42)
  })

  it('exports capitalization documents with PDF-first aliases preserved', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/capitalization.pdf',
      XlsxDocument: 'https://example.test/capitalization.xlsx',
    })

    await expect(exportProductCapitalization('capitalization-1')).resolves.toEqual({
      DocumentURL: 'https://example.test/capitalization.xlsx',
      PdfDocumentURL: 'https://example.test/capitalization.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/capitalizations/document/export', {
      query: {
        netId: 'capitalization-1',
      },
    })
  })
})
