import { moneyFlowDefinitions, moneyFlowFilters, moneyFlowLabels, moneyFlowRows, type MoneyFlowResult, type MoneyFlowValues } from './originalMoneyFlowAnalysis'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
const unitNote = 'Суми у валюті рахунку / каси та управлінські суми — окремі збережені ресурси. Валюти арифметично об’єднуються без валютного перерахунку.'
const scopeNote = 'Період включає бізнес-дні до останньої цілої секунди. Відповідність ефективного періоду та результату 1С не підтверджена.'
const nullNote = '«—» означає відсутність внеску; 0.00 — спостережений нуль. Підсумки передано сервером без перерахунку в консолі.'
const captions = new Map(moneyFlowDefinitions.map(d => [d.Key, d.Caption]))
export const moneyFlowCells = (result: MoneyFlowResult, values: MoneyFlowValues) => result.Measures.map(measure => values[measure] ?? '—')
export function moneyFlowHeaders(result: MoneyFlowResult): string[] {
  return [...moneyFlowRows.map(field => moneyFlowLabels[field]), ...result.Measures.map(measure => captions.get(measure) ?? measure)]
}
export function moneyFlowLines(result: MoneyFlowResult) {
  const lines: { key: string; cells: string[]; subtotal: boolean }[] = []
  result.Rows.forEach((organization, organizationIndex) => {
    const organizationName = organization.CaptionAvailable ? organization.Caption : `Організація ${organizationIndex + 1} · назва недоступна`
    lines.push({ key: JSON.stringify([organization.Key]), cells: [organizationName, '', ...moneyFlowCells(result, organization.Values)], subtotal: true })
    organization.Children.forEach((article, articleIndex) => lines.push({ key: JSON.stringify([organization.Key, article.Key]),
      cells: [organizationName, article.CaptionAvailable ? article.Caption : `Стаття руху коштів ${articleIndex + 1} · назва недоступна`, ...moneyFlowCells(result, article.Values)], subtotal: false }))
  })
  return lines
}
export function moneyFlowExportError(result: MoneyFlowResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.OurSnapshotVerified || !result.Totals) return 'Повний аналіз руху коштів недоступний для експорту.'
  const count = result.Rows.reduce((sum, row) => sum + 1 + row.Children.length, 0)
  return (count + 2) * (2 + result.Measures.length) > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбори; частковий файл не формується.' : null
}
export function moneyFlowMatrix(result: MoneyFlowResult): string[][] {
  const error = moneyFlowExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [moneyFlowHeaders(result), ...moneyFlowLines(result).map(line => line.cells), ['Разом', '', ...moneyFlowCells(result, result.Totals)]]
}
export function moneyFlowFilterSummary(result: MoneyFlowResult): string[] {
  return moneyFlowFilters.map(field => {
    const names = new Map(result.Choices[field].map(c => [c.Key, c.Caption]))
    return `${moneyFlowLabels[field]}: ${result.Selectors[field].length ? result.Selectors[field].map(key => `${names.get(key) ?? 'Назва недоступна'} [${key}]`).join(', ') : 'усі'}`
  })
}
function metadata(result: MoneyFlowResult): string[][] {
  return [['Аналіз руху коштів Fenix'], [`Період: ${result.From} — ${result.Through}`], [unitNote], [scopeNote], [nullNote],
    [`Код управлінської валюти джерела: ${result.ManagementCurrency?.Code ?? 'не підтверджено'}`],
    ...moneyFlowFilterSummary(result).map(text => [text]),
    [`Назви не зіставлено: ${result.MissingCaptionMappings.map(field => moneyFlowLabels[field]).join(', ')}`]]
}
export function moneyFlowCsv(result: MoneyFlowResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const rows = [...metadata(result).map(row => row.map(safe)), ...moneyFlowMatrix(result).map((row, i) => row.map((value, column) => i === 0 || column < 2 ? safe(value) : value))]
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function moneyFlowXlsx(result: MoneyFlowResult): Promise<Blob> {
  const rows = moneyFlowMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Аналіз руху коштів')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function moneyFlowPdfDefinition(result: MoneyFlowResult): CurrentVparivanieV2PdfDefinition {
  const body = moneyFlowMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [...metadata(result).map(row => ({ text: row.join(' ') })), { table: { headerRows: 1, widths: body[0].map(() => '*'), body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function moneyFlowPdf(result: MoneyFlowResult): Promise<Blob> {
  const definition = moneyFlowPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
