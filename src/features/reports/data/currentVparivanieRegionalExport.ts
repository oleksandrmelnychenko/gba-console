import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from './currentVparivanie'
import type { CurrentVparivanieV2Cell } from './currentVparivanieV2'
import { currentVparivanieV2CellKey, currentVparivanieV2ColumnCaption,
  currentVparivanieV2Columns, type CurrentVparivanieV2PdfDefinition } from './currentVparivanieV2Export'
import type { CurrentVparivanieRegionalResult } from './currentVparivanieRegional'

export const CURRENT_REGIONAL_TITLE = 'Впарювання: регіональна форма'
export const currentRegionalCellText = (cell?: CurrentVparivanieV2Cell) =>
  cell === undefined ? '' : cell.Quantity === null ? '∅' : cell.Quantity
export function currentRegionalColumnCaption(key: string): string {
  const [kind, region] = JSON.parse(key) as [string, string | null]
  return kind === 'CounterpartyRegionCode' && region === ''
    ? 'Регіон / Без коду' : currentVparivanieV2ColumnCaption(key)
}

/** Numeric strings remain exact in the matrix and in the separate quantity/unit sheet. */
export function currentRegionalSheets(result: CurrentVparivanieRegionalResult) {
  const columns = currentVparivanieV2Columns(result)
  const about: string[][] = [[CURRENT_REGIONAL_TITLE], ['Період продажів', `${result.From} — ${result.To}`],
    ['Залишки', 'Поточна записана вільна кількість'], ['Товарів', String(result.ProductCount)],
    ['Порожня клітинка', 'Факт відсутній'], ['∅', 'Кількість невідома'],
    ...result.Request.Filters.map(filter => [filter.Field, filter.Condition, ...filter.Values]),
    ...result.Request.Notes.map(note => [note])]
  const matrix: string[][] = [[CURRENT_REGIONAL_TITLE], ['Період продажів', `${result.From} — ${result.To}`], [],
    ['ProductId', ...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, ...columns.map(currentRegionalColumnCaption)],
    ...result.Rows.map(row => {
      const cells = new Map(row.Cells.map(cell => [currentVparivanieV2CellKey(cell), cell]))
      return [row.ProductId, row.Article ?? '', row.Name ?? '', row.Description ?? '', row.Group ?? '',
        row.OE ?? '', row.Size ?? '', row.Top ?? '', ...columns.map(key => currentRegionalCellText(cells.get(key)))]
    })]
  const facts: string[][] = [['ProductId', 'Column', 'RegionCode', 'Quantity', 'UnitId', 'FactCount'],
    ...result.Rows.flatMap(row => row.Cells.map(cell => [row.ProductId, cell.Column, cell.RegionCode ?? '',
      currentRegionalCellText(cell), cell.UnitId ?? '', String(cell.FactCount)]))]
  return { about, matrix, facts }
}

export function currentRegionalCsv(result: CurrentVparivanieRegionalResult): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const safeLabel = (value: string) => /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value
  return '\ufeff' + currentRegionalSheets(result).matrix.map(row => row.map((value, index) =>
    quote(index >= 1 && index <= 7 ? safeLabel(value) : value)).join(',')).join('\r\n') + '\r\n'
}

export function currentRegionalPdfDefinition(result: CurrentVparivanieRegionalResult): CurrentVparivanieV2PdfDefinition {
  const columns = currentVparivanieV2Columns(result)
  const content: CurrentVparivanieV2PdfDefinition['content'] = [
    { text: CURRENT_REGIONAL_TITLE, style: 'title' },
    { text: `Період продажів: ${result.From} — ${result.To}. Залишки поточні.`, margin: [0, 3, 0, 6] },
    ...result.Request.Filters.map(filter => ({ text: `${filter.Field} · ${filter.Condition}: ${filter.Values.join(', ')}` })),
    { text: 'Порожня клітинка: факт відсутній. н/д: кількість невідома.', margin: [0, 4, 0, 8] },
  ]
  const bands = columns.length ? Array.from({ length: Math.ceil(columns.length / 8) }, (_, index) =>
    columns.slice(index * 8, index * 8 + 8)) : [[]]
  for (const band of bands) {
    const body = [[...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, ...band.map(currentRegionalColumnCaption)],
      ...result.Rows.map(row => {
        const cells = new Map(row.Cells.map(cell => [currentVparivanieV2CellKey(cell), cell]))
        return [row.Article ?? '', row.Name ?? '', row.Description ?? '', row.Group ?? '', row.OE ?? '',
          row.Size ?? '', row.Top ?? '', ...band.map(key => {
            const cell = cells.get(key)
            // The bundled Roboto PDF font has no empty-set glyph.
            return cell?.Quantity === null ? 'н/д' : currentRegionalCellText(cell)
          })]
      })]
    content.push({ table: { headerRows: 1, widths: [70, 100, 120, 70, 60, 45, 35, ...band.map(() => 55)], body },
      layout: 'lightHorizontalLines' })
  }
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [28, 38, 28, 32],
    defaultStyle: { font: 'Roboto', fontSize: 8 }, content,
    styles: { title: { bold: true, fontSize: 14 } },
    footer: (page, pages) => ({ text: `${CURRENT_REGIONAL_TITLE} · ${page}/${pages}`, fontSize: 7,
      alignment: 'right', margin: [28, 0, 28, 0] }) }
}

export async function currentRegionalXlsx(result: CurrentVparivanieRegionalResult): Promise<Blob> {
  const XLSX = await import('xlsx')
  const sheets = currentRegionalSheets(result), book = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries({ Matrix: sheets.matrix, About: sheets.about, Cells: sheets.facts }))
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export async function currentRegionalPdf(result: CurrentVparivanieRegionalResult): Promise<Blob> {
  const [pdfMake, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  return new Promise((resolve, reject) => {
    try { pdfMake.default.createPdf(currentRegionalPdfDefinition(result), undefined, undefined, fonts.default).getBlob(resolve) }
    catch (error) { reject(error) }
  })
}
