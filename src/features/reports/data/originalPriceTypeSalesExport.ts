import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import type { PriceSalesResult, PriceSalesValues } from './originalPriceTypeSales'
export const priceSalesUnitNote = 'Записані управлінські суми й глобальні ціни без перерахунку валют. Відсутня ціна зберігається порожнім значенням; кількість у базових одиницях походить із точних коефіцієнтів товару.'
export const priceSalesHeaders = (r: PriceSalesResult) => ['Контрагент', 'Номенклатура', ...r.Measures]
export const priceSalesValues = (r: PriceSalesResult, v: PriceSalesValues) => r.Measures.map(m => v[m] ?? '')
export function priceSalesLines(r: PriceSalesResult) {
  return r.Rows.flatMap(p => [{ key: p.Counterparty + '|total', cells: [p.Caption, 'Підсумок контрагента', ...priceSalesValues(r, p.Values)], subtotal: true },
    ...p.Products.map(product => ({ key: p.Counterparty + '|' + product.Product, cells: [p.Caption, product.Caption, ...priceSalesValues(r, product.Values)], subtotal: false }))])
}
export function priceSalesExportError(r: PriceSalesResult): string | null {
  if (!r.Available || !r.Totals) return 'Повний результат недоступний для експорту.'
  return (r.Rows.reduce((n, p) => n + 1 + p.Products.length, 2) * priceSalesHeaders(r).length > 1_000_000) ? 'Файл перевищує 1 000 000 клітинок; частковий файл не формується.' : null
}
export function priceSalesMatrix(r: PriceSalesResult): string[][] {
  const error = priceSalesExportError(r); if (error || !r.Totals) throw new Error(error ?? 'Повний результат недоступний.')
  return [priceSalesHeaders(r), ...priceSalesLines(r).map(line => line.cells), ['Разом', '', ...priceSalesValues(r, r.Totals)]]
}
const metadata = (r: PriceSalesResult) => [[`Період: ${r.From} – ${r.Through}, включно до 23:59:59`], [priceSalesUnitNote], [`Результат: ${r.ResultSha256}`],
  ...(['Counterparties', 'Products', 'Projects', 'Divisions'] as const).map(k => [`${k}: ${r[k].length} обрано`])]
export function priceSalesCsv(r: PriceSalesResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`, safe = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  return '\ufeff' + [...metadata(r).map(row => row.map(safe)), ...priceSalesMatrix(r).map(row => row.map((s, i) => i < 2 ? safe(s) : s))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function priceSalesXlsx(result: PriceSalesResult): Promise<Blob> {
  const matrix = priceSalesMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Продажі за типом цін')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function priceSalesPdfDefinition(result: PriceSalesResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Порівняння продажів за типом цін', style: 'title' }, ...metadata(result).map(r => ({ text: r.join(' · ') })),
      { table: { headerRows: 1, widths: priceSalesHeaders(result).map(() => '*' as const), body: priceSalesMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function priceSalesPdf(result: PriceSalesResult): Promise<Blob> {
  const definition = priceSalesPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
