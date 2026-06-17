import { describe, expect, it } from 'vitest'
import { URGENCY_COLOR } from './chartTheme'
import { buildTaskTypeSlices, buildUrgencySlices } from './donutData'

describe('buildUrgencySlices', () => {
  it('orders slices critical -> high -> normal -> low and applies the color scale', () => {
    const slices = buildUrgencySlices([
      { level: 'low', label: 'low', value: 3 },
      { level: 'critical', label: 'crit', value: 5 },
      { level: 'high', label: 'high', value: 2 },
    ])

    expect(slices.map((slice) => slice.name)).toEqual(['crit', 'high', 'low'])
    expect(slices[0].color).toBe(URGENCY_COLOR.critical)
  })

  it('drops zero and missing buckets', () => {
    const slices = buildUrgencySlices([
      { level: 'critical', label: 'crit', value: 0 },
      { level: 'normal', label: 'norm', value: 4 },
    ])

    expect(slices).toHaveLength(1)
    expect(slices[0].name).toBe('norm')
  })
})

describe('buildTaskTypeSlices', () => {
  it('keeps positive slices and assigns palette colors when none provided', () => {
    const slices = buildTaskTypeSlices([
      { type: 'call', label: 'call', value: 4 },
      { type: 'visit', label: 'visit', value: 0 },
      { type: 'email', label: 'email', value: 2, color: 'blue.6' },
    ])

    expect(slices.map((slice) => slice.name)).toEqual(['call', 'email'])
    expect(slices[1].color).toBe('blue.6')
    expect(slices[0].color).toBeTruthy()
  })
})
