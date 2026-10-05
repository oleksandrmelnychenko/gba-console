import { amgResultRequest, normalizeAmgDiscounts, type AmgDiscountResult } from './originalAmgClientDiscounts'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const amgDiscountHeaders = ['Отримувач знижки', 'Номенклатура', 'Прямий код регіону', 'Відсоток знижки/націнки']
export function amgDiscountLines(result: AmgDiscountResult) {
  return result.Cells.map(cell => ({ key: JSON.stringify([cell.Recipient, cell.Product]), cells: [cell.RecipientName, cell.ProductName, cell.RegionCode ?? '', cell.Percentage], subtotal: false }))
}
export function amgDiscountExportError(result: AmgDiscountResult): string | null {
  if (!result.InputAvailable || !result.OurSnapshotVerified) return 'Повний результат недоступний для експорту.'
  return (result.Cells.length + 1) * 4 > 1_000_000 ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте відбір.' : null
}
export function amgDiscountMatrix(result: AmgDiscountResult): string[][] {
  const error = amgDiscountExportError(result); if (error) throw new Error(error)
  normalizeAmgDiscounts(result, amgResultRequest(result))
  return [amgDiscountHeaders, ...amgDiscountLines(result).map(row => row.cells)]
}
const metadata = (result: AmgDiscountResult) => [[`AMG · ОтчетПоСкидкам · зріз ${result.Through} до 23:59:59`],
  ['Максимальний відсоток на рівні отримувача й номенклатури. Відсотки не додаються.'],
  [`Максимум сервера: ${result.MaximumPercentage ?? 'рядків немає'}`],
  ['Повна відповідність поточному оригіналу 1С ще не підтверджена. Валютна конвертація не застосовується.']]
export function amgDiscountCsv(result: AmgDiscountResult): string {
  const safe = (v: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(v) ? `'${v}` : v
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  return '\ufeff' + [...metadata(result).map(row => row.map(safe)), ...amgDiscountMatrix(result).map(row => row.map((v, i) => i < 3 ? safe(v) : v))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function amgDiscountXlsx(result: AmgDiscountResult): Promise<Blob> {
  const matrix = amgDiscountMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Знижки AMG')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function amgDiscountPdfDefinition(result: AmgDiscountResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Знижки AMG', style: 'title' }, ...metadata(result).map(row => ({ text: row.join(' · ') })),
      { table: { headerRows: 1, widths: amgDiscountHeaders.map(() => '*' as const), body: amgDiscountMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function amgDiscountPdf(result: AmgDiscountResult): Promise<Blob> {
  const definition = amgDiscountPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
