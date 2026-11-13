
import type { CurrentVparivanieV2Cell, CurrentVparivanieV2Result } from './currentVparivanieV2'

export const CURRENT_VPARIVANIE_V2_DRAFT = 'Поточні дані · чернетка; звірку з 1С не підтверджено'
const kinds = ['Stock', 'Sales', 'CounterpartyTotal', 'CounterpartyRegionCode', 'CounterpartyUnknown']
const captions: Record<string, string> = {
  Stock: 'Остатки', Sales: 'Продажи', CounterpartyTotal: 'Контрагенты',
  CounterpartyRegionCode: 'Регіон', CounterpartyUnknown: 'Невідомий регіон',
}

type PdfText = { text: string; style?: string; color?: string; fontSize?: number; margin?: number[] }
type PdfTable = { table: { headerRows: number; widths: Array<number | '*' | 'auto'>; body: string[][] }; layout: string }
export type CurrentVparivanieV2PdfDefinition = {
  pageSize: 'A3' | 'A4'; pageOrientation: 'landscape'; pageMargins: number[]
  defaultStyle: { font: 'Roboto'; fontSize: number }
  content: Array<PdfText | PdfTable>
  styles: { title: { bold: boolean; fontSize: number } }
  footer: (page: number, pages: number) => { text: string; fontSize: number;
    alignment: 'right'; margin: number[] }
}

export function currentVparivanieV2Columns(result: Pick<CurrentVparivanieV2Result, 'Rows'>): string[] {
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
