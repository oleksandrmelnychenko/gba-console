import { describe, expect, it } from 'vitest'
import { currentFinancialFilterConditionsCapability, financialFilterConditionTypes } from './currentFinancialFilterConditions'
import { financialFilterCapability, financialFilterDataset, financialFilterRequest } from './currentFinancialFilterConditions.test-fixtures'
import { datasetConfigurationError } from './reportDatasets'

describe('current financial exact filter capability', () => {
  it.each([undefined, null, {}, { ...financialFilterCapability, version: 2 },
    { ...financialFilterCapability, conditions: [0, 1, 2, 3, 4] }, { ...financialFilterCapability, allowedFields: [0, 1, 2, 6, 9, 10] },
    { ...financialFilterCapability, requiredProfitReadMode: 1 }, { ...financialFilterCapability, maximumValues: 1000 },
  ])('rejects unconfirmed metadata without admitting negative conditions: %j', currentFinancialFilterConditions => {
    const dataset = { ...financialFilterDataset, currentFinancialFilterConditions }
    expect(currentFinancialFilterConditionsCapability(dataset)).toBeUndefined()
    expect(financialFilterConditionTypes(dataset, financialFilterRequest())).toEqual([0, 2])
  })
  it.each([0, 1, 2, 6, 9])('admits all four conditions for field %i without changing Int64 values', field => {
    for (const condition of [0, 1, 2, 4]) {
      const data = financialFilterRequest(field, condition)
      const before = structuredClone(data)
      expect(datasetConfigurationError(data, financialFilterDataset)).toBeNull()
      expect(data).toEqual(before)
      expect(data.selections[0].Values[0].Data.Id).toBe('9007199254740993')
    }
  })
  it.each([{ profitReadMode: undefined }, { profitReadMode: 1 }, { dayOrganizationBasis: undefined }, { dayOrganizationBasis: 1 }])(
    'retains incompatible settings and rejects submission: %j', changed => {
      const data = { ...financialFilterRequest(), ...changed }, before = structuredClone(data)
      expect(financialFilterConditionTypes(financialFilterDataset, data)).toEqual([0, 2])
      expect(datasetConfigurationError(data, financialFilterDataset)).not.toBeNull()
      expect(data).toEqual(before)
    })
  it('keeps old metadata positive-only and current capability away from source38', () => {
    const old = { ...financialFilterDataset, currentFinancialFilterConditions: undefined }
    expect(datasetConfigurationError(financialFilterRequest(1, 4), old)).toContain('сервер не підтвердив')
    expect(datasetConfigurationError(financialFilterRequest(1, 2), old)).toBeNull()
    expect(currentFinancialFilterConditionsCapability({ ...financialFilterDataset, DataSource: 38 })).toBeUndefined()
  })
  it('enforces exact cardinality and existing limits while preserving duplicate list identities', () => {
    expect(datasetConfigurationError(financialFilterRequest(1, 1, ['1', '2']), financialFilterDataset)).not.toBeNull()
    expect(datasetConfigurationError(financialFilterRequest(1, 4, []), financialFilterDataset)).not.toBeNull()
    expect(datasetConfigurationError(financialFilterRequest(1, 4, ['1', '1', '9007199254740993']), financialFilterDataset)).toBeNull()
    for (const id of ['0', '-1', '1.5', '9223372036854775808'])
      expect(datasetConfigurationError(financialFilterRequest(1, 4, [id]), financialFilterDataset)).not.toBeNull()
    expect(datasetConfigurationError(financialFilterRequest(1, 4, Array.from({ length: 101 }, (_, i) => String(i + 1))), financialFilterDataset)).not.toBeNull()
  })
  it('preserves negative conditions and identities through saved-definition JSON and date edits', () => {
    const data = financialFilterRequest(9, 4, ['201', '202'])
    const restored = JSON.parse(JSON.stringify({ Data: data })).Data
    restored.from = '2026-10-18'
    expect(datasetConfigurationError(restored, financialFilterDataset)).toBeNull()
    expect(restored.selections).toEqual(data.selections)
    for (const condition of [3, 5, 6, 7])
      expect(datasetConfigurationError(financialFilterRequest(1, condition), financialFilterDataset)).not.toBeNull()
  })
})
