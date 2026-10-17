import { describe, expect, it } from 'vitest'
import { normalizeNativeReportPreview, previewAmountText, previewCaptionText, previewCellText, previewNumberText, previewScalarText } from './nativeReportPreview'

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

  it('shows numbers like 1C: no-break space thousands and a decimal comma, keeping the server digits', () => {
    expect(previewNumberText('104090.44')).toBe('104\u00a0090,44')
    expect(previewNumberText('-6477443.56')).toBe('-6\u00a0477\u00a0443,56')
    expect(previewNumberText('2260.3')).toBe('2\u00a0260,3')
    expect(previewNumberText('999')).toBe('999')
    expect(previewNumberText('1000')).toBe('1\u00a0000')
    expect(previewNumberText('0.00')).toBe('0,00')
    expect(previewNumberText('n/a')).toBe('n/a')
    expect(previewCellText({ Kind: 'decimal', Value: '17222', Provenance: 'producerCell' })).toBe('17\u00a0222')
    expect(previewCellText({ Kind: 'signedInteger', Value: '-12345', Provenance: 'producerCell' })).toBe('-12\u00a0345')
    expect(previewCellText({ Kind: 'text', Value: '12345.5', Provenance: 'producerCell' })).toBe('12345.5')
    expect(previewCellText({ Kind: 'null', Value: null, Provenance: 'producerCell' })).toBe('∅')
    expect(previewCellText(undefined)).toBe('—')
  })

  it('prints money and percentages with two decimals like the exported #,##0.00 cells', () => {
    expect(previewAmountText('2260.3')).toBe('2\u00a0260,30')
    expect(previewAmountText('-6.6')).toBe('-6,60')
    expect(previewAmountText('14463.81')).toBe('14\u00a0463,81')
    expect(previewAmountText('0')).toBe('0,00')
    expect(previewAmountText('0.123456')).toBe('0,123456')
    expect(previewAmountText('n/a')).toBe('n/a')
  })

  it('drops the uniqueness id from a name but keeps names that merely end in brackets', () => {
    expect(previewCaptionText('ТОВ «АМГ «КОНКОРД» [10557]')).toBe('ТОВ «АМГ «КОНКОРД»')
    expect(previewCaptionText('Клієнт [id=12]')).toBe('Клієнт')
    expect(previewCaptionText('Каса [грн]')).toBe('Каса [грн]')
    expect(previewCaptionText('СКЛАД -1')).toBe('СКЛАД -1')
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
