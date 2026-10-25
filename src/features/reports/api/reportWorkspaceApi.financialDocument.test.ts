import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { documentDataset, documentRequest } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { productTimeDataset } from '../data/currentFinancialProductTimeAxes.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it.each([[[81], []], [[81, 5], []], [[81], [5]], [[5], [81]]])('retains document template %j / %j with negative filters and requires current capability before writing', async (rows, cols) => {
  const data = documentRequest(rows, cols)
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Документи', Data: { DataSource: 35,
    From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, ProfitReadMode: 0, DayOrganizationBasis: 0 } }
  vi.mocked(apiRequest).mockResolvedValue([wire])
  const [template] = await getServerReportTemplates()
  const normalized = { dataSource: 35, from: data.from, to: data.to, sorted: data.sorted, selections: data.selections,
    ProfitReadMode: 0, DayOrganizationBasis: 0 }
  expect(template.Data).toEqual(normalized)
  vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(template, undefined, productTimeDataset)).rejects.toThrow('не підтвердив')
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue(wire)
  await expect(saveServerReportTemplate(template, undefined, documentDataset)).resolves.toEqual(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: {
    Id: wire.Id, Revision: 1, Name: wire.Name, Data: normalized,
  } })
})
