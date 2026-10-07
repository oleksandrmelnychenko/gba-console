import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import { buyerOrdersScaled, buyerOrdersValueKey, type BuyerOrdersMeasure, type BuyerOrdersResult } from './originalBuyerOrders'
export const buyerOrdersHeaders = ['Замовлення', 'Товар', 'Базові: початковий залишок', 'Базові: надходження', 'Базові: витрати', 'Базові: кінцевий залишок',
  'Зберігання: початковий залишок', 'Зберігання: надходження', 'Зберігання: витрати', 'Зберігання: кінцевий залишок']
export const buyerOrdersValues = (base: BuyerOrdersMeasure, stored: BuyerOrdersMeasure) => [base.Opening, base.Incoming, base.Outgoing, base.Closing,
  stored.Opening, stored.Incoming, stored.Outgoing, stored.Closing]
const stages = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
function formatted(value: bigint, stored: boolean) {
  const sign = value < 0n ? '-' : '', digits = (value < 0n ? -value : value).toString().padStart(7, '0')
  const fraction = stored ? digits.slice(-6, -3) : digits.slice(-6).replace(/0{1,3}$/, '')
  return `${sign}${digits.slice(0, -6)}.${fraction.padEnd(3, '0')}`
}
function total(rows: BuyerOrdersMeasure[], stored: boolean): BuyerOrdersMeasure {
  return Object.fromEntries(stages.map(stage => [stage, formatted(rows.reduce((sum, r) => sum + buyerOrdersScaled(r[stage], stored), 0n), stored)])) as BuyerOrdersMeasure
}
export function buyerOrdersExportError(result: BuyerOrdersResult): string | null {
  if (!result.Available || !result.BaseTotals || !result.StoredTotals) return 'Повний результат недоступний для експорту.'
  if (result.Rows.some(r => r.Key.length !== 2 || r.Key[0].Field !== 0 || r.Key[1].Field !== 1)) return 'Експорт потребує групування «Замовлення → товар».'
  const orders = new Set(result.Rows.map(r => buyerOrdersValueKey(r.Key[0]))).size
  return (result.Rows.length + orders + 2) * buyerOrdersHeaders.length > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір; частковий файл не формується.' : null
}
/** Full tuple grouping, exact accepted strings, and exact subtotal arithmetic shared by screen and exports. */
export function buyerOrdersLines(result: BuyerOrdersResult) {
  const captions = new Map(result.FieldChoices.map(c => [buyerOrdersValueKey(c.Value), c.Caption]))
  const groups = new Map<string, BuyerOrdersResult['Rows']>()
  for (const row of result.Rows) {
    const key = buyerOrdersValueKey(row.Key[0]), list = groups.get(key) ?? []
    list.push(row); groups.set(key, list)
  }
  return [...groups].flatMap(([key, rows]) => {
    const order = captions.get(key) ?? 'Замовлення без назви'
    return [{ key: JSON.stringify([key]), subtotal: true, cells: [order, 'Підсумок замовлення', ...buyerOrdersValues(total(rows.map(r => r.Base), false), total(rows.map(r => r.Stored), true))] },
      ...rows.map(r => ({ key: JSON.stringify(r.Key.map(buyerOrdersValueKey)), subtotal: false,
        cells: [order, captions.get(buyerOrdersValueKey(r.Key[1])) ?? 'Товар без назви', ...buyerOrdersValues(r.Base, r.Stored)] }))]
  })
}
export function buyerOrdersMatrix(result: BuyerOrdersResult): string[][] {
  const error = buyerOrdersExportError(result)
  if (error || !result.BaseTotals || !result.StoredTotals) throw new Error(error ?? 'Повний результат недоступний для експорту.')
  return [buyerOrdersHeaders, ...buyerOrdersLines(result).map(r => r.cells), ['Разом', '', ...buyerOrdersValues(result.BaseTotals, result.StoredTotals)]]
}
const units = 'Базова кількість = кількість зберігання × коефіцієнт одиниці зберігання товару до групування. Значення точні, без округлення.'
const mapping = 'Назви замовлень недоступні; їхні окремі рядки збережено. Повна відповідність усім налаштуванням 1С не підтверджена.'
export function buyerOrdersCsv(result: BuyerOrdersResult): string {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  const label = (v: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(v) ? `'${v}` : v
  return '\ufeff' + [[`Період: ${result.From} — ${result.Through}`], [units], [mapping], ...result.FilterSummary.map(v => [v]), ...buyerOrdersMatrix(result)]
    .map(row => row.map((v, i) => quote(i < 2 ? label(v) : v)).join(',')).join('\r\n') + '\r\n'
}
export async function buyerOrdersXlsx(result: BuyerOrdersResult): Promise<Blob> {
  const rows = buyerOrdersMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Замовлення покупців')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Період', `${result.From} — ${result.Through}`], ['Одиниці', units], ['Відповідність', mapping],
    ...result.FilterSummary.map(v => ['Відбір', v])]), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function buyerOrdersPdfDefinition(result: BuyerOrdersResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [{ text: 'Відомість замовлень покупців', style: 'title' }, { text: `${result.From} — ${result.Through}. ${units} ${mapping}`, margin: [0, 4, 0, 8] },
      ...result.FilterSummary.map(v => ({ text: v })), { table: { headerRows: 1, widths: [125, 125, ...Array(8).fill(80)], body: buyerOrdersMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function buyerOrdersPdf(result: BuyerOrdersResult): Promise<Blob> {
  const definition = buyerOrdersPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
