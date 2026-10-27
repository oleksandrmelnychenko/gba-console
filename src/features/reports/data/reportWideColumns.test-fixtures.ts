export const WIDE_MEASURES = ['SalesValueWithoutVAT', 'SalesVAT', 'SalesValueWithVAT', 'CostWithoutVAT', 'CostVAT', 'CostWithVAT',
  'MarkupWithoutVAT', 'MarkupWithVAT', 'ProfitabilityWithoutVAT', 'ProfitabilityWithVAT'] as const
export const WIDE_RESULT = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: 'b'.repeat(64),
  ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
export const WIDE_SEMANTICS = { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true,
  defaultDecimalPlaces: 2, defaultMinimumDecimalPlaces: 2 }

export const wideAgreement = (column: number) => 501000 + Math.floor(column / WIDE_MEASURES.length)
export const wideCellValue = (row: number, column: number) => `${column}.${String(row).padStart(2, '0')}`
export const wideHasCell = (row: number, column: number) => (column + row) % 7 === 0
export const wideTotalValue = (column: number) => `${column * 3}.5`

export type WideWindow = { total: number; offset: number; returned: number; limit?: number; rowOffset?: number; rows?: number; totalRows?: number }

export function wideColumn(column: number) {
  return { Ordinal: column, SourceIndex: column, Values: [
    { Caption: `Договір ${wideAgreement(column)}`, Identity: { Kind: 'signedInteger', Value: String(wideAgreement(column)), Provenance: 'columnAxisKey' } },
    { Caption: 'Валовий прибуток', Identity: { Kind: 'text', Value: 'Валовий прибуток', Provenance: 'columnAxisKey' } },
    { Caption: WIDE_MEASURES[column % WIDE_MEASURES.length], Identity: { Kind: 'reportField', Value: WIDE_MEASURES[column % WIDE_MEASURES.length], Provenance: 'columnAxisKey' } },
  ] }
}

export function widePreview({ total, offset, returned, limit = 256, rowOffset = 0, rows = 2, totalRows = 120 }: WideWindow) {
  const columns = Array.from({ length: returned }, (_, index) => wideColumn(offset + index))
  const rowAxes = Array.from({ length: rows }, (_, index) => ({ Ordinal: rowOffset + index, SourceIndex: rowOffset + index, Values: [
    { Caption: `0${1 + Math.floor((rowOffset + index) / 4)}.10.2026`, Identity: { Kind: 'dateTime', Value: '2026-10-01T00:00:00', Provenance: 'rowAxisKey' } },
    { Caption: `Організація ${(rowOffset + index) % 4}`, Identity: { Kind: 'signedInteger', Value: String(10561 + (rowOffset + index) % 4), Provenance: 'rowAxisKey' } },
  ] }))
  const cells = rowAxes.flatMap(row => columns.filter(column => wideHasCell(row.SourceIndex, column.SourceIndex)).map(column => ({
    RowSourceIndex: row.SourceIndex, ColumnSourceIndex: column.SourceIndex,
    Value: { Kind: 'decimal', Value: wideCellValue(row.SourceIndex, column.SourceIndex), Provenance: 'producerCell' } })))
  return {
    Version: 1, ResultSha256: WIDE_RESULT.ResultSha256, RequestSha256: WIDE_RESULT.RequestSha256, PresentationOnly: true,
    Page: { Offset: rowOffset, Limit: 50, TotalVisibleRows: totalRows, ReturnedRows: rows, HasMore: rowOffset + rows < totalRows,
      ColumnOffset: offset, ColumnLimit: limit, TotalColumns: total, ReturnedColumns: returned, HasMoreColumns: offset + returned < total },
    Request: null,
    RowSchema: [{ Caption: 'Дата', Identity: 'Day' }, { Caption: 'Організація', Identity: 'Organization' }],
    ColumnSchema: [{ Caption: 'Договір', Identity: 'CustomerContract' }, { Caption: 'Група показників', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
    Rows: rowAxes, Columns: columns, Cells: cells,
    Totals: { State: 'materialized',
      Values: columns.map(column => ({ RowSourceIndex: -1, ColumnSourceIndex: column.SourceIndex, Value: { Kind: 'decimal', Value: wideTotalValue(column.SourceIndex), Provenance: 'presentationTotal' } })),
      Groups: rows > 0 ? [{ Level: 0, RowSourceIndex: rowOffset, RowCount: 4, Values: columns.slice(0, 3).map(column => ({ RowSourceIndex: rowOffset,
        ColumnSourceIndex: column.SourceIndex, Value: { Kind: 'decimal', Value: `${column.SourceIndex}.25`, Provenance: 'presentationTotal' } })) }] : [] },
    valueSemantics: columns.map(column => ({ columnSourceIndex: column.SourceIndex, measureType: 2, semantics: WIDE_SEMANTICS })),
  }
}

export const wideResponse = (window: WideWindow) => ({ Preview: widePreview(window), PreviewVersion: 2, ...WIDE_RESULT,
  DocumentURL: '', PdfDocumentURL: '' })
