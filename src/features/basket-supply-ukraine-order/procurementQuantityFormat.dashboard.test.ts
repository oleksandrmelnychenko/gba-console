import { expect, it } from 'vitest'
import { formatDashboardQuantity, quantityByUnit } from './procurementQuantityFormat'

const plain = (value: string) => value.replace(/\s/g, ' ')

it('prints whole units as integers and measured units with two decimals', () => {
  expect(plain(formatDashboardQuantity(788.1, 'м'))).toBe('788,10 м')
  expect(plain(formatDashboardQuantity(800.61, 'л'))).toBe('800,61 л')
  expect(plain(formatDashboardQuantity(12216, 'шт'))).toBe('12 216 шт')
  expect(plain(formatDashboardQuantity(15.4, 'компл.'))).toBe('15 компл.')
  expect(plain(formatDashboardQuantity(40, 'м'))).toBe('40 м')
})
it('keeps decimals even without a unit and never rounds a small fraction away', () => {
  expect(formatDashboardQuantity(788.1)).toBe('788,10')
  expect(formatDashboardQuantity(800.61, null)).toBe('800,61')
  expect(formatDashboardQuantity(0.021)).toBe('0,021')
  expect(plain(formatDashboardQuantity(0.5, 'шт'))).toBe('0,5 шт')
})
it('adds quantities per unit and refuses a total when a unit is missing', () => {
  const items = [{ unit: 'шт', qty: 10 }, { unit: 'м', qty: 2.5 }, { unit: 'шт', qty: 5 }, { unit: null, qty: 0 }]
  expect(quantityByUnit(items, item => item.unit, item => item.qty)).toEqual({ шт: 15, м: 2.5 })
  expect(quantityByUnit([...items, { unit: null, qty: 3 }], item => item.unit, item => item.qty)).toBeNull()
  expect(quantityByUnit([], () => 'шт', () => 1)).toBeNull()
})
