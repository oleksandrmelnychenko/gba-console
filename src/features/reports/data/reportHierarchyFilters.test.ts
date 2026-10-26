import { describe, expect, it } from 'vitest'
import wire from './currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { dayOrganizationGrossProfitConfigurationError } from './dayOrganizationGrossProfit'
import { supplierBatchGrossProfitConfigurationError } from './supplierBatchGrossProfit'
import { groupedSettlementConfigurationError } from './groupedSettlementPeriod'
import { groupedSettlementSupplierDataset, groupedSettlementSupplierRequest } from './groupedSettlementSupplier.test-fixtures'
import { profitSupplierDataset } from './profitReadMode.test-fixtures'
import { datasetFieldHierarchy, datasetGroupSelectionError, isDatasetGroupSelection, withDatasetGroupConditions } from './reportHierarchyFilters'
import { REPORT_FILTER_CONDITIONS } from './reportOptions'
import type { AnalysisHierarchy } from './currentVparivanieAnalysis'
import type { ReportDataset, ReportSelection } from '../types'

const hierarchy = (field: number) => wire.filters.find(filter => filter.type === (field === 6 ? 5 : field))!.hierarchy as AnalysisHierarchy
const declared = (field: number): AnalysisHierarchy => ({ ...hierarchy(field), itemField: field })
const FOLDER = 'A0000000000000000000000000000001'
const group = { kind: 'counterpartyGroup', world: 'fenix', id: FOLDER }
const selection = (field: number, condition: number, ...data: Record<string, unknown>[]): ReportSelection => ({
  IsChecked: true, SelectedField: { Type: field, Name: String(field) }, FilterCondition: { Type: condition, Name: String(condition) },
  Values: data.map((Data, index) => ({ Data, Name: `Значення ${index}`, Value: 0 })),
})
const supplierDataset: ReportDataset = { ...profitSupplierDataset,
  Filters: profitSupplierDataset.Filters.map(field => [1, 17].includes(field.Type) ? { ...field, hierarchy: declared(field.Type) } : field) }
const settlementDataset: ReportDataset = { ...groupedSettlementSupplierDataset,
  Filters: groupedSettlementSupplierDataset.Filters.map(field => [6, 17].includes(field.Type) ? { ...field, hierarchy: declared(field.Type) } : field) }
const dayDataset: ReportDataset = {
  DataSource: 35, Name: 'Валовий прибуток', Description: '', PeriodRequired: true, PeriodSupported: true,
  Groupings: [{ Type: 3, Name: 'День' }, { Type: 4, Name: 'Організація' }],
  Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: `Фільтр ${Type}`, ...([1, 6].includes(Type) ? { hierarchy: declared(Type) } : {}) })),
  Limitations: [],
}

