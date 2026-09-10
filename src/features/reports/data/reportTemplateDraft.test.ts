import { describe, expect, it } from 'vitest'
import { createSalesReportPreset } from './reportPresets'
import { retainStoredTemplateFields } from './reportTemplateDraft'

describe('saved-template draft preservation', () => {
  it('preserves unrecognized settings and grouping metadata while allowing explicit option removal and full filter edits', () => {
    const data = createSalesReportPreset('agreements', '', '', []).Data
    const stored = { ...data, future: { nil: null, enabled: false }, ordering: { Version: 1 },
      sorted: { ...data.sorted, futureLayout: ['keep'], Row: data.sorted.Row.map(item => ({ ...item, futureId: 42 })) } }
    const draft = { ...data, from: '2026-09-01', selections: [{ SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'InGroup', Type: 6 }, IsChecked: false, Values: [{ Name: '42', Value: 42, Data: { Id: 42 } }] }] }
    const result = retainStoredTemplateFields(stored, draft)
    expect(result).toMatchObject({ future: { nil: null, enabled: false }, from: '2026-09-01', selections: draft.selections })
    expect(result.sorted).toMatchObject({ futureLayout: ['keep'], Row: stored.sorted.Row })
    expect(result).not.toHaveProperty('ordering')
    expect(result.selections).not.toBe(draft.selections)
    expect(stored.ordering).toEqual({ Version: 1 })
  })
  it('retains stored unchecked measures and their metadata without restoring a checked measure deselected in the form', () => {
    const data = createSalesReportPreset('agreements', '', '', []).Data
    const first = data.sorted.Measurements[0]
    const unchecked = { ...first, Type: 902, IsChecked: false, future: { nil: null, keep: 0 } }
    const deselected = { ...first, Type: 903, IsChecked: true }
    const stored = { ...data, sorted: { ...data.sorted, Measurements: [first, unchecked, deselected] } }
    const draft = { ...data, sorted: { ...data.sorted, Measurements: [first] } }
    const result = retainStoredTemplateFields(stored, draft)
    expect(result.sorted.Measurements).toEqual([first, unchecked])
    expect(result.sorted.Measurements[1]).not.toBe(unchecked)
    const selected = retainStoredTemplateFields(stored, { ...draft, sorted: { ...draft.sorted,
      Measurements: [first, { ...unchecked, IsChecked: true }] } })
    expect(selected.sorted.Measurements.filter(item => item.Type === 902)).toEqual([{ ...unchecked, IsChecked: true }])
  })

})
