import { expect, it } from 'vitest'
import { classLabel, regionDisplayName } from './assortmentLabels'

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
