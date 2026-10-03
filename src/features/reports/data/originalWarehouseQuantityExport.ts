import type { WarehouseQuantityResult, WarehouseQuantity } from './originalWarehouseQuantity'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const warehouseQuantityHeaders = ['Товар', 'Документ надходження', 'Початковий залишок', 'Надходження', 'Витрати', 'Кінцевий залишок']
const values = (q: WarehouseQuantity) => [q.Opening, q.Incoming, q.Outgoing, q.Closing]
/** The full main matrix is bounded before allocating export rows; the screen can still page every row. */
export function warehouseQuantityExportError(result: WarehouseQuantityResult): string | null {
  if (!result.Available || !result.Totals) return 'Повний результат недоступний для експорту.'
  const count = result.Rows.reduce((n, row) => n + 1 + row.Receipts.length, 2)
  return count * warehouseQuantityHeaders.length > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір; частковий файл не формується.' : null
}
/** All rows, never the screen page; quantities are strings and never IEEE-754 numbers. */
export function warehouseQuantityMatrix(result: WarehouseQuantityResult): string[][] {
  const error = warehouseQuantityExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [warehouseQuantityHeaders, ...result.Rows.flatMap(row => [[row.Caption, 'Підсумок товару', ...values(row.Quantity)],
    ...row.Receipts.map(child => [row.Caption, child.Caption, ...values(child.Quantity)])]), ['Разом', '', ...values(result.Totals)]]
}
export function warehouseQuantityCsv(result: WarehouseQuantityResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
  const label = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  const metadata = [[`Період: ${result.From} — ${result.Through}`], ...result.FilterSummary.map(s => [s]), ['Назви документів недоступні; відповідність 1С не підтверджена.']]
  return '\ufeff' + [...metadata, ...warehouseQuantityMatrix(result)].map(row => row.map((s, i) => quote(i < 2 ? label(s) : s)).join(',')).join('\r\n') + '\r\n'
}
export async function warehouseQuantityXlsx(result: WarehouseQuantityResult): Promise<Blob> {
  const rows = warehouseQuantityMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Кількість')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Період', `${result.From} — ${result.Through}`], ['Одиниці', 'Записана кількість без перерахунку одиниць'],
    ['Назви документів', 'Зіставлення з документами GBA недоступне'], ['Відповідність 1С', 'Не підтверджена'], ...result.FilterSummary.map(s => ['Відбір', s])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function warehouseQuantityPdfDefinition(result: WarehouseQuantityResult): CurrentVparivanieV2PdfDefinition {
  const body = warehouseQuantityMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [28, 38, 28, 32], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Відомість партій на складах: кількість', style: 'title' },
      { text: `${result.From} — ${result.Through}. Записані одиниці. Назви документів недоступні; відповідність 1С не підтверджена.`, margin: [0, 4, 0, 8] },
      ...result.FilterSummary.map(s => ({ text: s })),
      { table: { headerRows: 1, widths: [200, 180, 110, 110, 110, 110], body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 14 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [28, 0, 28, 0] }) }
}
export async function warehouseQuantityPdf(result: WarehouseQuantityResult): Promise<Blob> {
  const definition = warehouseQuantityPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
