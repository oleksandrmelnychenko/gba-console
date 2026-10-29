import { expect, it } from 'vitest'
import { customerGroupRegionError, isCustomerGroupRegion } from './customerGroupRegion'
import type { ReportSelection } from '../types'
const selection = (condition = 2, checked = true): ReportSelection => ({ IsChecked: checked, SelectedField: { Type: 7, Name: 'Поточний регіон клієнта' },
  FilterCondition: { Type: condition, Name: '' }, Values: [11, 22].map(Id => ({ Data: { Id }, Name: 'Однакова назва', Value: 0 })) })
it('admits only source44 parent Region7, never RegionCode8 or other reports', () => {
  expect(isCustomerGroupRegion(44, 7)).toBe(true); expect(isCustomerGroupRegion(44, 8)).toBe(false); expect(isCustomerGroupRegion(2, 7)).toBe(false)
  const invalid = selection(0); expect(customerGroupRegionError(2, [invalid])).toBeNull()
  invalid.SelectedField.Type = 8; expect(customerGroupRegionError(44, [invalid])).toBeNull()
})
it.each([0, 1])('requires exactly one checked parent region for condition%i without rewriting', condition => {
  const value = selection(condition), before = structuredClone(value)
  expect(customerGroupRegionError(44, [value])).toBe('Оберіть одне значення для цієї умови.'); expect(value).toEqual(before)
  value.Values = [value.Values[0]]; expect(customerGroupRegionError(44, [value])).toBeNull()
})
it.each([2, 4])('preserves duplicate saved list identities condition%i', condition => {
  const value = selection(condition); value.Values.push(value.Values[0]); expect(customerGroupRegionError(44, [value])).toBeNull(); expect(value.Values).toHaveLength(3)
})
it.each([{}, { RegionId: 11 }, { NetUid: 'same' }, { Id: '9007199254740993' }, '{"Id":1.00000000000000001}', '{"Id":11,"id":22}'])('rejects missing/unsafe parent identity without guessing from other keys %j', Data => {
  const value = selection(); value.Values = [{ Data, Value: 0, Name: 'Назва' }]
  expect(customerGroupRegionError(44, [value])).toContain('ідентифікатор'); value.IsChecked = false; expect(customerGroupRegionError(44, [value])).toBeNull()
})
it('retains canonical saved JSON and enforces bounded flat selection only', () => {
  const value = selection(); value.Values[0].Data = '{"Id":"11"}'; expect(customerGroupRegionError(44, [value])).toBeNull()
  value.FilterCondition.Type = 5; expect(customerGroupRegionError(44, [value])).toContain('чотирьох')
  value.FilterCondition.Type = 2; value.Values = Array.from({length:101},()=>value.Values[0]); expect(customerGroupRegionError(44,[value])).toContain('100')
})
