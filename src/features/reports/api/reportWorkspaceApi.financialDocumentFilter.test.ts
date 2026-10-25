import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { documentFilterCapability, documentFilterDataset, documentFilterRequest } from '../data/currentFinancialDocumentFilter.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('admits exact additive metadata and older server payload without rewriting base fields', async () => {
  for (const cap of [undefined, documentFilterCapability]) {
    const dataset = { ...documentFilterDataset, currentFinancialDocumentFilter: cap }
    vi.mocked(apiRequest).mockResolvedValue([dataset])
    await expect(getReportDatasets()).resolves.toEqual([dataset])
  }
})
it.each([null, { ...documentFilterCapability, version: 2 }, { ...documentFilterCapability, valueKind: 'nativeId' },
  { ...documentFilterCapability, requiredProfitReadMode: 1 }])('fails closed on malformed optional metadata %#', async currentFinancialDocumentFilter => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...documentFilterDataset, currentFinancialDocumentFilter }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список наборів даних')
})
it('retains both typed identities through saved template parsing and writes only with current server admission', async () => {
  const data = documentFilterRequest(4)
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Без документів', Data: { DataSource: data.dataSource, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, ProfitReadMode: data.profitReadMode, DayOrganizationBasis: data.dayOrganizationBasis } }
  vi.mocked(apiRequest).mockResolvedValue([wire])
  const [template] = await getServerReportTemplates()
  expect(template.Data.selections).toEqual(data.selections)
  vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(template)).rejects.toThrow('сервер не підтвердив')
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue(wire)
  await saveServerReportTemplate(template, undefined, documentFilterDataset)
  expect(apiRequest).toHaveBeenCalledWith('/report/templates/save', { method: 'POST', body: {
    Id: wire.Id, Revision: 1, Name: wire.Name, Data: template.Data,
  } })
  expect(template.Data.selections[0].Values.map(v => v.Data)).toEqual([
    { kind: 'sale', id: '9007199254740993' }, { kind: 'return', id: '9007199254740993' },
  ])
})
