import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import type { DebtAmounts, DebtResult } from './originalCounterpartyDebt'
export const debtHeaders = (result: DebtResult) => ['Організація', 'Контрагент', 'Управлінська сума', ...(result.IncludeSettlement ? ['Записана сума взаєморозрахунків'] : [])]
export const debtValues = (amounts: DebtAmounts, settlement: boolean) => [amounts.Management, ...(settlement ? [amounts.Settlement] : [])]
export function debtLines(result: DebtResult) {
  return result.Rows.flatMap(r => [{ key: `${r.Organization}|total`, cells: [r.Caption, 'Підсумок організації', ...debtValues(r.Amounts, result.IncludeSettlement)], subtotal: true },
    ...r.Counterparties.map(p => ({ key: `${r.Organization}|${p.Counterparty}`, cells: [r.Caption, p.Caption, ...debtValues(p.Amounts, result.IncludeSettlement)], subtotal: false }))])
}
export function debtExportError(result: DebtResult): string | null {
  if (!result.Available || !result.Totals) return 'Повний результат недоступний для експорту.'
  return result.Rows.reduce((n, r) => n + 1 + r.Counterparties.length, 2) * debtHeaders(result).length > 1_000_000
    ? 'Файл перевищує 1 000 000 клітинок; частковий файл не формується.' : null
}
export function debtMatrix(result: DebtResult): string[][] {
  const error = debtExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний.')
  return [debtHeaders(result), ...debtLines(result).map(r => r.cells), ['Разом', '', ...debtValues(result.Totals, result.IncludeSettlement)]]
}
export const debtUnitNote = 'Записані управлінські суми; додаткова сума взаєморозрахунків не конвертується. Позначення валюти та відповідність усім налаштуванням 1С не підтверджені.'
const metadata = (r: DebtResult) => [[`Залишок до: ${r.AsOf}`], [debtUnitNote], [`Результат: ${r.ResultSha256}`], ...r.FilterSummary.map(s => [s])]
export function debtCsv(result: DebtResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
  const label = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  return '\ufeff' + [...metadata(result), ...debtMatrix(result)].map(r => r.map((s, i) => quote(i < 2 ? label(s) : s)).join(',')).join('\r\n') + '\r\n'
}
export async function debtXlsx(result: DebtResult): Promise<Blob> {
  const matrix = debtMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Заборгованість')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function debtPdfDefinition(result: DebtResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Заборгованість за контрагентами', style: 'title' }, ...metadata(result).map(r => ({ text: r.join(' · ') })),
      { table: { headerRows: 1, widths: debtHeaders(result).map(() => '*'), body: debtMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function debtPdf(result: DebtResult): Promise<Blob> {
  const definition = debtPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
