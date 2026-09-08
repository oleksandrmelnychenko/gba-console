import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { abcDataset, abcRequest, accountAbc } from '../data/reportAbcClassification.test-fixtures'
import { reportAbcClassificationError } from '../data/reportAbcClassification'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
const wire = (AbcClassification: unknown) => { const data = abcRequest(); return { Id: crypto.randomUUID(), Revision: 3, Name: 'Мій ABC',
  Data: { DataSource: 11, From: null, To: null, Sorted: data.sorted, Selections: data.selections, Ordering: data.ordering, FilterExpression: data.filterExpression, TopGroups: data.topGroups, AbcClassification } } }

it.each([accountAbc, { ...accountAbc, Version: 7, Future: true }])('preserves exact raw ABC, class row, TOP/filter/ordering through wire normalization and serialization %#', async AbcClassification => {
  const original = wire(AbcClassification)
  vi.mocked(apiRequest).mockResolvedValue([original]); const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual({ ...abcRequest(), abcClassification: AbcClassification })
  vi.mocked(apiRequest).mockResolvedValue({ ...original, Revision: 4 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: template })
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: template.Data })
})
it('keeps conflicting casing intact for explicit refusal', async () => {
  const original = wire(accountAbc); vi.mocked(apiRequest).mockResolvedValue([{ ...original, Data: { ...original.Data, abcClassification: { Version: 99 } } }])
  const [template] = await getServerReportTemplates()
  expect(template.Data.AbcClassification).toEqual(accountAbc); expect(template.Data.abcClassification).toEqual({ Version: 99 })
  expect(reportAbcClassificationError(template.Data, abcDataset)).toContain('двічі')
})
it.each([{ ...accountAbc, Sql: 'not executed' }, { ...accountAbc, PercentC: 99 }, { ...accountAbc, Grouping: 999 }])('blocks invalid browser import before POST and retains original raw content %#', async abcClassification => {
  const template = { Name: 'Оригінал ABC', Data: { ...abcRequest(), abcClassification } }, raw = JSON.stringify([template])
  localStorage.setItem('app_configs_reports_template:v1', raw); vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [abcDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(result.current.notice).toMatch(/Некорект|некорект|відсотки|початковий ключ/)
  expect(readBrowserReportTemplates()).toEqual([template]); expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
