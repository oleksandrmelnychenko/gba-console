import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, saveServerReportTemplate } from './reportWorkspaceApi'
import { agreementPricesDataset, agreementPricesRequest } from '../data/agreementPrices.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('accepts source22 capabilities and exact string product IDs', async () => {
  vi.mocked(apiRequest).mockResolvedValue([agreementPricesDataset])
  expect(await getReportDatasets()).toEqual([agreementPricesDataset])
  vi.mocked(apiRequest).mockResolvedValue([{ Id: '9223372036854775807', Name: 'Товар' }])
  expect(await searchDatasetReportValues(22, 1, { value: '', limit: 30, offset: 0 })).toEqual([{ Id: '9223372036854775807', Name: 'Товар' }])
  vi.mocked(apiRequest).mockResolvedValue([{ Id: Number('9223372036854775807'), Name: 'Товар' }])
  await expect(searchDatasetReportValues(22, 1, { value: '', limit: 30, offset: 0 })).rejects.toThrow(/значення/)
})
it('rejects wrong source22 capabilities instead of accepting a partially supported editor', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...agreementPricesDataset, PeriodSupported: true }])
  await expect(getReportDatasets()).rejects.toThrow(/список/)
})
it('refuses generating or saving an invalid price request before network access', async () => {
  const request = agreementPricesRequest(); request.valuationClientAgreementId = undefined
  await expect(createStockReport(request)).rejects.toThrow(/договір/)
  await expect(saveServerReportTemplate({ Name: 'Price', Data: request })).rejects.toThrow(/договір/)
  expect(apiRequest).not.toHaveBeenCalled()
})
