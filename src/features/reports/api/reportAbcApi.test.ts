import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readBrowserReportTemplates, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import { abcDataset, abcRequest, accountAbc } from '../data/reportAbcClassification.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
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
