import { receiptCaptionNote } from './warehouseReceiptCaptions'
import type { WarehouseMonetaryResources, WarehouseMonetaryResult } from './originalWarehouseMonetary'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
const stages = [['Opening', 'Початковий залишок'], ['Incoming', 'Надходження'], ['Outgoing', 'Витрати'], ['Closing', 'Кінцевий залишок']] as const
const resources = [['Quantity', 'кількість'], ['Cost', 'вартість'], ['Vat', 'ПДВ']] as const
export const warehouseMonetaryColumns = stages.flatMap(([stage, title]) => resources.map(([resource, label]) => ({ stage, resource, label: `${title} · ${label}` })))
export const warehouseMonetaryHeaders = ['Товар', 'Документ надходження', ...warehouseMonetaryColumns.map(column => column.label)]
export const warehouseMonetaryValues = (value: WarehouseMonetaryResources) => warehouseMonetaryColumns.map(column => value[column.resource][column.stage])
export function warehouseMonetaryExportError(result: WarehouseMonetaryResult): string | null {
  if (!result.Available || !result.Totals) return 'Повний результат недоступний для експорту.'
  const rows = result.Rows.reduce((count, row) => count + 1 + row.Receipts.length, 2)
  return rows * warehouseMonetaryHeaders.length > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір; частковий файл не формується.' : null
}
/** Every resource remains an exact signed string; no numeric currency/unit conversion occurs in an export. */
export function warehouseMonetaryMatrix(result: WarehouseMonetaryResult): string[][] {
  const error = warehouseMonetaryExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [warehouseMonetaryHeaders, ...result.Rows.flatMap(row => [[row.Caption, 'Підсумок товару', ...warehouseMonetaryValues(row.Resources)],
    ...row.Receipts.map(child => [row.Caption, child.Caption, ...warehouseMonetaryValues(child.Resources)])]), ['Разом', '', ...warehouseMonetaryValues(result.Totals)]]
}
const unitDescription = 'Кількість — записані одиниці; вартість і ПДВ — суми управлінського обліку без валютного перерахунку.'
export function warehouseMonetaryCsv(result: WarehouseMonetaryResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const label = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const metadata = [[`Період: ${result.From} — ${result.Through}`], [unitDescription], ...result.FilterSummary.map(value => [value]), [receiptCaptionNote(result.ReceiptCaptions)]]
  return '\ufeff' + [...metadata, ...warehouseMonetaryMatrix(result)].map(row => row.map((value, i) => quote(i < 2 ? label(value) : value)).join(',')).join('\r\n') + '\r\n'
}
export async function warehouseMonetaryXlsx(result: WarehouseMonetaryResult): Promise<Blob> {
  const rows = warehouseMonetaryMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Партії')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Період', `${result.From} — ${result.Through}`], ['Одиниці', unitDescription],
    ['Назви документів', result.ReceiptCaptions ? receiptCaptionNote(result.ReceiptCaptions) : 'Зіставлення з документами GBA недоступне'], ['Відповідність 1С', 'Не підтверджена'], ...result.FilterSummary.map(value => ['Відбір', value])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function warehouseMonetaryPdfDefinition(result: WarehouseMonetaryResult): CurrentVparivanieV2PdfDefinition {
  const body = warehouseMonetaryMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 6 },
    content: [{ text: 'Відомість партій на складах: кількість, вартість і ПДВ', style: 'title' },
      { text: `${result.From} — ${result.Through}. ${unitDescription} ${receiptCaptionNote(result.ReceiptCaptions)}`, margin: [0, 4, 0, 8] },
      ...result.FilterSummary.map(value => ({ text: value })),
      { table: { headerRows: 1, widths: [125, 125, ...warehouseMonetaryColumns.map(() => 64)], body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function warehouseMonetaryPdf(result: WarehouseMonetaryResult): Promise<Blob> {
  const definition = warehouseMonetaryPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
