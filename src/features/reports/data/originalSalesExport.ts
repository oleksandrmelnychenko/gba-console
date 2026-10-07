import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import type { SalesResult, SalesValues } from './originalSales'
export const salesUnitNote = 'Записані управлінські суми без перерахунку валют. Базова та звітна кількість використовують точні коефіцієнти товару; назви базових одиниць ще недоступні.'
export const salesHeaders = (r: SalesResult) => ['Контрагент', 'Номенклатура', ...r.Measures]
export const salesValues = (r: SalesResult, v: SalesValues) => r.Measures.map(m => v[m] ?? '')
export function salesLines(r: SalesResult) {
  return r.Rows.flatMap(p => [{ key: p.Counterparty + '|total', cells: [p.Caption, 'Підсумок контрагента', ...salesValues(r, p.Values)], subtotal: true },
    ...p.Products.map(product => ({ key: p.Counterparty + '|' + product.Product, cells: [p.Caption, product.Caption, ...salesValues(r, product.Values)], subtotal: false }))])
}
export function salesExportError(r: SalesResult): string | null {
  if (!r.Available || !r.Totals) return 'Повний результат недоступний для експорту.'
  return (r.Rows.reduce((n, p) => n + 1 + p.Products.length, 2) * salesHeaders(r).length > 1_000_000) ? 'Файл перевищує 1 000 000 клітинок; частковий файл не формується.' : null
}
export function salesMatrix(r: SalesResult): string[][] {
  const error = salesExportError(r); if (error || !r.Totals) throw new Error(error ?? 'Повний результат недоступний.')
  return [salesHeaders(r), ...salesLines(r).map(line => line.cells), ['Разом', '', ...salesValues(r, r.Totals)]]
}
const metadata = (r: SalesResult) => [[`Період: ${r.From} – ${r.Through}, включно до 23:59:59`], [salesUnitNote], [`Результат: ${r.ResultSha256}`],
  ...(['Counterparties', 'Products', 'Projects', 'Divisions'] as const).map(k => [`${k}: ${r[k].length} обрано`])]
export function salesCsv(r: SalesResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`, safe = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  return '\ufeff' + [...metadata(r).map(row => row.map(safe)), ...salesMatrix(r).map(row => row.map((s, i) => i < 2 ? safe(s) : s))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function salesXlsx(result: SalesResult): Promise<Blob> {
  const matrix = salesMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Продажі')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function salesPdfDefinition(result: SalesResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Продажі', style: 'title' }, ...metadata(result).map(r => ({ text: r.join(' · ') })),
      { table: { headerRows: 1, widths: salesHeaders(result).map(() => '*' as const), body: salesMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function salesPdf(result: SalesResult): Promise<Blob> {
  const definition = salesPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
