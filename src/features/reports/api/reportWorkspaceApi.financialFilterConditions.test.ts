import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { financialFilterCapability, financialFilterDataset, financialFilterRequest } from '../data/currentFinancialFilterConditions.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('accepts the additive capability and an older catalogue with no capability', async () => {
  for (const capability of [undefined, financialFilterCapability]) {
    const dataset = { ...financialFilterDataset, currentFinancialFilterConditions: capability }
    vi.mocked(apiRequest).mockResolvedValue([dataset])
    await expect(getReportDatasets()).resolves.toEqual([dataset])
  }
})

it.each([null, { ...financialFilterCapability, version: 2 },
  { ...financialFilterCapability, conditions: [0, 1, 2] },
  { ...financialFilterCapability, allowedFields: [0, 1, 2, 6, 9, 7] }])('rejects unrecognized financial condition metadata %#', async capability => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...financialFilterDataset, currentFinancialFilterConditions: capability }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список наборів даних')
})

it('retains an exact negative identity through template load/save and requires server admission before writing', async () => {
  const data = financialFilterRequest(9, 4, ['9007199254740993', '9223372036854775807'])
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Без вибраних договорів', Data: {
    DataSource: data.dataSource, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections,
    ProfitReadMode: data.profitReadMode, DayOrganizationBasis: data.dayOrganizationBasis,
  } }
  vi.mocked(apiRequest).mockResolvedValue([wire])
  const [template] = await getServerReportTemplates()
  // Saved financial aliases are deliberately retained so duplicate/ambiguous aliases stay rejectable.
  const { profitReadMode, dayOrganizationBasis, ...unchanged } = data
  const normalized = { ...unchanged, ProfitReadMode: profitReadMode, DayOrganizationBasis: dayOrganizationBasis }
  expect(template.Data).toEqual(normalized)
  vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(template)).rejects.toThrow('сервер не підтвердив')
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue(wire)
  await expect(saveServerReportTemplate(template, undefined, financialFilterDataset)).resolves.toEqual(template)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: {
    Id: wire.Id, Revision: 1, Name: wire.Name, Data: normalized,
  } })
  expect(template.Data).toEqual(normalized)
})