describe('dataset hierarchy declarations', () => {
  it('reads only valid declared hierarchies on non-analysis datasets', () => {
    expect(datasetFieldHierarchy(supplierDataset, 17)?.itemKind).toBe('supplier')
    expect(datasetFieldHierarchy(supplierDataset, 1)?.groupKind).toBe('productGroup')
    expect(datasetFieldHierarchy(supplierDataset, 0)).toBeUndefined()
    expect(datasetFieldHierarchy(profitSupplierDataset, 17)).toBeUndefined()
    const wrong = { ...supplierDataset, Filters: supplierDataset.Filters.map(field => field.Type === 17 ? { ...field, hierarchy: declared(1) } : field) }
    expect(datasetFieldHierarchy(wrong, 17)).toBeUndefined()
  })
  it('adds group comparisons next to the exact ones they extend', () => {
    expect(withDatasetGroupConditions(supplierDataset, 17, REPORT_FILTER_CONDITIONS).map(condition => condition.Name))
      .toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі'])
    expect(withDatasetGroupConditions(supplierDataset, 0, REPORT_FILTER_CONDITIONS).map(condition => condition.Type)).toEqual([0, 1, 2, 4])
    expect(withDatasetGroupConditions(dayDataset, 6, REPORT_FILTER_CONDITIONS, [0, 2]).map(condition => condition.Type)).toEqual([0, 1, 2, 3, 4, 6])
  })
  it('requires typed groups for group comparisons and refuses them in flat ones', () => {
    expect(isDatasetGroupSelection(settlementDataset, selection(6, 7, group))).toBe(true)
    expect(isDatasetGroupSelection(settlementDataset, selection(0, 7, group))).toBe(false)
    expect(datasetGroupSelectionError(settlementDataset, selection(6, 7, group))).toBeNull()
    expect(datasetGroupSelectionError(settlementDataset, selection(6, 6, { kind: 'buyer', id: '5' }))).toMatch('оберіть групу')
    expect(datasetGroupSelectionError(settlementDataset, selection(6, 6, group, group))).toBe('Оберіть одну групу для цієї умови.')
    expect(datasetGroupSelectionError(settlementDataset, selection(6, 3, group, { kind: 'buyer', id: '5' }))).toBeNull()
    expect(datasetGroupSelectionError(settlementDataset, selection(6, 2, group))).toMatch('лише в умовах «У групі…»')
    expect(datasetGroupSelectionError(settlementDataset, selection(17, 5, { kind: 'supplier', id: '40' }, group))).toBeNull()
  })
})

describe('dataset validators', () => {
  it('admits supplier gross-profit group conditions and keeps exclusions behind the server capability', () => {
    const request = { ...defaultDatasetRequest(supplierDataset, '2026-09-01', '2026-09-23'),
      selections: [selection(1, 6, { kind: 'productGroup', id: 42 }), selection(17, 3, group, { kind: 'supplier', id: 7 })] }
    expect(supplierBatchGrossProfitConfigurationError(request, supplierDataset)).toBeNull()
    expect(datasetConfigurationError(request, supplierDataset)).toBeNull()
    const exclusion = { ...request, selections: [selection(17, 7, group)] }
    expect(supplierBatchGrossProfitConfigurationError(exclusion, supplierDataset))
      .toBe('Сервер не підтвердив виключення для партійного прибутку. Налаштування не змінено.')
    expect(supplierBatchGrossProfitConfigurationError(exclusion, { ...supplierDataset, FilterExpression: { Version: 1, Operators: [1, 2], MaximumDepth: 3, MaximumLeaves: 16, MaximumNodes: 32 } }))
      .not.toBe('Сервер не підтвердив виключення для партійного прибутку. Налаштування не змінено.')
    expect(supplierBatchGrossProfitConfigurationError({ ...request, selections: [selection(17, 6, { kind: 'supplier', id: 7 })] }, supplierDataset))
      .toMatch('оберіть групу')
  })
  it('admits buyer and supplier folders in grouped settlements', () => {
    const request = { ...groupedSettlementSupplierRequest(), selections: [selection(6, 5, group, { kind: 'buyer', id: '9' }), selection(17, 6, group)] }
    expect(groupedSettlementConfigurationError(request, settlementDataset)).toBeNull()
    expect(groupedSettlementConfigurationError({ ...request, selections: [selection(9, 6, group)] }, settlementDataset)).not.toBeNull()
    expect(groupedSettlementConfigurationError({ ...request, selections: [selection(6, 7, { kind: 'buyer', id: '9' })] }, settlementDataset))
      .toMatch('оберіть групу')
  })
  it('admits positive day-profit groups in every mode and negative groups only where exclusions are exact', () => {
    const request = { ...defaultDatasetRequest(dayDataset, '2026-09-01', '2026-09-01'),
      selections: [selection(1, 6, { kind: 'productGroup', id: 42 })] }
    expect(dayOrganizationGrossProfitConfigurationError(request, dayDataset)).toBeNull()
    const negative = { ...request, selections: [selection(6, 7, group)] }
    expect(dayOrganizationGrossProfitConfigurationError(negative, dayDataset)).toMatch('«Не дорівнює» та «Не у списку»')
  })
})
