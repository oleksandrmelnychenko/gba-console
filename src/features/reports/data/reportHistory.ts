import type { ReportDataset, ReportEntity, ReportFilterNode, ReportRequestBody, ReportSelection } from '../types'
import { CURRENT_REGIONAL_TITLE } from './currentVparivanieRegionalExport'
import { profileForWorkbook } from './salesConstructorProfiles'
import { deskPeriodText } from './workbookDesk'
import {
  STOCK_MOVEMENT_FILTER_DEFINITIONS, STOCK_MOVEMENT_FILTER_FIELDS, type StockMovementCapability, type StockMovementDraft,
  type StockMovementFilterField, type StockMovementFilterRow, type StockMovementFilterWire, type StockMovementLookupItem, type StockMovementRequest,
} from './warehouseStockMovement'
import type { WorkbookLaunch } from './bug1274WorkbookLaunch'
import { bug1274DatasetTitle, workbookDisplayFileName, workbookMenuName } from './bug1274WorkbookGuide'
import { datasetFilters, datasetGroupings } from './reportDatasets'
import { readReportFilterExpression, requestFilterExpression } from './reportFilterExpression'
import { getReportFieldLabel } from './reportOptions'
import { ALL_NAVIGATION_ENTRIES } from './reportNavigationEntries'
import { readReportProfile, requestReportProfile, salesConstructorTitle } from './salesConstructorProfiles'
import { workbookFilterLogic, workbookRequestSummary } from './workbookDesk'
import { previousKyivDay } from './cashPeriod'
import { distinctCaptions, plainCaption } from './distinctCaptions'

export const REPORT_HISTORY_RUN_KEY = 'gba.reports.history-run'
export type ReportHistoryAction = 'open' | 'excel'
export type ReportHistoryRun = { id: string; action: ReportHistoryAction; at: number; report?: string }
export const MOVEMENT_REPORT_KEY = '1001'
export const REGIONAL_REPORT_KEY = '1039'
export const MOVEMENT_REPORT_NAME = 'Рух товару'

export function rememberHistoryRun(id: string, action: ReportHistoryAction, storage: Storage = sessionStorage, now = Date.now(), report?: string): void {
  storage.setItem(REPORT_HISTORY_RUN_KEY, JSON.stringify({ id, action, at: now, ...(report ? { report } : {}) }))
}

