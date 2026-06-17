import { describe, expect, it } from 'vitest'
import { computeRangeBand } from './rangeBandData'

describe('computeRangeBand', () => {
  it('builds a band with padded domain covering markers and median', () => {
    const result = computeRangeBand({
      low: 10,
      high: 20,
      median: 15,
      markers: [
        { value: 8, label: 'floor' },
        { value: 18, label: 'recommended' },
      ],
    })

    expect(result.hasBand).toBe(true)
    expect(result.median).toBe(15)
    expect(result.markers).toHaveLength(2)
    expect(result.domain[0]).toBeLessThan(8)
    expect(result.domain[1]).toBeGreaterThan(20)
  })

  it('drops null and non-finite markers', () => {
    const result = computeRangeBand({
      low: null,
      high: null,
      median: null,
      markers: [
        { value: null, label: 'floor' },
        { value: Number.NaN, label: 'baseline' },
        { value: 12, label: 'recommended' },
      ],
    })

    expect(result.hasBand).toBe(false)
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].value).toBe(12)
  })

  it('treats a reversed or zero-width band as no band but keeps points', () => {
    const reversed = computeRangeBand({ low: 30, high: 10, median: 20, markers: [] })
    expect(reversed.hasBand).toBe(false)
    expect(reversed.median).toBe(20)
  })

  it('pads a degenerate single point so the domain has width', () => {
    const result = computeRangeBand({ low: null, high: null, median: 50, markers: [] })
    expect(result.domain[0]).toBeLessThan(50)
    expect(result.domain[1]).toBeGreaterThan(50)
  })
})
