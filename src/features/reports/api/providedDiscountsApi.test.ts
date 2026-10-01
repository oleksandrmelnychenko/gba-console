import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { saveServerReportTemplate } from './reportWorkspaceApi'
import { providedDiscountRequest } from '../data/providedDiscounts.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
describe('current provided discounts API binding', () => {
  beforeEach(() => vi.clearAllMocks())
  it('passes explicit current basis and genuine native Source identity to one bounded lookup', async () => {
    const signal = new AbortController().signal, Id = '4'.repeat(32)
    vi.mocked(apiRequest).mockResolvedValue([{ Id, Name: 'Наш товар' }])
    expect(await searchDatasetReportValues(24, 41, { value: ' товар ', offset: 2, limit: 30 }, signal, 1, undefined, 0))
      .toEqual([{ Id, Name: 'Наш товар' }])
    expect(apiRequest).toHaveBeenCalledWith('/report/datasets/lookup', {
      query: { dataSource: 24, field: 41, value: 'товар', offset: 2, limit: 30, sourceWorld: 1, providedDiscountBasis: 0 }, signal,
    })
    vi.clearAllMocks()
    await expect(searchDatasetReportValues(24, 41, { value: '', offset: 0, limit: 30 }, signal, 2, undefined, 0)).rejects.toThrow(/основа/)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('keeps same request basis for generation, preview and template save and rejects invalid basis before networking', async () => {
    const request = providedDiscountRequest(0)
    vi.mocked(apiRequest).mockResolvedValue({})
    await createStockReport(request)
    expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toMatchObject({ providedDiscounts: { Basis: 0 } })
    vi.mocked(apiRequest).mockResolvedValue({ Preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
      Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
      RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
    await previewStockReport(request)
    expect(vi.mocked(apiRequest).mock.calls[1][1]?.body).toMatchObject({ providedDiscounts: { Basis: 0 } })
    vi.mocked(apiRequest).mockResolvedValue({ Id: 'saved', Revision: 1, Name: 'Знижки', UpdatedAtUtc: '2026-10-01T00:00:00Z',
      Data: { DataSource: 24, From: request.from, To: request.to, Sorted: request.sorted, ProvidedDiscounts: request.providedDiscounts } })
    await saveServerReportTemplate({ Name: 'Знижки', Data: request })
    expect(vi.mocked(apiRequest).mock.calls[2][1]?.body).toMatchObject({ Data: { providedDiscounts: { Basis: 0 } } })
    vi.clearAllMocks()
    await expect(createStockReport({ ...request, providedDiscounts: { Version: 1, SourceWorld: 1, Basis: 9 } })).rejects.toThrow(/основа/)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
