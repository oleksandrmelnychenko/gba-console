import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { clientActivityDataset, clientActivityRequest } from '../data/clientActivity.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
it('reads source12 caps and preserves exact period, contracts, disabled filter, OR indices and count through template/request transport', async () => {
  vi.mocked(apiRequest).mockResolvedValue([clientActivityDataset]); expect(await getReportDatasets()).toEqual([clientActivityDataset])
  const data = clientActivityRequest(), original = { Id: crypto.randomUUID(), Revision: 3, Name: 'Клієнти за договорами', Data: {
    DataSource: 12, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, Ordering: data.ordering, FilterExpression: data.filterExpression } }
  vi.mocked(apiRequest).mockResolvedValue([original]); const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual(data)
  vi.mocked(apiRequest).mockResolvedValue({ ...original, Revision: 4 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: template })
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: data })
})
it.each([{ PeriodRequired: false }, { PeriodRequired: undefined }, { PeriodSupported: false }, { PeriodSupported: undefined }])('refuses source12 without declared explicit period capabilities %#', async patch => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...clientActivityDataset, ...patch }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})
it('routes exact contract lookup through native source12 endpoint, retaining distinct binding IDs despite same terms', async () => {
  const entities = clientActivityRequest().selections.slice(0, 2).map(selection => ({ ...selection.Values[0].Data, Name: selection.Values[0].Name }))
  vi.mocked(apiRequest).mockResolvedValue(entities)
  expect(await searchDatasetReportValues(12, 9, { limit: 30, offset: 0, value: 'a' })).toEqual(entities)
  expect(apiRequest).toHaveBeenCalledWith('/report/datasets/lookup', { query: { dataSource: 12, field: 9, limit: 30, offset: 0, value: 'a' }, signal: undefined })
})
it.each([{ from: '' }, { valuationClientAgreementId: 456246 }, { hideZero: { Version: 1 } }, { topGroups: { Version: 1, Axis: 1, Grouping: 12, Mode: 1, Value: 10, Measure: 25, Direction: 2 } }])(
  'refuses invalid source12 browser import before POST while preserving original %#', async patch => {
    const template = { Name: 'Поточні клієнти', Data: { ...clientActivityRequest(), ...patch } }, raw = JSON.stringify([template])
    localStorage.setItem('app_configs_reports_template:v1', raw); vi.mocked(apiRequest).mockResolvedValue([])
    const { result } = renderHook(() => useServerReportTemplates(true, [clientActivityDataset]))
    await waitFor(() => expect(result.current.ready).toBe(true)); await act(() => result.current.importBrowserTemplate(template))
    expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
    expect(result.current.notice).toBeTruthy(); expect(readBrowserReportTemplates()).toEqual([template])
    expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
  })
