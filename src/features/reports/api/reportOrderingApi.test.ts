import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport } from './reportsApi'
import { readBrowserReportTemplates } from '../hooks/useServerReportTemplates'
import { accountOrdering, orderedAccountRequest } from '../data/reportOrdering.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

it.each([accountOrdering, { Version: 7, Rows: 'future', Expression: 'source-path' }, { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], Extra: true }] }])('preserves known and unknown wire ordering values without stripping fields %#', async Ordering => {
  const data = orderedAccountRequest(), wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Моє сортування', Data: { DataSource: 11, From: null, To: null, Sorted: data.sorted, Selections: [], Ordering } }
  vi.mocked(apiRequest).mockResolvedValue([wire]); const [template] = await getServerReportTemplates()
  expect(template.Data.ordering).toEqual(Ordering)
  vi.mocked(apiRequest).mockResolvedValue({ ...wire, Revision: 2 }); await saveServerReportTemplate(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: { Id: wire.Id, Revision: 1, Name: wire.Name, Data: { ...data, ordering: Ordering } } })
})
it('passes exact request ordering to the server and retains unknown local template source material', async () => {
  const data = orderedAccountRequest(); vi.mocked(apiRequest).mockResolvedValue({}); await createStockReport(data)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body: data })
  const local = { Name: 'Невідомий порядок', Data: { ...data, ordering: { Version: 99, Rows: 'future', SecretExpression: 'not-executed' } } }
  localStorage.setItem('app_configs_reports_template:v1', JSON.stringify([local]))
  expect(readBrowserReportTemplates()).toEqual([local])
})
