export type NativeReportPreviewScalar = { Kind: string; Value: string | null; Provenance: string }
export type NativeReportPreviewAxis = { Ordinal: number; SourceIndex: number; Values: { Caption: string }[] }
export type NativeReportPreviewCell = { RowSourceIndex: number; ColumnSourceIndex: number; Value: NativeReportPreviewScalar }
export type NativeReportPreview = {
  Version: number
  ResultSha256: string
  PresentationOnly: boolean
  Page: { Offset: number; Limit: number; TotalVisibleRows: number; ReturnedRows: number; HasMore: boolean }
  RowSchema: { Caption: string }[]
  ColumnSchema: { Caption: string }[]
  Rows: NativeReportPreviewAxis[]
  Columns: NativeReportPreviewAxis[]
  Cells: NativeReportPreviewCell[]
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const boundedInteger = (value: unknown, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max
const scalar = (value: unknown): value is NativeReportPreviewScalar => record(value)
  && typeof value.Kind === 'string' && typeof value.Provenance === 'string'
  && (value.Value === null || typeof value.Value === 'string')

export function normalizeNativeReportPreview(response: unknown): NativeReportPreview {
  const preview = record(response) ? response.Preview : undefined
  if (!record(preview) || preview.Version !== 1 || preview.PresentationOnly !== true
    || typeof preview.ResultSha256 !== 'string' || !/^[a-f\d]{64}$/i.test(preview.ResultSha256)
    || !record(preview.Page) || !boundedInteger(preview.Page.Offset, 500000)
    || !boundedInteger(preview.Page.Limit, 50) || preview.Page.Limit === 0
    || !boundedInteger(preview.Page.TotalVisibleRows, 500000)
    || !boundedInteger(preview.Page.ReturnedRows, 50)
    || typeof preview.Page.HasMore !== 'boolean'
    || !Array.isArray(preview.RowSchema) || preview.RowSchema.length > 64
    || !preview.RowSchema.every(item => record(item) && typeof item.Caption === 'string')
    || !Array.isArray(preview.ColumnSchema) || preview.ColumnSchema.length > 66
    || !preview.ColumnSchema.every(item => record(item) && typeof item.Caption === 'string')
    || !Array.isArray(preview.Rows) || preview.Rows.length > 50
    || !Array.isArray(preview.Columns) || preview.Columns.length > 256
    || !Array.isArray(preview.Cells) || preview.Cells.length > 12800)
    throw new Error('Сервер повернув некоректний попередній перегляд звіту.')

  const axis = (item: unknown, max: number): item is NativeReportPreviewAxis => record(item)
    && boundedInteger(item.Ordinal, max) && boundedInteger(item.SourceIndex, 500000)
    && Array.isArray(item.Values) && item.Values.length <= 66
    && item.Values.every(value => record(value) && typeof value.Caption === 'string')
  const page = preview.Page as NativeReportPreview['Page']
  if (!preview.Rows.every(item => axis(item, 500000)) || !preview.Columns.every(item => axis(item, 256))
    || page.ReturnedRows !== preview.Rows.length
    || preview.Rows.some((row, index) => row.Ordinal !== page.Offset + index)
    || preview.Columns.some((column, index) => column.Ordinal !== index))
    throw new Error('Сервер повернув некоректні осі попереднього перегляду.')

  const rowIds = new Set(preview.Rows.map(row => row.SourceIndex))
  const columnIds = new Set(preview.Columns.map(column => column.SourceIndex))
  const coordinates = new Set<string>()
  for (const cell of preview.Cells) {
    if (!record(cell) || !boundedInteger(cell.RowSourceIndex, 500000) || !boundedInteger(cell.ColumnSourceIndex, 256)
      || !rowIds.has(cell.RowSourceIndex) || !columnIds.has(cell.ColumnSourceIndex) || !scalar(cell.Value))
      throw new Error('Сервер повернув некоректні клітинки попереднього перегляду.')
    const coordinate = `${cell.RowSourceIndex}:${cell.ColumnSourceIndex}`
    if (coordinates.has(coordinate)) throw new Error('Сервер повернув повторні клітинки попереднього перегляду.')
    coordinates.add(coordinate)
  }
  return preview as NativeReportPreview
}

export function previewScalarText(value: NativeReportPreviewScalar | undefined): string {
  if (value === undefined) return '—'
  if (value.Kind === 'null') return '∅'
  return value.Value ?? '∅'
}
