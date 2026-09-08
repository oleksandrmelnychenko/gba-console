import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { accountTop, topDataset, topRequest } from '../data/reportTopGroups.test-fixtures'
import { reportTopGroupsError } from '../data/reportTopGroups'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
const wire = (TopGroups: unknown) => { const data = topRequest(); return { Id: crypto.randomUUID(), Revision: 3, Name: 'Мій TOP',
  Data: { DataSource: 11, From: null, To: null, Sorted: data.sorted, Selections: data.selections, Ordering: data.ordering, FilterExpression: data.filterExpression, TopGroups } } }

it.each([accountTop, { ...accountTop, Version: 7, Future: true }])('preserves native TOP data, filter indices and sorting across template normalization/save/generation %#', async TopGroups => {
  const original = wire(TopGroups)
  vi.mocked(apiRequest).mockResolvedValue([original]); const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual({ ...topRequest(), topGroups: TopGroups })
  vi.mocked(apiRequest).mockResolvedValue({ ...original, Revision: 4 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: template })
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: template.Data })
})
it('retains conflicting Pascal/camel fields received from a malformed template, allowing explicit refusal instead of collapsing them', async () => {
  const original = wire(accountTop); const duplicate = { ...original, Data: { ...original.Data, topGroups: { Version: 99 } } }
  vi.mocked(apiRequest).mockResolvedValue([duplicate]); const [template] = await getServerReportTemplates()
  expect(template.Data.TopGroups).toEqual(accountTop); expect(template.Data.topGroups).toEqual({ Version: 99 })
  expect(reportTopGroupsError(template.Data, topDataset)).toContain('двічі')
})
it.each([{ ...accountTop, Sql: 'never executed' }, { ...accountTop, Value: 101, Mode: 2 }, { ...accountTop, Grouping: 999 }])('refuses invalid browser imports before POST and retains the exact original %#', async topGroups => {
  const template = { Name: 'Оригінал TOP', Data: { ...topRequest(), topGroups } }, raw = JSON.stringify([template])
  localStorage.setItem('app_configs_reports_template:v1', raw)
  vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [topDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(result.current.notice).toMatch(/Некорект|некорект|ціле число|поле має бути/)
  expect(readBrowserReportTemplates()).toEqual([template]); expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
