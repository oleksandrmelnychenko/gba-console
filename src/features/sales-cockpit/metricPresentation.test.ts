import { describe, expect, it } from 'vitest'
import { departmentPaceColor } from './metricPresentation'

describe('Department working-day pace', () => {
  it('does not mark 20% of the month red when only 10% was expected by today', () => {
    expect(departmentPaceColor(1000, 200, 100)).toBe('green')
  })
  it('does not mark 80% healthy when 95% was expected by today', () => {
    expect(departmentPaceColor(1000, 800, 950)).toBe('red')
  })
  it('separates on-pace and missing historical baseline', () => {
    expect(departmentPaceColor(1000, 500, 500)).toBe('orange')
    expect(departmentPaceColor(0, 500, 0)).toBe('gray')
  })
})
