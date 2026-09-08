import { beforeEach, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { expressionDataset, expressionRequest, nestedExpression } from '../data/reportFilterExpression.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

it.each([nestedExpression, { Version: 7, Root: { Future: true, OriginalIndices: [2, 1, 0] } }])('preserves native wire/template filter tree and full original selections %#', async FilterExpression => {
  const data = expressionRequest(), wire = { Id: crypto.randomUUID(), Revision: 3, Name: 'Груповані умови', Data: { DataSource: 11, From: null, To: null, Sorted: data.sorted, Selections: data.selections, Ordering: data.ordering, FilterExpression } }
  vi.mocked(apiRequest).mockResolvedValue([wire]); const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual({ ...data, filterExpression: FilterExpression })
  vi.mocked(apiRequest).mockResolvedValue({ ...wire, Revision: 4 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: template })
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: template.Data })
})

it.each([{ Version: 99, Root: { Query: 'not executed' } }, { Version: 1, Root: { Kind: 3, SelectionIndex: 0 } }])('refuses malformed or active-omitting local imports without a POST or changing originals %#', async filterExpression => {
  const template = { Name: 'Оригінал', Data: { ...expressionRequest(), filterExpression } }, raw = JSON.stringify([template])
  localStorage.setItem('app_configs_reports_template:v1', raw)
  vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [expressionDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(result.current.notice).toMatch(/Невідома версія|не включено/)
  expect(readBrowserReportTemplates()).toEqual([template]); expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
