import { normalizePurchases, purchasesFilterLabels, purchasesFilters, purchasesLabels, purchasesResultRequest, type PurchasesResult, type PurchasesValues } from './originalPurchases'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export const purchasesValues = (values: PurchasesValues, result: PurchasesResult) => result.Measures.map(m => values[m])
export const purchasesHeaders = (result: PurchasesResult) => ['Статус партії', 'Контрагент', 'Номенклатура', ...result.Measures.map(m => purchasesLabels[m])]
export function purchasesLines(result: PurchasesResult) {
  return result.Rows.flatMap((status, statusIndex) => {
    const statusName = status.CaptionAvailable ? status.Caption : `Статус партії ${statusIndex + 1} · назва недоступна`
    return [{ key: JSON.stringify([status.Key]), cells: [statusName, 'Підсумок статусу', '', ...purchasesValues(status.Values, result)], subtotal: true },
      ...status.Children.flatMap((party, partyIndex) => {
        const partyName = party.CaptionAvailable ? party.Caption : `Контрагент ${partyIndex + 1} · назва недоступна`
        return [{ key: JSON.stringify([status.Key, party.Key]), cells: [statusName, partyName, 'Підсумок контрагента', ...purchasesValues(party.Values, result)], subtotal: true },
          ...party.Children.map((product, productIndex) => ({ key: JSON.stringify([status.Key, party.Key, product.Key]),
            cells: [statusName, partyName, product.CaptionAvailable ? product.Caption : `Номенклатура ${productIndex + 1} · назва недоступна`, ...purchasesValues(product.Values, result)], subtotal: false }))]
      })]
  })
}
export function purchasesExportError(result: PurchasesResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.Totals) return 'Повний результат недоступний для експорту.'
  const rows = result.Rows.reduce((count, row) => count + 1 + row.Children.reduce((part, party) => part + 1 + party.Children.length, 0), 2)
  return rows * (result.Measures.length + 3) > 1_000_000 ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період.' : null
}
export function purchasesMatrix(result: PurchasesResult): string[][] {
  const error = purchasesExportError(result)
  if (error || !result.Totals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  normalizePurchases(result, purchasesResultRequest(result))
  return [purchasesHeaders(result), ...purchasesLines(result).map(row => row.cells), ['Разом', '', '', ...purchasesValues(result.Totals, result)]]
}
const unitNote = 'Кількості мають три десяткові знаки. Базові та звітні одиниці використовують спостережені коефіцієнти товару; підсумки сервера не перераховуються з округлених рядків.'
const metadata = (result: PurchasesResult) => [[`Період: ${result.From} — ${result.Through}, включно до 23:59:59`], [unitNote],
  ...purchasesFilters.map(field => [`${purchasesFilterLabels[field]}: ${result.Selectors[field].length ? 'вибрані' : 'усі'}`])]
export function purchasesCsv(result: PurchasesResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  return '\ufeff' + [...metadata(result).map(row => row.map(safe)), ...purchasesMatrix(result).map(row => row.map((value, index) => index < 3 ? safe(value) : value))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function purchasesXlsx(result: PurchasesResult): Promise<Blob> {
  const matrix = purchasesMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Закупки')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function purchasesPdfDefinition(result: PurchasesResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Закупки', style: 'title' }, ...metadata(result).map(row => ({ text: row.join(' · ') })),
      { table: { headerRows: 1, widths: purchasesHeaders(result).map(() => '*' as const), body: purchasesMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function purchasesPdf(result: PurchasesResult): Promise<Blob> {
  const definition = purchasesPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
