import { cashMovementsDefinitions, cashMovementsFilters, cashMovementsLabels, cashMovementsMeasures, cashMovementsRows,
  type CashMovementsResult, type CashMovementsRow, type CashMovementsTotals, type CashMovementsValues } from './originalCashMovements'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
const unitNote = 'Сума у валюті рахунку / каси та управлінська сума — два збережені ресурси без валютного перерахунку. Загальний підсумок арифметично об’єднує валюти.'
const nullNote = '«—» означає відсутність внеску; 0.00 — спостережений нуль після взаємного погашення. Відповідність 1С не підтверджена.'
const textValues = (values: CashMovementsValues) => cashMovementsMeasures.map(measure => values[measure] ?? '—')
export function cashMovementsHeaders(result: CashMovementsResult): string[] {
  return [...cashMovementsRows.map(field => cashMovementsLabels[field]), ...cashMovementsDefinitions.map(d => `Разом · ${d.Caption}`),
    ...result.Columns.flatMap(column => cashMovementsDefinitions.map(d => `${column.Caption} · ${d.Caption}`))]
}
export function cashMovementsCells(result: CashMovementsResult, totals: CashMovementsTotals): string[] {
  return [...textValues(totals.Values), ...result.Columns.flatMap(column => textValues(totals.ByMoneyKind[column.Key]))]
}
export function cashMovementsLines(result: CashMovementsResult) {
  const lines: { key: string; cells: string[]; subtotal: boolean }[] = []
  function append(rows: CashMovementsRow[], keys: string[], names: string[]) {
    for (const row of rows) {
      const path = [...keys, row.Key], captions = [...names, row.Caption]
      lines.push({ key: JSON.stringify(path), cells: [...captions, ...Array<string>(4 - captions.length).fill(''), ...cashMovementsCells(result, row)], subtotal: row.Children.length > 0 })
      append(row.Children, path, captions)
    }
  }
  append(result.Rows, [], [])
  return lines
}
function rowCount(rows: CashMovementsRow[]): number {
  let count = 0
  for (const row of rows) count += 1 + rowCount(row.Children)
  return count
}
export function cashMovementsExportError(result: CashMovementsResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.Totals) return 'Повні рухи коштів недоступні для експорту.'
  return (rowCount(result.Rows) + 2) * (6 + result.Columns.length * 2) > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбори; частковий файл не формується.' : null
}
export function cashMovementsMatrix(result: CashMovementsResult): string[][] {
  const error = cashMovementsExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [cashMovementsHeaders(result), ...cashMovementsLines(result).map(line => line.cells), ['Разом', '', '', '', ...cashMovementsCells(result, result.Totals)]]
}
export function cashMovementsFilterSummary(result: CashMovementsResult): string[] {
  return cashMovementsFilters.map(field => {
    const names = new Map(result.Choices[field].map(c => [c.Key, c.Caption]))
    return `${cashMovementsLabels[field]}: ${result.Selectors[field].length ? result.Selectors[field].map(key => `${names.get(key) ?? 'Назва недоступна'} [${key}]`).join(', ') : 'усі'}`
  })
}
function metadata(result: CashMovementsResult): string[][] {
  return [['Рухи коштів Fenix'], [`Період: ${result.From} — ${result.Through}`], [unitNote], [nullNote],
    [`Код управлінської валюти джерела: ${result.ManagementCurrency?.Code ?? 'не підтверджено'}`],
    ...cashMovementsFilterSummary(result).map(text => [text]),
    [`Назви не зіставлено: ${result.MissingCaptionMappings.map(field => cashMovementsLabels[field]).join(', ')}`]]
}
export function cashMovementsCsv(result: CashMovementsResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const rows = [...metadata(result).map(row => row.map(safe)), ...cashMovementsMatrix(result).map((row, i) => row.map((value, column) => i === 0 || column < 4 ? safe(value) : value))]
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function cashMovementsXlsx(result: CashMovementsResult): Promise<Blob> {
  const rows = cashMovementsMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Рухи коштів')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function cashMovementsPdfDefinition(result: CashMovementsResult): CurrentVparivanieV2PdfDefinition {
  const body = cashMovementsMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 6 },
    content: [...metadata(result).map(row => ({ text: row.join(' ') })), { table: { headerRows: 1, widths: body[0].map(() => '*'), body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function cashMovementsPdf(result: CashMovementsResult): Promise<Blob> {
  const definition = cashMovementsPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
