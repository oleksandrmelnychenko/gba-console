import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { buyerManagerCapability, buyerManagerDataset, buyerManagerRequest } from '../data/currentFinancialBuyerManagerFilter.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('admits exact additive metadata and older server payload without rewriting base fields', async () => {
  for (const cap of [undefined, buyerManagerCapability]) {
    const dataset = { ...buyerManagerDataset, currentFinancialBuyerManagerFilter: cap }
    vi.mocked(apiRequest).mockResolvedValue([dataset])
    await expect(getReportDatasets()).resolves.toEqual([dataset])
  }
})
it.each([null, { ...buyerManagerCapability, version: 2 }, { ...buyerManagerCapability, valueKind: 'nativeId' },
  { ...buyerManagerCapability, requiredProfitReadMode: 1 }])('fails closed on malformed optional metadata %#', async currentFinancialBuyerManagerFilter => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...buyerManagerDataset, currentFinancialBuyerManagerFilter }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список наборів даних')
})
it('retains exact manager and unassigned identities through saved template parsing and writes only with current server admission', async () => {
  const data = buyerManagerRequest(4)
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Без менеджерів', Data: { DataSource: data.dataSource, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, ProfitReadMode: data.profitReadMode, DayOrganizationBasis: data.dayOrganizationBasis } }
  vi.mocked(apiRequest).mockResolvedValue([wire])
  const [template] = await getServerReportTemplates()
  expect(template.Data.selections).toEqual(data.selections)
  vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(template)).rejects.toThrow('сервер не підтвердив')
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue(wire)
  await saveServerReportTemplate(template, undefined, buyerManagerDataset)
  expect(apiRequest).toHaveBeenCalledWith('/report/templates/save', { method: 'POST', body: {
    Id: wire.Id, Revision: 1, Name: wire.Name, Data: template.Data,
  } })
  expect(template.Data.selections[0].Values.map(v => v.Data)).toEqual([
    { Id: '33221100554477668899AABBCCDDEEFF' }, { Id: '00000000000000000000000000000000' },
  ])
})
