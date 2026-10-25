import { expect, it } from 'vitest'
import { bindProfitPreviewGrouping } from './workbookPreview'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { productTimeRequest } from './currentFinancialProductTimeAxes.test-fixtures'

const identity = (Kind: string, Value: string | null) => ({ Kind, Value, Provenance: 'rowAxisKey' })
const dimensions: Record<number, { name: string; key: ReturnType<typeof identity> }> = {
  0: { name: 'Year', key: identity('signedInteger', '2026') },
  1: { name: 'Quarter', key: identity('dateTime', '2026-10-01T00:00:00.0000000') },
  2: { name: 'Month', key: identity('dateTime', '2026-10-01T00:00:00.0000000') },
  3: { name: 'Day', key: identity('dateTime', '2026-10-17T00:00:00.0000000') },
  4: { name: 'Organization', key: identity('signedInteger', '1') },
  5: { name: 'Product', key: identity('signedInteger', '9223372036854775807') },
  12: { name: 'CustomerName', key: identity('signedInteger', '12') },
  15: { name: 'CustomerContract', key: identity('null', null) },
}
function payload(rows = [5], columns = [2]) {
  const schema = (types: number[]) => types.map(type => ({ Caption: dimensions[type].name, Identity: dimensions[type].name }))
  const values = (types: number[]) => types.map(type => ({ Caption: dimensions[type].name, Identity: { ...dimensions[type].key } }))
  return { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeDayOrganizationGrossProfit', ProfitReadMode: 0, IsCurrentSnapshot: false,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, HasPeriod: true, PeriodFrom: '2026-10-17', PeriodTo: '2026-10-23',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: rows.map(type => dimensions[type].name),
      ColumnGroupings: columns.map(type => dimensions[type].name), Measures: ['Продажі'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: schema(rows), ColumnSchema: [...schema(columns), { Caption: 'Прибуток', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: values(rows) }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [...values(columns),
      { Caption: 'Прибуток', Identity: identity('string', 'profit') },
      { Caption: 'Продажі', Identity: identity('reportField', 'SalesValueWithVAT') }] }],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: identity('decimal', '7.00') }],
  }
}
const normalize = (value: ReturnType<typeof payload>) => normalizeNativeReportPreview({ Preview: value })

it.each([[[5], [2]], [[2], [5]], [[0, 5], []], [[1], [12]], [[5], [15]]])(
  'binds typed product/time axes %j / %j without coercing long IDs or business bucket dates', (rows, cols) => {
    const preview = normalize(payload(rows, cols))
    expect(() => bindProfitPreviewGrouping(productTimeRequest(rows, cols), preview)).not.toThrow()
    expect(preview.Cells[0].Value.Value).toBe('7.00')
    if (rows[0] === 5) expect(preview.Rows[0].Values[0].Identity?.Value).toBe('9223372036854775807')
  })

it('keeps a missing product identity null while its proven monetary value remains known', () => {
  const raw = payload(); raw.Rows[0].Values[0].Identity = identity('null', null)
  const preview = normalize(raw)
  expect(() => bindProfitPreviewGrouping(productTimeRequest(), preview)).not.toThrow()
  expect(preview.Rows[0].Values[0].Identity).toMatchObject({ Kind: 'null', Value: null })
  expect(preview.Cells[0].Value.Value).toBe('7.00')
})

it.each([
  [5, 'signedInteger', '0'], [5, 'signedInteger', '-1'], [5, 'signedInteger', '9223372036854775808'], [5, 'decimal', '1'],
  [0, 'dateTime', '2026-01-01T00:00:00.0000000'], [0, 'signedInteger', '0'], [0, 'signedInteger', '10000'], [0, 'null', null],
  [2, 'dateTime', '2026-10-01T00:00:00.0000000Z'], [2, 'dateTime', '2026-10-15T00:00:00.0000000'],
  [2, 'dateTime', '2026-13-01T00:00:00.0000000'], [2, 'dateTime', '0000-10-01T00:00:00.0000000'],
  [1, 'dateTime', '2026-02-01T00:00:00.0000000'], [1, 'dateTime', '2026-10-01T00:00:00.0000001'],
] as const)('rejects malformed %s identity %s/%s at the shared normalizer, including saved previews', (type, kind, value) => {
  const raw = payload([type], [4]); raw.Rows[0].Values[0].Identity = identity(kind, value)
  expect(() => normalize(raw)).toThrow('ключі товару або періоду')
})

it('rejects substituted schema, invalid column keys and historical-mode claims', () => {
  const wrong = payload(); wrong.RowSchema[0].Identity = 'Organization'
  expect(() => bindProfitPreviewGrouping(productTimeRequest(), normalize(wrong))).toThrow()
  const column = payload(); column.Columns[0].Values[0].Identity = identity('signedInteger', '202610')
  expect(() => normalize(column)).toThrow()
  const legacy = payload(); legacy.Request.ProfitReadMode = 1
  expect(() => normalize(legacy)).toThrow()
  expect(() => bindProfitPreviewGrouping({ ...productTimeRequest(), dayOrganizationBasis: 1 }, normalize(payload()))).toThrow()
})

it('accepts retained workbook settings for product/time rows without changing metadata-only fields', () => {
  const raw = { ...payload([2, 5], []), workbookPresentation: { version: 1, resultSha256: 'a'.repeat(64),
    selection: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' },
    fields: [{ type: 2, caption: 'Артикул', placement: 'retainedSetting' }, { type: 3, caption: 'Топ', placement: 'retainedSetting' }], rows: [] } }
  const preview = normalize(raw)
  expect(preview.WorkbookPresentation?.fields).toHaveLength(2)
  expect(() => bindProfitPreviewGrouping(productTimeRequest([2, 5], []), preview)).not.toThrow()
})
