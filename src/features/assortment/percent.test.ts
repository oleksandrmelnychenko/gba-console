import { describe, expect, it } from 'vitest'
import { formatRatioPercent } from './percent'

describe('formatRatioPercent', () => {
  it('separates the percent sign with a non-breaking space', () => {
    expect(formatRatioPercent(0.18)).toBe('18\u00a0%')
    expect(formatRatioPercent(0.1234, 1)).toBe('12,3\u00a0%')
  })

  it('uses a real minus sign for negative values', () => {
    expect(formatRatioPercent(-1.43)).toBe('\u2212143\u00a0%')
    expect(formatRatioPercent(-0.055, 1)).toBe('\u22125,5\u00a0%')
  })

  it('does not sign a value that rounds to zero', () => {
    expect(formatRatioPercent(-0.001)).toBe('0\u00a0%')
  })
})
