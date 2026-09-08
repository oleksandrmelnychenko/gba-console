import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { importedPaymentsDataset, importedPaymentsRequest } from '../data/importedPayments.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
it('reads source14 capabilities and saved date/axis/measure identities without importing comparison metadata', async () => {
  vi.mocked(apiRequest).mockResolvedValue([importedPaymentsDataset])
  expect(await getReportDatasets()).toEqual([importedPaymentsDataset])
  const data = importedPaymentsRequest()
  vi.mocked(apiRequest).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 3, Name: 'Платежі', Data: {
    DataSource: 14, From: data.from, To: data.to, Sorted: data.sorted, Selections: [] } }])
  const [template] = await getServerReportTemplates(); expect(template.Data).toEqual(data)
  vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(template.Data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: data })
})
it.each([{ PeriodRequired: false }, { PeriodSupported: false }])('rejects incompatible source14 period capability %#', async patch => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...importedPaymentsDataset, ...patch }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})
it.each([{ comparison: { Version: 1, From: '2026-06-01', To: '2026-06-30' } }, { from: '' }, { hideZero: { Version: 1 } }, { topGroups: { Version: 1 } }])('rejects malformed direct generation and browser template before POST %#', async patch => {
  const template = { Name: 'Імпортований шаблон', Data: { ...importedPaymentsRequest(), ...patch } }
  await expect(createStockReport(template.Data)).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
  const raw = JSON.stringify([template]); localStorage.setItem('app_configs_reports_template:v1', raw)
  vi.mocked(apiRequest).mockResolvedValue([])
  const { result } = renderHook(() => useServerReportTemplates(true, [importedPaymentsDataset]))
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.importBrowserTemplate(template))
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(localStorage.getItem('app_configs_reports_template:v1')).toBe(raw)
})