export function takeHistoryRun(storage: Storage = sessionStorage, now = Date.now()): ReportHistoryRun | null {
  const raw = storage.getItem(REPORT_HISTORY_RUN_KEY)
  if (raw === null) return null
  storage.removeItem(REPORT_HISTORY_RUN_KEY)
  try {
    const value = JSON.parse(raw) as Partial<ReportHistoryRun>
    if (typeof value.id !== 'string' || (value.action !== 'open' && value.action !== 'excel')
      || typeof value.at !== 'number' || now - value.at > 60_000 || value.at > now + 5_000) return null
    return { id: value.id, action: value.action, at: value.at, ...(typeof value.report === 'string' ? { report: value.report } : {}) }
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
  const own = (item: WorkbookLaunch) => item.dataset.DataSource === dataSource && !profileForWorkbook(item.fileName)
  const launch = ALL_NAVIGATION_ENTRIES.flatMap(entry => launches.filter(item => item.fileName === entry.file && own(item)))[0]
    ?? launches.find(own)
  return (launch ? workbookMenuName(launch) : null) ?? bug1274DatasetTitle(dataSource) ?? datasets.find(item => item.DataSource === dataSource)?.Name ?? 'Звіт'
}

const HISTORY_PROFILE_WORKBOOKS: Readonly<Record<string, string>> = {
  '41:settlements': 'Взаємороз всі.xls',
  '41:debtors': 'ДБіторка.xls',
}

export function historyReportWorkbook(key: string | undefined): string | null {
  return key ? HISTORY_PROFILE_WORKBOOKS[key] ?? null : null
}

function historyWorkbookKey(fileName: string): string | null {
  return Object.entries(HISTORY_PROFILE_WORKBOOKS).find(([, file]) => file === fileName)?.[0] ?? null
}

export function historyReportKeyName(key: string, datasets: readonly ReportDataset[], launches: readonly WorkbookLaunch[]): string {
  if (key === MOVEMENT_REPORT_KEY) return MOVEMENT_REPORT_NAME
  const workbook = historyReportWorkbook(key)
  if (workbook) {
    const launch = launches.find(item => item.fileName === workbook)
    return launch ? workbookMenuName(launch) : workbookDisplayFileName(workbook)
  }
  if (key === REGIONAL_REPORT_KEY) return CURRENT_REGIONAL_TITLE
  const [source, profile] = key.split(':')
  const known = readReportProfile(profile)
  return known ? salesConstructorTitle(known) : historyReportName(null, Number(source), datasets, launches)
}

export function historyReportOptions(datasets: readonly ReportDataset[], launches: readonly WorkbookLaunch[],
  active: ReadonlySet<number>): Array<{ value: string; label: string }> {
  const keys: string[] = []
  const add = (key: string) => { if (!keys.includes(key)) keys.push(key) }
  for (const entry of ALL_NAVIGATION_ENTRIES) {
    const launch = launches.find(item => item.fileName === entry.file)
    if (!launch) continue
    const profile = profileForWorkbook(entry.file)
    add(profile ? `${launch.dataset.DataSource}:${profile}` : historyWorkbookKey(launch.fileName) ?? String(launch.dataset.DataSource))
  }
  for (const dataset of datasets) if (active.has(dataset.DataSource) && !Object.keys(HISTORY_PROFILE_WORKBOOKS).some(key => key.startsWith(`${dataset.DataSource}:`))) add(String(dataset.DataSource))
  add(MOVEMENT_REPORT_KEY)
  if (datasets.some(dataset => dataset.DataSource === 39)) add(REGIONAL_REPORT_KEY)
  const items = keys.map(key => ({ id: key, name: historyReportKeyName(key, datasets, launches) }))
  const labels = distinctLabels(items, item => item.name, item => item.id)
  return items.map(item => ({ value: item.id, label: labels.get(item.id)! }))
}

function selectionLabel(selection: ReportSelection, dataset: ReportDataset | undefined, data: ReportRequestBody): string {
  return datasetFilters(dataset, data).find(option => option.field.Type === selection.SelectedField.Type)?.label
    ?? getReportFieldLabel(selection.SelectedField.Name)
}

export function historySummary(data: ReportRequestBody, dataset: ReportDataset | undefined): { period: string; filters: string } {
  const logic = workbookFilterLogic(data, selection => selectionLabel(selection, dataset, data))
  const summary = workbookRequestSummary(data, dataset, selection => selectionLabel(selection, dataset, data),
    { withoutSelections: logic !== null })
  const organizations = summary.organizations && summary.organizations !== 'Усі' ? `Організації: ${summary.organizations}` : null
  const filters = [organizations, ...summary.chips.filter(chip => chip.kind === 'filter').map(chip => chip.label), logic]
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

function retainSelections(source: ReportRequestBody, data: ReportRequestBody, keep: (selection: ReportSelection, index: number) => ReportSelection | null): void {
  const indices = new Map<number, number>()
  const selections: ReportSelection[] = []
  ;(Array.isArray(source.selections) ? source.selections : []).forEach((selection, index) => {
    const kept = keep(selection, index)
    if (!kept) return
    indices.set(index, selections.length)
    selections.push(kept)
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
}

export type HistoryValueSearch = (fieldType: number, text: string) => Promise<ReportEntity[]>

function identities(values: readonly unknown[]): string[] {
  return values.flatMap(value => typeof value === 'number' || typeof value === 'string' && value !== '' ? [String(value)] : [])
}

export async function verifyHistoryValues(source: ReportRequestBody, search: HistoryValueSearch, limit: number,
  label: (selection: ReportSelection) => string): Promise<{ data: ReportRequestBody; dropped: string[] }> {
  const data = structuredClone(source)
  const dropped: string[] = []
  const verifiable = new Map<number, Promise<boolean>>()
  const probe = (field: number) => {
    if (!verifiable.has(field)) verifiable.set(field, search(field, '').then(items => items.length > 0, () => false))
    return verifiable.get(field)!
  }
  const selections = Array.isArray(source.selections) ? source.selections : []
  const kept = await Promise.all(selections.map(async selection => {
    const field = selection.SelectedField.Type
    if (!selection.Values?.length || !await probe(field)) return structuredClone(selection)
    const values = await Promise.all(selection.Values.map(async value => {
      const wanted = new Set(identities([value.Value, value.Data?.Id, value.Data?.id, value.Data?.NetUid]))
      if (!wanted.size) return true
      const texts = [...new Set([value.Data?.Name, value.Name, value.Data?.Code, value.Data?.FullName]
        .filter((text): text is string => typeof text === 'string' && text.trim() !== '').map(text => text.trim()))]
      let uncertain = texts.length === 0
      for (const text of texts) {
        let items: ReportEntity[]
        try { items = await search(field, text) } catch { uncertain = true; break }
        if (items.some(item => identities([item.Id, item.id, item.NetUid, item.Value]).some(id => wanted.has(id)))) return true
        if (items.length >= limit) uncertain = true
      }
      if (!uncertain) dropped.push(`${label(selection)}: ${plainCaption(String(value.Name ?? ''))}`)
      return uncertain
    }))
    const survivors = selection.Values.filter((_, index) => values[index])
    return survivors.length ? { ...structuredClone(selection), Values: structuredClone(survivors) } : null
  }))
  retainSelections(source, data, (_, index) => kept[index])
  return { data, dropped }
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
  retainSelections(source, data, selection => {
    if (filters.has(selection.SelectedField.Type)) return structuredClone(selection)
    if (selection.IsChecked !== false) dropped.push(getReportFieldLabel(selection.SelectedField.Name))
    return null
  })
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

const MOVEMENT_LEGACY: ReadonlyArray<[StockMovementFilterField, (request: StockMovementRequest) => StockMovementFilterWire | null]> = [
  ['warehouse', request => request.WarehouseIds?.length ? { Field: 'warehouse', Ids: request.WarehouseIds } : null],
  ['organization', request => request.OrganizationIds?.length ? { Field: 'organization', Ids: request.OrganizationIds } : null],
  ['product', request => request.ProductIds?.length ? { Field: 'product', Ids: request.ProductIds } : null],
  ['article', request => request.Articles?.length ? { Field: 'article', Values: request.Articles, ArticleMatch: request.ArticleMatch || 'equals' } : null],
  ['group', request => request.ProductGroupIds?.length ? { Field: 'group', Ids: request.ProductGroupIds } : null],
  ['top', request => request.ProductTops?.length ? { Field: 'top', Values: request.ProductTops } : null],
  ['unit', request => request.MeasureUnitIds?.length ? { Field: 'unit', Ids: request.MeasureUnitIds } : null],
  ['documentKind', request => request.DocumentKinds?.length ? { Field: 'documentKind', Values: request.DocumentKinds } : null],
  ['documentText', request => request.DocumentText ? { Field: 'documentText', Text: request.DocumentText } : null],
]

function movementWires(request: StockMovementRequest): StockMovementFilterWire[] {
  if (request.Filters?.length) return request.Filters.filter(wire => STOCK_MOVEMENT_FILTER_FIELDS.includes(wire.Field))
  return MOVEMENT_LEGACY.flatMap(([, read]) => { const wire = read(request); return wire ? [wire] : [] })
}

export type MovementHistoryLists = {
  warehouses: readonly StockMovementLookupItem[]
  organizations: readonly StockMovementLookupItem[]
  units: readonly StockMovementLookupItem[] | null
  tops: readonly string[] | null
  products: readonly StockMovementLookupItem[]
  groups: readonly StockMovementLookupItem[]
  storedNames?: Partial<Record<string, Record<string, string>>>
}

function valueCount(count: number): string {
  const tail = count % 100 >= 11 && count % 100 <= 14 ? 'значень' : count % 10 === 1 ? 'значення' : count % 10 >= 2 && count % 10 <= 4 ? 'значення' : 'значень'
  return `${count} ${tail}`
}

type MovementTreeNode = { Kind: number; Children?: MovementTreeNode[]; SelectionIndex?: number; Filter?: string }

export function movementDraftFromHistory(request: StockMovementRequest, capability: StockMovementCapability, base: StockMovementDraft,
  lists: MovementHistoryLists): { draft: StockMovementDraft; dropped: string[] } {
  const dropped: string[] = []
  const wires = movementWires(request)
  const listed = !!request.Filters?.length
  const rowOf = new Map<number, number>()
  const rows: StockMovementFilterRow[] = []
  const known = (items: readonly StockMovementLookupItem[] | null, ids: readonly number[], field: StockMovementFilterField) => {
    if (!items) return [...ids]
    const present = ids.filter(id => items.some(item => item.Id === id))
    const missing = ids.filter(id => !present.includes(id))
    if (missing.length) dropped.push(`${STOCK_MOVEMENT_FILTER_DEFINITIONS[field].label}: ${namedValues(missing, lists.storedNames?.[field])}`)
    return present
  }
  const kinds = capability.DocumentKinds.map(kind => kind.Code)
  wires.forEach((wire, index) => {
    const field = wire.Field
    let row: StockMovementFilterRow | null = null
    const id = rows.length + 1
    if (field === 'warehouse' || field === 'organization' || field === 'unit') {
      const ids = known(field === 'warehouse' ? lists.warehouses : field === 'organization' ? lists.organizations : lists.units, wire.Ids ?? [], field)
      row = ids.length ? { id, field, enabled: true, ids } : null
    } else if (field === 'product' || field === 'group' || field === 'manufacturer') {
      const source = field === 'product' ? lists.products : lists.groups
      const ids = known(source, wire.Ids ?? [], field)
      row = ids.length ? { id, field, enabled: true, items: ids.map(value => ({ id: value, label: source.find(item => item.Id === value)!.Name })) } : null
    } else if (field === 'top' || field === 'documentKind') {
      const allowed = field === 'top' ? lists.tops : kinds
      const values = (wire.Values ?? []).filter(value => !allowed || allowed.includes(value))
      if (values.length < (wire.Values ?? []).length) dropped.push(`${STOCK_MOVEMENT_FILTER_DEFINITIONS[field].label}: ${(wire.Values ?? []).filter(value => !values.includes(value)).join(', ')}`)
      row = values.length ? { id, field, enabled: true, values } : null
    } else if (field === 'article') {
      const match = wire.ArticleMatch ?? 'equals'
      row = { id, field, enabled: true, articleMatch: match, text: match === 'inList' ? (wire.Values ?? []).join('\n') : (wire.Values ?? [])[0] ?? '' }
    } else if (field === 'documentText') {
      row = { id, field, enabled: true, text: wire.Text ?? '' }
    }
    if (!row) return
    rowOf.set(index, rows.length)
    rows.push(row)
  })
  const fieldRow = new Map(rows.map((row, index) => [row.field, index]))
  function convert(node: MovementTreeNode): MovementTreeNode | null {
    if (node.Kind === 3) {
      const target = node.SelectionIndex !== undefined ? rowOf.get(node.SelectionIndex) : node.Filter ? fieldRow.get(node.Filter as StockMovementFilterField) : undefined
      return target === undefined ? null : { Kind: 3, SelectionIndex: target }
    }
    const children = (node.Children ?? []).flatMap(child => { const next = convert(child); return next ? [next] : [] })
    return children.length ? { Kind: node.Kind === 2 ? 2 : 1, Children: children } : null
  }
  const root = request.FilterExpression ? convert(request.FilterExpression.Root as MovementTreeNode) : null
  return { dropped, draft: { ...base, from: request.From, to: request.To, listed: listed || base.listed, filterRows: rows,
    filterExpression: root ? { Version: 1, Root: root.Kind === 3 ? { Kind: 1, Children: [root] } : root } : null,
    conditions: structuredClone(request.Conditions ?? []), levels: [...request.Levels], measures: [...request.Measures],
    grandTotals: request.GrandTotals, negativeRed: request.NegativeRed } }
}

function namedValues(ids: readonly number[], names: Record<string, string> | undefined): string {
  const named = ids.flatMap(id => names?.[String(id)] ? [{ id: String(id), caption: plainCaption(names[String(id)]) }] : [])
  const known = distinctCaptions(named)
  const unknown = ids.length - known.length
  return [...known, ...(unknown ? [known.length ? `ще ${valueCount(unknown)}` : valueCount(unknown)] : [])].join(', ')
}

export function movementHistorySummary(request: StockMovementRequest,
  names: Partial<Record<string, Record<string, string>>> = {}): { period: string; filters: string } {
  const leaf = (wire: StockMovementFilterWire) => {
    const label = STOCK_MOVEMENT_FILTER_DEFINITIONS[wire.Field].label
    if (wire.Text) return `${label}: ${wire.Text}`
    if (wire.Values?.length) return `${label}: ${wire.Values.join(', ')}`
    return `${label}: ${namedValues(wire.Ids ?? [], names[wire.Field])}`
  }
  const wires = movementWires(request)
  const listed = !!request.Filters?.length
  function render(node: MovementTreeNode, top: boolean): string | null {
    if (node.Kind === 3) {
      const wire = node.SelectionIndex !== undefined && listed ? wires[node.SelectionIndex]
        : node.Filter ? wires.find(item => item.Field === node.Filter) : undefined
      return wire ? leaf(wire) : null
    }
    const parts = (node.Children ?? []).map(child => render(child, false)).filter((part): part is string => part !== null)
    if (parts.length < 2) return parts[0] ?? null
    const joined = parts.join(node.Kind === 2 ? ' або ' : ' і ')
    return top ? joined : `(${joined})`
  }
  const logic = request.FilterExpression ? render(request.FilterExpression.Root as MovementTreeNode, true) : null
  return { period: deskPeriodText(request.From, request.To), filters: logic ?? wires.map(leaf).join('; ') }
}
