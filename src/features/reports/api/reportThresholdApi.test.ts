import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { accountThreshold, thresholdDataset, thresholdRequest } from '../data/reportThreshold.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
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
