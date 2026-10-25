import { expect, it } from 'vitest'
import { bindProfitPreviewGrouping } from './workbookPreview'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { currentFinancialRequest } from './currentFinancialAxes.test-fixtures'

function payload() {
  return { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeDayOrganizationGrossProfit', ProfitReadMode: 0, IsCurrentSnapshot: false,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, HasPeriod: true, PeriodFrom: '2026-10-17', PeriodTo: '2026-10-23',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Клієнт'], ColumnGroupings: ['Договір'],
      Measures: ['Продажі'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Клієнт', Identity: 'CustomerName' }],
    ColumnSchema: [{ Caption: 'Договір', Identity: 'CustomerContract' }, { Caption: 'Прибуток', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Клієнт', Identity: { Kind: 'signedInteger', Value: '9223372036854775807' as string | null, Provenance: 'rowAxisKey' } }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [
      { Caption: 'Не вказано', Identity: { Kind: 'null', Value: null as string | null, Provenance: 'columnAxisKey' } },
      { Caption: 'Прибуток', Identity: { Kind: 'string', Value: 'profit', Provenance: 'columnAxisKey' } },
      { Caption: 'Продажі', Identity: { Kind: 'reportField', Value: 'SalesValueWithoutVAT', Provenance: 'columnAxisKey' } },
    ] }],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '7.00', Provenance: 'producerCell' } }],
  }
}
const normalize = (value: ReturnType<typeof payload>) => normalizeNativeReportPreview({ Preview: value })

it('binds exact client/agreement identities without replacing missing agreements by zero or making amounts unknown', () => {
  const preview = normalize(payload())
  expect(() => bindProfitPreviewGrouping(currentFinancialRequest(), preview)).not.toThrow()
  expect(preview.Rows[0].Values[0].Identity?.Value).toBe('9223372036854775807')
  expect(preview.Columns[0].Values[0].Identity).toMatchObject({ Kind: 'null', Value: null })
  expect(preview.Cells[0].Value.Value).toBe('7.00')
})

it.each(['0', '-1', '9223372036854775808', '1.5', ''])('rejects invalid native client identity %s', value => {
  const raw = payload(); raw.Rows[0].Values[0].Identity.Value = value
  expect(() => bindProfitPreviewGrouping(currentFinancialRequest(), normalize(raw))).toThrow()
})

it('rejects substituted dimensions, hidden legacy mode and a fake zero agreement', () => {
  const wrong = payload(); wrong.ColumnSchema[0].Identity = 'Organization'
  expect(() => bindProfitPreviewGrouping(currentFinancialRequest(), normalize(wrong))).toThrow()
  const legacy = payload(); legacy.Request.ProfitReadMode = 1
  expect(() => bindProfitPreviewGrouping(currentFinancialRequest(), normalize(legacy))).toThrow()
  const zero = payload(); zero.Columns[0].Values[0].Identity = { Kind: 'signedInteger', Value: '0', Provenance: 'columnAxisKey' }
  expect(() => bindProfitPreviewGrouping(currentFinancialRequest(), normalize(zero))).toThrow()
  expect(() => bindProfitPreviewGrouping({ ...currentFinancialRequest(), profitReadMode: 1 }, normalize(payload()))).toThrow()
})

it('accepts retained workbook settings with current client rows and rejects their attribution to a legacy mode', () => {
  const raw = { ...payload(), workbookPresentation: { version: 1, resultSha256: 'a'.repeat(64),
    selection: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' },
    fields: [{ type: 2, caption: 'Артикул', placement: 'retainedSetting' }, { type: 3, caption: 'Топ', placement: 'retainedSetting' }], rows: [] } }
  expect(normalize(raw).WorkbookPresentation?.fields).toHaveLength(2)
  raw.Request.ProfitReadMode = 1
  expect(() => normalize(raw)).toThrow()
})
