import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import type { WipResult, WipValues } from './originalWorkInProgress'
export const wipUnitNote = 'Записані управлінські суми без перерахунку валют. Кількість матеріалів збережена в одиницях запису без перерахунку.'
export const wipHeaders = (r: WipResult) => ['Підрозділ', 'Номенклатурна група', 'Стаття витрат', ...r.Measures]
export const wipValues = (r: WipResult, v: WipValues) => r.Measures.map(m => v[m] ?? '')
export function wipLines(r: WipResult) {
  return r.Rows.flatMap(d => [{ key: JSON.stringify([d.Division, 'division']), cells: [d.Caption, 'Підсумок підрозділу', '', ...wipValues(r, d.Values)], subtotal: true },
    ...d.ProductGroups.flatMap(g => [{ key: JSON.stringify([d.Division, g.ProductGroup, 'group']), cells: [d.Caption, g.Caption, 'Підсумок групи', ...wipValues(r, g.Values)], subtotal: true },
      ...g.Articles.map(a => ({ key: JSON.stringify([d.Division, g.ProductGroup, a.CostArticle, 'article']), cells: [d.Caption, g.Caption, a.Caption, ...wipValues(r, a.Values)], subtotal: false }))])])
}
export function wipExportError(r: WipResult): string | null {
  if (!r.Available || !r.Totals) return 'Повний результат недоступний для експорту.'
  return ((wipLines(r).length + 2) * wipHeaders(r).length > 1_000_000) ? 'Файл перевищує 1 000 000 клітинок; частковий файл не формується.' : null
}
export function wipMatrix(r: WipResult): string[][] {
  const error = wipExportError(r); if (error || !r.Totals) throw new Error(error ?? 'Повний результат недоступний.')
  return [wipHeaders(r), ...wipLines(r).map(line => line.cells), ['Разом', '', '', ...wipValues(r, r.Totals)]]
}
const metadata = (r: WipResult) => [[`Період: ${r.From} – ${r.Through}, включно до 23:59:59`], [wipUnitNote], [`Результат: ${r.ResultSha256}`],
  ...(['Divisions', 'ProductGroups', 'CostArticles'] as const).map(k => [`${k}: ${r[k].length} обрано`])]
export function wipCsv(r: WipResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`, safe = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  return '\ufeff' + [...metadata(r).map(row => row.map(safe)), ...wipMatrix(r).map(row => row.map((s, i) => i < 3 ? safe(s) : s))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function wipXlsx(result: WipResult): Promise<Blob> {
  const matrix = wipMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Незавершене виробництво')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function wipPdfDefinition(result: WipResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Незавершене виробництво', style: 'title' }, ...metadata(result).map(r => ({ text: r.join(' · ') })),
      { table: { headerRows: 1, widths: wipHeaders(result).map(() => '*' as const), body: wipMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function wipPdf(result: WipResult): Promise<Blob> {
  const definition = wipPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
