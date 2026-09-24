import { expect, it } from 'vitest'
import type { ReportRequestBody } from '../types'
import { agreementPriceComparisonConfigurationError, cloneAgreementPriceComparisonAliases,
  defaultAgreementPriceComparison, normalizeAgreementPriceComparisonDataset } from './agreementPriceComparison'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { comparisonDataset } from './agreementPriceComparison.test-fixtures'

function valid(): ReportRequestBody {
  return { ...defaultDatasetRequest(comparisonDataset, '2026-09-01', '2026-09-23'),
    agreementPriceComparison: { version: 1, baseClientAgreementId: 41, comparedClientAgreementId: 42, productIds: [7, 8] } }
}

it('builds a current four-measure preset and retains exact compared agreements and products', () => {
  const request = valid()
  expect(request.from).toBe(''); expect(request.to).toBe('')
  expect(request.sorted.Row.map(item => item.type)).toEqual([5, 28])
  expect(request.sorted.Measurements.map(item => item.Type)).toEqual([75, 76, 77, 78])
  expect(datasetConfigurationError(request, comparisonDataset)).toBeNull()
  const preset = datasetPresetRequest(comparisonDataset, 'current-two-agreement-product-prices', request)!
  expect(preset.Data.agreementPriceComparison).toEqual(request.agreementPriceComparison)
})

it('refuses ambiguous agreements, product lists, period and extra selections', () => {
  const data = valid()
  for (const comparison of [defaultAgreementPriceComparison(),
    { version: 1, baseClientAgreementId: 41, comparedClientAgreementId: 41, productIds: [7] },
    { version: 1, baseClientAgreementId: 41, comparedClientAgreementId: 42, productIds: [7, 7] },
    { version: 1, baseClientAgreementId: 41, comparedClientAgreementId: 42, productIds: Array.from({ length: 2001 }, (_, i) => i + 1) },
  ]) expect(agreementPriceComparisonConfigurationError({ ...data, agreementPriceComparison: comparison })).not.toBeNull()
  expect(agreementPriceComparisonConfigurationError({ ...data, from: '2026-09-01' })).not.toBeNull()
  expect(agreementPriceComparisonConfigurationError({ ...data, selections: [{} as ReportRequestBody['selections'][number]] })).not.toBeNull()
  expect(agreementPriceComparisonConfigurationError({ ...data, sorted: { ...data.sorted, Col: data.sorted.Row } })).not.toBeNull()
})

it('accepts one case alias, rejects duplicate aliases and wrong server capability', () => {
  const data = valid()
  const value = data.agreementPriceComparison
  delete data.agreementPriceComparison
  data.AgreementPriceComparison = value
  expect(cloneAgreementPriceComparisonAliases(data)).toEqual({ AgreementPriceComparison: value })
  expect(agreementPriceComparisonConfigurationError(data, comparisonDataset)).toBeNull()
  data.agreementPriceComparison = value
  expect(agreementPriceComparisonConfigurationError(data, comparisonDataset)).not.toBeNull()
  expect(normalizeAgreementPriceComparisonDataset({ ...comparisonDataset, AgreementPriceComparison: comparisonDataset.agreementPriceComparison,
    agreementPriceComparison: undefined })).toBeNull()
  expect(agreementPriceComparisonConfigurationError(valid(), { ...comparisonDataset, agreementPriceComparison: { version: 2 } })).not.toBeNull()
})
