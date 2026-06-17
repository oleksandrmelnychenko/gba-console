import { describe, expect, it } from 'vitest'
import { computeWaterfall } from './marginWaterfallData'

describe('computeWaterfall', () => {
  it('anchors the first step from zero and floats subsequent steps', () => {
    const { rows, domainMax } = computeWaterfall([
      { key: 'cost', label: 'cost', value: 10 },
      { key: 'floor', label: 'floor', value: 14 },
      { key: 'recommended', label: 'recommended', value: 18 },
      { key: 'baseline', label: 'baseline', value: 16 },
    ])

    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ base: 0, delta: 10, rising: true })
    expect(rows[1]).toMatchObject({ base: 10, delta: 4, rising: true })
    expect(rows[2]).toMatchObject({ base: 14, delta: 4, rising: true })
    expect(rows[3]).toMatchObject({ base: 16, delta: 2, rising: false })
    expect(domainMax).toBeCloseTo(18 * 1.1)
  })

  it('skips steps with null or non-finite values', () => {
    const { rows } = computeWaterfall([
      { key: 'cost', label: 'cost', value: 10 },
      { key: 'floor', label: 'floor', value: null },
      { key: 'recommended', label: 'recommended', value: 15 },
    ])

    expect(rows.map((row) => row.key)).toEqual(['cost', 'recommended'])
    expect(rows[1]).toMatchObject({ base: 10, delta: 5, rising: true })
  })

  it('returns an empty result when nothing is finite', () => {
    const { rows, domainMax } = computeWaterfall([{ key: 'cost', label: 'cost', value: null }])
    expect(rows).toHaveLength(0)
    expect(domainMax).toBe(0)
  })
})
