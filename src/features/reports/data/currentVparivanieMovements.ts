import type { ReportDataset, ReportRequestBody } from '../types'
import type { NativeReportPreview } from './nativeReportPreview'

export type CurrentVparivanieMovementSelection = { Incoming: boolean; Outgoing: boolean }
export const EMPTY_MOVEMENT_SELECTION: CurrentVparivanieMovementSelection = { Incoming: false, Outgoing: false }
export const MOVEMENT_FILTER_NOTICE = 'Прихід і розхід — фізичний рух товару за вибраний період і складами. Відбори клієнта та його основного менеджера стосуються лише продажів контрагентам. Неповна історія руху позначається як невідома кількість, а не нуль.'
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const field = 'currentvparivaniemovements'
export function isMovementSelection(value: unknown): value is CurrentVparivanieMovementSelection {
  return record(value) && Object.keys(value).sort().join(',') === 'Incoming,Outgoing'
    && typeof value.Incoming === 'boolean' && typeof value.Outgoing === 'boolean'
    && (value.Incoming || value.Outgoing)
}
export function currentVparivanieMovementsAvailable(dataset: ReportDataset | null | undefined): boolean {
  const capability = dataset?.currentVparivanie
  return dataset?.DataSource === 39 && record(capability) && capability.MovementQuantityVersion === 1
    && Array.isArray(capability.MovementQuantityColumns) && capability.MovementQuantityColumns.join(',') === 'Incoming,Outgoing'
    && capability.MovementFilterScope === 'ProductGroupWarehouse'
}
export function movementSelection(data: Record<string, unknown>): CurrentVparivanieMovementSelection | undefined {
  const entries = Object.entries(data).filter(([key]) => key.toLowerCase() === field)
  if (!entries.length) return undefined
  if (entries.length !== 1 || !['currentVparivanieMovements', 'CurrentVparivanieMovements'].includes(entries[0][0])
    || !isMovementSelection(entries[0][1])) throw new Error('Некоректний вибір показників приходу та розходу.')
  return { ...entries[0][1] }
}
export function movementSelectionError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  try {
    if (!movementSelection(data)) return null
    if (data.dataSource !== 39) return 'Прихід і розхід доступні лише в аналізі залишків і продажів.'
    if (dataset && !currentVparivanieMovementsAvailable(dataset)) return 'Сервер ще не підтримує показники приходу та розходу в цьому звіті.'
    return null
  } catch (error) { return (error as Error).message }
}
/** Retain malformed/duplicate aliases so validation refuses them instead of silently losing selection. */
export function cloneMovementSelection(data: Record<string, unknown>): Partial<ReportRequestBody> {
  const entries = Object.entries(data).filter(([key]) => key.toLowerCase() === field)
  return structuredClone(Object.fromEntries(data.DataSource === 39 && entries.length === 1 && entries[0][0] === 'CurrentVparivanieMovements'
    ? [['currentVparivanieMovements', entries[0][1]]] : entries))
}

export type CurrentVparivanieMovementCoverage = CurrentVparivanieMovementSelection & {
  Version: 1
  ResultSha256: string
  ProductCoverage: Array<{ ProductId: number; Complete: boolean; Reasons: string[] }>
  TotalProducts: number
  IncompleteProducts: number
  OldestCapturedAtUtc: string | null
  NewestCapturedAtUtc: string | null
}
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const utc = (value: unknown): value is string => typeof value === 'string' && /(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value))
export function readMovementCoverage(preview: NativeReportPreview): CurrentVparivanieMovementCoverage | undefined {
  const value: unknown = preview.CurrentVparivanieMovements
  const selected = preview.Request?.CurrentVparivanieMovements
  if (value == null && selected == null) {
    if (preview.Request?.DataSource === 'NativeCurrentVparivanie'
      && preview.Columns.some(column => ['4', '5'].includes(column.Values[0]?.Identity?.Value ?? '')))
      throw new Error('Сервер не підтвердив покриття показників руху товару.')
    return undefined
  }
  const fail = (): never => { throw new Error('Сервер не підтвердив покриття показників руху товару.') }
  if (preview.Request?.DataSource !== 'NativeCurrentVparivanie' || !isMovementSelection(selected) || !record(value)
    || value.Version !== 1 || value.ResultSha256 !== preview.ResultSha256
    || value.Incoming !== selected.Incoming || value.Outgoing !== selected.Outgoing
    || !count(value.TotalProducts) || value.TotalProducts !== preview.Page.TotalVisibleRows
    || !count(value.IncompleteProducts) || value.IncompleteProducts > value.TotalProducts
    || !Array.isArray(value.ProductCoverage) || value.ProductCoverage.length !== preview.Rows.length
    || (value.OldestCapturedAtUtc !== null && !utc(value.OldestCapturedAtUtc))
    || (value.NewestCapturedAtUtc !== null && !utc(value.NewestCapturedAtUtc))
    || (value.OldestCapturedAtUtc === null) !== (value.NewestCapturedAtUtc === null)
    || (typeof value.OldestCapturedAtUtc === 'string' && typeof value.NewestCapturedAtUtc === 'string'
      && Date.parse(value.OldestCapturedAtUtc) > Date.parse(value.NewestCapturedAtUtc))) return fail()
  const products = new Map(preview.Rows.map(row => [row.Values[0]?.Identity?.Value, row.SourceIndex]))
  const seen = new Set<number>()
  let pageIncomplete = 0
  for (const item of value.ProductCoverage) {
    if (!record(item) || !count(item.ProductId) || item.ProductId === 0 || seen.has(item.ProductId)
      || !products.has(String(item.ProductId)) || typeof item.Complete !== 'boolean'
      || !Array.isArray(item.Reasons) || !item.Reasons.every(reason => typeof reason === 'string' && reason.trim())
      || new Set(item.Reasons).size !== item.Reasons.length || item.Complete !== (item.Reasons.length === 0)) return fail()
    seen.add(item.ProductId)
    if (!item.Complete) {
      pageIncomplete++
      const rowIndex = products.get(String(item.ProductId))
      for (const column of preview.Columns.filter(column => ['4', '5'].includes(column.Values[0]?.Identity?.Value ?? ''))) {
        const cell = preview.Cells.find(cell => cell.RowSourceIndex === rowIndex && cell.ColumnSourceIndex === column.SourceIndex)
        if (cell?.Value.Kind !== 'null' || cell.Value.Value !== null) return fail()
      }
    }
  }
  if (pageIncomplete > value.IncompleteProducts || value.IncompleteProducts - pageIncomplete > value.TotalProducts - preview.Rows.length) return fail()
  for (const [key, group] of [['Incoming', '4'], ['Outgoing', '5']] as const) {
    const columns = preview.Columns.filter(column => column.Values[0]?.Identity?.Value === group)
    if (columns.length !== (selected[key] && value.TotalProducts > 0 ? 1 : 0)) return fail()
  }
  return structuredClone(value) as CurrentVparivanieMovementCoverage
}

export function bindMovementPreview(request: ReportRequestBody, preview: NativeReportPreview): void {
  const expected = movementSelection(request)
  const actual = preview.Request?.CurrentVparivanieMovements
  if (!!expected !== !!actual || expected && (expected.Incoming !== actual?.Incoming || expected.Outgoing !== actual?.Outgoing))
    throw new Error('Сервер повернув інший вибір показників приходу та розходу.')
}
