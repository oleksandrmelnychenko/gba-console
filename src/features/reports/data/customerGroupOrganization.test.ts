import { expect, it } from 'vitest'
import { customerGroupOrganizationError, customerGroupOrganizationId } from './customerGroupOrganization'
import type { ReportSelection } from '../types'
const selection = (condition = 2, checked = true): ReportSelection => ({ IsChecked: checked, SelectedField: { Type: 0, Name: 'Organization' },
  FilterCondition: { Type: condition, Name: '' }, Values: [10, 20].map(Id => ({ Data: { Id }, Name: 'Однакова назва', Value: Id })) })
it.each([{ Id: 10 }, { id: '10' }, '{"Id":10}', '{ "Id": "10", "Name":"Стара назва" }'])('reads exact saved identity without rewriting %j', value => {
  const copy = structuredClone(value); expect(customerGroupOrganizationId(value)).toBe(10); expect(value).toEqual(copy)
})
it.each([null, {}, { Id: 0 }, { Id: -1 }, { Id: 1.1 }, { Id: 9007199254740992 }, { Id: '9007199254740993' },
  '{"Id":9007199254740993}', '{"Id":1.00000000000000001}', '{"Id":1e0}', '{"Id":1,"Id":2}', '{"Id":1,"id":2}', { Id: '01' }])('refuses invalid or rounded identity %j', value => expect(customerGroupOrganizationId(value)).toBeNull())
it.each([0, 1])('blocks checked single-value condition%i but preserves all values', condition => {
  const value = selection(condition), before = structuredClone(value)
  expect(customerGroupOrganizationError(44, [value])).toBe('Оберіть одне значення для цієї умови.')
  expect(value).toEqual(before); expect(customerGroupOrganizationError(2, [value])).toBeNull()
})
it.each([2, 4])('accepts list condition%i and preserves duplicate saved IDs', condition => {
  const value = selection(condition); value.Values.push(value.Values[0])
  expect(customerGroupOrganizationError(44, [value])).toBeNull(); expect(value.Values).toHaveLength(3)
})
it('does not let an unchecked invalid row change the active scope', () => {
  const value = selection(0, false); value.Values[0].Data = { Id: -1 }
  expect(customerGroupOrganizationError(44, [value])).toBeNull()
  value.IsChecked = true; value.Values = [value.Values[0]]
  expect(customerGroupOrganizationError(44, [value])).toContain('ідентифікатор')
})
