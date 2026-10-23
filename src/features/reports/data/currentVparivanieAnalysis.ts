import { movementSelection } from './currentVparivanieMovements'
import type { ReportDataset, ReportFilterCondition, ReportRequestBody } from '../types'
import type { NativeReportPreview } from './nativeReportPreview'

export type CurrentVparivanieAnalysisRequest = { version: 1 }
export type AnalysisFieldDescriptor = {
  type: number; name: string; path: string[]; valueKind: string; branches: number[]
  conditions: number[]; lookupKind: string; coverage: string; available?: boolean; unavailabilityReason?: string | null
}
export type CurrentVparivanieAnalysisCapability = {
  version: 1; maximumDimensions: 8; requiredColumnGrouping: 74; measure: 83
  allSalesFilterScope: true; stockAllocation: 'periodEndOnly'; physicalCalendar: 'Europe/Kyiv'
  groupings: AnalysisFieldDescriptor[]; filters: AnalysisFieldDescriptor[]
}
export type CurrentVparivanieAnalysisMetadata = {
  version: 1; allSalesFilterScope: true; stockAllocation: 'periodEndOnly'; physicalCalendar: 'Europe/Kyiv'
  fieldCoverage: Array<{ field: number; scope: 'grouping' | 'filter'; knownFacts: number; unknownFacts: number; notApplicableFacts: number; reasons: string[] }>
  resultSha256: string; incoming: boolean; outgoing: boolean
}
export const ANALYSIS_SCOPE_NOTICE = 'Відбори покупця, договору й менеджера застосовуються до всіх продажів та їхніх підсумків. Залишки не розподіляються між покупцями чи документами. «Не застосовується» — показник не має цього розрізу; «Невідомо» — бракує підтверджених даних.'
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const ids = (v: unknown): v is number[] => Array.isArray(v) && v.every(x => Number.isSafeInteger(x) && x >= 0 && x <= 1024) && new Set(v).size === v.length
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0 && x.length <= 1024)
const scope = (v: Record<string, unknown>) => v.version === 1 && v.allSalesFilterScope === true && v.stockAllocation === 'periodEndOnly' && v.physicalCalendar === 'Europe/Kyiv'
const aliases = (v: object) => Object.keys(v).filter(k => k.toLowerCase() === 'currentvparivanieanalysis')
export const isAnalysisRequest = (v: unknown): v is CurrentVparivanieAnalysisRequest => record(v) && ['version', 'Version'].includes(Object.keys(v).join(',')) && (v.version ?? v.Version) === 1

export function requestCurrentVparivanieAnalysis(data: object): CurrentVparivanieAnalysisRequest | undefined {
  const keys = aliases(data)
  if (!keys.length) return undefined
  const value = (data as Record<string, unknown>)[keys[0]]
  if (keys.length !== 1 || !['currentVparivanieAnalysis', 'CurrentVparivanieAnalysis'].includes(keys[0]) || !isAnalysisRequest(value))
    throw new Error('Некоректний режим групування аналізу залишків і продажів.')
  return { version: 1 }
}
export function cloneCurrentVparivanieAnalysis(data: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(data).filter(([k]) => k.toLowerCase() === 'currentvparivanieanalysis')
  return structuredClone(Object.fromEntries(data.DataSource === 39 && entries.length === 1 && entries[0][0] === 'CurrentVparivanieAnalysis'
    ? [['currentVparivanieAnalysis', entries[0][1]]] : entries))
}
export function currentVparivanieAnalysisCapability(dataset: ReportDataset | null | undefined): CurrentVparivanieAnalysisCapability | undefined {
  const value = record(dataset?.currentVparivanie) ? dataset.currentVparivanie.analysis : undefined
  if (dataset?.DataSource !== 39 || !record(value) || !scope(value) || value.maximumDimensions !== 8 || value.requiredColumnGrouping !== 74 || value.measure !== 83) return undefined
  const fields = (raw: unknown): raw is AnalysisFieldDescriptor[] => Array.isArray(raw) && raw.length <= 128
    && raw.every(f => record(f) && Number.isSafeInteger(f.type) && Number(f.type) >= 0 && typeof f.name === 'string' && !!f.name
      && strings(f.path) && f.path.length <= 5 && ['nativeId', 'sourceRef', 'text', 'documentRef', 'groupRef', 'date'].includes(String(f.valueKind))
      && ['nativeId', 'sourceRef', 'text', 'documentRef', 'groupRef', 'date', 'none'].includes(String(f.lookupKind)) && ['currentMasterData', 'documentEvidence', 'allocationEvidence'].includes(String(f.coverage)) && ids(f.branches) && f.branches.every(b => b >= 1 && b <= 5)
      && (f.available === undefined || typeof f.available === 'boolean') && (f.available !== false || typeof f.unavailabilityReason === 'string' && !!f.unavailabilityReason)
      && ids(f.conditions) && f.conditions.every(c => c <= 7)) && new Set(raw.map(f => f.type)).size === raw.length
  return fields(value.groupings) && fields(value.filters) ? value as unknown as CurrentVparivanieAnalysisCapability : undefined
}
export function withCurrentVparivanieAnalysisScope(data: ReportRequestBody): ReportRequestBody {
  if (data.dataSource !== 39) return data
  try { if (!requestCurrentVparivanieAnalysis(data)) return data } catch { return data }
  const keys = Object.keys(data).filter(k => k.toLowerCase() === 'currentvparivaniefullscope')
  if (keys.length && (keys.length !== 1 || !['currentVparivanieFullScope', 'CurrentVparivanieFullScope'].includes(keys[0]) || (data as unknown as Record<string, unknown>)[keys[0]] !== true)) return data
  const result = { ...data, currentVparivanieAnalysis: { version: 1 }, currentVparivanieFullScope: true }
  delete result.CurrentVparivanieAnalysis; delete result.CurrentVparivanieFullScope
  return result
}
/** Upgrade the user-facing report only when this server advertises the analysis contract. */
export function upgradeCurrentVparivanieAnalysis(data: ReportRequestBody, dataset?: ReportDataset): ReportRequestBody {
  if (data.dataSource !== 39 || !currentVparivanieAnalysisCapability(dataset)) return data
  try { requestCurrentVparivanieAnalysis(data) } catch { return data }
  const legacyDefault = !aliases(data).length && data.sorted.Row.length === 1 && data.sorted.Row[0].type === 5
  const sorted = legacyDefault ? { ...data.sorted, Row: [{ key: 'ProductArticle', label: 'Артикул', type: 6 }, ...data.sorted.Row] } : data.sorted
  return withCurrentVparivanieAnalysisScope({ ...data, sorted, ...(aliases(data).length ? {} : { currentVparivanieAnalysis: { version: 1 } }) })
}
export function currentVparivanieAnalysisScopeError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  try {
    if (!requestCurrentVparivanieAnalysis(data)) return null
    if (data.dataSource !== 39) return 'Розширене групування доступне лише для аналізу залишків і продажів.'
    if (dataset && !currentVparivanieAnalysisCapability(dataset)) return 'Сервер ще не підтримує це групування та відбори аналізу залишків і продажів.'
  } catch (e) { return (e as Error).message }
  return null
}
const positiveId = (v: unknown) => typeof v === 'string' && /^[1-9]\d{0,18}$/.test(v)
  || typeof v === 'number' && Number.isSafeInteger(v) && v > 0
