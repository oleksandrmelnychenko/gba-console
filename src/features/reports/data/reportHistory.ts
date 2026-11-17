import type { ReportDataset, ReportFilterNode, ReportRequestBody, ReportSelection } from '../types'
import type { WorkbookLaunch } from './bug1274WorkbookLaunch'
import { bug1274DatasetTitle } from './bug1274WorkbookGuide'
import { datasetFilters, datasetGroupings } from './reportDatasets'
import { readReportFilterExpression, requestFilterExpression } from './reportFilterExpression'
import { getReportFieldLabel } from './reportOptions'
import { ALL_NAVIGATION_ENTRIES } from './reportNavigationEntries'
import { readReportProfile, requestReportProfile, salesConstructorTitle } from './salesConstructorProfiles'
import { workbookRequestSummary } from './workbookDesk'
import { previousKyivDay } from './cashPeriod'

export const REPORT_HISTORY_RUN_KEY = 'gba.reports.history-run'
export type ReportHistoryAction = 'open' | 'excel'
export type ReportHistoryRun = { id: string; action: ReportHistoryAction; at: number }

export function rememberHistoryRun(id: string, action: ReportHistoryAction, storage: Storage = sessionStorage, now = Date.now()): void {
  storage.setItem(REPORT_HISTORY_RUN_KEY, JSON.stringify({ id, action, at: now }))
}

export function takeHistoryRun(storage: Storage = sessionStorage, now = Date.now()): ReportHistoryRun | null {
  const raw = storage.getItem(REPORT_HISTORY_RUN_KEY)
  if (raw === null) return null
  storage.removeItem(REPORT_HISTORY_RUN_KEY)
  try {
    const value = JSON.parse(raw) as Partial<ReportHistoryRun>
    if (typeof value.id !== 'string' || (value.action !== 'open' && value.action !== 'excel')
      || typeof value.at !== 'number' || now - value.at > 60_000 || value.at > now + 5_000) return null
    return { id: value.id, action: value.action, at: value.at }
  } catch { return null }
}

export const REPORT_WORKBOOK_OPEN_KEY = 'gba.reports.open-workbook'

export function rememberWorkbookOpen(fileName: string, storage: Storage = sessionStorage, now = Date.now()): void {
  storage.setItem(REPORT_WORKBOOK_OPEN_KEY, JSON.stringify({ fileName, at: now }))
}

export function takeWorkbookOpen(storage: Storage = sessionStorage, now = Date.now()): string | null {
  const raw = storage.getItem(REPORT_WORKBOOK_OPEN_KEY)
  if (raw === null) return null
  storage.removeItem(REPORT_WORKBOOK_OPEN_KEY)
  try {
    const value = JSON.parse(raw) as { fileName?: unknown; at?: unknown }
    return typeof value.fileName === 'string' && typeof value.at === 'number' && now - value.at <= 60_000 ? value.fileName : null
  } catch { return null }
}

export function peekReportHandoff(storage: Storage = sessionStorage, now = Date.now()): { history: ReportHistoryRun | null; workbook: string | null } {
  const copy = new Map<string, string>()
  for (const key of [REPORT_HISTORY_RUN_KEY, REPORT_WORKBOOK_OPEN_KEY]) {
    const value = storage.getItem(key)
    if (value !== null) copy.set(key, value)
  }
  const scratch = { getItem: (key: string) => copy.get(key) ?? null, removeItem: (key: string) => { copy.delete(key) } } as Storage
  return { history: takeHistoryRun(scratch, now), workbook: takeWorkbookOpen(scratch, now) }
}

export function clearReportHandoff(storage: Storage = sessionStorage): void {
  storage.removeItem(REPORT_HISTORY_RUN_KEY)
  storage.removeItem(REPORT_WORKBOOK_OPEN_KEY)
}

export function historyReportName(data: ReportRequestBody | null, dataSource: number, datasets: readonly ReportDataset[],
  launches: readonly WorkbookLaunch[]): string {
  const profile = data ? readReportProfile(requestReportProfile(data)) : undefined
  if (profile) return salesConstructorTitle(profile)
  const entry = ALL_NAVIGATION_ENTRIES.find(item => item.file !== null
    && launches.some(launch => launch.fileName === item.file && launch.dataset.DataSource === dataSource))
  return entry?.label ?? bug1274DatasetTitle(dataSource) ?? datasets.find(item => item.DataSource === dataSource)?.Name ?? 'Звіт'
}

function selectionLabel(selection: ReportSelection, dataset: ReportDataset | undefined, data: ReportRequestBody): string {
  return datasetFilters(dataset, data).find(option => option.field.Type === selection.SelectedField.Type)?.label
    ?? getReportFieldLabel(selection.SelectedField.Name)
}

