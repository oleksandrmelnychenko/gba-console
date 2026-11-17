import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportRequestBody } from '../types'
import type { StockMovementLookupItem, StockMovementRequest } from '../data/warehouseStockMovement'
import { normalizeSavedTemplate } from './reportWorkspaceApi'

export type ReportHistoryOutput = 'screen' | 'excel'
export type ReportHistoryKind = 'report' | 'movement' | 'regional'
export type ReportHistoryItem = {
  id: string
  formedAtUtc: string
  dataSource: number
  output: ReportHistoryOutput
  rowCount: number
  userNetId: string
  userName: string
  own: boolean
  kind: ReportHistoryKind
  report: string
  data: ReportRequestBody | null
  movement: StockMovementRequest | null
  names: MovementStoredNames
}
export type MovementStoredNames = Partial<Record<string, Record<string, string>>>
export type ReportHistoryDay = { day: string; count: number }
export type ReportHistoryReportCount = { report: string; dataSource: number; profile: string | null; kind: ReportHistoryKind; count: number }
export type ReportHistoryPage = { isHead: boolean; total: number; days: ReportHistoryDay[]; reports: ReportHistoryReportCount[]; items: ReportHistoryItem[] }
export type ReportHistorySettings =
  | { kind: 'report' | 'regional'; data: ReportRequestBody }
  | { kind: 'movement'; movement: StockMovementRequest; products: StockMovementLookupItem[]; groups: StockMovementLookupItem[]; storedNames: MovementStoredNames }
export type ReportHistoryUser = { userNetId: string; userName: string; own: boolean }
export type ReportHistoryQuery = { from: string; to: string; reports?: string[]; user?: string | null; offset?: number; limit?: number }
const KINDS: readonly ReportHistoryKind[] = ['report', 'movement', 'regional']
const kindOf = (value: unknown): ReportHistoryKind | null => KINDS.includes(value as ReportHistoryKind) ? value as ReportHistoryKind : null

function readMovement(value: unknown): StockMovementRequest | null {
  return record(value) && value.Version === 1 && typeof value.From === 'string' && typeof value.To === 'string'
    && Array.isArray(value.Levels) && Array.isArray(value.Measures) ? structuredClone(value) as StockMovementRequest : null
}

function readStoredNames(value: unknown): MovementStoredNames {
  if (!record(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([field, names]) => record(names)
    ? [[field, Object.fromEntries(Object.entries(names).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))]] : []))
}

function readLookup(value: unknown): StockMovementLookupItem[] {
  return Array.isArray(value) ? value.flatMap(item => record(item) && Number.isSafeInteger(item.Id) && typeof item.Name === 'string'
    ? [{ Id: item.Id as number, Name: item.Name, Detail: typeof item.Detail === 'string' ? item.Detail : null }] : []) : []
}

const GUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const DAY = /^\d{4}-\d\d-\d\d$/

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readData(id: string, formedAtUtc: string, value: unknown): ReportRequestBody | null {
  if (!record(value)) return null
  try {
    return normalizeSavedTemplate({ Id: id, Revision: 1, Name: '', UpdatedAtUtc: formedAtUtc, Data: value } as never).Data
  } catch { return null }
}

function readItem(value: unknown): ReportHistoryItem {
  if (!record(value) || typeof value.Id !== 'string' || !GUID.test(value.Id) || typeof value.FormedAtUtc !== 'string'
    || !Number.isFinite(Date.parse(value.FormedAtUtc)) || !Number.isInteger(value.DataSource)
    || (value.Output !== 'screen' && value.Output !== 'excel') || !Number.isInteger(value.RowCount)
    || typeof value.UserNetId !== 'string' || typeof value.UserName !== 'string' || typeof value.Own !== 'boolean'
    || !kindOf(value.Kind) || typeof value.Report !== 'string')
    throw new Error('Сервер повернув некоректну історію звітів.')
  const kind = kindOf(value.Kind)!
  return { id: value.Id, formedAtUtc: value.FormedAtUtc, dataSource: value.DataSource as number, output: value.Output,
    rowCount: value.RowCount as number, userNetId: value.UserNetId, userName: value.UserName, own: value.Own, kind, report: value.Report,
    data: kind === 'movement' ? null : readData(value.Id, value.FormedAtUtc, value.Data),
    movement: kind === 'movement' ? readMovement(value.Data) : null,
    names: kind === 'movement' ? readStoredNames(value.Names) : {} }
}

