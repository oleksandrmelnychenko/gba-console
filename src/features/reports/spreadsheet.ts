import type {
  SpreadsheetCellValue,
  SpreadsheetReportHeader,
  SpreadsheetRow,
  SpreadsheetRowKind,
  SpreadsheetSheet,
} from './types'
import { parseNumericValue } from './utils'

// The file «Перегляд звіту з файла» exists for is the one our own report engine writes
// (ProductPlacementStorageManager.ExportVerificationReportsToXlsx): the header is as many rows deep as the
// column axis and its merged cells repeat their caption, a row-field value is printed only on the row where it
// changes, «Підсумок: …» closes every group and one «Загальний підсумок» closes the sheet. Read as a flat table
// the header landed on the innermost measure names, the merged group cells came out blank, and the group and
// grand totals were summed as if they were data — which trebled every total.
const SUBTOTAL_PREFIX = 'Підсумок:'
const GRAND_TOTAL_LABEL = 'Загальний підсумок'
const HEADER_LEVEL_SEPARATOR = ' · '
// The first line of the engine's attribution block, and the only thing that identifies the block as one.
const REPORT_TITLE = 'Звіт продажів'
const ROW_GROUPINGS_PREFIX = 'Рядки:'
const COLUMN_GROUPINGS_PREFIX = 'Колонки:'
// What the block prints where an axis has no groupings at all.
const EMPTY_LIST_MARKER = '—'
// A measure the engine could not answer is printed as an EMPTY cell and accounted for in one of these lines; a
// filter that was requested and not applied is printed in the other. Both change what the numbers mean, so both
// are lifted out of the block and shown as warnings rather than as more small print.
const NO_DATA_MARKER = 'немає даних'
const IGNORED_FILTERS_PREFIX = 'УВАГА'
const NO_ROWS_LINE = 'За вибраними умовами даних не знайдено'
// The engine's own header depth: however many levels the column axis has, plus the two rows the measures always
// occupy — the unit group («Вартість продажу, EUR») and then the measure itself («Продажі без ПДВ»). Used only
// when the row-field caption row cannot be found by name.
const MEASURE_HEADER_LEVELS = 2
// The engine sums in C# decimal and writes an IEEE-754 double, so a column that is a plain sum still misses its
// own total by a few ulps over ~10^4 addends. Relative, so it holds for a 10-row sheet and a 500 000-row one.
const TOTAL_MATCH_TOLERANCE = 1e-6

export function buildSpreadsheetSheet(name: string, rows: SpreadsheetCellValue[][]): SpreadsheetSheet {
  const firstFilledRowIndex = rows.findIndex((row) => row.some(isFilledCell))

  if (firstFilledRowIndex === -1) {
    return { name, columns: [], header: null, rows: [] }
  }

  const sheetRows = rows.slice(firstFilledRowIndex)
  // «Загальний підсумок» is written on every sheet the report engine produces and on nothing else, so it is what
  // tells an engine report from an arbitrary spreadsheet. Only a report is read as a pivot; anything else keeps
  // the plain one-header-row reading it has always had.
  const isReport = sheetRows.some((row) => getStructuralRowKind(row) !== null)
  // The attribution block the engine now writes above the table. It is what tells the viewer where the table
  // starts — reading that off the data instead is what broke here: countHeaderRows() took the first row holding a
  // number as the first row of the body, and the block has no numbers in it, so on a report whose FIRST product
  // has no cost the first row with a number was two group-subtotals further down and a whole data row was eaten
  // as if it were part of the header.
  const reportHeader = isReport ? readReportHeader(sheetRows) : null
  const tableRows = reportHeader ? sheetRows.slice(reportHeader.tableTopIndex) : sheetRows
  const headerRowCount = reportHeader
    ? countReportHeaderRows(tableRows, reportHeader.header)
    : isReport
      ? countHeaderRows(sheetRows)
      : 1

  return {
    name,
    columns: buildColumns(tableRows.slice(0, headerRowCount), reportHeader?.header.rowGroupings.length ?? 0),
    header: reportHeader?.header ?? null,
    // A grouping value is merged down the rows of its group and has to be carried; a MEASURE that is empty is a
    // measure with no answer and must stay empty. Only the row-field columns may be carried, and there are
    // exactly as many of them as the block names in «Рядки».
    rows: buildBodyRows(tableRows.slice(headerRowCount), isReport, reportHeader?.header.rowGroupings.length),
  }
}

