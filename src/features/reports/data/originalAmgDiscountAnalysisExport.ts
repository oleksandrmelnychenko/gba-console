import { amgDiscountAnalysisIndex, amgDiscountAnalysisResultRequest, amgDiscountAnalysisValues, normalizeAmgDiscountAnalysisResult, type AmgDiscountAnalysisIndex, type AmgDiscountAnalysisResult } from './originalAmgDiscountAnalysis'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export function amgDiscountAnalysisHeaders(index: AmgDiscountAnalysisIndex): string[] {
  return ['Контрагент', ...index.products.flatMap(p => [`${p.caption} · Тип ціни`, `${p.caption} · Відсоток знижки/націнки`])]
}
export function amgDiscountAnalysisExportError(result: AmgDiscountAnalysisResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.OurSnapshotVerified) return 'Повний результат недоступний для експорту.'
  const index = amgDiscountAnalysisIndex(result), columns = 1 + 2 * index.products.length
  return columns > 16_384 || (index.parties.length + 1) * columns > 1_000_000
    ? 'Матриця перевищує межу файлу: 16 384 стовпці або 1 000 000 клітинок. Експорт не скорочується.' : null
}
function typedMatrix(result: AmgDiscountAnalysisResult) {
  normalizeAmgDiscountAnalysisResult(result, amgDiscountAnalysisResultRequest(result))
  const error = amgDiscountAnalysisExportError(result); if (error) throw new Error(error)
  const index = amgDiscountAnalysisIndex(result), text = (value: string, numeric = false) => ({ text: value, numeric })
  return [amgDiscountAnalysisHeaders(index).map(h => text(h)), ...index.parties.map(p => [text(p.caption), ...index.products.flatMap(product => {
    const cell = index.cells.get(JSON.stringify([p.key, product.key])), values = amgDiscountAnalysisValues(cell)
    return [text(values[0]), text(values[1], cell?.Percentage !== null && cell?.Percentage !== undefined)]
  })])]
}
export function amgDiscountAnalysisMatrix(result: AmgDiscountAnalysisResult): string[][] {
  return typedMatrix(result).map(row => row.map(c => c.text))
}
const metadata = (result: AmgDiscountAnalysisResult) => [[`AMG · Аналіз знижок і націнок · на кінець дня ${result.Through}`],
  ['Контрагент у рядках, номенклатура у стовпцях; тип ціни й відсоток знижки/націнки. Загальних підсумків немає.'],
  ['Для кожної пари контрагента й товару показано тип ціни та відсоток.'],
  [result.Counterparties.length || result.Products.length
    ? `Відбори: контрагенти ${result.Counterparties.length}, номенклатура ${result.Products.length}.`
    : 'Без відборів: усі контрагенти й номенклатура.']]
export function amgDiscountAnalysisCsv(result: AmgDiscountAnalysisResult): string {
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  return '\ufeff' + [...metadata(result).map(row => row.map(safe)), ...typedMatrix(result).map(row => row.map(c => c.numeric ? c.text : safe(c.text)))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function amgDiscountAnalysisXlsx(result: AmgDiscountAnalysisResult): Promise<Blob> {
  const matrix = amgDiscountAnalysisMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Знижки AMG')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function amgDiscountAnalysisPdfDefinition(result: AmgDiscountAnalysisResult): CurrentVparivanieV2PdfDefinition {
  const matrix = amgDiscountAnalysisMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Аналіз знижок і націнок AMG', style: 'title' }, ...metadata(result).map(row => ({ text: row.join(' · ') })),
      { table: { headerRows: 1, widths: matrix[0].map(() => '*' as const), body: matrix }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function amgDiscountAnalysisPdf(result: AmgDiscountAnalysisResult): Promise<Blob> {
  const definition = amgDiscountAnalysisPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
