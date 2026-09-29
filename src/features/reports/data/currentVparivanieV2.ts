import type { ReportDataset } from '../types'

export const CURRENT_VPARIVANIE_V2_DAY = '2026-09-03'
export const CURRENT_VPARIVANIE_V2_COLUMNS = ['Stock', 'Sales', 'CounterpartyTotal',
  'CounterpartyRegionCode', 'CounterpartyUnknown'] as const
export type CurrentVparivanieV2Column = typeof CURRENT_VPARIVANIE_V2_COLUMNS[number]
export type CurrentVparivanieV2Cell = { Column: CurrentVparivanieV2Column; RegionCode: string | null;
  Quantity: string | null; UnitId: string | null; FactCount: number }
export type CurrentVparivanieV2Row = { ProductId: string; Article: string | null; Name: string | null;
  Description: string | null; Group: string | null; OE: string | null; Size: string | null;
  Top: string | null; Cells: CurrentVparivanieV2Cell[] }
export type CurrentVparivanieV2Result = { Version: 2; Day: typeof CURRENT_VPARIVANIE_V2_DAY;
  ProductCount: 631; SaleFacts: number; ReturnFacts: number; Rows: CurrentVparivanieV2Row[] }

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const exactId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)
const decimal = (value: unknown): value is string => typeof value === 'string'
  && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
const text = (value: unknown): value is string | null => value === null || typeof value === 'string' && value.length <= 4096
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export function currentVparivanieV2Available(dataset: ReportDataset | null | undefined): boolean {
  if (dataset?.DataSource !== 39 || !object(dataset.currentVparivanie)) return false
  return dataset.currentVparivanie.Version === 1
    && dataset.currentVparivanie.RegionalV2Available === true
    && dataset.currentVparivanie.RegionalV2Day === CURRENT_VPARIVANIE_V2_DAY
}

export function normalizeCurrentVparivanieV2(value: unknown): CurrentVparivanieV2Result {
  if (!object(value) || value.Version !== 2 || value.Day !== CURRENT_VPARIVANIE_V2_DAY
    || value.ProductCount !== 631 || !count(value.SaleFacts) || !count(value.ReturnFacts)
    || !Array.isArray(value.Rows) || value.Rows.length !== 631) throw new Error('Сервер повернув неповну регіональну матрицю V2.')
  const products = new Set<string>()
  let saleCells = 0
  let counterpartyFacts = 0
  const rows = value.Rows.map(raw => {
    if (!object(raw) || !exactId(raw.ProductId) || products.has(raw.ProductId)
      || !['Article', 'Name', 'Description', 'Group', 'OE', 'Size', 'Top'].every(field => text(raw[field]))
      || !Array.isArray(raw.Cells) || raw.Cells.length > 260)
      throw new Error('Сервер повернув неоднозначний рядок регіональної матриці V2.')
    products.add(raw.ProductId)
    const cells = raw.Cells.map(cell => {
      if (!object(cell) || !CURRENT_VPARIVANIE_V2_COLUMNS.includes(cell.Column as CurrentVparivanieV2Column)
        || cell.RegionCode !== null && (typeof cell.RegionCode !== 'string' || cell.RegionCode.length > 128)
        || (cell.Column === 'CounterpartyRegionCode') !== (typeof cell.RegionCode === 'string' && cell.RegionCode.length > 0)
        || cell.Quantity !== null && !decimal(cell.Quantity)
        || cell.UnitId !== null && !exactId(cell.UnitId)
        || !count(cell.FactCount) || cell.FactCount === 0)
        throw new Error('Сервер повернув некоректну клітинку регіональної матриці V2.')
      if (cell.Column === 'Sales') saleCells += cell.FactCount as number
      if (cell.Column === 'CounterpartyTotal') counterpartyFacts += cell.FactCount as number
      return cell as CurrentVparivanieV2Cell
    })
    const keys = cells.map(cell => `${cell.Column}:${cell.RegionCode ?? ''}`)
    if (new Set(keys).size !== keys.length) throw new Error('Сервер повернув повторні колонки регіональної матриці V2.')
    return { ...raw, Cells: cells } as CurrentVparivanieV2Row
  })
  if (saleCells !== value.SaleFacts + value.ReturnFacts || counterpartyFacts > saleCells)
    throw new Error('Сервер повернув неповні підсумки регіональної матриці V2.')
  return { ...value, Rows: rows } as CurrentVparivanieV2Result
}

/** CSV preserves exact server decimal text and one row per observed cell. */
export function currentVparivanieV2Csv(result: CurrentVparivanieV2Result): string {
  const quote = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const label = (value: string | null) => quote(value && /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? `'${value}` : value)
  const header = ['ProductId', 'Article', 'Name', 'Description', 'Group', 'OE', 'Size', 'Top',
    'Column', 'RegionCode', 'Quantity', 'UnitId', 'FactCount']
  const records = result.Rows.flatMap(row => (row.Cells.length ? row.Cells : [{ Column: '', RegionCode: null,
    Quantity: null, UnitId: null, FactCount: 0 }]).map(cell => [row.ProductId, row.Article, row.Name,
    row.Description, row.Group, row.OE, row.Size, row.Top, cell.Column, cell.RegionCode,
    cell.Quantity, cell.UnitId, cell.FactCount].map((value,index) => index >= 1 && index <= 9
      ? label(value as string | null) : quote(value)).join(',')))
  return '\ufeff' + [header.map(quote).join(','), ...records].join('\r\n') + '\r\n'
}
