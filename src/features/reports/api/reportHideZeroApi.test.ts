import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { hideZeroDataset, hideZeroRequest } from '../data/reportHideZero.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
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
