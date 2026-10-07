import { describe, expect, it } from 'vitest'
import { normalizeNativeReportPreview, previewScalarText } from './nativeReportPreview'

const preview = {
  Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
  Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
  RowSchema: [{ Caption: 'Клієнт' }], ColumnSchema: [{ Caption: 'Сума' }],
  Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Клієнт А' }] }],
  Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Сума' }] }],
  Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
}
const request = {
  DataSource: 'NativeDayOrganizationGrossProfit', IsCurrentSnapshot: false,
  ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null,
  HasPeriod: true, PeriodFrom: '12.09.2026', PeriodTo: '12.09.2026',
  ComparisonPeriodFrom: null, ComparisonPeriodTo: null,
  RowGroupings: [], ColumnGroupings: [], Measures: [], Filters: [], IgnoredFilters: [], Notes: [],
}

describe('native report preview transport', () => {
  it('preserves an explicit null separately from an absent cell', () => {
    const result = normalizeNativeReportPreview({ Preview: preview })
    expect(previewScalarText(result.Cells[0].Value)).toBe('∅')
    expect(previewScalarText(undefined)).toBe('—')
  })

  it('rejects unexpected coordinates and oversized result pages', () => {
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Cells: [{ ...preview.Cells[0], RowSourceIndex: 11 }] } })).toThrow('клітинки')
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Page: { ...preview.Page, Limit: 200 } } })).toThrow('некоректний')
  })

  it('binds attribution only to the returned preview and preserves server display dates and repeated notes', () => {
    const source = { ...request, Notes: ['Не історична повнота.', 'Не історична повнота.'],
      Filters: [{ Field: 'Послуга Fenix', Condition: 'Дорівнює', Values: ['Ні'], IgnoredReason: null }] }
    const result = normalizeNativeReportPreview({ Request: { ...request, PeriodFrom: 'wrong' }, Preview: { ...preview, Request: source } })
    expect(result.Request).toEqual(source)
    source.Notes[0] = 'changed'
    source.Filters[0].Values[0] = 'Так'
    expect(result.Request?.Notes).toEqual(['Не історична повнота.', 'Не історична повнота.'])
    expect(result.Request?.Filters?.[0].Values).toEqual(['Ні'])
    expect(result.ResultSha256).toBe(preview.ResultSha256)
  })

  it.each([undefined, null])('keeps absent legacy attribution absent (%s)', Request => {
    expect(normalizeNativeReportPreview({ Preview: { ...preview, Request } }).Request).toBeNull()
  })

  it('retains nullable lists and dates without inventing empty or zero observations', () => {
    const result = normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...request,
      Notes: null, Filters: null, IgnoredFilters: null, PeriodFrom: null, PeriodTo: undefined } } })
    expect(result.Request).toMatchObject({ Notes: null, Filters: null, IgnoredFilters: null, PeriodFrom: null, PeriodTo: null })
  })

  it.each([
    { HasPeriod: 'true' }, { IsCurrentSnapshot: 1 }, { DataSource: 35 }, { PeriodFrom: {} },
    { Notes: 'note' }, { Notes: [null] }, { RowGroupings: {} },
    { Filters: [null] }, { Filters: [{ Field: 'Поле', Condition: 'У списку', Values: null }] },
    { IgnoredFilters: [{ Field: 'Поле', Condition: 'У списку', Values: ['Значення'], IgnoredReason: 1 }] },
    { Measures: ['\ud800'] }, { Notes: ['\udc00'] },
  ])('refuses malformed attribution %#', change => {
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...request, ...change } } })).toThrow('опис розрахунку')
  })

  it('enforces one 4096-item budget across all lists, filters and filter values', () => {
    const atLimit = { ...request, RowGroupings: ['День'], Notes: Array(4092).fill('Примітка'),
      Filters: [{ Field: 'Товар', Condition: 'У списку', Values: ['А', 'Б'], IgnoredReason: null }] }
    expect(normalizeNativeReportPreview({ Preview: { ...preview, Request: atLimit } }).Request?.Notes).toHaveLength(4092)
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...atLimit, IgnoredFilters: [{ Field: 'Договір', Condition: 'Дорівнює', Values: [], IgnoredReason: null }] } } })).toThrow('межі опису')
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...request, Notes: Array(4097).fill('') } } })).toThrow('межі опису')
  })

  it('measures each string in strict UTF-8 bytes, including supplementary characters', () => {
    const atLimit = '😀'.repeat(16384)
    expect(normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...request, Notes: [atLimit] } } }).Request?.Notes?.[0]).toBe(atLimit)
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...request, Notes: [atLimit + 'a'] } } })).toThrow('опис розрахунку')
    expect(() => normalizeNativeReportPreview({ Preview: { ...preview, Request: { ...request, DataSource: 'a'.repeat(65537) } } })).toThrow('опис розрахунку')
  })
})
