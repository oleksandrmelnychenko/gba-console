import { describe, expect, it } from 'vitest'
import { createSalesReportPreset, SALES_REPORT_PRESETS } from './reportPresets'
import { sanitizeReportTemplate } from './reportOptions'
import type { ReportSelection } from '../types'

describe('sales report presets', () => {
  it.each(SALES_REPORT_PRESETS)('$id preserves period and filters and uses supported measures', ({ id, rowKeys, colKeys, measureTypes }) => {
    const selections: ReportSelection[] = [{
      IsChecked: false,
      SelectedField: { Name: 'ProductGroup', Type: 4 },
      FilterCondition: { Name: 'У списку', Type: 2 },
      Values: [{ Data: { Id: 42, Name: 'MAY' }, Name: 'MAY', Value: 42 }],
    }]

    const { Data: data } = createSalesReportPreset(id, '2026-09-01', '2026-09-03', selections)

    expect(data.from).toBe('2026-09-01')
    expect(data.to).toBe('2026-09-03')
    expect(data.selections).toEqual(selections)
    expect(data.selections[0]).not.toBe(selections[0])
    expect(data.sorted.Row.map((group) => group.key)).toEqual(rowKeys)
    expect(data.sorted.Col.map((group) => group.key)).toEqual(colKeys)
    expect(data.sorted.Measurements.map((measure) => measure.Type)).toEqual(measureTypes)
    expect(sanitizeReportTemplate(data).removedCount).toBe(0)
  })

  it('creates independent layouts and does not invent MAY or organization filters', () => {
    const first = createSalesReportPreset('daily', '2026-09-01', '2026-09-03', [])
    first.Data.sorted.Row[0].key = 'changed'
    first.Data.sorted.Measurements.length = 0
    const second = createSalesReportPreset('daily', '2026-09-01', '2026-09-03', [])
    expect(second.Data.sorted.Row[0].key).toBe('Day')
    expect(second.Data.sorted.Measurements).toHaveLength(12)
    expect(second.Data.selections).toEqual([])
  })

  it('keeps source responsible roles distinct from input/posting users and survives template loading', () => {
    const preset = createSalesReportPreset('responsibles', '2026-08-01', '2026-08-31', [])
    const { data } = sanitizeReportTemplate(preset.Data)
    expect(data.sorted.Row.map((group) => group.type)).toEqual([4, 22])
    expect(data.sorted.Col.map((group) => group.type)).toEqual([23])
    expect(data.sorted.Row[1].label).toBe('Відповідальний реалізації (1С)')
    expect(data.sorted.Col[0].label).toBe('Відповідальний замовлення (1С)')
    expect(data.sorted.Measurements.map((measure) => measure.Type)).toEqual([2, 4])
  })
})
