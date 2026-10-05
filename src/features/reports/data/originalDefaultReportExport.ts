import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export type OriginalDefaultLine = { key: string; cells: string[]; subtotal?: boolean }
export type OriginalDefaultSheet = { title: string; from: string; through: string; headers: string[]; labelColumns: number;
  lines: OriginalDefaultLine[]; total: string[] | null; note: string }
export function defaultSheetExportError(sheet: OriginalDefaultSheet): string | null {
  return (sheet.lines.length + 1 + (sheet.total ? 1 : 0)) * sheet.headers.length > 1_000_000
    ? 'Файл перевищує 1 000 000 клітинок; звузьте період. Частковий файл не формується.' : null
}
function matrix(sheet: OriginalDefaultSheet): string[][] {
  const error = defaultSheetExportError(sheet)
  if (error) throw new Error(error)
  return [sheet.headers, ...sheet.lines.map(line => line.cells), ...(sheet.total ? [sheet.total] : [])]
}
const metadata = (sheet: OriginalDefaultSheet) => [[sheet.title], [`Період: ${sheet.from} – ${sheet.through}, включно`], [sheet.note]]
export function defaultSheetCsv(sheet: OriginalDefaultSheet): string {
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const rows = [...metadata(sheet).map(row => row.map(safe)), ...matrix(sheet).map((row, index) => row.map((value, column) => index === 0 || column < sheet.labelColumns ? safe(value) : value))]
  return '\ufeff' + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n'
}
async function xlsx(sheet: OriginalDefaultSheet): Promise<Blob> {
  const rows = matrix(sheet), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Звіт')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(sheet)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
async function pdf(sheet: OriginalDefaultSheet): Promise<Blob> {
  const definition: CurrentVparivanieV2PdfDefinition = { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [...metadata(sheet).map(row => ({ text: row.join(' · ') })), { table: { headerRows: 1, widths: sheet.headers.map(() => '*' as const), body: matrix(sheet) }, layout: 'lightHorizontalLines' }],
    styles: {}, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
export const defaultSheetBlob = (sheet: OriginalDefaultSheet, format: 'csv' | 'xlsx' | 'pdf') => format === 'csv'
  ? Promise.resolve(new Blob([defaultSheetCsv(sheet)], { type: 'text/csv;charset=utf-8' })) : format === 'xlsx' ? xlsx(sheet) : pdf(sheet)
