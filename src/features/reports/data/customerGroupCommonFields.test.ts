import { expect, it } from 'vitest'
import type { ReportDataset, ReportSelection } from '../types'
import { parseReportDatasets } from '../api/reportWorkspaceApi'
import { salesDocumentLookupPolicy, usesSalesDocumentLookup } from '../api/nativeSalesDocumentLookup'
import { customerGroupConditionTypes, customerGroupSelectionsError } from './customerGroupSelections'
import { customerGroupChoiceValues } from './customerGroupChoiceValues'
import { customerCommonFieldsDataset as dataset, customerProductHierarchy } from './customerGroupCommonFields.test-fixtures'
import { changeAnalysisSelectionCondition } from './currentVparivanieAnalysis'

const selection = (field: number, condition = 2): ReportSelection => ({ IsChecked: true, SelectedField: { Type: field, Name: String(field) },
  FilterCondition: { Type: condition, Name: 'Умова' }, Values: [{ Data: '{"Id":"9007199254740993"}' as never, Name: 'Збережений', Value: 0 },
    { Data: { Id: '9223372036854775807' }, Name: 'Архівний', Value: 0 }] })

it('requires the exact source44 document capability and advertised fields, preserving implicit source2', () => {
  const parsed = parseReportDatasets([dataset])[0]
  expect(usesSalesDocumentLookup(44, 12, parsed)).toBe(true); expect(usesSalesDocumentLookup(44, 14, parsed)).toBe(true)
  expect(usesSalesDocumentLookup(2, 12)).toBe(true); expect(usesSalesDocumentLookup(2, 14)).toBe(true)
  expect(usesSalesDocumentLookup(44, 12)).toBe(false); expect(usesSalesDocumentLookup(44, 13, parsed)).toBe(false)
  for (const bad of [{ ...dataset, DataSource: 3 }, { ...dataset, salesDocumentLookup: { version: 2 } },
    { ...dataset, salesDocumentLookup: { ...(dataset.salesDocumentLookup as object), extra: true } },
    { ...dataset, Filters: dataset.Filters.filter(field => field.Type !== 14) }, { ...dataset, SalesDocumentLookup: dataset.salesDocumentLookup }]) {
    expect(() => parseReportDatasets([bad])).toThrow('некоректний список')
  }
})
it.each([12, 14, 15, 16])('keeps exact Int64 field%d data untouched and blocks incomplete/single-valued settings', field => {
  const saved = selection(field), original = structuredClone(saved)
  expect(customerGroupSelectionsError(44, [saved], dataset)).toBeNull()
  expect(customerGroupSelectionsError(44, [{ ...saved, FilterCondition: { Type: 0, Name: 'Дорівнює' } }], dataset)).toBe('Оберіть одне значення для цієї умови.')
  expect(customerGroupSelectionsError(44, [{ ...saved, Values: [] }], dataset)).toContain('Оберіть значення')
  expect(customerGroupSelectionsError(44, [{ ...saved, IsChecked: false, Values: [] }], dataset)).toBeNull()
  expect(customerGroupSelectionsError(44, [{ ...saved, Values: [{ ...saved.Values[0], Data: { Id: 9007199254740992 } }] }], dataset)).toContain('ідентифікатор')
  expect(saved).toEqual(original)
  if (field === 15 || field === 16) {
    const choices = customerGroupChoiceValues(saved.Values, [{ Id: '9007199254740993', Name: 'Нова назва' }], field)
    expect(choices.change(['9007199254740993', '9223372036854775807'])).toEqual(saved.Values)
  }
})
it('keeps old unsupported document templates visible but blocked until server capability is present', () => {
  const old = { ...dataset, salesDocumentLookup: undefined }, saved = selection(12), raw = JSON.stringify(saved)
  expect(customerGroupSelectionsError(44, [saved], old)).toContain('не підтвердив довідник документів')
  expect(customerGroupSelectionsError(44, [saved])).toContain('не підтвердив довідник документів')
  expect(customerGroupSelectionsError(44, [{ ...saved, IsChecked: false }], old)).toBeNull()
  expect(JSON.stringify(saved)).toBe(raw)
})
it('allows all8 Product conditions only from the exact hierarchy contract; direct group and authors stay flat', () => {
  expect(customerGroupConditionTypes(dataset, 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  for (const field of [4, 12, 14, 15, 16, 21]) expect(customerGroupConditionTypes(dataset, field)).toEqual([0, 1, 2, 4])
  for (const hierarchy of [undefined, { ...customerProductHierarchy, itemField: 4 }, { ...customerProductHierarchy, version: 2 }]) {
    const old = { ...dataset, Filters: dataset.Filters.map(field => field.Type === 1 ? { ...field, hierarchy } : field) } as ReportDataset
    expect(customerGroupConditionTypes(old, 1)).toEqual([0, 1, 2, 4])
  }
})
it.each([3, 5])('retains typed product/group identities and raw saved bytes for mixed condition%d', condition => {
  const saved = selection(1, condition); saved.Values = [{ Data: { kind: 'productGroup', id: '9223372036854775807' }, Name: 'Група', Value: 0 },
    { Data: { kind: 'product', id: '9007199254740993' }, Name: 'Товар', Value: 0 }]
  const raw = JSON.stringify(saved)
  expect(customerGroupSelectionsError(44, [saved], dataset)).toBeNull()
  expect(customerGroupSelectionsError(44, [saved], { ...dataset, Filters: dataset.Filters.map(field => ({ ...field, hierarchy: undefined })) })).toContain('чотирьох')
  expect(JSON.stringify(saved)).toBe(raw)
  const single = changeAnalysisSelectionCondition(saved, { Type: 6, Name: 'У групі' })
  expect(single.Values).toEqual(saved.Values); expect(customerGroupSelectionsError(44, [single], dataset)).toContain('одну групу')
  single.Values = [saved.Values[1]]; expect(customerGroupSelectionsError(44, [single], dataset)).toContain('оберіть групу')
  single.Values = [saved.Values[0]]; expect(customerGroupSelectionsError(44, [single], dataset)).toBeNull()
  const flat = { ...saved, Values: [saved.Values[1]], FilterCondition: { Type: 0, Name: 'Дорівнює' } }
  expect(customerGroupSelectionsError(44, [flat], dataset)).toContain('Групи можна обрати лише')
})
it('does not grant hierarchy to direct ProductGroup4 even if an unrelated descriptor is present', () => {
  const direct = { ...dataset, Filters: dataset.Filters.map(field => field.Type === 4 ? { ...field, hierarchy: customerProductHierarchy } : field) }
  const saved = selection(4, 3)
  expect(customerGroupSelectionsError(44, [saved], direct)).toContain('чотирьох')
  expect(customerGroupConditionTypes(direct, 4)).toEqual([0, 1, 2, 4])
})

it('keeps the exact native and legacy financial document lookup date scope', () => {
  const dates = ['2026-10-18', '2026-10-27'] as const
  for (const [source, field, metadata, native, period] of [
    [44, 12, dataset, true, dates], [44, 14, dataset, true, dates], [44, 12, undefined, false, []],
    [2, 12, undefined, true, dates], [2, 14, undefined, true, dates], [35, 12, undefined, false, dates],
    [35, 14, undefined, false, []], [44, 15, dataset, false, []], [3, 12, undefined, false, []],
  ] as const) {
    const policy = salesDocumentLookupPolicy(source, field, metadata, false, ...dates)
    expect(policy.native).toBe(native); expect(policy.period).toEqual(period)
    expect(policy.legacyAllowed).toBe(!(source === 44 && (field === 12 || field === 14)))
    expect(policy.unavailable).toBe(source === 44 && field === 12 && !metadata)
    expect(salesDocumentLookupPolicy(source, field, metadata, true, ...dates).unavailable).toBe(true)
  }
})