// The rows the console's own CSV export writes: the engine's attribution block first, then the table. The export
// is the file a reader keeps, and a copy of a report that has dropped its period, its filters and its «немає
// даних» line is a page of numbers that answers no stated question — which is the very thing the block was added
// to the workbook to stop.
export function buildSheetExportRows(
  sheet: SpreadsheetSheet,
  rows: SpreadsheetRow[],
  totalsRow?: SpreadsheetCellValue[] | null,
): SpreadsheetCellValue[][] {
  const attribution: SpreadsheetCellValue[][] = sheet.header
    ? [...sheet.header.lines.map((line) => [line]), []]
    : []

  return [
    ...attribution,
    sheet.columns,
    ...rows.map((row) => row.cells),
    ...(totalsRow ? [totalsRow] : []),
  ]
}

export function filterSheetRows(
  sheet: SpreadsheetSheet | null,
  searchValue: string,
  dateFrom: string,
  dateTo: string,
): SpreadsheetRow[] {
  if (!sheet) {
    return []
  }

  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch && !dateFrom && !dateTo) {
    return sheet.rows
  }

  // Subtotals and the grand total are the engine's arithmetic over the whole sheet; once a filter narrows it
  // they describe rows that are no longer on screen, so they go with them.
  return sheet.rows.filter((row) => {
    if (row.kind !== 'data') {
      return false
    }

    const matchesSearch = normalizedSearch
      ? row.cells.some((cell) => String(cell || '').toLowerCase().includes(normalizedSearch))
      : true
    const rowDate = extractRowDate(row.cells)
    const matchesDateFrom = dateFrom && rowDate ? rowDate >= dateFrom : true
    const matchesDateTo = dateTo && rowDate ? rowDate <= dateTo : true

    return matchesSearch && matchesDateFrom && matchesDateTo
  })
}

// The sheet says itself which of its columns may be added up. The engine's «Загальний підсумок» holds a number
// under a measure and nothing under a grouping column, and under a ratio measure («Рентабельність, %») it holds
// a number that is deliberately not the sum of the rows above it. Whatever the engine did not add, the viewer
// does not add either — an article code or a percentage run down a column is not a total.
export function getAdditiveColumns(sheet: SpreadsheetSheet | null): boolean[] {
  const columnCount = sheet?.columns.length || 0
  const grandTotal = sheet?.rows.find((row) => row.kind === 'total')

  if (!sheet || !grandTotal) {
    return Array.from({ length: columnCount }, () => true)
  }

  const dataRows = sheet.rows.filter((row) => row.kind === 'data')

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const declaredTotal = parseNumericValue(grandTotal.cells[columnIndex])

    if (declaredTotal === null) {
      return false
    }

    const summedTotal = sumColumn(dataRows, columnIndex)

    return (
      summedTotal !== null
      && Math.abs(summedTotal - declaredTotal) <= TOTAL_MATCH_TOLERANCE * Math.max(1, Math.abs(declaredTotal))
    )
  })
}

export function calculateTotals(rows: SpreadsheetRow[], additiveColumns: boolean[]): Array<number | null> {
  return additiveColumns.map((isAdditive, columnIndex) => (isAdditive ? sumColumn(rows, columnIndex) : null))
}

export function isFilledCell(cell: SpreadsheetCellValue): boolean {
  return typeof cell === 'number' || typeof cell === 'boolean' || String(cell ?? '').trim() !== ''
}

export function detectDelimiter(text: string): ',' | '\t' | ';' {
  const sample = text.split(/\r?\n/, 1)[0] || ''
  const candidates: Array<',' | '\t' | ';'> = [',', '\t', ';']

  return candidates.reduce((best, delimiter) =>
    countOccurrences(sample, delimiter) > countOccurrences(sample, best) ? delimiter : best,
  )
}

export function parseDelimitedText(text: string, delimiter: string): SpreadsheetCellValue[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => parseDelimitedLine(line, delimiter).map(normalizeCellValue))
}

export function normalizeImportedCellValue(value: unknown): SpreadsheetCellValue {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null) {
    return value
  }

  return String(value || '').trim()
}

