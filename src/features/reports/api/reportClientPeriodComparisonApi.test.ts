import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { clientComparisonDataset, clientComparisonRequest } from '../data/clientPeriodComparison.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
it('reads PascalCase capabilities and preserves the exact saved two-window request', async () => {
  vi.mocked(apiRequest).mockResolvedValue([clientComparisonDataset])
  expect(await getReportDatasets()).toEqual([clientComparisonDataset])
  const data = clientComparisonRequest()
  vi.mocked(apiRequest).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 3, Name: 'Порівняння', Data: {
    DataSource: 13, From: data.from, To: data.to, Comparison: data.comparison, Sorted: data.sorted, Selections: [] } }])
  const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual(data)
  vi.mocked(apiRequest).mockResolvedValue({})
  await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: data })
})
it.each([undefined, { Version: 2 }, { ...(clientComparisonDataset.Comparison as object), ColumnsSupported: true }])('refuses unavailable or incompatible comparison capabilities %#', async Comparison => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...clientComparisonDataset, Comparison }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})
it.each([{ comparison: null }, { Comparison: { Version: 1 } }, { hideZero: { Version: 1 } }])('refuses malformed browser templates before POST and retains original bytes %#', async patch => {
  const template = { Name: 'Перенесений шаблон', Data: { ...clientComparisonRequest(), ...patch } }
  const raw = JSON.stringify([template]); localStorage.setItem('app_configs_reports_template:v1', raw)
  vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [clientComparisonDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