export function validAnalysisFilterValue(field: number, value: unknown, descriptor?: AnalysisFieldDescriptor): boolean {
  if (!record(value)) return false
  if (field === 2 || field === 3 || descriptor?.valueKind === 'text') {
    const entries = Object.entries(value)
    return entries.length === 1 && ['value', 'Value', 'name', 'Name'].includes(entries[0][0])
      && typeof entries[0][1] === 'string' && entries[0][1].length > 0 && entries[0][1].length <= 256
  }
  if ([12, 13].includes(field)) return ['sale', 'return'].includes(String(value.kind)) && positiveId(value.id)
  if (field === 60 || descriptor?.valueKind === 'sourceRef') return typeof value.Id === 'string' && /^[0-9a-f]{32}$/i.test(value.Id)
  return positiveId(value.Id)
}
export function currentVparivanieAnalysisLayoutError(data: ReportRequestBody, dataset?: ReportDataset, draft = false): string | null {
  const invalid = currentVparivanieAnalysisScopeError(data, dataset)
  if (invalid) return invalid
  if (!requestCurrentVparivanieAnalysis(data)) return null
  const rows = data.sorted.Row.map(x => x.type), cols = data.sorted.Col.map(x => x.type), all = [...rows, ...cols]
  const cap = currentVparivanieAnalysisCapability(dataset)
  if ((!draft && rows.length < 1) || cols[0] !== 74 || rows.includes(74) || new Set(all).size !== all.length || all.length - 1 > 8
    || cap && all.some(x => x !== 74 && !cap.groupings.some(f => f.type === x))
    || data.sorted.Measurements.length !== 1 || data.sorted.Measurements[0].Type !== 83 || data.sorted.Measurements[0].IsChecked === false)
    return 'Оберіть до восьми різних групувань; показник «Результат» і колонка показників залишаються у звіті.'
  if (data.selections.length > 24 || new Set(data.selections.filter(s => s.IsChecked !== false).map(s => s.SelectedField.Type)).size !== data.selections.filter(s => s.IsChecked !== false).length) return 'Задайте одне правило на поле відбору, до 24 правил.'
  const descriptors = new Map(cap?.filters.map(field => [field.type, field]) ?? [])
  let anchor = false
  for (const selection of data.selections) {
    if (selection.IsChecked === false) continue
    const field = selection.SelectedField.Type, condition = selection.FilterCondition.Type
    if (selection.Values.length > 0 && (field === 1 && [0, 2].includes(condition) || field === 4 && [0, 2, 3, 6].includes(condition))) anchor = true
    const f = descriptors.get(field)
    if (f?.available === false) return f.unavailabilityReason ?? 'Цей відбір поки недоступний.'
    if (cap && (!f || !f.conditions.includes(selection.FilterCondition.Type))) return 'Сервер не підтримує вибраний відбір або умову для цього поля.'
    if (!draft && selection.Values.length === 0) return 'Оберіть значення відбору.'
    if (selection.Values.some(v => !validAnalysisFilterValue(field, v.Data, f))) return 'Некоректне значення відбору аналізу.'
    if (field === 21 && selection.Values.length > 32) return 'Оберіть до 32 складів.'
    if (selection.Values.length > 4096 || ![2, 3, 4, 5].includes(condition) && selection.Values.length > 1) return 'Кількість значень не відповідає умові відбору.'
  }
  return !draft && !anchor ? 'Оберіть товари або групи товарів для аналізу.' : null
}
const conditions = ['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі']
export function analysisFilterConditions(dataset: ReportDataset | undefined | null, field: number): ReportFilterCondition[] {
  return currentVparivanieAnalysisCapability(dataset)?.filters.find(f => f.type === field)?.conditions.map(Type => ({ Type, Name: conditions[Type] })) ?? []
}
export function readAnalysisMetadata(value: unknown, preview: NativeReportPreview): CurrentVparivanieAnalysisMetadata | undefined {
  if (value == null) return undefined
  const fail = () => { throw new Error('Сервер не підтвердив розрізи та покриття аналізу залишків і продажів.') }
  if (!record(value) || !scope(value) || typeof value.incoming !== 'boolean' || typeof value.outgoing !== 'boolean' || value.resultSha256 !== preview.ResultSha256 || !Array.isArray(value.fieldCoverage) || value.fieldCoverage.length > 64
    || !preview.Request?.HasPeriod || preview.Request.IsCurrentSnapshot || !preview.Request.PeriodFrom || !preview.Request.PeriodTo
    || preview.RowSchema.length < 1 || preview.RowSchema.length > 8 || preview.ColumnSchema.length > 10
    || preview.ColumnSchema.filter(f => f.Identity === 'CurrentVparivanieGroup').length !== 1
    || preview.Page.TotalVisibleRows * (preview.RowSchema.length + preview.Columns.length) > 1000000
    || new Set(preview.Rows.map(r => r.SourceIndex)).size !== preview.Rows.length || new Set(preview.Columns.map(c => c.SourceIndex)).size !== preview.Columns.length
    || preview.Rows.some(r => r.Values.length !== preview.RowSchema.length) || preview.Columns.some(c => c.Values.length !== preview.ColumnSchema.length)
    || preview.Cells.some(c => !['null', 'decimal'].includes(c.Value.Kind) || c.Value.Kind === 'null' && c.Value.Value !== null
      || c.Value.Kind === 'decimal' && (typeof c.Value.Value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(c.Value.Value)))) return fail()
  const seen = new Set<string>()
  for (const f of value.fieldCoverage) {
    if (!record(f) || !Number.isSafeInteger(f.field) || !['grouping', 'filter'].includes(String(f.scope))
      || ![f.knownFacts, f.unknownFacts, f.notApplicableFacts].every(x => Number.isSafeInteger(x) && Number(x) >= 0)
      || !Array.isArray(f.reasons) || f.reasons.length > 32 || !f.reasons.every(x => typeof x === 'string' && x.length > 0 && x.length <= 160) || Number(f.unknownFacts) > 0 && f.reasons.length === 0 || seen.has(`${f.scope}:${f.field}`)) return fail()
    seen.add(`${f.scope}:${f.field}`)
  }
  return value as unknown as CurrentVparivanieAnalysisMetadata
}
export function bindAnalysisPreview(request: ReportRequestBody, preview: NativeReportPreview): void {
  const requested = requestCurrentVparivanieAnalysis(request)
  if (!!requested !== !!preview.currentVparivanieAnalysis || !!requested !== !!preview.Request?.currentVparivanieAnalysis)
    throw new Error('Сервер повернув інший режим групування звіту.')
  const movements = movementSelection(request)
  if (requested && (preview.currentVparivanieAnalysis?.incoming !== !!movements?.Incoming || preview.currentVparivanieAnalysis?.outgoing !== !!movements?.Outgoing)) throw new Error('Сервер повернув інший вибір руху товару.')
  if (requested && (preview.currentVparivanieAnalysis?.incoming !== !!preview.Request?.CurrentVparivanieMovements?.Incoming
    || preview.currentVparivanieAnalysis?.outgoing !== !!preview.Request?.CurrentVparivanieMovements?.Outgoing)) throw new Error('Сервер повернув інший вибір руху товару.')
  if (requested && [...request.sorted.Row, ...request.sorted.Col].some(g => !preview.currentVparivanieAnalysis?.fieldCoverage.some(f => f.scope === 'grouping' && f.field === g.type))) throw new Error('Сервер не передав покриття всіх групувань.')
  // Version 1 requires coverage for output dimensions. Filter evidence is enforced by
  // reader admission and bound by the immutable request hash; per-filter counters are optional.
  if (requested && preview.Request?.DataSource !== 'NativeCurrentVparivanie') throw new Error('Сервер повернув інший набір даних аналізу.')
}
