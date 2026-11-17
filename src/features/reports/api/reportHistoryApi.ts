import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportRequestBody } from '../types'
import { normalizeSavedTemplate } from './reportWorkspaceApi'

export type ReportHistoryOutput = 'screen' | 'excel'
export type ReportHistoryItem = {
  id: string
  formedAtUtc: string
  dataSource: number
  output: ReportHistoryOutput
  rowCount: number
  userNetId: string
  userName: string
  own: boolean
  data: ReportRequestBody | null
}
export type ReportHistoryDay = { day: string; count: number }
export type ReportHistoryPage = { isHead: boolean; total: number; days: ReportHistoryDay[]; items: ReportHistoryItem[] }
export type ReportHistoryUser = { userNetId: string; userName: string; own: boolean }
export type ReportHistoryQuery = { from: string; to: string; reports?: number[]; user?: string | null; offset?: number; limit?: number }

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
    || typeof value.UserNetId !== 'string' || typeof value.UserName !== 'string' || typeof value.Own !== 'boolean')
    throw new Error('Сервер повернув некоректну історію звітів.')
  return { id: value.Id, formedAtUtc: value.FormedAtUtc, dataSource: value.DataSource as number, output: value.Output,
    rowCount: value.RowCount as number, userNetId: value.UserNetId, userName: value.UserName, own: value.Own,
    data: readData(value.Id, value.FormedAtUtc, value.Data) }
}

export function parseReportHistoryPage(value: unknown): ReportHistoryPage {
  if (!record(value) || typeof value.IsHead !== 'boolean' || !Number.isInteger(value.Total) || !Array.isArray(value.Days)
    || !Array.isArray(value.Items)) throw new Error('Сервер повернув некоректну історію звітів.')
  const days = value.Days.map(day => {
    if (!record(day) || typeof day.Day !== 'string' || !DAY.test(day.Day) || !Number.isInteger(day.Count))
      throw new Error('Сервер повернув некоректну історію звітів.')
    return { day: day.Day, count: day.Count as number }
  })
  return { isHead: value.IsHead, total: value.Total as number, days, items: value.Items.map(readItem) }
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

export async function getReportHistorySettings(id: string, signal?: AbortSignal): Promise<ReportRequestBody> {
  if (!GUID.test(id)) throw new Error('Запис історії не знайдено.')
  const value = await apiRequest<unknown>(`/report/history/${id}`, { signal, cache: 'no-store', dedupe: false })
  if (!record(value) || value.Id !== id) throw new Error('Сервер повернув некоректний запис історії.')
  return normalizeSavedTemplate(value as never).Data
}
