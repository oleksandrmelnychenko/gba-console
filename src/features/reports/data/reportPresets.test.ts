import { describe, expect, it } from 'vitest'
import { createSalesReportPreset } from './reportPresets'

describe('sales report presets', () => {

  it('creates independent layouts and does not invent MAY or organization filters', () => {
    const first = createSalesReportPreset('daily', '2026-09-01', '2026-09-03', [])
    first.Data.sorted.Row[0].key = 'changed'
    first.Data.sorted.Measurements.length = 0
    const second = createSalesReportPreset('daily', '2026-09-01', '2026-09-03', [])
    expect(second.Data.sorted.Row[0].key).toBe('Day')
    expect(second.Data.sorted.Measurements).toHaveLength(12)
    expect(second.Data.selections).toEqual([])
  })
})
