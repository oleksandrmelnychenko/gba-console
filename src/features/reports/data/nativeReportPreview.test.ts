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
})
