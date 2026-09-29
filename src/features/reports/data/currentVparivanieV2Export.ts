import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from './currentVparivanie'
import type { CurrentVparivanieV2Cell, CurrentVparivanieV2Result } from './currentVparivanieV2'

export const CURRENT_VPARIVANIE_V2_DRAFT = 'Поточні дані · чернетка; звірку з 1С не підтверджено'
const kinds = ['Stock', 'Sales', 'CounterpartyTotal', 'CounterpartyRegionCode', 'CounterpartyUnknown']
const captions: Record<string, string> = {
  Stock: 'Остатки', Sales: 'Продажи', CounterpartyTotal: 'Контрагенты',
  CounterpartyRegionCode: 'Регіон', CounterpartyUnknown: 'Невідомий регіон',
}

type PdfText = { text: string; style?: string; color?: string; margin?: number[] }
type PdfTable = { table: { headerRows: number; widths: number[]; body: string[][] }; layout: string }
export type CurrentVparivanieV2PdfDefinition = {
  pageSize: 'A3'; pageOrientation: 'landscape'; pageMargins: number[]
  defaultStyle: { font: 'Roboto'; fontSize: number }
  content: Array<PdfText | PdfTable>
  styles: { title: { bold: boolean; fontSize: number } }
  footer: (page: number, pages: number) => { text: string; fontSize: number;
    alignment: 'right'; margin: number[] }
}

export function currentVparivanieV2Columns(result: CurrentVparivanieV2Result): string[] {
  return [...new Set(result.Rows.flatMap(row => row.Cells.map(currentVparivanieV2CellKey)))]
    .sort((left, right) => {
      const [leftKind, leftRegion] = JSON.parse(left) as [string, string | null]
      const [rightKind, rightRegion] = JSON.parse(right) as [string, string | null]
      return kinds.indexOf(leftKind) - kinds.indexOf(rightKind)
        || (leftRegion ?? '').localeCompare(rightRegion ?? '')
    })
}

export function currentVparivanieV2ColumnCaption(key: string): string {
  const [kind, region] = JSON.parse(key) as [string, string | null]
  return captions[kind] + (region ? ` / ${region}` : '')
}

export const currentVparivanieV2CellKey = (cell: CurrentVparivanieV2Cell) =>
  JSON.stringify([cell.Column, cell.RegionCode])
const quantity = (cell: CurrentVparivanieV2Cell | undefined) =>
  cell === undefined ? '' : cell.Quantity === null ? '∅' : cell.Quantity

/** All quantities remain strings. The matrix marks an absent cell blank and an explicit null ∅. */
export function currentVparivanieV2Sheets(result: CurrentVparivanieV2Result) {
  const columns = currentVparivanieV2Columns(result)
  const about: string[][] = [
    ['Регіональна матриця V2', CURRENT_VPARIVANIE_V2_DRAFT],
    ['День', result.Day], ['Товарів', String(result.ProductCount)],
    ['Фактів продажу', String(result.SaleFacts)], ['Фактів повернення', String(result.ReturnFacts)],
    ['Порожня клітинка', 'Факт відсутній'], ['∅', 'Факт є, кількість невідома'],
  ]
  const matrix: string[][] = [
    ['Регіональна матриця V2', CURRENT_VPARIVANIE_V2_DRAFT],
    ['День', result.Day], [],
    ['ProductId', ...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS, ...columns.map(currentVparivanieV2ColumnCaption)],
    ...result.Rows.map(row => {
      const cells = new Map(row.Cells.map(cell => [currentVparivanieV2CellKey(cell), cell]))
      return [row.ProductId, row.Article ?? '', row.Name ?? '', row.Description ?? '',
        row.Group ?? '', row.OE ?? '', row.Size ?? '', row.Top ?? '',
        ...columns.map(key => quantity(cells.get(key)))]
    }),
  ]
  const facts: string[][] = [
    ['Регіональна матриця V2', CURRENT_VPARIVANIE_V2_DRAFT],
    ['ProductId', 'Column', 'RegionCode', 'Quantity', 'UnitId', 'FactCount'],
    ...result.Rows.flatMap(row => row.Cells.map(cell => [row.ProductId, cell.Column,
      cell.RegionCode ?? '', quantity(cell), cell.UnitId ?? '', String(cell.FactCount)])),
  ]
  return { about, matrix, facts }
}

export function currentVparivanieV2PdfDefinition(result: CurrentVparivanieV2Result): CurrentVparivanieV2PdfDefinition {
  const body: string[][] = [
    ['Товар / атрибути', 'Колонка', 'Кількість', 'Одиниця', 'Фактів'],
  ]
  for (const row of result.Rows) {
    body.push([`ID ${row.ProductId} · ${row.Article ?? '—'} · ${row.Name ?? '—'}\n`
      + `Опис: ${row.Description ?? '—'} · Група: ${row.Group ?? '—'} · OE: ${row.OE ?? '—'} · Розмір: ${row.Size ?? '—'} · Топ: ${row.Top ?? '—'}`,
    '', '', '', ''])
    for (const cell of row.Cells) body.push([
      row.ProductId, currentVparivanieV2ColumnCaption(currentVparivanieV2CellKey(cell)),
      quantity(cell), cell.UnitId ?? '—', String(cell.FactCount),
    ])
  }
  return {
    pageSize: 'A3', pageOrientation: 'landscape',
    pageMargins: [28, 38, 28, 32],
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [
      { text: 'Регіональна матриця V2', style: 'title' },
      { text: CURRENT_VPARIVANIE_V2_DRAFT, color: '#9a3412', margin: [0, 2, 0, 5] },
      { text: `День: ${result.Day} · Товарів: ${result.ProductCount} · Фактів продажу: ${result.SaleFacts} · Повернень: ${result.ReturnFacts}`,
        margin: [0, 0, 0, 8] },
      { text: 'Порожня клітинка означає відсутній факт; ∅ означає факт із невідомою кількістю.',
        margin: [0, 0, 0, 8] },
      { table: { headerRows: 1, widths: [380, 180, 90, 80, 55], body },
        layout: 'lightHorizontalLines' },
    ],
    styles: { title: { bold: true, fontSize: 14 } },
    footer: (page, pages) => ({ text: `${CURRENT_VPARIVANIE_V2_DRAFT} · ${page}/${pages}`,
      fontSize: 7, alignment: 'right', margin: [28, 0, 28, 0] }),
  }
}

export async function currentVparivanieV2Xlsx(result: CurrentVparivanieV2Result): Promise<Blob> {
  const XLSX = await import('xlsx')
  const sheets = currentVparivanieV2Sheets(result)
  const book = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries({ About: sheets.about, Matrix: sheets.matrix, Cells: sheets.facts })) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(book, sheet, name)
  }
  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export async function currentVparivanieV2Pdf(result: CurrentVparivanieV2Result): Promise<Blob> {
  const [pdfMake, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
  ])
  return new Promise((resolve, reject) => {
    try {
      pdfMake.default.createPdf(currentVparivanieV2PdfDefinition(result), undefined, undefined,
        fontModule.default).getBlob(resolve)
    } catch (error) { reject(error) }
  })
}
