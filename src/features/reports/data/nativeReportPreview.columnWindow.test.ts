import { describe, expect, it } from 'vitest'
import { isPartialColumnWindow, normalizeNativeReportPreview, previewColumnWindow } from './nativeReportPreview'
import { columnWindowText, readPreviewColumnPaging } from './reportWideColumns'
import { wideCellValue, wideHasCell, widePreview, wideTotalValue } from './reportWideColumns.test-fixtures'

const normalize = (preview: object) => normalizeNativeReportPreview({ Preview: preview })

describe('wide preview column windows', () => {
  it('accepts a middle window of a 3 660-column result with global column identities and window totals', () => {
    const result = normalize(widePreview({ total: 3660, offset: 256, returned: 256 }))
    expect(result.Columns.map(column => column.SourceIndex)).toEqual(Array.from({ length: 256 }, (_, index) => 256 + index))
    expect(previewColumnWindow(result)).toEqual({ ColumnOffset: 256, ColumnLimit: 256, TotalColumns: 3660, ReturnedColumns: 256, HasMoreColumns: true })
    expect(isPartialColumnWindow(previewColumnWindow(result))).toBe(true)
    expect(result.Totals?.Values.map(cell => cell.ColumnSourceIndex)).toEqual(result.Columns.map(column => column.SourceIndex))
    expect(result.Totals?.Values[0].Value.Value).toBe(wideTotalValue(256))
    const cell = result.Cells.find(item => item.ColumnSourceIndex === 259)
    expect(cell?.Value).toEqual({ Kind: 'decimal', Value: wideCellValue(cell!.RowSourceIndex, 259), Provenance: 'producerCell' })
    expect(columnWindowText(256, 256, 3660)).toBe('Колонки 257–512 з 3 660')
  })

  it('accepts the short last window and walks 6 000 columns exactly once when the server shortens windows', () => {
    const last = normalize(widePreview({ total: 3660, offset: 3584, returned: 76 }))
    expect(last.Page.HasMoreColumns).toBe(false)
    const seen: number[] = []
    let offset = 0
    while (offset < 6000) {
      const returned = Math.min(offset % 512 === 0 ? 200 : 256, 6000 - offset)
      const page = normalize(widePreview({ total: 6000, offset, returned, rows: 1 }))
      seen.push(...page.Columns.map(column => column.SourceIndex))
      expect(page.Cells.every(cell => cell.ColumnSourceIndex >= offset && cell.ColumnSourceIndex < offset + returned)).toBe(true)
      expect(page.Cells.length).toBe(page.Columns.filter(column => wideHasCell(0, column.SourceIndex)).length)
      offset += page.Page.ReturnedColumns!
    }
    expect(seen).toEqual(Array.from({ length: 6000 }, (_, index) => index))
  })

  it.each([
    ['non-contiguous columns', (p: ReturnType<typeof widePreview>) => { p.Columns[3] = { ...p.Columns[3], Ordinal: 900, SourceIndex: 900 } }],
    ['an ordinal that is not the global index', (p: ReturnType<typeof widePreview>) => { p.Columns[0] = { ...p.Columns[0], Ordinal: 0 } }],
    ['a cell outside the window', (p: ReturnType<typeof widePreview>) => { p.Cells.push({ RowSourceIndex: 0, ColumnSourceIndex: 10, Value: { Kind: 'decimal', Value: '1', Provenance: 'producerCell' } }) }],
    ['units outside the window', (p: ReturnType<typeof widePreview>) => { p.valueSemantics.push({ ...p.valueSemantics[0], columnSourceIndex: 10 }) }],
    ['a grand total outside the window', (p: ReturnType<typeof widePreview>) => { p.Totals.Values.push({ RowSourceIndex: -1, ColumnSourceIndex: 10, Value: { Kind: 'decimal', Value: '1', Provenance: 'presentationTotal' } }) }],
    ['a group total outside the window', (p: ReturnType<typeof widePreview>) => { p.Totals.Groups[0].Values.push({ RowSourceIndex: 0, ColumnSourceIndex: 4000, Value: { Kind: 'decimal', Value: '1', Provenance: 'presentationTotal' } }) }],
    ['an inconsistent continuation flag', (p: ReturnType<typeof widePreview>) => { p.Page.HasMoreColumns = false }],
    ['a returned count that differs from the columns', (p: ReturnedType) => { p.Page.ReturnedColumns = 255 }],
    ['a partial set of window fields', (p: ReturnType<typeof widePreview>) => { delete (p.Page as Partial<typeof p.Page>).TotalColumns }],
    ['more than 16 000 columns', (p: ReturnType<typeof widePreview>) => { p.Page.TotalColumns = 16001 }],
    ['a window larger than its limit', (p: ReturnType<typeof widePreview>) => { p.Page.ColumnLimit = 100 }],
  ])('rejects %s', (_name, mutate) => {
    const preview = widePreview({ total: 3660, offset: 256, returned: 256, rows: 1 })
    mutate(preview)
    expect(() => normalize(preview)).toThrow()
  })

  it('keeps the legacy 256-column rule when the server sends no column window', () => {
    const legacy = (count: number) => {
      const preview = widePreview({ total: count, offset: 0, returned: count, rows: 1 })
      const page = { ...preview.Page } as Partial<typeof preview.Page>
      delete page.ColumnOffset; delete page.ColumnLimit; delete page.TotalColumns; delete page.ReturnedColumns; delete page.HasMoreColumns
      return { ...preview, Page: page, Columns: preview.Columns.map((column, index) => ({ ...column, Ordinal: index })) }
    }
    const accepted = normalize(legacy(256))
    expect(accepted.Columns).toHaveLength(256)
    expect(previewColumnWindow(accepted)).toBeNull()
    expect(isPartialColumnWindow(previewColumnWindow(accepted))).toBe(false)
    expect(() => normalize(legacy(257))).toThrow('Сервер повернув некоректний попередній перегляд звіту.')
  })

  it('treats a full-width answer from a column-aware server as one complete window', () => {
    const full = normalize(widePreview({ total: 40, offset: 0, returned: 40, limit: 40, rows: 1 }))
    expect(isPartialColumnWindow(previewColumnWindow(full))).toBe(false)
    const empty = normalize({ ...widePreview({ total: 0, offset: 0, returned: 0, limit: 0, rows: 1 }), Totals: undefined })
    expect(empty.Columns).toEqual([])
  })

  it('reads the preview column capability additively and refuses malformed values', () => {
    expect(readPreviewColumnPaging({ Version: 2 })).toBeNull()
    expect(readPreviewColumnPaging({ ColumnPaging: true, MaximumPageColumns: 256, MaximumResultColumns: 16000, MaximumOccupiedCells: 1000000, MaximumResponseBytes: 1048576 }))
      .toEqual({ pageColumns: 256, resultColumns: 16000 })
    expect(readPreviewColumnPaging({ ColumnPaging: true, MaximumPageColumns: 1000 })).toEqual({ pageColumns: 256, resultColumns: 16000 })
    expect(readPreviewColumnPaging({ ColumnPaging: false })).toBeNull()
    for (const malformed of [{ ColumnPaging: 'yes' }, { ColumnPaging: true }, { ColumnPaging: true, MaximumPageColumns: 0 },
      { ColumnPaging: true, MaximumPageColumns: 256, MaximumResultColumns: 100 }, { ColumnPaging: true, MaximumPageColumns: 256, MaximumResponseBytes: '1' }])
      expect(readPreviewColumnPaging(malformed)).toBeUndefined()
  })
})

type ReturnedType = ReturnType<typeof widePreview>
