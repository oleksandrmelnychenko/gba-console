import type { ReportDataset, ReportRequestBody } from '../types'
import { isCurrentVparivanieDataset, currentVparivanieFullScope, CURRENT_VPARIVANIE_FULL_NOTE } from './currentVparivanie'
import { CURRENT_VPARIVANIE_V2_COLUMNS, type CurrentVparivanieV2Cell,
  type CurrentVparivanieV2Row } from './currentVparivanieV2'

export type CurrentRegionalSummary = {
  HasPeriod: true; IsCurrentSnapshot: false; PeriodFrom: string; PeriodTo: string
  Filters: Array<{ Field: string; Condition: string; Values: string[] }>; Notes: string[]
}
export type CurrentVparivanieRegionalResult = {
  FullScopeVersion?: 1
  Version: 3; From: string; To: string; StockAnchor: 'CurrentRecordedFree'
  ProductCount: number; StockFacts: number; SaleFacts: number; ReturnFacts: number; CounterpartyFacts: number
  Rows: CurrentVparivanieV2Row[]; Request: CurrentRegionalSummary
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const exactId = (value: unknown): value is string => typeof value === 'string'
  && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
const text = (value: unknown): value is string | null => value === null
  || typeof value === 'string'
function fail(): never { throw new Error('Сервер повернув неповну регіональну форму «Впарювання».') }
const displayDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`

// Compare decimal text at an exact common scale; no floating-point quantity is introduced.
function scaledQuantity(value: unknown): bigint | null {
  if (typeof value !== 'string' || value.length > 64 || !/^-?\d+(?:\.\d{1,28})?$/.test(value)) return null
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  return (negative ? -1n : 1n) * BigInt(whole + fraction.padEnd(28, '0'))
}

export function currentVparivanieRegionalAvailable(dataset: ReportDataset | null | undefined): boolean {
  return !!dataset && isCurrentVparivanieDataset(dataset) && object(dataset.currentVparivanie)
    && dataset.currentVparivanie.CurrentRegionalAvailable === true
    && dataset.currentVparivanie.CurrentRegionalVersion === 3
}

function cell(raw: unknown): CurrentVparivanieV2Cell {
  if (!object(raw) || !CURRENT_VPARIVANIE_V2_COLUMNS.includes(raw.Column as CurrentVparivanieV2Cell['Column'])
    || (raw.Column === 'CounterpartyRegionCode' ? typeof raw.RegionCode !== 'string'
      || raw.RegionCode.length > 0 && raw.RegionCode.trim() === '' : raw.RegionCode !== null)
    || raw.Quantity !== null && scaledQuantity(raw.Quantity) === null
    || raw.UnitId !== null && !exactId(raw.UnitId) || raw.Quantity !== null && raw.UnitId === null
    || !count(raw.FactCount)
    || raw.Column === 'CounterpartyUnknown' && raw.Quantity !== null
    || raw.FactCount === 0 && (raw.Column !== 'Stock' && raw.Column !== 'Sales'
      || raw.Quantity !== null && scaledQuantity(raw.Quantity) !== 0n)) fail()
  return raw as CurrentVparivanieV2Cell
}

function validateCounterpartyPartition(cells: CurrentVparivanieV2Cell[]): void {
  const total = cells.find(value => value.Column === 'CounterpartyTotal')
  const children = cells.filter(value => value.Column === 'CounterpartyRegionCode' || value.Column === 'CounterpartyUnknown')
  if (!total && children.length || total && children.reduce((sum, value) => sum + value.FactCount, 0) !== total.FactCount) fail()
  if (!total || total.Quantity === null) return
  const regions = children.filter(value => value.Column === 'CounterpartyRegionCode')
  if (regions.some(value => value.Quantity === null || value.UnitId !== total.UnitId)) fail()
  if (children.some(value => value.Column === 'CounterpartyUnknown')) return
  if (regions.reduce((sum, value) => sum + scaledQuantity(value.Quantity)!, 0n) !== scaledQuantity(total.Quantity)) fail()
}

export function normalizeCurrentVparivanieRegional(value: unknown,
  request: ReportRequestBody): CurrentVparivanieRegionalResult {
  if (!object(value) || value.Version !== 3 || value.From !== request.from || value.To !== request.to
    || value.StockAnchor !== 'CurrentRecordedFree' || !count(value.ProductCount)
    || !['StockFacts', 'SaleFacts', 'ReturnFacts', 'CounterpartyFacts'].every(key => count(value[key]))
    || !Array.isArray(value.Rows) || value.Rows.length !== value.ProductCount
    || !object(value.Request) || value.Request.HasPeriod !== true || value.Request.IsCurrentSnapshot !== false
    || value.Request.PeriodFrom !== displayDate(request.from) || value.Request.PeriodTo !== displayDate(request.to)
    || !Array.isArray(value.Request.Notes) || value.Request.Notes.some(note => typeof note !== 'string')
    || !Array.isArray(value.Request.Filters) || value.Request.Filters.some(filter => !object(filter)
      || typeof filter.Field !== 'string' || typeof filter.Condition !== 'string'
      || !Array.isArray(filter.Values) || filter.Values.some(item => typeof item !== 'string'))) fail()
  const full = currentVparivanieFullScope(request)
  if (full ? value.FullScopeVersion !== 1 || !value.Request.Notes.includes(CURRENT_VPARIVANIE_FULL_NOTE)
    : Object.hasOwn(value, 'FullScopeVersion')) fail()
  if (full && value.Rows.length > 500000) fail()
  const products = new Set<string>()
  let stockFacts = 0, salesFacts = 0, counterpartyFacts = 0
  const rows = value.Rows.map(raw => {
    if (!object(raw) || !exactId(raw.ProductId) || products.has(raw.ProductId)
      || !['Article', 'Name', 'Description', 'Group', 'OE', 'Size', 'Top'].every(field => text(raw[field]))
      || !Array.isArray(raw.Cells)) fail()
    products.add(raw.ProductId)
    const cells = raw.Cells.map(cell)
    const keys = cells.map(item => JSON.stringify([item.Column, item.RegionCode]))
    if (new Set(keys).size !== keys.length || cells.filter(item => item.Column === 'Stock').length !== 1
      || cells.filter(item => item.Column === 'Sales').length !== 1) fail()
    validateCounterpartyPartition(cells)
    for (const item of cells) {
      if (item.Column === 'Stock') stockFacts += item.FactCount
      if (item.Column === 'Sales') salesFacts += item.FactCount
      if (item.Column === 'CounterpartyTotal') counterpartyFacts += item.FactCount
    }
    return { ...raw, Cells: cells } as CurrentVparivanieV2Row
  })
  if (stockFacts !== value.StockFacts || salesFacts !== Number(value.SaleFacts) + Number(value.ReturnFacts)
    || counterpartyFacts !== value.CounterpartyFacts || counterpartyFacts > salesFacts) fail()
  if (full) {
    const codes = new Set(rows.flatMap(row => row.Cells.filter(item => item.Column === 'CounterpartyRegionCode').map(item => item.RegionCode)))
    const columns = 10 + codes.size + (rows.some(row => row.Cells.some(item => item.Column === 'CounterpartyUnknown')) ? 1 : 0)
    if (columns > 263 || rows.length * columns > 1000000) fail()
  }
  return { ...value, Rows: rows } as CurrentVparivanieRegionalResult
}
