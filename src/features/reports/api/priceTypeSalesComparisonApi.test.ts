import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, saveServerReportTemplate } from './reportWorkspaceApi'
import {
  PRICE_TYPE_ID,
  priceTypeSalesComparisonDataset,
  priceTypeSalesComparisonRequest,
} from '../data/priceTypeSalesComparison.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

describe('source27 API boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts the exact partial capability and five exact filters', async () => {
    const { priceTypeSalesComparison, ...dataset } = priceTypeSalesComparisonDataset
    vi.mocked(apiRequest).mockResolvedValue([{ ...dataset, PriceTypeSalesComparison: priceTypeSalesComparison }])
    const datasets = await getReportDatasets()
    expect(datasets).toHaveLength(1)
    expect(datasets[0].Filters.map(item => item.Type)).toEqual([51, 52, 45, 53, 54])
    expect(datasets[0]).not.toHaveProperty('PriceTypeSalesComparison')
    expect(datasets[0].priceTypeSalesComparison).toMatchObject({ RecommendationEligible: false, AgreementPriceFallback: false })
  })

  it('uses one bounded source27 lookup for global price type and exact filter identities', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiRequest).mockResolvedValue([{ Id: PRICE_TYPE_ID, Name: 'Оптова глобальна' }])
    await expect(searchDatasetReportValues(27, 46, { value: ' опт ', offset: 0, limit: 30 }, signal))
      .resolves.toEqual([{ Id: PRICE_TYPE_ID, Name: 'Оптова глобальна' }])
    expect(apiRequest).toHaveBeenCalledWith('/report/datasets/lookup', {
      query: { dataSource: 27, field: 46, value: 'опт', offset: 0, limit: 30 }, signal,
    })
    vi.mocked(apiRequest).mockResolvedValue([{ Id: '4'.repeat(32), Name: 'Договір 1С' }])
    await expect(searchDatasetReportValues(27, 45, { value: '', offset: 0, limit: 30 })).resolves.toHaveLength(1)
    vi.mocked(apiRequest).mockResolvedValue([{ Id: 44, Name: 'Локальний ID' }])
    await expect(searchDatasetReportValues(27, 45, { value: '', offset: 0, limit: 30 })).rejects.toThrow(/некоректні значення/)
  })

  it('rejects invalid source27 generation and template save before network access', async () => {
    const request = priceTypeSalesComparisonRequest()
    ;(request.priceTypeSalesComparison as { PriceTypeId: string }).PriceTypeId = '0'.repeat(32)
    await expect(createStockReport(request)).rejects.toThrow(/глобальний тип ціни/)
    await expect(saveServerReportTemplate({ Name: 'Порівняння', Data: request })).rejects.toThrow(/глобальний тип ціни/)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
