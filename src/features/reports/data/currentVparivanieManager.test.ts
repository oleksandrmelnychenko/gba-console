import { expect, it } from 'vitest'
import { currentVparivanieConfigurationError, currentVparivanieManagerReference, currentVparivanieManagerSupported, currentVparivanieNotice, isCurrentVparivanieDataset } from './currentVparivanie'
import { currentVparivanieDataset as legacy, currentVparivanieRequest, exactSelection } from './currentVparivanie.test-fixtures'
import { datasetFilters, datasetConfigurationError } from './reportDatasets'
const reference = 'ABCDEF1234567890ABCDEF1234567890'
const enabled = { ...legacy, currentVparivanie: { ...legacy.currentVparivanie as object, ManagerFilterSupported: true },
  Filters: legacy.Filters.map(field => field.Type === 60 ? { ...field, Selectable: true } : field) }
const manager = (Id = reference) => exactSelection(60, 0, [Id])
it('accepts only paired supported capability and selectable manager field', () => {
 expect(isCurrentVparivanieDataset(enabled)).toBe(true)
 expect(currentVparivanieManagerSupported(enabled)).toBe(true)
 expect(datasetFilters(enabled).map(f => f.field.Type)).toEqual([1,4,5,21,60])
 expect(datasetFilters(legacy).map(f => f.field.Type)).toEqual([1,4,5,21])
 for (const contradictory of [{ ...legacy, Filters: enabled.Filters }, { ...enabled, Filters: legacy.Filters }]) {
  expect(isCurrentVparivanieDataset(contradictory)).toBe(false)
  expect(datasetConfigurationError(currentVparivanieRequest(), contradictory)).not.toBeNull()
 }
})
it('allows exact current source-manager syntax without dataset and rejects old advertised capability', () => {
 const request = { ...currentVparivanieRequest(), selections: [exactSelection(1), manager()] }
 expect(currentVparivanieConfigurationError(request)).toBeNull()
 expect(currentVparivanieConfigurationError(request, enabled)).toBeNull()
 expect(currentVparivanieConfigurationError(request, legacy)).toContain('поки недоступний')
 expect(currentVparivanieManagerReference({ Id: reference.toLowerCase() })).toBe(reference)
})
it.each([null, undefined, 123, true, '', 'A'.repeat(31), 'A'.repeat(33), '0x'+reference, 'G'.repeat(32),
 'ABCDEF12-3456-7890-ABCD-EF1234567890', ' '+reference, reference+' '])('rejects nonexact manager identity %#', Id => {
 expect(currentVparivanieManagerReference({ Id })).toBeNull()
 const request = { ...currentVparivanieRequest(), selections: [exactSelection(1), manager()] }
 Object.assign(request.selections[1].Values[0].Data, { Id })
 expect(currentVparivanieConfigurationError(request, enabled)).not.toBeNull()
})
it('refuses ambiguous aliases, native User filter, multiple manager values and invalid conditions', () => {
 expect(currentVparivanieManagerReference({ Id: reference, id: reference })).toBeNull()
 for (const selection of [exactSelection(10), exactSelection(60,2,[reference]),exactSelection(60,0,[reference,reference]),
  { ...manager(), Values: [{ ...manager().Values[0], Value: 42 }] }]) {
  expect(currentVparivanieConfigurationError({ ...currentVparivanieRequest(), selections: [exactSelection(1),selection] },enabled)).not.toBeNull()
 }
})
it('permits all five bounded filters without losing the product/group intersection', () => {
 expect(currentVparivanieConfigurationError({ ...currentVparivanieRequest(), selections: [exactSelection(1),exactSelection(4,6),exactSelection(5),exactSelection(21),manager()] },enabled)).toBeNull()
})
it('describes only actual enabled source-manager customer-arm semantics', () => {
 expect(currentVparivanieNotice()).toContain('поки недоступний')
 expect(currentVparivanieNotice(true)).toContain('Менеджер покупця з 1С (Fenix) впливає лише на колонки контрагентів')
 expect(currentVparivanieNotice(true)).not.toContain('поки недоступний')
})

it('gates EmptyRef independently and preserves old named-manager capability', () => {
 const empty = '0'.repeat(32)
 const request = { ...currentVparivanieRequest(), selections: [exactSelection(1), manager(empty)] }
 const supported = { ...enabled, currentVparivanie: { ...enabled.currentVparivanie, ManagerUnassignedFilterSupported: true } }
 expect(currentVparivanieManagerReference({ Id: empty })).toBe(empty)
 expect(currentVparivanieConfigurationError(request)).toBeNull() // Saved syntax requires no invented current capability.
 expect(currentVparivanieConfigurationError(request, supported)).toBeNull()
 for (const old of [enabled, { ...enabled, currentVparivanie: { ...enabled.currentVparivanie, ManagerUnassignedFilterSupported: false } }]) {
  expect(currentVparivanieConfigurationError(request, old)).toContain('без основного менеджера')
  expect(currentVparivanieConfigurationError({ ...request, selections: [exactSelection(1), manager()] }, old)).toBeNull()
 }
 for (const value of ['true', 1, null]) {
  expect(isCurrentVparivanieDataset({ ...enabled, currentVparivanie: { ...enabled.currentVparivanie, ManagerUnassignedFilterSupported: value } })).toBe(false)
 }
 expect(isCurrentVparivanieDataset({ ...legacy, currentVparivanie: { ...legacy.currentVparivanie as object, ManagerUnassignedFilterSupported: true } })).toBe(false)
})