// The reading of the file shape that predates the attribution block: kept for a workbook saved before the engine
// started writing one, and for anything that is not one of our reports at all.
function countHeaderRows(rows: SpreadsheetCellValue[][]): number {
  const firstBodyRowIndex = rows.findIndex(
    (row) => getStructuralRowKind(row) !== null || row.some((cell) => typeof cell === 'number'),
  )

  return firstBodyRowIndex > 0 ? firstBodyRowIndex : 1
}

// Reads the block the engine writes above the table, and says where the table begins. The block is column-A-only
// and is closed by one blank row; that blank row is the writer's own separator, not a guess.
function readReportHeader(
  rows: SpreadsheetCellValue[][],
): { header: SpreadsheetReportHeader; tableTopIndex: number } | null {
  if (String(rows[0]?.[0] ?? '').trim() !== REPORT_TITLE) {
    return null
  }

  const lines: string[] = []
  let index = 0

  while (index < rows.length && rows[index].some(isFilledCell)) {
    lines.push(String(rows[index][0] ?? '').trim())
    index += 1
  }

  // No separator and therefore no table under it: the file is not one of ours after all.
  if (index >= rows.length) {
    return null
  }

  return {
    header: {
      columnGroupings: readGroupingList(lines, COLUMN_GROUPINGS_PREFIX),
      lines,
      rowGroupings: readGroupingList(lines, ROW_GROUPINGS_PREFIX),
      warnings: lines.filter(isWarningLine),
    },
    tableTopIndex: index + 1,
  }
}

function readGroupingList(lines: string[], prefix: string): string[] {
  const line = lines.find((candidate) => candidate.startsWith(prefix))

  if (!line) {
    return []
  }

  const value = line.slice(prefix.length).trim()

  if (!value || value === EMPTY_LIST_MARKER) {
    return []
  }

  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

function isWarningLine(line: string): boolean {
  return line.startsWith(IGNORED_FILTERS_PREFIX) || line.includes(NO_DATA_MARKER) || line === NO_ROWS_LINE
}

// How deep the table's own header is, from two independent readings of the block that have to agree.
//
// ARITHMETIC. One header row per level of the column axis, then the two the measures always occupy — the unit
// group («Вартість продажу, EUR») and the measure itself («Продажі без ПДВ»). The block names both axes, so this
// is computable without looking at the table at all.
//
// BY NAME. The engine prints the row-field captions on its LAST header row, the one the autofilter is anchored
// to, so those captions mark the row above the data whatever the data looks like.
//
// The name search must take the DEEPEST match inside the arithmetic depth, not the first. With the same grouping
// on both axes — «Організація» down the side and across the top, which the engine accepts and the report screen
// offers — column A carries «Організація» twice: once at the top of the header, naming what the captions across
// the sheet are, and once on the last header row, naming the column beneath it. Taking the first match returned
// a one-row header and fed the viewer two header rows as if they were data, with «Кількість продажу, шт» showing
// up as a group in the table.
function countReportHeaderRows(tableRows: SpreadsheetCellValue[][], header: SpreadsheetReportHeader): number {
  const arithmeticDepth = Math.min(
    Math.max(header.columnGroupings.length + MEASURE_HEADER_LEVELS, 1),
    Math.max(tableRows.length, 1),
  )

  if (!header.rowGroupings.length) {
    return arithmeticDepth
  }

  let captionRowIndex = -1

  for (let index = 0; index < arithmeticDepth; index += 1) {
    if (hasLeadingCaptions(tableRows[index] ?? [], header.rowGroupings)) {
      captionRowIndex = index
    }
  }

  // Nothing matched — a caption carrying a comma would do it, since the block joins the list with one. The
  // arithmetic stands on its own.
  return captionRowIndex >= 0 ? captionRowIndex + 1 : arithmeticDepth
}

function hasLeadingCaptions(row: SpreadsheetCellValue[], captions: string[]): boolean {
  return row.length >= captions.length
    && captions.every((caption, columnIndex) => String(row[columnIndex] ?? '').trim() === caption)
}

function buildColumns(headerRows: SpreadsheetCellValue[][], rowFieldCount: number): string[] {
  const columnCount = headerRows.reduce((count, row) => Math.max(count, row.length), 0)
  const lastHeaderRow = headerRows[headerRows.length - 1] ?? []

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    // A row-field column is named by its own caption alone. The levels above it belong to the COLUMN axis — the
    // engine prints «По місяцях» in the last row-field column to say what the headers across the top are — and
    // stacking that onto the row field would title the product column «По місяцях · Товар».
    if (columnIndex < rowFieldCount) {
      return String(lastHeaderRow[columnIndex] ?? '').trim() || `C${columnIndex + 1}`
    }

    // A merged header cell repeats its caption in every cell it covers — across the columns of a column group
    // and down the rows a row-field title spans — so the same level arrives more than once per column.
    const levels: string[] = []
    const seenLevels = new Set<string>()

    for (const row of headerRows) {
      const level = String(row[columnIndex] ?? '').trim()

      if (level && !seenLevels.has(level)) {
        seenLevels.add(level)
        levels.push(level)
      }
    }

    return levels.join(HEADER_LEVEL_SEPARATOR) || `C${columnIndex + 1}`
  })
}

