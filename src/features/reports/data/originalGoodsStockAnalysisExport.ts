import { goodsAnalysisMeasures, type GoodsAnalysisResult, type GoodsAnalysisValues } from './originalGoodsStockAnalysis'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const goodsAnalysisHeaders = ['Склад', 'Товар', 'Початковий залишок · кількість', 'Кінцевий залишок · кількість']
export const goodsAnalysisValues = (value: GoodsAnalysisValues) => goodsAnalysisMeasures.map(m => value[m])
export function goodsAnalysisLines(result: GoodsAnalysisResult) {
  return result.Rows.flatMap(row => [
    { key: JSON.stringify([row.Warehouse]), cells: [row.Caption, 'Підсумок складу', ...goodsAnalysisValues(row.Values)], subtotal: true },
    ...row.Products.map(product => ({ key: JSON.stringify([row.Warehouse, product.Product]), cells: [row.Caption, product.Caption, ...goodsAnalysisValues(product.Values)], subtotal: false })),
  ])
}
export function goodsAnalysisExportError(result: GoodsAnalysisResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.Totals) return 'Повний результат недоступний для експорту.'
  const rows = result.Rows.reduce((n, row) => n + 1 + row.Products.length, 2)
  return rows * goodsAnalysisHeaders.length > 1_000_000 ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір.' : null
}
export function goodsAnalysisMatrix(result: GoodsAnalysisResult): string[][] {
  const error = goodsAnalysisExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [goodsAnalysisHeaders, ...goodsAnalysisLines(result).map(row => row.cells), ['Разом', '', ...goodsAnalysisValues(result.Totals)]]
}
const unitNote = 'Кількість — в облікових одиницях із трьома десятковими знаками.'
export function goodsAnalysisFilterSummary(result: GoodsAnalysisResult): string[] {
  const fields = [['Склад', result.Warehouses], ['Номенклатура', result.Products]] as const
  return fields.map(([field, keys]) => {
    const choices = result.Choices[field]
    return `${field}: ${keys.length ? keys.map(key => choices.find(c => c.Key === key)?.Caption ?? 'Назву не зіставлено').join(', ') : 'усі'}`
  })
}
export function goodsAnalysisCsv(result: GoodsAnalysisResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const metadata = [[`Період: ${result.From} — ${result.Through}`], [unitNote], ...goodsAnalysisFilterSummary(result).map(value => [value])]
  return '\ufeff' + [...metadata, ...goodsAnalysisMatrix(result)].map(row => row.map((value, i) => quote(i < 2 ? safe(value) : value)).join(',')).join('\r\n') + '\r\n'
}
export async function goodsAnalysisXlsx(result: GoodsAnalysisResult): Promise<Blob> {
  const matrix = goodsAnalysisMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Залишки')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Період', `${result.From} — ${result.Through}`], ['Одиниці', unitNote],
    ...goodsAnalysisFilterSummary(result).map(value => ['Відбір', value])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function goodsAnalysisPdfDefinition(result: GoodsAnalysisResult): CurrentVparivanieV2PdfDefinition {
  const body = goodsAnalysisMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Аналіз товарних залишків без продажів', style: 'title' },
      { text: `${result.From} — ${result.Through}. ${unitNote}`, margin: [0, 4, 0, 8] }, ...goodsAnalysisFilterSummary(result).map(value => ({ text: value })),
      { table: { headerRows: 1, widths: ['*', '*', 110, 110], body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function goodsAnalysisPdf(result: GoodsAnalysisResult): Promise<Blob> {
  const definition = goodsAnalysisPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
