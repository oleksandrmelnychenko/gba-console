import { expect, it } from 'vitest'
import type { NativeReportPreview } from './nativeReportPreview'
import { reportQuantityExplanations } from './reportQuantityExplanations'

const historicalUnitReason = 'Кількість не визначено без підтвердженої історичної одиниці виміру документа.'
function preview(source = 'NativePriceComparison', measureType: number | null = 0, money = false): NativeReportPreview {
  return {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, PeriodFrom: '20.10.2026', PeriodTo: '20.10.2026',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: [], ColumnGroupings: [],
      Measures: ['Довільна назва'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
    valueSemantics: [{ columnSourceIndex: 7, measureType, semantics: money
      ? { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 }
      : { kind: 'quantity', currencyPolicy: 'notApplicable', unitPolicy: 'confirmedCompatibleUnit', aggregation: 'sumWithinCompatibleUnit', scalable: false, defaultDecimalPlaces: 3 } }],
  }
}
it('explains only the exact price-comparison quantity column independently of translated captions or sales profile', () => {
  const value = preview()
  expect([...reportQuantityExplanations(value)]).toEqual([[7, historicalUnitReason]])
  expect([...reportQuantityExplanations(value, 'sales')]).toEqual([[7, historicalUnitReason]])
})
it.each([
  ['NativePurchases', 0, false], ['NativeSalesNet', 0, false], ['UnknownNativeSource', 0, false],
  ['NativePriceComparison', 2, false], ['NativePriceComparison', null, false], ['NativePriceComparison', 0, true],
] as const)('does not invent the source46 unit reason for foreign or contradictory semantics %s/%s/%s', (source, measure, money) => {
  expect(reportQuantityExplanations(preview(source, measure, money)).size).toBe(0)
})
it('does not infer a document unit reason when measure semantics or result attribution is absent', () => {
  const value = preview(); delete value.valueSemantics
  expect(reportQuantityExplanations(value).size).toBe(0)
  const unattributed = preview(); unattributed.Request = null
  expect(reportQuantityExplanations(unattributed).size).toBe(0)
})