export function parseReportHistoryPage(value: unknown): ReportHistoryPage {
  if (!record(value) || typeof value.IsHead !== 'boolean' || !Number.isInteger(value.Total) || !Array.isArray(value.Days)
    || !Array.isArray(value.Reports) || !Array.isArray(value.Items)) throw new Error('Сервер повернув некоректну історію звітів.')
  const reports = value.Reports.map(item => {
    if (!record(item) || typeof item.Report !== 'string' || !Number.isInteger(item.DataSource) || !kindOf(item.Kind)
      || !Number.isInteger(item.Count) || (item.Profile !== null && item.Profile !== undefined && typeof item.Profile !== 'string'))
      throw new Error('Сервер повернув некоректну історію звітів.')
    return { report: item.Report, dataSource: item.DataSource as number, profile: (item.Profile as string | null | undefined) ?? null,
      kind: kindOf(item.Kind)!, count: item.Count as number }
  })
  const days = value.Days.map(day => {
    if (!record(day) || typeof day.Day !== 'string' || !DAY.test(day.Day) || !Number.isInteger(day.Count))
      throw new Error('Сервер повернув некоректну історію звітів.')
    return { day: day.Day, count: day.Count as number }
  })
  return { isHead: value.IsHead, total: value.Total as number, days, reports, items: value.Items.map(readItem) }
}

export async function getReportHistory(query: ReportHistoryQuery, signal?: AbortSignal): Promise<ReportHistoryPage> {
  const params: Record<string, string | number> = { from: query.from, to: query.to, offset: query.offset ?? 0, limit: query.limit ?? 25 }
  if (query.reports?.length) params.reports = query.reports.join(',')
  if (query.user) params.user = query.user
  return parseReportHistoryPage(await apiRequest<unknown>('/report/history', { query: params, signal, cache: 'no-store', dedupe: false }))
}

export async function getReportHistoryUsers(from: string, to: string, signal?: AbortSignal): Promise<ReportHistoryUser[]> {
  const value = await apiRequest<unknown>('/report/history/users', { query: { from, to }, signal, cache: 'no-store', dedupe: false })
  if (!Array.isArray(value)) throw new Error('Сервер повернув некоректний список користувачів.')
  return value.map(item => {
    if (!record(item) || typeof item.UserNetId !== 'string' || typeof item.UserName !== 'string' || typeof item.Own !== 'boolean')
      throw new Error('Сервер повернув некоректний список користувачів.')
    return { userNetId: item.UserNetId, userName: item.UserName, own: item.Own }
  })
}

export async function getReportHistorySettings(id: string, signal?: AbortSignal): Promise<ReportHistorySettings> {
  if (!GUID.test(id)) throw new Error('Запис історії не знайдено.')
  const value = await apiRequest<unknown>(`/report/history/${id}`, { signal, cache: 'no-store', dedupe: false })
  const kind = record(value) ? kindOf(value.Kind) : null
  if (!record(value) || value.Id !== id || !kind) throw new Error('Сервер повернув некоректний запис історії.')
  if (kind === 'movement') {
    const movement = readMovement(value.Data)
    if (!movement) throw new Error('Сервер повернув некоректний запис історії.')
    const names = record(value.Names) ? value.Names : {}
    return { kind, movement, products: readLookup(names.Products), groups: readLookup(names.Groups), storedNames: readStoredNames(value.StoredNames) }
  }
  return { kind, data: normalizeSavedTemplate(value as never).Data }
}
