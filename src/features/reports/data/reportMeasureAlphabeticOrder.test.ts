import { expect, it } from 'vitest'
import { alphabetizeMeasurements } from './reportConstructorTree'
import type { ReportMeasurementGroup } from '../types'

const labels = ['Їжа', 'Інше', 'Ємність', 'Ґатунок', 'Група 10', 'Група 2']
const groups: ReportMeasurementGroup[] = labels.map((Label, index) => ({ Name: `group${index}`, Label, IsChecked: false,
  SubList: [{ Type: index * 2, Name: 'second', Label: 'Показник 10', IsChecked: false },
    { Type: index * 2 + 1, Name: 'first', Label: 'Показник 2', IsChecked: true }] }))
it.each([1, -1] as const)('orders Ukrainian groups and numeric children independently, direction %i', direction => {
  const before = structuredClone(groups)
  const sorted = alphabetizeMeasurements(groups, direction, group => group.Label!, item => item.Label!)
  const names = ['Група 2', 'Група 10', 'Ґатунок', 'Ємність', 'Інше', 'Їжа']
  expect(sorted.map(group => group.Label)).toEqual(direction === 1 ? names : names.toReversed())
  expect(sorted.every(group => group.SubList.map(item => item.Label).join() ===
    (direction === 1 ? 'Показник 2,Показник 10' : 'Показник 10,Показник 2'))).toBe(true)
  expect(sorted.flatMap(group => group.SubList).filter(item => item.IsChecked).map(item => item.Type).toSorted()).toEqual([1, 3, 5, 7, 9, 11].toSorted())
  expect(groups).toEqual(before)
  for (const group of sorted) expect(new Set(group.SubList.map(item => item.Type))).toEqual(new Set(before.find(item => item.Name === group.Name)!.SubList.map(item => item.Type)))
})
it('keeps manual order for equivalent labels in either direction', () => {
  const same = groups.slice(0, 2).map(group => ({ ...group, Label: 'Однаково',
    SubList: group.SubList.map(item => ({ ...item, Label: 'Показник' })) }))
  for (const direction of [1, -1] as const) expect(alphabetizeMeasurements(same, direction, group => group.Label!, item => item.Label!)).toEqual(same)
})
