import { expect, it } from 'vitest'
import { formatMonthLabel } from './monthLabel'

it('writes a month key the way the forecast chart names months and leaves other labels alone', () => {
  expect(formatMonthLabel('2026-12')).toBe('Гру 2026')
  expect(formatMonthLabel('2026-01-01')).toBe('Січ 2026')
  expect(formatMonthLabel('2026-07')).toBe('Лип 2026')
  expect(formatMonthLabel('2026-13')).toBe('2026-13')
  expect(formatMonthLabel('Q4 2026')).toBe('Q4 2026')
  expect(formatMonthLabel(null)).toBe('')
})
