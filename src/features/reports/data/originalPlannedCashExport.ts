import { plannedDefinitions, plannedFieldLabels, type OriginalPlannedResult, type PlannedAmounts } from './originalPlannedCash'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
const stages = [['Opening', 'Початковий залишок'], ['Incoming', 'Надходження'], ['Outgoing', 'Витрати'], ['Closing', 'Кінцевий залишок']] as const
const resources = [['Settlement', 'Взаєморозрахунки'], ['Management', 'Управлінська сума'], ['Cash', 'Сума коштів']] as const
export const plannedColumns = resources.flatMap(([resource, label]) => stages.map(([stage, title]) => ({ resource, stage, label: `${label} · ${title}` })))
export const plannedValues = (value: PlannedAmounts) => plannedColumns.map(column => value[column.resource][column.stage])
export const plannedHeaders = (result: OriginalPlannedResult) => ['Група', ...result.Grouping.map(field => plannedFieldLabels[field]), ...plannedColumns.map(column => column.label)]
export function plannedExportError(result: OriginalPlannedResult): string | null {
  if (!result.Available) return 'Повний результат недоступний для експорту.'
  return (result.Rows.length + 1 + (result.Totals ? 1 : 0)) * plannedHeaders(result).length > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або групування; частковий файл не формується.' : null
}
/** Screen/CSV/XLSX/PDF consume one immutable full result; missing names never become raw reference labels. */
export function plannedMatrix(result: OriginalPlannedResult): string[][] {
  const error = plannedExportError(result); if (error) throw new Error(error)
  return [plannedHeaders(result), ...result.Rows.map((row, index) => [String(index + 1), ...row.Key.map(value => value.Caption ?? 'Назва недоступна'), ...plannedValues(row)]),
    ...(result.Totals ? [['Разом', ...result.Grouping.map(() => ''), ...plannedValues(result.Totals)]] : [])]
}
function metadata(result: OriginalPlannedResult): string[][] {
  return [[plannedDefinitions[result.Variant].title], [`Період: ${result.From} — ${result.Through}`], ['Суми у записаних одиницях регістру, без валютного перерахунку.'],
    ...result.Filters.map(filter => [`Відбір: ${plannedFieldLabels[filter.Field]} · ${result.Choices.find(choice => choice.Field === filter.Field && choice.Type === filter.Type && choice.Table === filter.Table && choice.Reference === filter.Reference)?.Caption ?? 'Назва недоступна'}`]),
    ['Нульові спостережені рядки збережено; назви, яких немає у довідниках, недоступні. Відповідність 1С не підтверджена.']]
}
export function plannedCsv(result: OriginalPlannedResult): string {
  const width = result.Grouping.length + 1, label = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const rows = [...metadata(result).map(row => row.map(label)), ...plannedMatrix(result).map((row, index) => row.map((value, column) => index === 0 || column < width ? label(value) : value))]
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function plannedXlsx(result: OriginalPlannedResult): Promise<Blob> {
  const rows = plannedMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'План коштів')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function plannedPdfDefinition(result: OriginalPlannedResult): CurrentVparivanieV2PdfDefinition {
  const body = plannedMatrix(result)
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 6 },
    content: [...metadata(result).map(row => ({ text: row.join(' ') })),
      { table: { headerRows: 1, widths: plannedHeaders(result).map(() => 48), body }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function plannedPdf(result: OriginalPlannedResult): Promise<Blob> {
  const definition = plannedPdfDefinition(result)
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
