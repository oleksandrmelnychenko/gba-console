import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportDataset } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.mocked(apiRequest).mockReset())

const dataset: ReportDataset = { DataSource: 23, Name: 'Знижки', Description: 'Fenix',
  Groupings: [57, 55, 53].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [{ Type: 64, Name: 'Знижка' }], Filters: [], Limitations: [],
  PeriodRequired: false, PeriodSupported: false,
  discountMarkup: { Version: 1, SourceWorlds: [1, 2] } }

it('requires a selected source world for specialized exact lookups and preserves string IDs', async () => {
  const params = { value: 'товар', offset: 0, limit: 30 }
  await expect(searchDatasetReportValues(23, 45, params)).rejects.toThrow(/базу/)
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: '0xA0000000000000000000000000000001', Name: 'Товар' }])
  await expect(searchDatasetReportValues(23, 45, params, undefined, 2)).resolves.toHaveLength(1)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/datasets/lookup', {
    query: { dataSource: 23, field: 45, value: 'товар', offset: 0, limit: 30, sourceWorld: 2 }, signal: undefined,
  })
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: 1, Name: 'Втрачений ID' }])
  await expect(searchDatasetReportValues(23, 45, params, undefined, 1)).rejects.toThrow(/некоректні значення/)
  await expect(searchDatasetReportValues(28, 45, params, undefined, 2)).rejects.toThrow(/базу/)
})

it('validates specialized generation and retains settings when a saved template is reloaded', async () => {
  const data = defaultDatasetRequest(dataset, '', '')
  data.discountMarkup = { Version: 1, SourceWorld: 1, DateEnd: '2026-09-21' }
  const original = structuredClone(data)
  vi.mocked(apiRequest).mockResolvedValueOnce({ DocumentURL: '/report/discount.xlsx' })
  await createStockReport(data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', dedupe: false, body: original })
  expect(data).toEqual(original)
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Знижки', Data: {
    DataSource: 23, From: null, To: null, Sorted: data.sorted, Selections: [], DiscountMarkup: data.discountMarkup,
  } }
  vi.mocked(apiRequest).mockResolvedValueOnce([wire])
  const [loaded] = await getServerReportTemplates()
  expect(loaded.Data.DiscountMarkup).toEqual(data.discountMarkup)
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...wire, Revision: 2 })
  expect((await saveServerReportTemplate(loaded)).Revision).toBe(2)
  const sent = vi.mocked(apiRequest).mock.calls.at(-1)?.[1]?.body as { Data: { DiscountMarkup: unknown } }
  expect(sent.Data.DiscountMarkup).toEqual(data.discountMarkup)
  expect(sent.Data.DiscountMarkup).not.toBe(loaded.Data.DiscountMarkup)
  vi.mocked(apiRequest).mockClear()
  await expect(createStockReport({ ...data, discountMarkup: { Version: 1, SourceWorld: 3, DateEnd: '2026-09-21' } })).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
})
