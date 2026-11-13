import { expect, it } from 'vitest'
import { abcMixChips, abcUnclassifiedLabel, classLabel, regionDisplayName, stockAsOfNote } from './assortmentLabels'

it('names a missing ABC or XYZ class instead of showing the raw service value', () => {
  expect(classLabel('unknown')).toBe('Без класу')
  expect(classLabel('')).toBe('Без класу')
  expect(classLabel('A')).toBe('A')
})

it('shows the oblast name next to a known region code and keeps other values as sent', () => {
  expect(regionDisplayName('RI')).toBe('Рівненська (RI)')
  expect(regionDisplayName(' xm ')).toBe('Хмельницька (xm)')
  expect(regionDisplayName('Київ')).toBe('Київ')
  expect(regionDisplayName('Q7')).toBe('Q7')
  expect(regionDisplayName(null)).toBe('')
})

it('uses the service label for a product without an ABC class', () => {
  expect(abcUnclassifiedLabel({ abc: 'A', abc_label: 'A' })).toBeNull()
  expect(abcUnclassifiedLabel({ abc: 'unknown', abc_status: 'no_sales', abc_label: 'Без продажів за період' }))
    .toBe('Без продажів за період')
  expect(abcUnclassifiedLabel({ abc: 'unknown' })).toBe('Без класу')
  expect(abcUnclassifiedLabel({ abc: 'unknown', abc_label: 'unknown' })).toBe('Без класу')
})

it('splits the unclassified ABC count by the status the service reports', () => {
  expect(abcMixChips(
    { A: 2, B: 1, unknown: 5 },
    { classified: 3, no_sales: 4, non_positive_contribution: 1 },
    { no_sales: 'Без продажів за період', non_positive_contribution: 'Продажі перекриті поверненнями або коригуваннями' },
  )).toEqual([
    { key: 'A', label: 'A', count: 2 },
    { key: 'B', label: 'B', count: 1 },
    { key: 'status:no_sales', label: 'Без продажів за період', count: 4 },
    { key: 'status:non_positive_contribution', label: 'Продажі перекриті поверненнями або коригуваннями', count: 1 },
  ])
  expect(abcMixChips({ A: 2, unknown: 5 }, undefined, undefined)).toEqual([
    { key: 'A', label: 'A', count: 2 },
    { key: 'unknown', label: 'Без класу', count: 5 },
  ])
  expect(abcMixChips({}, { classified: 0 }, {})).toEqual([])
})

it('notes that stock is current only when it differs from the report date', () => {
  expect(stockAsOfNote({ stock_as_of: '2026-11-13', stock_matches_as_of: false }))
    .toBe('залишок і собівартість — на сьогодні (13.11.2026)')
  expect(stockAsOfNote({ stock_matches_as_of: false })).toBe('залишок і собівартість — на сьогодні')
  expect(stockAsOfNote({ stock_as_of: '2026-11-13', stock_matches_as_of: true })).toBeNull()
  expect(stockAsOfNote({})).toBeNull()
})
