import { receiptCaptionNote } from './warehouseReceiptCaptions'
import { warehouseMonetaryColumns, warehouseMonetaryValues } from './originalWarehouseMonetaryExport'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import type { TransferredResult } from './originalTransferredGoods'
export const transferredHeaders = ['Документ надходження', 'Товар', ...warehouseMonetaryColumns.map(c => c.label)]
export const transferredValues = warehouseMonetaryValues
export function transferredExportError(result: TransferredResult): string | null {
  if (!result.Available || !result.Totals) return 'Повний результат недоступний для експорту.'
  return result.Rows.reduce((count, r) => count + 1 + r.Products.length, 2) * transferredHeaders.length > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір; частковий файл не формується.' : null
}
/** Full accepted hierarchy shared by every export, without floating point or caption-based merging. */
export function transferredMatrix(result: TransferredResult): string[][] {
  const error = transferredExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [transferredHeaders, ...result.Rows.flatMap(row => [[row.Caption, 'Підсумок документа', ...transferredValues(row.Resources)],
    ...row.Products.map(child => [row.Caption, child.Caption, ...transferredValues(child.Resources)])]), ['Разом', '', ...transferredValues(result.Totals)]]
}
const units = 'Кількість — записані одиниці; вартість і ПДВ — суми управлінського обліку без валютного перерахунку.'
const mapping = (result: TransferredResult) => result.ReceiptCaptions ? receiptCaptionNote(result.ReceiptCaptions)
  : 'Назви документів недоступні; повна відповідність усім налаштуванням 1С не підтверджена.'
export function transferredCsv(result: TransferredResult): string {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  const label = (v: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(v) ? `'${v}` : v
  const metadata = [[`Період: ${result.From} — ${result.Through}`], [units], ...result.FilterSummary.map(v => [v]), [mapping(result)]]
  return '\ufeff' + [...metadata, ...transferredMatrix(result)].map(row => row.map((v, i) => quote(i < 2 ? label(v) : v)).join(',')).join('\r\n') + '\r\n'
}
export async function transferredXlsx(result: TransferredResult): Promise<Blob> {
  const rows = transferredMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Передані товари')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Період', `${result.From} — ${result.Through}`], ['Одиниці', units],
    ['Зіставлення й відповідність', mapping(result)], ...result.FilterSummary.map(v => ['Відбір', v])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function transferredPdfDefinition(result: TransferredResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 6 },
    content: [{ text: 'Відомість партій переданих товарів', style: 'title' }, { text: `${result.From} — ${result.Through}. ${units} ${mapping(result)}`, margin: [0, 4, 0, 8] },
      ...result.FilterSummary.map(v => ({ text: v })), { table: { headerRows: 1, widths: [125, 125, ...warehouseMonetaryColumns.map(() => 64)],
        body: transferredMatrix(result) }, layout: 'lightHorizontalLines' }], styles: { title: { bold: true, fontSize: 13 } },
    footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function transferredPdf(result: TransferredResult): Promise<Blob> {
  const definition = transferredPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) }
  })
}
