import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { hideZeroDataset, hideZeroRequest } from '../data/reportHideZero.test-fixtures'
import { reportHideZeroError } from '../data/reportHideZero'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
const wire = (HideZero: unknown) => {
  const data = hideZeroRequest()
  return { Id: crypto.randomUUID(), Revision: 3, Name: 'Мої приховані нулі', Data: { DataSource: 11, From: null, To: null,
    Sorted: data.sorted, Selections: data.selections, Ordering: data.ordering, FilterExpression: data.filterExpression,
    TopGroups: data.topGroups, AbcClassification: data.abcClassification, Threshold: data.threshold, HideZero } }
}
it.each([{ Version: 1 }, { Version: 7, Future: true }])('preserves exact hideZero, native filters, ABC/TOP and ordering through wire/save/generate transport %#', async HideZero => {
  const original = wire(HideZero)
  vi.mocked(apiRequest).mockResolvedValue([original]); const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual({ ...hideZeroRequest(), hideZero: HideZero })
  vi.mocked(apiRequest).mockResolvedValue({ ...original, Revision: 4 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: template })
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: template.Data })
})
it('retains both aliases from a conflicting template so validation can refuse it explicitly', async () => {
  const original = wire({ Version: 1 })
  vi.mocked(apiRequest).mockResolvedValue([{ ...original, Data: { ...original.Data, hideZero: { Version: 99 } } }])
  const [template] = await getServerReportTemplates()
  expect(template.Data.HideZero).toEqual({ Version: 1 })
  expect(template.Data.hideZero).toEqual({ Version: 99 })
  expect(reportHideZeroError(template.Data, hideZeroDataset)).toContain('двічі')
})
it.each([{ Version: 1, Sql: 'never executed' }, { Version: "1" }, { Version: 1, Grouping: 42 }])('blocks invalid browser import before POST without dropping the original %#', async hideZero => {
  const template = { Name: 'Оригінал приховування нулів', Data: { ...hideZeroRequest(), hideZero } }, raw = JSON.stringify([template])
  localStorage.setItem('app_configs_reports_template:v1', raw)
  vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [hideZeroDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(result.current.notice).toMatch(/Некорект|некорект|невідома версія/)
  expect(readBrowserReportTemplates()).toEqual([template])
  expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
