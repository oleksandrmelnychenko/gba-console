import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { accountTop, topDataset, topRequest } from '../data/reportTopGroups.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
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
