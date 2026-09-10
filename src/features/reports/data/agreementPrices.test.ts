import { describe, expect, it } from 'vitest'
import { agreementPricesConfigurationError, isAgreementPricesDataset } from './agreementPrices'
import { agreementPricesDataset, agreementPricesRequest } from './agreementPrices.test-fixtures'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { valuationConfigurationError } from './reportValuation'

describe('current exact agreement product price contract', () => {
  it('accepts one explicit contract and requires it on a fresh dataset', () => {
    expect(isAgreementPricesDataset(agreementPricesDataset)).toBe(true)
    expect(datasetConfigurationError(agreementPricesRequest(), agreementPricesDataset)).toBeNull()
    const fresh = defaultDatasetRequest(agreementPricesDataset, '2026-09-01', '2026-09-10')
    expect(fresh).toMatchObject({ from: '', to: '', sorted: { Row: [{ type: 5 }, { type: 28 }], Measurements: [{ Type: 63 }] } })
    expect(datasetConfigurationError(fresh, agreementPricesDataset)).toContain('договір')
  })
  it('keeps the exact contract when applying the same price preset', () => {
    const request = agreementPricesRequest()
    const preset = datasetPresetRequest(agreementPricesDataset, 'product-prices-by-agreement', request)
    expect(preset?.Data.valuationClientAgreementId).toBe(42)
    expect(preset?.Data.sorted.Measurements.map(item => item.Type)).toEqual([63])
    expect(valuationConfigurationError({ dataSource: 0, valuationClientAgreementId: 42 })).not.toBeNull()
  })
  it.each([0, -1, undefined, NaN, Number.MAX_SAFE_INTEGER + 1])('refuses invalid agreement %s', id => {
    expect(agreementPricesConfigurationError({ ...agreementPricesRequest(), valuationClientAgreementId: id })).toContain('договір')
  })
  it.each(['from', 'ordering', 'filterExpression', 'threshold', 'revenueComparison', 'PaymentComparison'])('refuses unsupported %s', key => {
    const request = agreementPricesRequest()
    Object.assign(request, { [key]: key === 'from' ? '2026-09-01' : {} })
    expect(agreementPricesConfigurationError(request)).not.toBeNull()
  })
  it('refuses dates advertised by a changed server or additive transformations', () => {
    expect(isAgreementPricesDataset({ ...agreementPricesDataset, PeriodSupported: true })).toBe(false)
    expect(isAgreementPricesDataset({ ...agreementPricesDataset, Ordering: {} } as typeof agreementPricesDataset)).toBe(false)
    expect(isAgreementPricesDataset({ ...agreementPricesDataset, Measurements: [{ Type: 63, Name: 'Price', Selectable: false }] })).toBe(false)
  })
  it('refuses rearranged axes, duplicate prices, unchecked measure and foreign filters', () => {
    const request = agreementPricesRequest()
    request.sorted.Row.reverse(); expect(agreementPricesConfigurationError(request)).not.toBeNull()
    request.sorted.Row.reverse(); request.sorted.Measurements[0].IsChecked = false
    expect(agreementPricesConfigurationError(request)).not.toBeNull()
    request.sorted.Measurements[0].IsChecked = true; request.sorted.Measurements.push(request.sorted.Measurements[0])
    expect(agreementPricesConfigurationError(request)).not.toBeNull()
  })
  it('retains exact large product identities and bounds inactive filter values too', () => {
    const request = agreementPricesRequest()
    request.selections = [{ IsChecked: false, SelectedField: { Type: 1, Name: 'Product' }, FilterCondition: { Type: 2, Name: 'У списку' },
      Values: [{ Name: 'Товар', Value: 1, Data: { Id: 1 } }] }]
    Object.assign(request.selections[0].Values[0], { Data: { Id: '9223372036854775807' } })
    expect(agreementPricesConfigurationError(request)).toBeNull()
    request.selections[0].Values = Array.from({ length: 2001 }, () => request.selections[0].Values[0])
    expect(agreementPricesConfigurationError(request)).toContain('2 000')
  })
})
