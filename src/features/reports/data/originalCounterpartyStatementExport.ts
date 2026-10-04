import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import { statementMeasures, statementResources, type StatementAmounts, type StatementResult } from './originalCounterpartyStatement'
export const statementHeaders = ['Організація', 'Контрагент', 'Договір', 'Взаєморозрахунки: початок', 'Взаєморозрахунки: прихід',
  'Взаєморозрахунки: витрата', 'Взаєморозрахунки: кінець', 'Управлінська сума: початок', 'Управлінська сума: прихід', 'Управлінська сума: витрата', 'Управлінська сума: кінець']
export const statementValues = (a: StatementAmounts) => statementResources.flatMap(r => statementMeasures.map(m => a[r][m]))
export function statementLines(result: StatementResult) {
  return result.Rows.flatMap(org => [{ key: org.Organization + '|total', cells: [org.Caption, 'Підсумок організації', '', ...statementValues(org.Amounts)], subtotal: true },
    ...org.Counterparties.flatMap(p => [{ key: org.Organization + '|' + p.Counterparty + '|total', cells: [org.Caption, p.Caption, 'Підсумок контрагента', ...statementValues(p.Amounts)], subtotal: true },
      ...p.Agreements.map(a => ({ key: org.Organization + '|' + p.Counterparty + '|' + a.Agreement, cells: [org.Caption, p.Caption, a.Caption, ...statementValues(a.Amounts)], subtotal: false }))])])
}
export function statementExportError(result: StatementResult): string | null {
  if (!result.Available || !result.Totals) return 'Повний результат недоступний для експорту.'
  const count = result.Rows.reduce((n, org) => n + 1 + org.Counterparties.reduce((sum, p) => sum + 1 + p.Agreements.length, 0), 2)
  return count * statementHeaders.length > 1_000_000 ? 'Файл перевищує 1 000 000 клітинок; частковий файл не формується.' : null
}
export function statementMatrix(result: StatementResult): string[][] {
  const error = statementExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний.')
  return [statementHeaders, ...statementLines(result).map(line => line.cells), ['Разом', '', '', ...statementValues(result.Totals)]]
}
export const statementUnitNote = 'Записані управлінські суми та суми взаєморозрахунків без перерахунку. Позначення валюти й відповідність іншим налаштуванням 1С не підтверджені.'
const metadata = (r: StatementResult) => [[`Період: ${r.From} – ${r.Through}, включно до 23:59:59`], [statementUnitNote], [`Результат: ${r.ResultSha256}`], ...r.FilterSummary.map(s => [s])]
export function statementCsv(result: StatementResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
  const safe = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  return '\ufeff' + [...metadata(result).map(row => row.map(safe)), ...statementMatrix(result).map(row => row.map((s, i) => i < 3 ? safe(s) : s))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function statementXlsx(result: StatementResult): Promise<Blob> {
  const matrix = statementMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Взаєморозрахунки')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function statementPdfDefinition(result: StatementResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Відомість взаєморозрахунків з контрагентами', style: 'title' }, ...metadata(result).map(r => ({ text: r.join(' · ') })),
      { table: { headerRows: 1, widths: statementHeaders.map(() => '*' as const), body: statementMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function statementPdf(result: StatementResult): Promise<Blob> {
  const definition = statementPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
