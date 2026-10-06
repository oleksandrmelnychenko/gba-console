import { fenixResultRequest, validateFenixDiscountResult, type FenixDiscountResult } from './originalFenixClientDiscounts'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const fenixDiscountHeaders = ['Отримувач знижки', 'Номенклатура', 'Прямий код регіону', 'Відсоток знижки/націнки']
export function fenixDiscountLines(result: FenixDiscountResult) {
  return result.Cells.map(cell => ({ key: JSON.stringify([cell.Recipient, cell.Product]), cells: [cell.RecipientName, cell.ProductName, cell.RegionCode ?? '', cell.Percentage], subtotal: false }))
}
export function fenixDiscountExportError(result: FenixDiscountResult, format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'): string | null {
  if (!result.InputAvailable || !result.OurSnapshotVerified) return 'Повний результат недоступний для експорту.'
  if (result.Cells.length > 500_000) return 'Файл перевищує повну межу 500 000 рядків цієї форми. Звузьте відбір.'
  return format === 'pdf' && result.Cells.length > 10_000 ? 'PDF повного звіту перевищує межу 10 000 рядків. Повний результат доступний у CSV та XLSX; PDF не скорочується.' : null
}
export function fenixDiscountMatrix(result: FenixDiscountResult): string[][] {
  const error = fenixDiscountExportError(result); if (error) throw new Error(error)
  validateFenixDiscountResult(result, fenixResultRequest(result))
  return [fenixDiscountHeaders, ...fenixDiscountLines(result).map(row => row.cells)]
}
const metadata = (result: FenixDiscountResult) => [[`FENIX · ОтчетПоСкидкам · зріз ${result.Through} до 23:59:59`],
  ['Максимальний відсоток на рівні отримувача й номенклатури. Відсотки не додаються.'],
  [`Максимум сервера: ${result.MaximumPercentage ?? 'рядків немає'}`],
  ['Повна відповідність поточному оригіналу 1С ще не підтверджена. Валютна конвертація не застосовується.']]
export function fenixDiscountCsv(result: FenixDiscountResult): string {
  const safe = (v: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(v) ? `'${v}` : v
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  return '\ufeff' + [...metadata(result).map(row => row.map(safe)), ...fenixDiscountMatrix(result).map(row => row.map((v, i) => i < 3 ? safe(v) : v))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
/** At most1000 formatted data rows are allocated per batch; the completed result is never truncated. */
function validatedExport(result: FenixDiscountResult, format: 'csv' | 'xlsx' | 'pdf') {
  const error = fenixDiscountExportError(result, format); if (error) throw new Error(error)
  validateFenixDiscountResult(result, fenixResultRequest(result))
}
function cellsForExport(result: FenixDiscountResult, start: number) { return result.Cells.slice(start, start + 1000).map(cell => [cell.RecipientName, cell.ProductName, cell.RegionCode ?? '', cell.Percentage]) }
function requireExportCaller(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError') }
async function yieldExport(start: number, signal?: AbortSignal) {
  requireExportCaller(signal)
  if (start > 0 && start % 10000 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
  requireExportCaller(signal)
}
export async function fenixDiscountCsvBlob(result: FenixDiscountResult, signal?: AbortSignal): Promise<Blob> {
  requireExportCaller(signal); validatedExport(result, 'csv')
  const safe = (v: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(v) ? `'${v}` : v
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  const line = (row: string[], data = false) => row.map((v, i) => quote(!data || i < 3 ? safe(v) : v)).join(',') + '\r\n'
  const chunks: BlobPart[] = ['\ufeff', ...metadata(result).map(row => line(row)), line(fenixDiscountHeaders)]
  for (let start = 0; start < result.Cells.length; start += 1000) { await yieldExport(start, signal); chunks.push(cellsForExport(result, start).map(row => line(row, true)).join('')) }
  requireExportCaller(signal)
  return new Blob(chunks, { type: 'text/csv;charset=utf-8' })
}
export async function fenixDiscountXlsx(result: FenixDiscountResult, signal?: AbortSignal): Promise<Blob> {
  requireExportCaller(signal); validatedExport(result, 'xlsx')
  const XLSX = await import('xlsx'), book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([fenixDiscountHeaders])
  for (let start = 0; start < result.Cells.length; start += 1000) { await yieldExport(start, signal); XLSX.utils.sheet_add_aoa(sheet, cellsForExport(result, start), { origin: -1 }) }
  requireExportCaller(signal)
  XLSX.utils.book_append_sheet(book, sheet, 'Знижки FENIX')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function fenixDiscountPdfDefinition(result: FenixDiscountResult): CurrentVparivanieV2PdfDefinition {
  validatedExport(result, 'pdf')
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Знижки FENIX', style: 'title' }, ...metadata(result).map(row => ({ text: row.join(' · ') })),
      { table: { headerRows: 1, widths: fenixDiscountHeaders.map(() => '*' as const), body: fenixDiscountMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function fenixDiscountPdf(result: FenixDiscountResult): Promise<Blob> {
  const definition = fenixDiscountPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
