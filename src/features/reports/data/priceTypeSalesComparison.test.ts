import { describe, expect, it } from 'vitest'
import { datasetConfigurationError, datasetFilters, defaultDatasetRequest } from './reportDatasets'
import {
  PRICE_TYPE_SALES_COMPARISON_FILTERS,
  PRICE_TYPE_SALES_COMPARISON_SOURCE,
  priceTypeSalesComparisonConfigurationError,
  priceTypeSalesComparisonOptions,
} from './priceTypeSalesComparison'
import {
  PRICE_TYPE_ID,
  PRICE_TYPE_SCOPE,
  priceTypeSalesComparisonDataset,
  priceTypeSalesComparisonRequest,
} from './priceTypeSalesComparison.test-fixtures'

describe('source27 price-type sales comparison contract', () => {
  it('creates Client → Product defaults with gross, global-price and difference measures', () => {
    const request = defaultDatasetRequest(priceTypeSalesComparisonDataset, '2026-09-01', '2026-09-03')
    expect(request.dataSource).toBe(PRICE_TYPE_SALES_COMPARISON_SOURCE)
    expect(request.sorted.Row.map(item => item.type)).toEqual([12, 5])
    expect(request.sorted.Col).toEqual([])
    expect(request.sorted.Measurements.map(item => item.Type)).toEqual([4, 70, 71])
    expect(request.priceTypeSalesComparison).toEqual({ Version: 1, SourceWorld: 1, PriceTypeId: '' })
    expect(datasetFilters(priceTypeSalesComparisonDataset).map(item => item.field.Type)).toEqual(PRICE_TYPE_SALES_COMPARISON_FILTERS)
  })

  it('accepts only Version1, Fenix and one exact nonzero PriceTypeId', () => {
    expect(priceTypeSalesComparisonOptions({ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID.toLowerCase() }))
      .toEqual({ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID })
    for (const value of ['', '0'.repeat(32), '1'.repeat(31), `${'1'.repeat(31)}Z`, ` ${PRICE_TYPE_ID}`]) {
      expect(priceTypeSalesComparisonOptions({ Version: 1, SourceWorld: 1, PriceTypeId: value })).toBeNull()
    }
    expect(priceTypeSalesComparisonOptions({ Version: 1, SourceWorld: 2, PriceTypeId: PRICE_TYPE_ID })).toBeNull()
    expect(priceTypeSalesComparisonOptions({ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, AgreementPriceId: PRICE_TYPE_ID })).toBeNull()
  })

  it('keeps exact agreement as filter 45 while forbidding agreement-price fallback and recommendation options', () => {
    const request = priceTypeSalesComparisonRequest()
    request.selections = [{ IsChecked: true, SelectedField: { Type: 45, Name: 'OneCDiscountAgreement' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: '4'.repeat(32) }, Name: 'Договір', Value: 0 }] }]
    expect(datasetConfigurationError(request, priceTypeSalesComparisonDataset)).toBeNull()
    ;(request.selections[0].Values[0].Data as { Id: unknown }).Id = 44
    expect(priceTypeSalesComparisonConfigurationError(request, priceTypeSalesComparisonDataset)).toMatch(/Перевірте exact scope/)
    expect(priceTypeSalesComparisonDataset.priceTypeSalesComparison).toMatchObject({
      RecommendationEligible: false, AgreementPriceFallback: false, CoverageStatus: 'native_partial', ParityVerified: false,
    })
  })

  it('requires an explicit compatible local Fenix scope and never infers a contract price', () => {
    const request = priceTypeSalesComparisonRequest()
    request.oneC = undefined
    expect(priceTypeSalesComparisonConfigurationError(request, priceTypeSalesComparisonDataset)).toMatch(/локальне покриття Fenix/)
    request.oneC = { ...PRICE_TYPE_SCOPE, BuyerRootId: '5'.repeat(32) }
    expect(priceTypeSalesComparisonConfigurationError(request, priceTypeSalesComparisonDataset)).toMatch(/локальне покриття Fenix/)
    request.oneC = structuredClone(PRICE_TYPE_SCOPE)
    request.valuationClientAgreementId = 42
    expect(priceTypeSalesComparisonConfigurationError(request, priceTypeSalesComparisonDataset)).toMatch(/Перевірте exact scope/)
  })

  it('rejects unknown dimensions, measures and duplicate source scope identities before execution', () => {
    const request = priceTypeSalesComparisonRequest()
    request.sorted.Row[0].type = 999
    expect(priceTypeSalesComparisonConfigurationError(request)).toMatch(/Перевірте exact scope/)
    request.sorted.Row[0].type = 12
    request.sorted.Measurements[0].Type = 63
    expect(priceTypeSalesComparisonConfigurationError(request)).toMatch(/Перевірте exact scope/)
    request.sorted.Measurements[0].Type = 4
    request.oneC = { ...PRICE_TYPE_SCOPE, OrganizationIds: [PRICE_TYPE_SCOPE.OrganizationIds[0], PRICE_TYPE_SCOPE.OrganizationIds[0]] }
    expect(priceTypeSalesComparisonConfigurationError(request)).toMatch(/локальне покриття Fenix/)
  })
})
