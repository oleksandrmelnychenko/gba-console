import type { SpreadsheetCellValue, SpreadsheetRow, SpreadsheetRowKind, SpreadsheetSheet } from './types'
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
// The engine sums in C# decimal and writes an IEEE-754 double, so a column that is a plain sum still misses its
// own total by a few ulps over ~10^4 addends. Relative, so it holds for a 10-row sheet and a 500 000-row one.
const TOTAL_MATCH_TOLERANCE = 1e-6

export function buildSpreadsheetSheet(name: string, rows: SpreadsheetCellValue[][]): SpreadsheetSheet {
  const firstFilledRowIndex = rows.findIndex((row) => row.some(isFilledCell))

  if (firstFilledRowIndex === -1) {
    return { name, columns: [], rows: [] }
  }

  const sheetRows = rows.slice(firstFilledRowIndex)
  // «Загальний підсумок» is written on every sheet the report engine produces and on nothing else, so it is what
  // tells an engine report from an arbitrary spreadsheet. Only a report is read as a pivot; anything else keeps
  // the plain one-header-row reading it has always had.
  const isReport = sheetRows.some((row) => getStructuralRowKind(row) !== null)
  const headerRowCount = isReport ? countHeaderRows(sheetRows) : 1

  return {
    name,
    columns: buildColumns(sheetRows.slice(0, headerRowCount)),
    rows: buildBodyRows(sheetRows.slice(headerRowCount), isReport),
  }
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

function countHeaderRows(rows: SpreadsheetCellValue[][]): number {
  const firstBodyRowIndex = rows.findIndex(
    (row) => getStructuralRowKind(row) !== null || row.some((cell) => typeof cell === 'number'),
  )

  return firstBodyRowIndex > 0 ? firstBodyRowIndex : 1
}

function buildColumns(headerRows: SpreadsheetCellValue[][]): string[] {
  const columnCount = headerRows.reduce((count, row) => Math.max(count, row.length), 0)

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    // A merged header cell repeats its caption in every cell it covers — across the columns of a column group
    // and down the rows a row-field title spans — so the same level arrives more than once per column.
    const levels: string[] = []

    for (const row of headerRows) {
      const level = String(row[columnIndex] ?? '').trim()

      if (level && !levels.includes(level)) {
        levels.push(level)
      }
    }

    return levels.join(HEADER_LEVEL_SEPARATOR) || `C${columnIndex + 1}`
  })
}

function buildBodyRows(rows: SpreadsheetCellValue[][], isReport: boolean): SpreadsheetRow[] {
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
    const leadingEmptyCount = countLeadingEmptyCells(cells)
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
