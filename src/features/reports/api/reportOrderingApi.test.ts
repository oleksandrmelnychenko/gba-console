import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates } from '../hooks/useServerReportTemplates'
import { orderedAccountRequest } from '../data/reportOrdering.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
it('passes exact request ordering to the server and retains unknown local template source material', async () => {
  const data = orderedAccountRequest(); vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', dedupe: false, body: data })
  const local = { Name: 'Невідомий порядок', Data: { ...data, ordering: { Version: 99, Rows: 'future', SecretExpression: 'not-executed' } } }
  localStorage.setItem('app_configs_reports_template:v1', JSON.stringify([local]))
  expect(readBrowserReportTemplates()).toEqual([local])
})
