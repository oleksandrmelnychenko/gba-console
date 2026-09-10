import type { SpreadsheetCellValue, SpreadsheetReportHeader, SpreadsheetSheet } from '../types'
import { AGREEMENT_PRICES_CAPTION, AGREEMENT_PRICES_NOTE_PREFIXES, AGREEMENT_PRICES_RESOURCE, AGREEMENT_PRICES_ROWS, AGREEMENT_PRICES_TITLE } from './agreementPrices'

const invalid = () => new Error('Некоректний файл цін за договором: потрібні точний договір, поточний стан і ціни товарів без підсумків. Файл не застосовано.')
export const isAgreementPricesSheet = (sheet: SpreadsheetSheet | null): boolean => sheet?.header?.lines[0] === AGREEMENT_PRICES_TITLE
const note = (line: string) => line.startsWith('! ') ? line.slice(2) : line
const priceColumn = `${AGREEMENT_PRICES_RESOURCE} · ${AGREEMENT_PRICES_CAPTION}`
const validId = (id: string): boolean => /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n

/** XLSX may omit trailing unknown prices or include empty styled columns. */
export function prepareAgreementPricesRows(rows: SpreadsheetCellValue[][]): SpreadsheetCellValue[][] {
  if (String(rows[0]?.[0] ?? '').trim() !== AGREEMENT_PRICES_TITLE) return rows
  return rows.map(row => {
    if (row.slice(3).some(cell => cell != null && String(cell).trim() !== '')) throw invalid()
    return Array.from({ length: 3 }, (_, index) => row[index] ?? null)
  })
}

export function validateAgreementPricesAttribution(rows: SpreadsheetCellValue[][], format: 'workbook' | 'flat'): void {
  const separator = rows.findIndex(row => row.every(value => value == null || String(value).trim() === ''))
  const header = rows.slice(0, separator >= 0 ? separator + (format === 'flat' ? 2 : 3) : 1)
  if (header.some(row => row.some(cell => typeof cell === 'string' && (cell === AGREEMENT_PRICES_CAPTION || cell === priceColumn
    || AGREEMENT_PRICES_NOTE_PREFIXES.some(prefix => note(cell).startsWith(prefix)))))
    && String(rows[0]?.[0] ?? '').trim() !== AGREEMENT_PRICES_TITLE) throw invalid()
}

export function validateAgreementPricesHeader(title: string, header: SpreadsheetReportHeader | null): void {
  if (title !== AGREEMENT_PRICES_TITLE) return
  if (!header || JSON.stringify(header.rowGroupings) !== JSON.stringify(AGREEMENT_PRICES_ROWS) || header.columnGroupings.length) throw invalid()
  const lines = header.lines.map(note)
  for (const prefix of [...AGREEMENT_PRICES_NOTE_PREFIXES, 'Поточний стан:', 'Час читання (UTC):', 'Рядки:', 'Колонки:', 'Показники:', 'Фільтри:']) {
    const matches = lines.filter(line => line.startsWith(prefix))
    if (matches.length !== 1 || !matches[0].slice(prefix.length).trim()) throw invalid()
  }
  if (lines.some(line => /^(Період:|Поточний період:|Період порівняння:)/u.test(line))
    || !lines.includes(`Показники: ${AGREEMENT_PRICES_CAPTION}`)) throw invalid()
  const agreement = /^Договір цін: ClientAgreementID=([1-9]\d*); .+ \[([1-9]\d*)\]\.$/u.exec(lines.find(line => line.startsWith('Договір цін:'))!)
  if (!agreement || !validId(agreement[1]) || agreement[1] !== agreement[2]) throw invalid()
}

/** Unit prices have no subtotal, grand total, browser sum or inferred average. */
export function validateAgreementPricesSheet(sheet: SpreadsheetSheet): SpreadsheetSheet {
  if (!isAgreementPricesSheet(sheet)) return sheet
  if (JSON.stringify(sheet.columns) !== JSON.stringify([...AGREEMENT_PRICES_ROWS, priceColumn]) || sheet.rows.length > 15000) throw invalid()
  const products = new Set<string>()
  for (const row of sheet.rows) {
    const product = typeof row.cells[0] === 'string' ? / \[([1-9]\d*)\]$/u.exec(row.cells[0]) : null
    if (row.kind !== 'data' || row.cells.length !== 3 || !product || !validId(product[1])
      || typeof row.cells[1] !== 'string' || !row.cells[1].trim() || products.has(product[1])) throw invalid()
    products.add(product[1])
    const price = row.cells[2]
    if (price !== null && price !== '' && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price >= 1e15)) throw invalid()
    if (typeof price === 'number') {
      // Read decimal precision from the shortest round-trip representation;
      // toFixed would introduce binary artefacts even for ordinary prices like 99.1.
      const [mantissa, exponent = '0'] = String(price).split('e')
      const decimals = Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent))
      const significant = mantissa.replace('.', '').replace(/^0+/, '').length
      if (decimals > 14 || significant > 15) throw invalid()
    }
  }
  return sheet
}
