import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { accountThreshold, thresholdDataset, thresholdRequest } from '../data/reportThreshold.test-fixtures'
import { reportThresholdError } from '../data/reportThreshold'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
const wire = (Threshold: unknown) => {
  const data = thresholdRequest()
  return { Id: crypto.randomUUID(), Revision: 3, Name: 'Мій поріг', Data: { DataSource: 11, From: null, To: null,
    Sorted: data.sorted, Selections: data.selections, Ordering: data.ordering, FilterExpression: data.filterExpression,
    TopGroups: data.topGroups, AbcClassification: data.abcClassification, Threshold } }
}
it.each([accountThreshold, { ...accountThreshold, Version: 7, Future: true }])('preserves exact threshold, native filters, ABC/TOP and ordering through wire/save/generate transport %#', async Threshold => {
  const original = wire(Threshold)
  vi.mocked(apiRequest).mockResolvedValue([original]); const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual({ ...thresholdRequest(), threshold: Threshold })
  vi.mocked(apiRequest).mockResolvedValue({ ...original, Revision: 4 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: template })
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: template.Data })
})
it('retains both aliases from a conflicting template so validation can refuse it explicitly', async () => {
  const original = wire(accountThreshold)
  vi.mocked(apiRequest).mockResolvedValue([{ ...original, Data: { ...original.Data, threshold: { Version: 99 } } }])
  const [template] = await getServerReportTemplates()
  expect(template.Data.Threshold).toEqual(accountThreshold)
  expect(template.Data.threshold).toEqual({ Version: 99 })
  expect(reportThresholdError(template.Data, thresholdDataset)).toContain('двічі')
})
it.each([{ ...accountThreshold, Sql: 'never executed' }, { ...accountThreshold, Percent: 101 }, { ...accountThreshold, Grouping: 999 }])('blocks invalid browser import before POST without dropping the original %#', async threshold => {
  const template = { Name: 'Оригінал порогу', Data: { ...thresholdRequest(), threshold } }, raw = JSON.stringify([template])
  localStorage.setItem('app_configs_reports_template:v1', raw)
  vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [thresholdDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(result.current.notice).toMatch(/Некорект|некорект|цілий відсоток|початкового поля/)
  expect(readBrowserReportTemplates()).toEqual([template])
  expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
