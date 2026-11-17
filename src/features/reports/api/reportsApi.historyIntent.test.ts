import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import catalog from '../data/constructorDatasets.dev-fixture.json'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { parseReportDatasets } from './reportWorkspaceApi'
import { previewStockReport } from './reportsApi'

vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))

const purchases = parseReportDatasets(catalog).find(item => item.DataSource === 3)!

beforeEach(() => vi.mocked(apiRequest).mockReset())

it.each([[false, false], [true, false], [false, true], [true, true]])(
  'marks a preview made only for an Excel file so the server keeps one entry (jobs=%s, intent=%s)', async (jobs, intent) => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      if (path === '/report/stocks/preview/capabilities') return { Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900, BackgroundJobs: jobs }
      return {}
    })
    await expect(previewStockReport(defaultDatasetRequest(purchases, '2026-11-01', '2026-11-17'), purchases,
      intent ? { excelIntent: true } : {})).rejects.toThrow()
    const call = vi.mocked(apiRequest).mock.calls.find(([path]) => path !== '/report/stocks/preview/capabilities')!
    expect(call[0]).toBe(jobs ? '/report/stocks/preview/jobs' : '/report/stocks/preview')
    expect((call[1]?.query as Record<string, unknown>).historyOutput).toBe(intent ? 2 : undefined)
  })
