import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, normalizeSavedTemplate, saveServerReportTemplate } from './reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { comparisonDataset } from '../data/agreementPriceComparison.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('accepts exact source31 capability and bounded numeric lookup IDs', async () => {
  const { agreementPriceComparison, ...dataset } = comparisonDataset
  vi.mocked(apiRequest).mockResolvedValueOnce([{ ...dataset, AgreementPriceComparison: agreementPriceComparison }])
  const datasets = await getReportDatasets()
  expect(datasets[0].agreementPriceComparison).toEqual(comparisonDataset.agreementPriceComparison)
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: 7, Name: 'Товар [7]' }])
  expect(await searchDatasetReportValues(31, 1, { value: 'товар', offset: 0, limit: 25 })).toEqual([{ Id: 7, Name: 'Товар [7]' }])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: '9007199254740992', Name: 'Надто великий ID' }])
  await expect(searchDatasetReportValues(31, 9, { value: '', offset: 0, limit: 25 })).rejects.toThrow(/значення/)
})

it('blocks invalid generation and template save before a network call', async () => {
  const data = defaultDatasetRequest(comparisonDataset, '', '')
  await expect(createStockReport(data)).rejects.toThrow(/договори/)
  await expect(saveServerReportTemplate({ Name: 'Compare', Data: data })).rejects.toThrow(/договори/)
  expect(apiRequest).not.toHaveBeenCalled()
})

it('restores PascalCase server template comparison settings', () => {
  const Data = { From: '', To: '', DataSource: 31, Sorted: defaultDatasetRequest(comparisonDataset, '', '').sorted,
    Selections: [], AgreementPriceComparison: { version: 1, baseClientAgreementId: 41, comparedClientAgreementId: 42, productIds: [7] } }
  const template = normalizeSavedTemplate({ Id: '10000000-0000-4000-8000-000000000031', Revision: 1, Name: 'Compare', Data } as never)
  expect(template.Data.AgreementPriceComparison).toEqual(Data.AgreementPriceComparison)
})
