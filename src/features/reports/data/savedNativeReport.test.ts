import { describe, expect, it } from 'vitest'
import type { ReportDataset, ReportRequestBody } from '../types'
import { agreementPricesDataset, agreementPricesRequest } from './agreementPrices.test-fixtures'
import { currentVparivanieDataset, currentVparivanieRequest } from './currentVparivanie.test-fixtures'
import { groupedCashDataset, groupedCashRequest } from './groupedCashPeriod.test-fixtures'
import { groupedSettlementDataset, groupedSettlementRequest } from './groupedSettlementPeriod.test-fixtures'
import { savedNativeReportConfigurationError } from './savedNativeReport'

function error(data: ReportRequestBody, datasets: readonly ReportDataset[]) {
  return savedNativeReportConfigurationError({ Name: 'Збережений варіант', Data: data }, datasets)
}
const forms = [
  { name: 'exact agreement', dataset: agreementPricesDataset, request: agreementPricesRequest },
  { name: 'current matrix', dataset: currentVparivanieDataset, request: currentVparivanieRequest },
  { name: 'grouped cash', dataset: groupedCashDataset, request: groupedCashRequest },
  { name: 'grouped settlement', dataset: groupedSettlementDataset, request: groupedSettlementRequest },
]

describe('saved native variants retain current form and refusal contracts', () => {
  it.each(forms)('accepts $name without modifying saved settings and refuses a missing or ambiguous dataset', ({ dataset, request }) => {
    const data = request(), original = structuredClone(data)
    expect(error(data, [dataset])).toBeNull()
    expect(data).toEqual(original)
    expect(error(data, [])).not.toBeNull()
    expect(error(data, [dataset, dataset])).not.toBeNull()
  })

  it('retains exact agreement identity and refuses a saved current-price variant with a historical period', () => {
    const data = agreementPricesRequest()
    expect(error({ ...data, valuationClientAgreementId: undefined }, [agreementPricesDataset])).toContain('договір')
    expect(error({ ...data, from: '2026-09-01' }, [agreementPricesDataset])).not.toBeNull()
    expect(error(data, [{ ...agreementPricesDataset, agreementPrices: undefined }])).not.toBeNull()
  })

  it('refuses a matrix capability change and saved transformations instead of dropping them', () => {
    const data = currentVparivanieRequest()
    expect(error(data, [{ ...currentVparivanieDataset, currentVparivanie: undefined }])).not.toBeNull()
    const transformed = { ...data, ordering: {} }
    const original = structuredClone(transformed)
    expect(error(transformed, [currentVparivanieDataset])).not.toBeNull()
    expect(transformed).toEqual(original)
  })

  it('refuses removed grouped financial capabilities even while the source number and fields remain', () => {
    expect(error(groupedCashRequest(), [{ ...groupedCashDataset, groupedCashPeriod: undefined }])).not.toBeNull()
    expect(error(groupedSettlementRequest(), [{ ...groupedSettlementDataset, groupedSettlementPeriod: undefined }])).not.toBeNull()
  })
})
