import { expect, it } from 'vitest'
import { originalNormalPeriodError } from './originalNormalPeriod'
it.each([
  ['2025-01-01', '2026-10-09', true], ['2025-01-31', '2034-12-31', true],
  ['2025-01-31', '2035-01-01', false], ['2028-02-29', '2028-03-01', true],
  ['2026-02-29', '2026-03-01', false], ['2024-12-31', '2025-01-01', false],
  ['2099-12-01', '2100-01-01', false], ['2026-10-09', '2025-01-01', false],
] as const)('checks the calendar period %s to %s', (from, through, accepted) => {
  expect(originalNormalPeriodError(from, through) === null).toBe(accepted)
})
