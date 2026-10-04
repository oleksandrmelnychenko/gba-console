import { lotAnalysisMeasures, type LotAnalysisResult, type LotAnalysisValues } from './originalLotBalanceAnalysis'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const lotAnalysisHeaders = ['Склад', 'Товар', 'Початковий залишок · кількість', 'Початковий залишок · вартість із ПДВ', 'Кінцевий залишок · кількість', 'Кінцевий залишок · вартість із ПДВ']
export const lotAnalysisValues = (value: LotAnalysisValues) => lotAnalysisMeasures.map(m => value[m])
export function lotAnalysisLines(result: LotAnalysisResult) {
  return result.Rows.flatMap(row => [
    { key: JSON.stringify([row.Warehouse]), cells: [row.Caption, 'Підсумок складу', ...lotAnalysisValues(row.Values)], subtotal: true },
    ...row.Products.map(product => ({ key: JSON.stringify([row.Warehouse, product.Product]), cells: [row.Caption, product.Caption, ...lotAnalysisValues(product.Values)], subtotal: false })),
  ])
}
export function lotAnalysisExportError(result: LotAnalysisResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.Totals) return 'Повний результат недоступний для експорту.'
  const rows = result.Rows.reduce((n, row) => n + 1 + row.Products.length, 2)
  return rows * lotAnalysisHeaders.length > 1_000_000 ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір.' : null
}
export function lotAnalysisMatrix(result: LotAnalysisResult): string[][] {
  const error = lotAnalysisExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [lotAnalysisHeaders, ...lotAnalysisLines(result).map(row => row.cells), ['Разом', '', ...lotAnalysisValues(result.Totals)]]
}
const unitNote = 'Кількість — записані одиниці; вартість — управлінська собівартість із ПДВ без валютного перерахунку.'
export function lotAnalysisFilterSummary(result: LotAnalysisResult): string[] {
  const fields = [['Склад', result.Warehouses], ['Номенклатура', result.Products]] as const
  return fields.map(([field, keys]) => {
    const choices = result.Choices[field]
    return `${field}: ${keys.length ? keys.map(key => choices.find(c => c.Key === key)?.Caption ?? 'Назву не зіставлено').join(', ') : 'усі'}`
  })
}
export function lotAnalysisCsv(result: LotAnalysisResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const metadata = [[`Період: ${result.From} — ${result.Through}`], [unitNote], ...lotAnalysisFilterSummary(result).map(value => [value])]
  return '\ufeff' + [...metadata, ...lotAnalysisMatrix(result)].map(row => row.map((value, i) => quote(i < 2 ? safe(value) : value)).join(',')).join('\r\n') + '\r\n'
}
export async function lotAnalysisXlsx(result: LotAnalysisResult): Promise<Blob> {
  const matrix = lotAnalysisMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Залишки')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Період', `${result.From} — ${result.Through}`], ['Одиниці', unitNote],
    ...lotAnalysisFilterSummary(result).map(value => ['Відбір', value])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function lotAnalysisPdfDefinition(result: LotAnalysisResult): CurrentVparivanieV2PdfDefinition {
  const body = lotAnalysisMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Аналіз залишків партій товарів на складах', style: 'title' },
      { text: `${result.From} — ${result.Through}. ${unitNote}`, margin: [0, 4, 0, 8] }, ...lotAnalysisFilterSummary(result).map(value => ({ text: value })),
      { table: { headerRows: 1, widths: ['*', '*', 95, 115, 95, 115], body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function lotAnalysisPdf(result: LotAnalysisResult): Promise<Blob> {
  const definition = lotAnalysisPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