function buildBodyRows(
  rows: SpreadsheetCellValue[][],
  isReport: boolean,
  rowFieldCount?: number,
): SpreadsheetRow[] {
  let carried: SpreadsheetCellValue[] = []

  return rows.reduce<SpreadsheetRow[]>((bodyRows, cells) => {
    if (!cells.some(isFilledCell)) {
      return bodyRows
    }

    if (!isReport) {
      bodyRows.push({ cells, kind: 'data' })

      return bodyRows
    }

    const structuralKind = getStructuralRowKind(cells)

    if (structuralKind) {
      carried = []
      bodyRows.push({ cells: collapseRepeatedLabel(cells), kind: structuralKind })

      return bodyRows
    }

    // A grouping column is merged down every row of its group, so each row after the first arrives with its
    // leading cells empty. Carrying the group down is what the merge reads as on screen; only the leading run is
    // carried, so a measure that is genuinely empty stays empty.
    //
    // The carry stops at the last row-field column. A measure cell is now legitimately empty — that is how the
    // engine says a cost could not be read — and an empty leading MEASURE would otherwise inherit the number
    // above it, which is the one mistake this whole change exists to prevent: it would print a cost for a line
    // that has none, taken from a different product.
    const carryLimit = rowFieldCount === undefined ? cells.length : rowFieldCount
    const leadingEmptyCount = Math.min(countLeadingEmptyCells(cells), carryLimit)
    const filledCells = cells.map((cell, index) =>
      index < leadingEmptyCount && index < carried.length ? carried[index] : cell,
    )

    carried = filledCells
    bodyRows.push({ cells: filledCells, kind: 'data' })

    return bodyRows
  }, [])
}

function getStructuralRowKind(cells: SpreadsheetCellValue[]): SpreadsheetRowKind | null {
  const label = String(cells[0] ?? '').trim()

  if (label === GRAND_TOTAL_LABEL) {
    return 'total'
  }

  if (label.startsWith(SUBTOTAL_PREFIX)) {
    return 'subtotal'
  }

  return null
}

// The subtotal caption is merged across every row-field column, which reads back as the same text repeated.
function collapseRepeatedLabel(cells: SpreadsheetCellValue[]): SpreadsheetCellValue[] {
  const label = cells[0]

  return cells.map((cell, index) => (index > 0 && cell === label ? null : cell))
}

function countLeadingEmptyCells(cells: SpreadsheetCellValue[]): number {
  const firstFilledIndex = cells.findIndex(isFilledCell)

  return firstFilledIndex === -1 ? cells.length : firstFilledIndex
}

function sumColumn(rows: SpreadsheetRow[], columnIndex: number): number | null {
  const values = rows
    .map((row) => parseNumericValue(row.cells[columnIndex]))
    .filter((value): value is number => typeof value === 'number')

  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && quoted && nextChar === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)

  return cells
}

function normalizeCellValue(value: string): SpreadsheetCellValue {
  const numericValue = parseNumericValue(value)

  if (numericValue !== null) {
    return numericValue
  }

  return value.trim()
}

function extractRowDate(row: SpreadsheetCellValue[]): string | null {
  for (const cell of row) {
    const value = String(cell || '').trim()
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    const localMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/)

    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }

    if (localMatch) {
      return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`
    }
  }

  return null
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1
}
