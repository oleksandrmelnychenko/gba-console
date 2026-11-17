import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDaysToEnd } from './offerHelpers'

afterEach(() => vi.useRealTimers())

describe('offer validity days', () => {
  it('counts calendar days to the shown date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 17, 18, 30))

    expect(getDaysToEnd(new Date(2026, 10, 19, 9, 0))).toBe(2)
    expect(getDaysToEnd(new Date(2026, 10, 17, 23, 0))).toBe(0)
    expect(getDaysToEnd(new Date(2026, 10, 18, 0, 5))).toBe(1)
  })
})
