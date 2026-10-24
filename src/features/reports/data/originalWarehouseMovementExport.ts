import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import { movementAsOf, type MovementResult, type MovementWarehouse, type MovementRegistrar } from './originalWarehouseMovement'
export const movementHeaders = ['Склад', 'Артикул', 'Документ руху', 'Дата руху', 'Початковий залишок', 'Прихід', 'Розхід', 'Кінцевий залишок']
const values = (q: NonNullable<MovementResult['Totals']>) => [q.Opening, q.Incoming, q.Outgoing, q.Closing]
export const movementWarehouseCaption = (row: MovementWarehouse) => row.Caption ?? `Склад без назви · ${row.SourceWarehouseReference}`
export const movementRegistrarCaption = (row: MovementRegistrar) => row.Caption ?? ([row.Number, row.SourceDate].filter(Boolean).join(' · ') || `${row.RecorderType}:${row.RecorderReference}`)
export function movementExportError(result: MovementResult): string | null {
  if (!result.Available || !result.OurSnapshotVerified || !result.Totals || !result.Capture || !result.ResultSha256) return 'Повний результат недоступний для експорту.'
  return (result.Rows.reduce((sum, row) => sum + 1 + row.Registrars.length, 2) * movementHeaders.length > 1_000_000) ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період; частковий файл не формується.' : null
}
/** Registrar balances are the known states before/after that movement; only warehouse states form totals. */
export function movementDisplayMatrix(result: MovementResult): string[][] {
  if (!result.Available || !result.Totals || !result.Capture) throw new Error('Результат недоступний.')
  // pdfmake normalizes table cells in place; never share its header array with the screen.
  return [[...movementHeaders], ...result.Rows.flatMap(row => [[movementWarehouseCaption(row), row.Article, 'Підсумок товару на складі', '', ...values(row.Quantity)],
    ...row.Registrars.map(child => [movementWarehouseCaption(row), row.Article, movementRegistrarCaption(child), child.SourcePeriod, ...values(child.Quantity)])]), ['Разом по складах', result.Scope.Article, '', '', ...values(result.Totals)]]
}
export function movementMatrix(result: MovementResult): string[][] {
  const error = movementExportError(result)
  if (error) throw new Error(error)
  return movementDisplayMatrix(result)
}
export function movementNotes(result: MovementResult): string[] {
  if (!result.Capture) throw new Error('Немає підтвердженого зрізу.')
  return [`Період: ${result.Scope.From} — ${result.Scope.Through}`, `Дані з 1С станом на ${movementAsOf(result.Capture)} (Київ).`,
    'Обмежене покриття: лише вибраний товар і склади опублікованого зрізу Fenix. Повна відповідність звіту 1С не підтверджена.',
    'Кількість — одиниці джерела, без перерахунку. Залишки в рядках документів — стан до та після руху; підсумок обчислюється за складами.',
    ...(result.Scope.Through === result.Capture.Through && !result.Capture.ThroughDayComplete ? ['Останній день періоду ще не завершений у джерельному зрізі.'] : []),
    ...(result.MissingCaptionMappings.length ? ['Для документів без назви показано номер і дату; якщо їх немає — ідентифікатор. Склади без назви також позначено ідентифікатором.'] : []),
    `Зріз: ${result.Capture.ManifestSha256}`, `Результат: ${result.ResultSha256}`]
}
export function movementCsv(result: MovementResult): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
  const safe = (s: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(s) ? `'${s}` : s
  const rows = [...movementNotes(result).map(note => [note]), ...movementMatrix(result)]
  return '\ufeff' + rows.map(row => row.map((v, index) => quote(index < 4 ? safe(v) : v)).join(',')).join('\r\n') + '\r\n'
}
export async function movementXlsx(result: MovementResult): Promise<Blob> {
  const rows = movementMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Рух товару')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(movementNotes(result).map(note => [note])), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function movementPdfDefinition(result: MovementResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [{ text: 'Рух товару за складськими документами', style: 'title' }, ...movementNotes(result).map(text => ({ text, margin: [0, 0, 0, 4] })),
      { table: { headerRows: 1, widths: [130, 80, 220, 120, 95, 95, 95, 95], body: movementMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function movementPdf(result: MovementResult): Promise<Blob> {
  const definition = movementPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) }
  })
}
