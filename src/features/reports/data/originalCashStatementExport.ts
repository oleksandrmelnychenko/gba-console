import { cashFields, cashLabels, cashFilterKey, type CashAmounts, type CashResult } from './originalCashStatement'
import type { CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
const stages = [['Opening', 'Початковий залишок'], ['Incoming', 'Надходження'], ['Outgoing', 'Витрати'], ['Closing', 'Кінцевий залишок'], ['Turnover', 'Оборот']] as const
const resources = [['Own', 'У валюті рахунку / каси'], ['Management', 'Управлінська сума']] as const
export const cashColumns = (turnover: boolean) => resources.flatMap(([resource, label]) => stages.filter(([stage]) => turnover || stage !== 'Turnover').map(([stage, title]) => ({ resource, stage, label: `${label} · ${title}` })))
export const cashHeaders = (turnover: boolean) => ['Банківський рахунок / каса', ...cashColumns(turnover).map(column => column.label)]
export const cashValues = (value: CashAmounts, turnover: boolean) => cashColumns(turnover).map(column => value[column.resource][column.stage])
export function cashExportError(result: CashResult): string | null {
  if (!result.Available) return 'Повна відомість недоступна для експорту.'
  return (result.Rows.length + 1 + (result.Totals ? 1 : 0)) * cashHeaders(result.IncludeTurnover).length > 1_000_000
    ? 'Файл перевищує межу 1 000 000 клітинок. Звузьте період або відбір; частковий файл не формується.' : null
}
export function cashMatrix(result: CashResult): string[][] {
  const error = cashExportError(result); if (error) throw new Error(error)
  return [cashHeaders(result.IncludeTurnover), ...result.Rows.map(row => [row.Caption ?? 'Назва недоступна', ...cashValues(row.Amounts, result.IncludeTurnover)]),
    ...(result.Totals ? [['Разом', ...cashValues(result.Totals, result.IncludeTurnover)]] : [])]
}
function metadata(result: CashResult): string[][] {
  const choices = new Map(result.Choices.map(choice => [cashFilterKey(choice.Value), choice.Caption])), missing = new Set(result.MissingCaptionMappings)
  return [['Відомість коштів Fenix'], [`Період: ${result.From} — ${result.Through}`], ['Сума у валюті рахунку / каси та управлінська сума: записані одиниці, без валютного перерахунку.'],
    ...result.Filters.map(filter => [`Відбір: ${cashLabels[filter.Field]} · ${choices.get(cashFilterKey(filter)) ?? 'Назва недоступна'}`]),
    [`Недоступні назви: ${cashFields.filter(field => missing.has(field)).map(field => cashLabels[field]).join(', ')}`],
    ['Нульові спостережені рядки збережено; відповідність 1С не підтверджена.']]
}
export function cashCsv(result: CashResult): string {
  const safe = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const rows = [...metadata(result).map(row => row.map(safe)), ...cashMatrix(result).map((row, i) => row.map((value, column) => i === 0 || column === 0 ? safe(value) : value))]
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export async function cashXlsx(result: CashResult): Promise<Blob> {
  const rows = cashMatrix(result), XLSX = await import('xlsx'), book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Відомість коштів')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(metadata(result)), 'Про звіт')
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
export function cashPdfDefinition(result: CashResult): CurrentVparivanieV2PdfDefinition {
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 28], defaultStyle: { font: 'Roboto', fontSize: 6 },
    content: [...metadata(result).map(row => ({ text: row.join(' ') })), { table: { headerRows: 1, widths: cashHeaders(result.IncludeTurnover).map(() => 70), body: cashMatrix(result) }, layout: 'lightHorizontalLines' }],
    styles: { title: { bold: true, fontSize: 13 } }, footer: (page, pages) => ({ text: `${page}/${pages}`, fontSize: 7, alignment: 'right', margin: [24, 0, 24, 0] }) }
}
export async function cashPdf(result: CashResult): Promise<Blob> {
  const definition = cashPdfDefinition(result), [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => { try { pdfMake.default.createPdf(definition, undefined, undefined, fonts.default).getBlob(resolve) } catch (error) { reject(error) } })
}
