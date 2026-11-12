export const LEGACY_PREVIEW_COLUMNS = 256
export const MAXIMUM_PREVIEW_PAGE_COLUMNS = 256
export const MAXIMUM_RESULT_COLUMNS = 16000
export const XLSX_MAXIMUM_COLUMNS = 16384

export const validMaximumResultColumns = (value: unknown): boolean => value === undefined
  || Number.isSafeInteger(value) && (value as number) >= LEGACY_PREVIEW_COLUMNS && (value as number) <= XLSX_MAXIMUM_COLUMNS

export type ReportPreviewColumnPaging = { pageColumns: number; resultColumns: number }

export function readPreviewColumnPaging(capability: Record<string, unknown>): ReportPreviewColumnPaging | null | undefined {
  if (capability.ColumnPaging === undefined) return null
  if (capability.ColumnPaging !== true && capability.ColumnPaging !== false) return undefined
  if (capability.ColumnPaging === false) return null
  const pageColumns = capability.MaximumPageColumns, resultColumns = capability.MaximumResultColumns
  if (!Number.isSafeInteger(pageColumns) || (pageColumns as number) < 1 || (pageColumns as number) > XLSX_MAXIMUM_COLUMNS
    || resultColumns !== undefined && !validMaximumResultColumns(resultColumns)
    || capability.MaximumResponseBytes !== undefined && (!Number.isSafeInteger(capability.MaximumResponseBytes) || (capability.MaximumResponseBytes as number) < 1)
    || capability.MaximumOccupiedCells !== undefined && (!Number.isSafeInteger(capability.MaximumOccupiedCells) || (capability.MaximumOccupiedCells as number) < 1))
    return undefined
  return { pageColumns: Math.min(pageColumns as number, MAXIMUM_PREVIEW_PAGE_COLUMNS),
    resultColumns: Math.min((resultColumns as number | undefined) ?? MAXIMUM_RESULT_COLUMNS, MAXIMUM_RESULT_COLUMNS) }
}

const HIGH_CARDINALITY_GROUPING_TYPES: ReadonlySet<number> = new Set([5, 6, 7, 8, 12, 15, 17, 18, 24, 33])

export function columnGroupingLimitHint(groups: ReadonlyArray<{ type: number; label: string }>): string | null {
  const risky = groups.filter(group => HIGH_CARDINALITY_GROUPING_TYPES.has(group.type))
  if (!risky.length) return null
  const limit = MAXIMUM_RESULT_COLUMNS.toLocaleString('uk-UA').replace(/\s/g, '\u00a0')
  const fields = risky.map(group => `«${group.label}»`).join(', ')
  return `Групування колонок за ${risky.length > 1 ? 'полями' : 'полем'} ${fields} може перевищити ліміт ${limit} колонок. Перенесіть його в рядки або додайте відбір.`
}

export function columnWindowText(offset: number, returned: number, total: number): string {
  const number = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (total === 0) return '0 колонок'
  return `Колонки ${number(offset + 1)}–${number(offset + returned)} з ${number(total)}`
}