export function historySummary(data: ReportRequestBody, dataset: ReportDataset | undefined): { period: string; filters: string } {
  const summary = workbookRequestSummary(data, dataset, selection => selectionLabel(selection, dataset, data))
  const organizations = summary.organizations && summary.organizations !== 'Усі' ? `Організації: ${summary.organizations}` : null
  const filters = [organizations, ...summary.chips.filter(chip => chip.kind === 'filter').map(chip => chip.label)]
    .filter((item): item is string => Boolean(item))
  return { period: summary.period, filters: filters.join('; ') }
}

function remapNode(node: ReportFilterNode, indices: ReadonlyMap<number, number>): ReportFilterNode | null {
  if (node.Kind === 3) {
    const next = indices.get(node.SelectionIndex)
    return next === undefined ? null : { Kind: 3, SelectionIndex: next }
  }
  const children = node.Children.map(child => remapNode(child, indices)).filter((child): child is ReportFilterNode => child !== null)
  if (children.length === 0) return null
  return { Kind: node.Kind, Children: children }
}

export function sanitizeHistorySettings(source: ReportRequestBody, dataset: ReportDataset): { data: ReportRequestBody; dropped: string[] } {
  const data = structuredClone(source)
  const dropped: string[] = []
  const groupings = new Set(datasetGroupings(dataset, data).map(item => item.type))
  const keepGroup = (item: { type: number; key?: string; label?: string }) => {
    if (groupings.has(item.type)) return true
    dropped.push(item.label || getReportFieldLabel(item.key) || 'групування')
    return false
  }
  data.sorted = { ...data.sorted, Row: (data.sorted?.Row ?? []).filter(keepGroup), Col: (data.sorted?.Col ?? []).filter(keepGroup) }
  const measures = new Set(dataset.Measurements.map(item => item.Type))
  data.sorted.Measurements = (data.sorted.Measurements ?? []).filter(item => {
    if (measures.has(item.Type)) return true
    if (item.IsChecked) dropped.push(item.Label || getReportFieldLabel(item.Name))
    return false
  })
  const filters = new Set(datasetFilters(dataset, source).map(option => option.field.Type))
  const indices = new Map<number, number>()
  const selections: ReportSelection[] = []
  ;(Array.isArray(source.selections) ? source.selections : []).forEach((selection, index) => {
    if (!filters.has(selection.SelectedField.Type)) {
      if (selection.IsChecked !== false) dropped.push(getReportFieldLabel(selection.SelectedField.Name))
      return
    }
    indices.set(index, selections.length)
    selections.push(structuredClone(selection))
  })
  data.selections = selections
  const expression = readReportFilterExpression(requestFilterExpression(source))
  if (expression && indices.size !== (source.selections ?? []).length) {
    const root = remapNode(expression.Root, indices)
    const key = Object.hasOwn(data, 'filterExpression') ? 'filterExpression' : 'FilterExpression'
    const next = root ? { Version: 1 as const, Root: root.Kind === 3 ? { Kind: 1 as const, Children: [root] } : root } : undefined
    if (next) (data as Record<string, unknown>)[key] = next
    else delete (data as Record<string, unknown>)[key]
  }
  return { data, dropped: [...new Set(dropped.filter(Boolean))] }
}

export function droppedSettingsLine(dropped: readonly string[]): string | null {
  return dropped.length ? `Не застосовано, бо цього вже немає у звіті: ${dropped.join(', ')}.` : null
}

const DAY_FORMAT = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const TIME_FORMAT = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })

export function historyDayTitle(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return DAY_FORMAT.format(new Date(Date.UTC(year, month - 1, date))).replace(/\s*р\.$/, '')
}

export function historyTime(formedAtUtc: string): string {
  return TIME_FORMAT.format(new Date(formedAtUtc))
}

function shiftDays(day: string, days: number): string {
  let value = day
  for (let index = 0; index < days; index += 1) value = previousKyivDay(value) || value
  return value
}

export type HistoryPeriodPreset = { label: string; from: string; to: string }

export function historyPeriodPresets(today: string): HistoryPeriodPreset[] {
  return [
    { label: 'Сьогодні', from: today, to: today },
    { label: 'Тиждень', from: shiftDays(today, 6), to: today },
    { label: 'Місяць', from: `${today.slice(0, 8)}01`, to: today },
  ]
}

export function defaultHistoryPeriod(today: string): { from: string; to: string } {
  return { from: shiftDays(today, 29), to: today }
}

export function distinctLabels<T>(items: readonly T[], name: (item: T) => string, id: (item: T) => string): Map<string, string> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(name(item), (counts.get(name(item)) ?? 0) + 1)
  return new Map(items.map(item => [id(item), (counts.get(name(item)) ?? 0) > 1 ? `${name(item)} (${id(item)})` : name(item)]))
}
