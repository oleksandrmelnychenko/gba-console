import { fenixDiscountIndex, fenixDiscountResultRequest, fenixDiscountValues, normalizeFenixDiscountResult, type FenixDiscountIndex, type FenixDiscountResult } from './originalFenixDiscountAnalysis'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
export function fenixDiscountHeaders(index: FenixDiscountIndex): string[] {
  return ['Контрагент', ...index.products.flatMap(p => [`${p.caption} · Тип ціни`, `${p.caption} · Відсоток знижки/націнки`])]
}
export function fenixDiscountExportError(result: FenixDiscountResult): string | null {
  if (!result.Available || !result.NormalInputsComplete || !result.OurSnapshotVerified) return 'Повний результат недоступний для експорту.'
  const index = fenixDiscountIndex(result), columns = 1 + 2 * index.products.length
  return columns > 16_384 || (index.parties.length + 1) * columns > 1_000_000
    ? 'Матриця перевищує межу файлу: 16 384 стовпці або 1 000 000 клітинок. Експорт не скорочується.' : null
}
function typedMatrix(result: FenixDiscountResult) {
  normalizeFenixDiscountResult(result, fenixDiscountResultRequest(result))
  const error = fenixDiscountExportError(result); if (error) throw new Error(error)
  const index = fenixDiscountIndex(result), text = (value: string, numeric = false) => ({ text: value, numeric })
  return [fenixDiscountHeaders(index).map(h => text(h)), ...index.parties.map(p => [text(p.caption), ...index.products.flatMap(product => {
    const cell = index.cells.get(JSON.stringify([p.key, product.key])), values = fenixDiscountValues(cell)
    return [text(values[0]), text(values[1], cell?.Percentage !== null && cell?.Percentage !== undefined)]
  })])]
}
export function fenixDiscountMatrix(result: FenixDiscountResult): string[][] {
  return typedMatrix(result).map(row => row.map(c => c.text))
}
const metadata = (result: FenixDiscountResult) => [[`Fenix · АнализСкидокНаценокНоменклатуры · зріз ${result.Through} до 23:59:59`],
  ['Контрагент у рядках, номенклатура у стовпцях; тип ціни й відсоток знижки/націнки. Загальних підсумків немає.'],
  ['Відсотки не додаються. Відповідність поточному оригіналу 1С та його порядку посилань ще не підтверджена.'],
  [result.Counterparties.length || result.Products.length
    ? `Відбори запиту: контрагенти ${result.Counterparties.length}, номенклатура ${result.Products.length}. Валютна конвертація не застосовується.`
    : 'Фільтри назв недоступні; запит без відборів. Валютна конвертація не застосовується.']]
export function fenixDiscountCsv(result: FenixDiscountResult): string {
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  return '\ufeff' + [...metadata(result).map(row => row.map(safe)), ...typedMatrix(result).map(row => row.map(c => c.numeric ? c.text : safe(c.text)))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function fenixDiscountXlsx(result: FenixDiscountResult): Promise<Blob> {
  const matrix = fenixDiscountMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix), 'Знижки Fenix')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function fenixDiscountPdfDefinition(result: FenixDiscountResult): CurrentVparivanieV2PdfDefinition {
  const matrix = fenixDiscountMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Аналіз знижок і націнок Fenix', style: 'title' }, ...metadata(result).map(row => ({ text: row.join(' · ') })),
      { table: { headerRows: 1, widths: matrix[0].map(() => '*' as const), body: matrix }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function fenixDiscountPdf(result: FenixDiscountResult): Promise<Blob> {
  const definition = fenixDiscountPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
