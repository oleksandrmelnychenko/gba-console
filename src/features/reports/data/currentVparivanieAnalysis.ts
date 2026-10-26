import { isMultiValueReportCondition, reportSelectionCardinalityError } from './reportOptions'
import { movementSelection } from './currentVparivanieMovements'
import type { ReportDataset, ReportFilterCondition, ReportRequestBody, ReportSelection, ReportSelectedValue, ReportEntity } from '../types'
import type { NativeReportPreview } from './nativeReportPreview'

export type CurrentVparivanieAnalysisRequest = { version: 1 }
export const ANALYSIS_GROUPS_ENDPOINT = '/report/datasets/current-vparivanie/analysis/groups'
export type AnalysisHierarchyBrowse = { version: 1; endpoint: typeof ANALYSIS_GROUPS_ENDPOINT; maximumPageSize: number }
export type AnalysisTextEntry = { version: 1; allowedValues: string[] }
export type AnalysisGroupSelection = { version: 1; itemField: 1; itemKind: 'product'; groupKind: 'productGroup'; mixedConditions: [3, 5] }
export const ANALYSIS_HIERARCHY_ENDPOINT = '/report/datasets/current-vparivanie/analysis/hierarchy'
export const ANALYSIS_HIERARCHY_STATUS_ENDPOINT = '/report/datasets/current-vparivanie/analysis/hierarchy-status'
export type AnalysisHierarchyKind = 'productGroup' | 'counterpartyGroup' | 'warehouseGroup'
export type AnalysisItemKind = 'product' | 'buyer' | 'supplier' | 'warehouse'
export type AnalysisHierarchy = {
  version: 1; groupKind: AnalysisHierarchyKind; itemKind: AnalysisItemKind; itemField: number
  groupConditions: number[]; mixedConditions: number[]; source: string; browseEndpoint: string; maximumPageSize: number; statusEndpoint: string
}
export type AnalysisHierarchyStatus = Partial<Record<AnalysisHierarchyKind, string | null>>
export type AnalysisFieldDescriptor = {
  type: number; name: string; path: string[]; valueKind: string; branches: number[]
  conditions: number[]; lookupKind: string; coverage: string; groupSelection?: AnalysisGroupSelection; hierarchyBrowse?: AnalysisHierarchyBrowse; textEntry?: AnalysisTextEntry; available?: boolean; unavailabilityReason?: string | null
  hierarchy?: AnalysisHierarchy
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
const HIERARCHY_ITEMS: Record<number, [AnalysisItemKind, AnalysisHierarchyKind]> = {
  1: ['product', 'productGroup'], 4: ['product', 'productGroup'], 5: ['buyer', 'counterpartyGroup'], 6: ['buyer', 'counterpartyGroup'],
  17: ['supplier', 'counterpartyGroup'], 21: ['warehouse', 'warehouseGroup'],
}
const sameIds = (value: unknown, expected: number[]) => Array.isArray(value) && value.length === expected.length && value.every((x, i) => x === expected[i])
function isAnalysisHierarchy(value: unknown, field: number): value is AnalysisHierarchy {
  const expected = HIERARCHY_ITEMS[field]
  return record(value) && !!expected && value.version === 1 && value.itemKind === expected[0] && value.groupKind === expected[1]
    && Number.isSafeInteger(value.itemField) && sameIds(value.groupConditions, [3, 5, 6, 7]) && sameIds(value.mixedConditions, [3, 5])
    && typeof value.source === 'string' && value.statusEndpoint === ANALYSIS_HIERARCHY_STATUS_ENDPOINT
    && value.browseEndpoint === (expected[1] === 'productGroup' ? ANALYSIS_GROUPS_ENDPOINT : ANALYSIS_HIERARCHY_ENDPOINT)
    && Number.isInteger(value.maximumPageSize) && Number(value.maximumPageSize) > 0 && Number(value.maximumPageSize) <= 50
}
const PRODUCT_HIERARCHY: AnalysisHierarchy = {
  version: 1, groupKind: 'productGroup', itemKind: 'product', itemField: 1, groupConditions: [3, 5, 6, 7], mixedConditions: [3, 5],
  source: 'Товарні групи GBA', browseEndpoint: ANALYSIS_GROUPS_ENDPOINT, maximumPageSize: 50, statusEndpoint: ANALYSIS_HIERARCHY_STATUS_ENDPOINT,
}
export function analysisHierarchy(descriptor: AnalysisFieldDescriptor | undefined): AnalysisHierarchy | undefined {
  if (!descriptor) return undefined
  if (descriptor.hierarchy) return descriptor.hierarchy
  return descriptor.type === 4 && descriptor.groupSelection ? PRODUCT_HIERARCHY : undefined
}
export function isAnalysisGroupCondition(descriptor: AnalysisFieldDescriptor | undefined, condition: number): boolean {
  return !!analysisHierarchy(descriptor)?.groupConditions.includes(condition)
}
export const ANALYSIS_HIERARCHY_PENDING = 'Перевіряємо, чи є в GBA ієрархія груп для цього поля…'
export function analysisHierarchyUnavailableReason(descriptor: AnalysisFieldDescriptor | undefined, status: AnalysisHierarchyStatus | null | undefined): string | null {
  const hierarchy = analysisHierarchy(descriptor)
  if (!hierarchy) return null
  if (!status) return hierarchy.groupKind === 'productGroup' ? null : ANALYSIS_HIERARCHY_PENDING
  if (!(hierarchy.groupKind in status)) return hierarchy.groupKind === 'productGroup' ? null : 'Сервер не повідомив стан ієрархії груп для цього поля.'
  return status[hierarchy.groupKind] ?? null
}
export function analysisConditionUnavailableReason(descriptor: AnalysisFieldDescriptor | undefined, condition: number, status: AnalysisHierarchyStatus | null | undefined): string | null {
  return isAnalysisGroupCondition(descriptor, condition) ? analysisHierarchyUnavailableReason(descriptor, status) : null
}
function isAnalysisGroupSelection(value: unknown): value is AnalysisGroupSelection {
  return record(value) && value.version === 1 && value.itemField === 1 && value.itemKind === 'product'
    && value.groupKind === 'productGroup' && Array.isArray(value.mixedConditions) && value.mixedConditions.length === 2 && value.mixedConditions[0] === 3 && value.mixedConditions[1] === 5
}
export function mixedAnalysisSelection(descriptor: AnalysisFieldDescriptor | undefined, condition: number): boolean {
  return !!descriptor?.groupSelection && descriptor.groupSelection.mixedConditions.some(type => type === condition)
}
export function currentVparivanieAnalysisCapability(dataset: ReportDataset | null | undefined): CurrentVparivanieAnalysisCapability | undefined {
  const value = record(dataset?.currentVparivanie) ? dataset.currentVparivanie.analysis : undefined
  if (dataset?.DataSource !== 39 || !record(value) || !scope(value) || value.maximumDimensions !== 8 || value.requiredColumnGrouping !== 74 || value.measure !== 83) return undefined
  const fields = (raw: unknown): raw is AnalysisFieldDescriptor[] => Array.isArray(raw) && raw.length <= 128
    && raw.every(f => record(f) && Number.isSafeInteger(f.type) && Number(f.type) >= 0 && typeof f.name === 'string' && !!f.name
      && strings(f.path) && f.path.length <= 5 && ['nativeId', 'sourceRef', 'text', 'documentRef', 'groupRef', 'date'].includes(String(f.valueKind))
      && ['nativeId', 'sourceRef', 'text', 'documentRef', 'groupRef', 'date', 'none'].includes(String(f.lookupKind)) && ['currentMasterData', 'documentEvidence', 'allocationEvidence'].includes(String(f.coverage)) && ids(f.branches) && f.branches.every(b => b >= 1 && b <= 5)
      && (f.available === undefined || typeof f.available === 'boolean') && (f.available !== false || typeof f.unavailabilityReason === 'string' && !!f.unavailabilityReason)
      && (f.groupSelection == null || f.type === 4 && isAnalysisGroupSelection(f.groupSelection))
      && (f.hierarchy == null || isAnalysisHierarchy(f.hierarchy, Number(f.type)))
      && (f.hierarchyBrowse == null || f.type === 4 && record(f.hierarchyBrowse) && f.hierarchyBrowse.version === 1
        && f.hierarchyBrowse.endpoint === ANALYSIS_GROUPS_ENDPOINT && Number.isInteger(f.hierarchyBrowse.maximumPageSize)
        && Number(f.hierarchyBrowse.maximumPageSize) > 0 && Number(f.hierarchyBrowse.maximumPageSize) <= 50)
      && (f.textEntry == null || f.type === 3 && record(f.textEntry) && f.textEntry.version === 1 && strings(f.textEntry.allowedValues)
        && f.textEntry.allowedValues.length > 0 && f.textEntry.allowedValues.length <= 32 && new Set(f.textEntry.allowedValues).size === f.textEntry.allowedValues.length)
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
const positiveId = (v: unknown) => typeof v === 'string' && v.length <= 8192 && /^\d+$/.test(v) && BigInt(v) > 0n && BigInt(v) <= 9223372036854775807n
  || typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const GROUP_CONDITIONS = [3, 5, 6, 7]
const SOURCE_ID = /^[0-9A-Fa-f]{32}$/
const hasKind = (value: Record<string, unknown>) => Object.keys(value).some(key => key.toLowerCase() === 'kind')
const legacyId = (value: Record<string, unknown>) => {
  const ids = Object.entries(value).filter(([key]) => key.toLowerCase() === 'id')
  return ids.length === 1 && !hasKind(value) && positiveId(ids[0][1]) ? ids[0][1] as string | number : null
}
export type AnalysisHierarchyIdentity = { kind: string; id: string | number; world?: 'fenix' | 'amg'; group: boolean; typed: boolean }
export function analysisHierarchyIdentity(field: number, value: ReportEntity): AnalysisHierarchyIdentity | null {
  if (field === 4) {
    const group = analysisGroupIdentity(value)
    return group ? { kind: group.kind, id: group.id, group: group.kind === 'productGroup', typed: group.typed } : null
  }
  const expected = HIERARCHY_ITEMS[field]
  if (!expected || !record(value)) return null
  const entries = Object.entries(value), lower = new Map(entries.map(([key, v]) => [key.toLowerCase(), v]))
  if (lower.size !== entries.length || !lower.has('kind')) return null
  const kind = lower.get('kind'), id = lower.get('id'), world = lower.get('world')
  if (kind === expected[0]) return entries.length === 2 && positiveId(id) ? { kind: expected[0], id: id as string | number, group: false, typed: true } : null
  if (kind !== expected[1]) return null
  if (kind === 'productGroup') return entries.length === 2 && positiveId(id) ? { kind, id: id as string | number, group: true, typed: true } : null
  return entries.length === 3 && typeof id === 'string' && SOURCE_ID.test(id) && /[1-9A-Fa-f]/.test(id)
    && (world === 'fenix' || world === 'amg' && kind === 'warehouseGroup')
    ? { kind: expected[1], id: id.toUpperCase(), world: world as 'fenix' | 'amg', group: true, typed: true } : null
}
export function validAnalysisFilterValue(field: number, value: unknown, descriptor?: AnalysisFieldDescriptor, condition?: number): boolean {
  if (!record(value)) return false
  if (field === 4) {
    const group = analysisGroupIdentity(value)
    return !!group && (!group.typed || [3, 5].includes(condition ?? -1) && (!descriptor || !!descriptor.groupSelection))
  }
  if (HIERARCHY_ITEMS[field]) {
    if (GROUP_CONDITIONS.includes(condition ?? -1)) {
      const identity = analysisHierarchyIdentity(field, value)
      return !!identity && (identity.group || [3, 5].includes(condition ?? -1)) && (!descriptor || !!analysisHierarchy(descriptor))
    }
    if (hasKind(value)) return false
  }
  if (field === 2 || field === 3 || descriptor?.valueKind === 'text') {
    const entries = Object.entries(value)
    return entries.length === 1 && ['value', 'Value', 'name', 'Name'].includes(entries[0][0])
      && typeof entries[0][1] === 'string' && entries[0][1].length > 0 && entries[0][1].length <= 256
  }
  if ([12, 13].includes(field)) return ['sale', 'return'].includes(String(value.kind)) && positiveId(value.id)
  if (field === 60 || descriptor?.valueKind === 'sourceRef') return typeof value.Id === 'string' && /^[0-9a-f]{32}$/i.test(value.Id)
  return positiveId(value.Id)
}
export function analysisGroupIdentity(value: ReportEntity): { kind: 'product' | 'productGroup'; id: string | number; typed: boolean } | null {
  const entries = Object.entries(value), lower = new Map(entries.map(([key, v]) => [key.toLowerCase(), v]))
  if (lower.size !== entries.length) return null
  if (lower.has('kind')) {
    const kind = lower.get('kind'), id = lower.get('id')
    return entries.length === 2 && (kind === 'product' || kind === 'productGroup') && positiveId(id)
      ? { kind, id: id as string | number, typed: true } : null
  }
  return positiveId(lower.get('id')) ? { kind: 'productGroup', id: lower.get('id') as string | number, typed: false } : null
}
export function analysisValueIdentity(field: number, value: ReportEntity): string {
  const group = field === 4 ? analysisGroupIdentity(value) : null
  const entries = Object.entries(value)
  if ([2, 3].includes(field) && entries.length === 1 && ['name', 'value'].includes(entries[0][0].toLowerCase()) && typeof entries[0][1] === 'string') return `text:${entries[0][1]}`
  if (group) return `${group.kind}:${BigInt(group.id)}`
  const expected = field === 4 ? undefined : HIERARCHY_ITEMS[field]
  if (expected) {
    const typed = analysisHierarchyIdentity(field, value)
    if (typed) return typed.world ? `${typed.kind}:${typed.world}:${typed.id}` : `${typed.kind}:${BigInt(typed.id)}`
    const id = legacyId(value)
    if (id !== null) return `${expected[0]}:${BigInt(id)}`
  }
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
}
export function analysisListCondition(type: number, descriptor?: AnalysisFieldDescriptor): ReportFilterCondition | undefined {
  const Type = type === 0 ? 2 : type === 1 ? 4 : undefined
  return Type !== undefined && descriptor?.conditions.includes(Type)
    ? { Type, Name: Type === 2 ? 'У списку' : 'Не у списку' } : undefined
}
export function changeAnalysisSelectionValues(selection: ReportSelection, Values: ReportSelectedValue[], descriptor?: AnalysisFieldDescriptor): ReportSelection {
  return { ...selection, Values, FilterCondition: Values.length > 1
    ? analysisListCondition(selection.FilterCondition.Type, descriptor) ?? selection.FilterCondition : selection.FilterCondition }
}
export function changeAnalysisSelectionCondition(selection: ReportSelection, condition: ReportFilterCondition): ReportSelection {
  // Re-encode a proven group without dropping it when leaving a mixed operator.
  // Individual products remain visible and invalid until explicitly replaced/removed.
  const field = selection.SelectedField.Type
  if (field !== 4 && HIERARCHY_ITEMS[field]) {
    const toGroup = GROUP_CONDITIONS.includes(condition.Type)
    const Values = selection.Values.map(value => {
      const typed = analysisHierarchyIdentity(field, value.Data)
      if (toGroup) {
        const id = typed ? null : legacyId(value.Data)
        return id === null ? value : { ...value, Data: { kind: HIERARCHY_ITEMS[field][0], id } }
      }
      return typed && !typed.group ? { ...value, Data: { Id: typed.id } } : value
    })
    return { ...selection, FilterCondition: condition, Values }
  }
  const Values = field === 4 && ![3, 5].includes(condition.Type)
    ? selection.Values.map(value => {
      const group = analysisGroupIdentity(value.Data)
      return group?.typed && group.kind === 'productGroup' ? { ...value, Data: { Id: group.id } } : value
    }) : selection.Values
  return { ...selection, FilterCondition: condition, Values }
}
export function analysisSelectionValueError(selection: ReportSelection, descriptor?: AnalysisFieldDescriptor): string | null {
  const cardinality = reportSelectionCardinalityError(selection)
  if (cardinality) return cardinality
  const field = selection.SelectedField.Type, condition = selection.FilterCondition.Type
  if (selection.Values.some(v => !validAnalysisFilterValue(field, v.Data, descriptor, condition))) {
    if (field === 4) return 'Для цієї умови оберіть групи товарів; окремі товари доступні в умовах «У групі зі списку» та «Не у групі зі списку».'
    if (HIERARCHY_ITEMS[field] && [6, 7].includes(condition))
      return 'Для умов «У групі» та «Не у групі» оберіть групу; окремі значення доступні в умовах «У групі зі списку» та «Не у групі зі списку».'
    if (HIERARCHY_ITEMS[field] && !GROUP_CONDITIONS.includes(condition) && selection.Values.some(v => analysisHierarchyIdentity(field, v.Data)?.group))
      return 'Групи можна обрати лише в умовах «У групі…»; приберіть групи або змініть умову.'
    return 'Некоректне значення відбору аналізу.'
  }
  return null
}
export function currentVparivanieAnalysisLayoutError(data: ReportRequestBody, dataset?: ReportDataset, draft = false, status?: AnalysisHierarchyStatus | null): string | null {
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
  const active = data.selections.filter(selection => selection.IsChecked !== false)
  if (active.filter(s => s.SelectedField.Type === 4 || s.SelectedField.Type === 1 && GROUP_CONDITIONS.includes(s.FilterCondition.Type)).length > 1)
    return 'Задайте відбір за групами товарів одним правилом: «Товар» або «Товарна група».'
  let anchor = false
  for (const selection of active) {
    const field = selection.SelectedField.Type, condition = selection.FilterCondition.Type
    if (selection.Values.length > 0 && [1, 4].includes(field) && [0, 2, 3, 6].includes(condition)) anchor = true
    const f = descriptors.get(field)
    if (f?.available === false) return f.unavailabilityReason ?? 'Цей відбір поки недоступний.'
    if (cap && (!f || !f.conditions.includes(selection.FilterCondition.Type))) return 'Сервер не підтримує вибраний відбір або умову для цього поля.'
    const unavailable = status === undefined ? null : analysisConditionUnavailableReason(f, condition, status)
    if (unavailable) return unavailable
    if (!draft && selection.Values.length === 0) return 'Оберіть значення відбору.'
    const valueError = analysisSelectionValueError(selection, f)
    if (valueError) return valueError
    if (field === 21 && selection.Values.length > 32) return 'Оберіть до 32 складів.'
    if (selection.Values.length > 4096 || !isMultiValueReportCondition(condition) && selection.Values.length > 1) return 'Кількість значень не відповідає умові відбору.'
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
