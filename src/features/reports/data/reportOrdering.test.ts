import { describe, expect, it } from 'vitest'
import { readOrderingCapabilities, readReportOrdering, reconcileReportOrdering, reportOrderingError, requestOrdering, setReportOrderRule } from './reportOrdering'
import { accountOrdering, orderedAccountDataset, orderedAccountRequest } from './reportOrdering.test-fixtures'
import { transferReportGrouping } from './reportGroupingLayout'
import { datasetConfigurationError } from './reportDatasets'
import type { ReportOrderRule, ReportOrdering } from '../types'

describe('typed ordering contracts', () => {
  it.each([undefined, null, { Version: 1, Rows: [], Columns: [] }])('preserves absent/default ordering without requiring new server capabilities %#', ordering => {
    expect(reportOrderingError({ ...orderedAccountRequest(), ordering }, { ...orderedAccountDataset, Ordering: undefined })).toBeNull()
  })
  it.each([
    { ...accountOrdering, Version: 2 }, { ...accountOrdering, Expression: 'Amount DESC' }, { ...accountOrdering, Rows: null },
    { Version: 1, Rows: [{ By: 1, Direction: 1, Nulls: 2 }], Columns: [] },
    ...['By', 'Direction', 'Nulls'].map(key => ({ ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], [key]: 0 }] })),
    { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], By: '3' }] },
    { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], Grouping: '40' }] },
    { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], Path: 'Supplier.Name' }] },
    { ...accountOrdering, Rows: [accountOrdering.Rows[0], accountOrdering.Rows[0]] },
  ])('rejects malformed/unknown rules intact %#', ordering => {
    const data = { ...orderedAccountRequest(), ordering }, copy = structuredClone(data)
    expect(readReportOrdering(ordering)).toBeNull(); expect(datasetConfigurationError(data, orderedAccountDataset)).toContain('Некоректні правила'.toLowerCase())
    expect(data).toEqual(copy); expect(setReportOrderRule(ordering, 'Rows', 40, null)).toBe(ordering)
  })
  it('accepts exactly32 rules and rejects a33rd rule without truncation', () => {
    const Rows: ReportOrderRule[] = Array.from({ length: 32 }, (_, Grouping) => ({ Grouping, By: 1, Direction: 1, Nulls: 2 }))
    expect(readReportOrdering({ Version: 1, Rows, Columns: [] })?.Rows).toHaveLength(32)
    expect(readReportOrdering({ Version: 1, Rows: [...Rows, { ...Rows[0], Grouping: 32 }], Columns: [] })).toBeNull()
  })
  it('requires explicit Year0 identity and uses server caption capabilities for typed dates', () => {
    const dataset = { ...orderedAccountDataset, Groupings: [{ Type: 0, Name: 'Рік' }], Ordering: { Version: 1, MaximumRules: 32, Groupings: [{ Type: 0, By: [1, 3] }] } }
    const data = orderedAccountRequest(); data.sorted.Row = [{ type: 0, key: 'Year', label: 'Рік' }]
    data.ordering = { Version: 1, Rows: [{ Grouping: 0, By: 1, Direction: 2, Nulls: 1 }], Columns: [] }
    expect(reportOrderingError(data, dataset)).toBeNull()
    ;(data.ordering as ReportOrdering).Rows[0].By = 2
    expect(reportOrderingError(data, dataset)).toContain('Для дат і чисел')
  })
  it('rejects wrong-axis, unknown and duplicate layout targets and unsupported modes', () => {
    const data = orderedAccountRequest()
    for (const Row of [[], [...data.sorted.Row, data.sorted.Row[3]]]) expect(reportOrderingError({ ...data, sorted: { ...data.sorted, Row } }, orderedAccountDataset)).toContain('рівно один раз')
    expect(reportOrderingError({ ...data, ordering: { ...accountOrdering, Rows: [], Columns: accountOrdering.Rows } }, orderedAccountDataset)).toContain('відповідній осі')
    expect(reportOrderingError({ ...data, ordering: { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], Grouping: 999 }] } }, orderedAccountDataset)).toContain('[999]')
  })
  it('retains a rule when its measure is disabled and disallows hidden/foreign measure selectors', () => {
    const data = orderedAccountRequest(), copy = structuredClone(data.ordering)
    data.sorted.Measurements[0].IsChecked = false
    expect(reportOrderingError(data, orderedAccountDataset)).toContain('увімкнений показник')
    expect(data.ordering).toEqual(copy)
    data.sorted.Measurements[0].IsChecked = true
    expect(reportOrderingError(data, orderedAccountDataset)).toBeNull()
    for (const rule of [{ ...accountOrdering.Rows[0], Measure: null }, { ...accountOrdering.Rows[0], Measure: 17 }]) expect(reportOrderingError({ ...data, ordering: { ...accountOrdering, Rows: [rule] } }, orderedAccountDataset)).toContain('увімкнений показник')
    expect(reportOrderingError({ ...data, ordering: { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], By: 1 }] } }, orderedAccountDataset)).toContain('лише до сортування за підсумком')
  })
  it('preserves valid unknown-capability data while refusing to advertise unsupported ordering', () => {
    for (const Ordering of [undefined, null, { Version: 2 }, { Version: 1, MaximumRules: 33, Groupings: [] }, { Version: 1, MaximumRules: 32, Groupings: [{ Type: 40, By: [4] }] }]) {
      const dataset = { ...orderedAccountDataset, Ordering }
      expect(readOrderingCapabilities(dataset)).toBeNull(); expect(reportOrderingError(orderedAccountRequest(), dataset)).toContain('не підтвердив')
    }
  })
  it('recognizes imported PascalCase without dropping it and refuses conflicting aliases', () => {
    const data = orderedAccountRequest(); delete data.ordering; data.Ordering = structuredClone(accountOrdering)
    expect(requestOrdering(data)).toEqual(accountOrdering); expect(reportOrderingError(data, orderedAccountDataset)).toBeNull()
    expect(reportOrderingError({ ...data, ordering: accountOrdering }, orderedAccountDataset)).toContain('двічі')
  })
  it('moves a rule atomically between axes and reports explicit removals without changing rule selectors', () => {
    const data = orderedAccountRequest(), previous = data.sorted, next = transferReportGrouping(previous, 'Row', 40, new Set([40,41,44,45]))
    const moved = reconcileReportOrdering(data.ordering, previous, next)
    expect(moved).toEqual({ ordering: { Version: 1, Rows: [], Columns: accountOrdering.Rows }, moved: [40], removed: [] })
    expect(reportOrderingError({ ...data, sorted: { ...data.sorted, ...next }, ordering: moved.ordering }, orderedAccountDataset)).toBeNull()
    expect(reconcileReportOrdering(moved.ordering, next, { ...next, Col: [] })).toEqual({ ordering: { Version: 1, Rows: [], Columns: [] }, moved: [], removed: [40] })
    expect(data.ordering).toEqual(accountOrdering)
  })
  it('leaves malformed saved ordering and already invalid targets intact during unrelated layout edits', () => {
    const data = orderedAccountRequest(), unknown = { Version: 2, Rows: 'future' }
    expect(reconcileReportOrdering(unknown, data.sorted, data.sorted).ordering).toBe(unknown)
    const orphan = { ...accountOrdering, Rows: [{ ...accountOrdering.Rows[0], Grouping: 999 }] }
    expect(reconcileReportOrdering(orphan, data.sorted, { ...data.sorted, Row: [] }).ordering).toEqual(orphan)
  })
})
