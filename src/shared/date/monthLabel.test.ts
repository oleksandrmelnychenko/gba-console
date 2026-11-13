import { expect, it } from 'vitest'
import { formatMonthLabel } from './monthLabel'

it('writes a month key as MM.yyyy and leaves other labels alone', () => {
  expect(formatMonthLabel('2026-12')).toBe('12.2026')
  expect(formatMonthLabel('2026-01-01')).toBe('01.2026')
  expect(formatMonthLabel('2026-13')).toBe('2026-13')
  expect(formatMonthLabel('Q4 2026')).toBe('Q4 2026')
  expect(formatMonthLabel(null)).toBe('')
})
