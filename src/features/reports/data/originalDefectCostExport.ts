import { defectCostLabels, normalizeDefectCost, type DefectCostResult, type DefectCostValues } from './originalDefectCost'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const defectCostValues = (value: DefectCostValues, result: DefectCostResult) => result.Measures.map(m => value[m])
export const defectCostHeaders = (result: DefectCostResult) => ['Підрозділ', 'Стаття витрат', ...result.Measures.map(m => defectCostLabels[m])]
/** Names are unavailable in the current wire contract. Ordinals identify visible rows without exposing technical references. */
export function defectCostLines(result: DefectCostResult) {
  return result.Rows.flatMap((row, division) => {
    const caption = `Підрозділ ${division + 1} · назва недоступна`
    return [{ key: JSON.stringify([row.Division]), cells: [caption, 'Підсумок підрозділу', ...defectCostValues(row.Values, result)], subtotal: true },
      ...row.Articles.map((article, index) => ({ key: JSON.stringify([row.Division, article.CostArticle]),
        cells: [caption, `Стаття витрат ${index + 1} · назва недоступна`, ...defectCostValues(article.Values, result)], subtotal: false }))]
  })
}
export function defectCostExportError(result: DefectCostResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.Totals) return 'Повний результат недоступний для експорту.'
  const rows = result.Rows.reduce((count, row) => count + 1 + row.Articles.length, 2)
  return rows * (result.Measures.length + 2) > 1_000_000 ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період.' : null
}
export function defectCostMatrix(result: DefectCostResult): string[][] {
  const error = defectCostExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  normalizeDefectCost(result, result)
  return [defectCostHeaders(result), ...defectCostLines(result).map(row => row.cells), ['Разом', '', ...defectCostValues(result.Totals, result)]]
}
const unitNote = 'Вартість і ПДВ — суми управлінського обліку з двома десятковими знаками, без валютного перерахунку.'
export function defectCostFilterSummary(result: DefectCostResult) {
  return [`Підрозділи: ${result.Divisions.length ? 'вибрані; назви недоступні' : 'усі'}`,
    `Статті витрат: ${result.CostArticles.length ? 'вибрані; назви недоступні' : 'усі'}`]
}
export function defectCostCsv(result: DefectCostResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const metadata = [[`Період: ${result.From} — ${result.Through}`], [unitNote], ...defectCostFilterSummary(result).map(value => [value])]
  return '\ufeff' + [...metadata, ...defectCostMatrix(result)].map(row => row.map((value, index) => quote(index < 2 ? safe(value) : value)).join(',')).join('\r\n') + '\r\n'
}
export async function defectCostXlsx(result: DefectCostResult): Promise<Blob> {
  const matrix = defectCostMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Вартість браку')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Період', `${result.From} — ${result.Through}`], ['Одиниці', unitNote],
    ...defectCostFilterSummary(result).map(value => ['Відбір', value])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function defectCostPdfDefinition(result: DefectCostResult): CurrentVparivanieV2PdfDefinition {
  const body = defectCostMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Брак у виробництві · вартість', style: 'title' }, { text: `${result.From} — ${result.Through}. ${unitNote}`, margin: [0, 4, 0, 8] },
      ...defectCostFilterSummary(result).map(value => ({ text: value })),
      { table: { headerRows: 1, widths: ['*', '*', ...result.Measures.map(() => 85)], body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function defectCostPdf(result: DefectCostResult): Promise<Blob> {
  const definition = defectCostPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
