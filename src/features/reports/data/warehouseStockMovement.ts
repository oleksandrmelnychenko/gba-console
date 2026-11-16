import { reportFilterExpressionError } from './reportFilterExpression'
import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { readPhysicalQuantityExceptions, type PhysicalQuantityException } from '../../../shared/ui/product-movement-history/physicalQuantityExceptions'
import { readPhysicalCoverage, type PhysicalCoverage } from '../../../shared/ui/product-movement-history/physicalCoverage'

export const WAREHOUSE_STOCK_MOVEMENT_ROUTE = '/report/constructors/warehouse-stock-movement'
export const WAREHOUSE_STOCK_MOVEMENT_TITLE = 'Рух товару — залишки, прихід і розхід'
export const WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE = 200
export const STOCK_MOVEMENT_UNCONFIRMED_TOTAL_NOTE = '«—» у підсумку: кількість частини руху не підтверджена партією, тому підсумок не визначено.'
export const STOCK_MOVEMENT_UNKNOWN_TOTAL_NOTE = '«—» у підсумку: значення не визначено, причину наведено в «Як розраховано».'
export const STOCK_MOVEMENT_UNCONFIRMED_CELL_NOTE = 'Кількість частини руху не підтверджена партією, тому значення не визначено.'
export const STOCK_MOVEMENT_UNKNOWN_CELL_NOTE = 'Значення не визначено, причину наведено в «Як розраховано».'

export const STOCK_MOVEMENT_LEVELS = ['warehouse', 'product', 'month', 'day', 'registrar'] as const
export const STOCK_MOVEMENT_MEASURES = ['opening', 'incoming', 'outgoing', 'closing'] as const
export const STOCK_MOVEMENT_COMPARISONS = ['greater', 'greaterOrEqual', 'less', 'lessOrEqual', 'equal', 'notEqual'] as const
export const STOCK_MOVEMENT_ARTICLE_MATCHES = ['equals', 'contains', 'inList'] as const

export type StockMovementLevel = typeof STOCK_MOVEMENT_LEVELS[number]
export type StockMovementMeasure = typeof STOCK_MOVEMENT_MEASURES[number]
export type StockMovementComparison = typeof STOCK_MOVEMENT_COMPARISONS[number]
export type StockMovementArticleMatch = typeof STOCK_MOVEMENT_ARTICLE_MATCHES[number]

export const STOCK_MOVEMENT_LEVEL_LABELS: Record<StockMovementLevel, string> = {
  warehouse: 'Склад',
  product: 'Номенклатура.Артикул',
  month: 'Місяць',
  day: 'День',
  registrar: 'Документ руху (реєстратор)',
}
export const STOCK_MOVEMENT_MEASURE_LABELS: Record<StockMovementMeasure, string> = {
  opening: 'Початковий залишок',
  incoming: 'Надходження',
  outgoing: 'Видаток',
  closing: 'Кінцевий залишок',
}
export const STOCK_MOVEMENT_COMPARISON_LABELS: Record<StockMovementComparison, string> = {
  greater: 'Більше',
  greaterOrEqual: 'Більше або дорівнює',
  less: 'Менше',
  lessOrEqual: 'Менше або дорівнює',
  equal: 'Дорівнює',
  notEqual: 'Не дорівнює',
}
export const STOCK_MOVEMENT_ARTICLE_LABELS: Record<StockMovementArticleMatch, string> = {
  equals: 'Дорівнює',
  contains: 'Містить',
  inList: 'У списку',
}

type StockMovementDocumentKind = { Code: string; Name: string }
export type StockMovementCapability = {
  Version: 1
  MinimumFrom: string
  Today: string
  StockSyncAt: string | null
  Levels: StockMovementLevel[]
  DefaultLevels: StockMovementLevel[]
  Measures: StockMovementMeasure[]
  Comparisons: StockMovementComparison[]
  ArticleMatches: StockMovementArticleMatch[]
  DocumentKinds: StockMovementDocumentKind[]
  MaximumLimit: number
  Notes: string[]
  FilterExpression?: StockMovementFilterExpressionCapability
}
export type StockMovementFilterExpressionCapability = { Version: 1; MaximumDepth: number; MaximumLeaves: number; Operators: Array<1 | 2> }
export type StockMovementFilterNode = { Kind: 1 | 2; Children: StockMovementFilterNode[] } | { Kind: 3; Filter: StockMovementFilterField }
export type StockMovementFilterExpression = { Version: 1; Root: StockMovementFilterNode }
export type StockMovementLookupItem = { Id: number; Name: string; Detail: string | null }
type StockMovementCondition = { Measure: StockMovementMeasure; Comparison: StockMovementComparison; Value: number }
export type StockMovementSelection = { id: number; label: string }
export const STOCK_MOVEMENT_FILTER_FIELDS = ['organization', 'product', 'article', 'top', 'group', 'unit', 'warehouse', 'documentKind', 'documentText'] as const
export type StockMovementFilterField = typeof STOCK_MOVEMENT_FILTER_FIELDS[number]
export type StockMovementFilterRow = { id: number; field: StockMovementFilterField | null; enabled: boolean }
export const STOCK_MOVEMENT_FILTER_DEFINITIONS: Record<StockMovementFilterField, { type: number; label: string; section?: string; condition: string }> = {
  organization: { type: 0, label: 'Організація складу', condition: 'В списку' },
  product: { type: 1, label: 'Товар', section: 'Товар', condition: 'В списку' },
  article: { type: 2, label: 'Артикул', section: 'Товар', condition: 'В списку' },
  top: { type: 3, label: 'Топ', section: 'Товар', condition: 'В списку' },
  group: { type: 4, label: 'Товарна група', section: 'Товар', condition: 'В групі' },
  unit: { type: 20, label: 'Одиниця виміру', section: 'Товар', condition: 'В списку' },
  warehouse: { type: 21, label: 'Склад', section: 'Склад', condition: 'В списку' },
  documentKind: { type: 1001, label: 'Вид документа руху', section: 'Документ руху', condition: 'В списку' },
  documentText: { type: 1002, label: 'Документ руху', section: 'Документ руху', condition: 'Містить' },
}

export type StockMovementDraft = {
  from: string
  to: string
  warehouseIds: number[]
  organizationIds: number[]
  articleMatch: StockMovementArticleMatch
  articleText: string
  articleList: string[]
  products: StockMovementSelection[]
  groups: StockMovementSelection[]
  productTops: string[]
  measureUnitIds: number[]
  filterRows: StockMovementFilterRow[]
  filterExpression?: { Version: 1; Root: unknown } | null
  documentKinds: string[]
  documentText: string
  conditions: StockMovementCondition[]
  levels: StockMovementLevel[]
  measures: StockMovementMeasure[]
  grandTotals: boolean
  negativeRed: boolean
}

export type StockMovementRequest = {
  Version: 1
  From: string
  To: string
  WarehouseIds: number[]
  OrganizationIds: number[]
  ProductIds: number[]
  ArticleMatch: StockMovementArticleMatch | ''
  Articles: string[]
  ProductGroupIds: number[]
  ProductTops: string[]
  MeasureUnitIds: number[]
  FilterExpression?: StockMovementFilterExpression
  DocumentKinds: string[]
  DocumentText: string | null
  Conditions: StockMovementCondition[]
  Levels: StockMovementLevel[]
  Measures: StockMovementMeasure[]
  GrandTotals: boolean
  NegativeRed: boolean
  Offset: number
  Limit: number
}

export type StockMovementQuantity = { Opening: number | null; Incoming: number | null; Outgoing: number | null; Closing: number | null }
export type StockMovementRow = {
  Index: number
  Depth: number
  Level: StockMovementLevel
  Label: string
  StorageId: number | null
  ProductId: number | null
  Article: string | null
  ProductName: string | null
  Period: string | null
  DocumentKind: string | null
  DocumentType: string | null
  DocumentNumber: string | null
  DocumentDate: string | null
  Counterparty: string | null
  Organization: string | null
  Source: '1c' | 'gba' | null
  Quantity: StockMovementQuantity
  QuantityStatus?: string | null
}
export type StockMovementResult = {
  PhysicalCoverage?: PhysicalCoverage[]
  PhysicalQuantityExceptions?: PhysicalQuantityException[]
  Version: 1
  From: string
  To: string
  Levels: StockMovementLevel[]
  Measures: StockMovementMeasure[]
  ObservedAt: string
  StockSyncAt: string | null
  Totals: StockMovementQuantity
  Keys: number
  Registrars: number
  TotalRows: number
  Offset: number
  Limit: number
  Rows: StockMovementRow[]
  Notes: string[]
}
export type StockMovementExport = { DocumentURL: string; FileName: string; TotalRows: number }

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalText = (value: unknown): value is string | null => value === null || typeof value === 'string'
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
const member = <T extends string>(values: readonly T[]) => (value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value)
const isLevel = member(STOCK_MOVEMENT_LEVELS)
const isMeasure = member(STOCK_MOVEMENT_MEASURES)
const isComparison = member(STOCK_MOVEMENT_COMPARISONS)
const isArticleMatch = member(STOCK_MOVEMENT_ARTICLE_MATCHES)

function normalizeStockMovementWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeStockMovementWire)
  if (!record(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.charAt(0).toUpperCase() + key.slice(1), normalizeStockMovementWire(item)]))
}

export function normalizeStockMovementCapability(raw: unknown): StockMovementCapability {
  const value = normalizeStockMovementWire(raw)
  if (!record(value) || value.Version !== 1 || !date(value.MinimumFrom) || !date(value.Today) || !optionalText(value.StockSyncAt)
    || !Array.isArray(value.Levels) || !value.Levels.every(isLevel) || !Array.isArray(value.DefaultLevels) || !value.DefaultLevels.every(isLevel)
    || !Array.isArray(value.Measures) || !value.Measures.every(isMeasure) || !Array.isArray(value.Comparisons) || !value.Comparisons.every(isComparison)
    || !Array.isArray(value.ArticleMatches) || !value.ArticleMatches.every(isArticleMatch) || !Array.isArray(value.DocumentKinds)
    || !value.DocumentKinds.every(kind => record(kind) && typeof kind.Code === 'string' && typeof kind.Name === 'string')
    || !count(value.MaximumLimit) || !strings(value.Notes))
    throw new Error('Сервер не підтвердив можливості звіту руху товару.')
  const expression = value.FilterExpression
  const supported = record(expression) && expression.Version === 1 && count(expression.MaximumDepth) && count(expression.MaximumLeaves)
    && Array.isArray(expression.Operators) && expression.Operators.length > 0 && expression.Operators.every(item => item === 1 || item === 2)
  const { FilterExpression: _ignored, ...rest } = value
  void _ignored
  return (supported ? { ...rest, FilterExpression: { Version: 1, MaximumDepth: expression.MaximumDepth, MaximumLeaves: expression.MaximumLeaves,
    Operators: expression.Operators } } : rest) as StockMovementCapability
}

export function normalizeStockMovementLookup(raw: unknown): StockMovementLookupItem[] {
  const value = normalizeStockMovementWire(raw)
  if (!Array.isArray(value) || !value.every(item => record(item) && count(item.Id) && typeof item.Name === 'string' && optionalText(item.Detail ?? null)))
    throw new Error('Сервер повернув некоректний перелік для відбору.')
  return value.map(item => ({ Id: (item as StockMovementLookupItem).Id, Name: (item as StockMovementLookupItem).Name, Detail: (item as StockMovementLookupItem).Detail ?? null }))
}

function quantity(value: unknown): value is StockMovementQuantity {
  return record(value) && [value.Opening, value.Incoming, value.Outgoing, value.Closing].every(item => item === null || finite(item))
}

function balances(quantity: StockMovementQuantity): boolean {
  if (quantity.Opening === null || quantity.Incoming === null || quantity.Outgoing === null || quantity.Closing === null) return true
  return Math.abs(quantity.Opening + quantity.Incoming - quantity.Outgoing - quantity.Closing) < 1e-6
}

function row(value: unknown): value is StockMovementRow {
  return record(value) && count(value.Index) && count(value.Depth) && isLevel(value.Level) && typeof value.Label === 'string'
    && (value.StorageId === null || count(value.StorageId)) && (value.ProductId === null || count(value.ProductId))
    && optionalText(value.Article) && optionalText(value.ProductName) && optionalText(value.Period) && optionalText(value.DocumentKind)
    && optionalText(value.DocumentType) && optionalText(value.DocumentNumber) && optionalText(value.DocumentDate)
    && optionalText(value.Counterparty) && optionalText(value.Organization) && (value.Source === null || value.Source === '1c' || value.Source === 'gba')
    && quantity(value.Quantity) && balances(value.Quantity)
}

export function normalizeStockMovementResult(raw: unknown, request: StockMovementRequest): StockMovementResult {
  const value = normalizeStockMovementWire(raw)
  const invalid = () => { throw new Error('Сервер повернув неузгоджений рух товару. Повторіть формування.') }
  if (!record(value) || value.Version !== 1 || !date(value.From) || !date(value.To) || value.From !== request.From || value.To !== request.To
    || !Array.isArray(value.Levels) || !value.Levels.every(isLevel) || !Array.isArray(value.Measures) || !value.Measures.every(isMeasure)
    || typeof value.ObservedAt !== 'string' || !optionalText(value.StockSyncAt) || !quantity(value.Totals) || !balances(value.Totals)
    || !count(value.Keys) || !count(value.Registrars) || !count(value.TotalRows) || value.Offset !== request.Offset || !count(value.Limit)
    || !Array.isArray(value.Rows) || value.Rows.length > request.Limit || !value.Rows.every(row) || !strings(value.Notes)) return invalid()
  const rows = value.Rows as StockMovementRow[]
  if (rows.some((item, index) => item.Index !== request.Offset + index) || request.Offset + rows.length > (value.TotalRows as number)) return invalid()
  return { ...value, PhysicalQuantityExceptions: readPhysicalQuantityExceptions(value.PhysicalQuantityExceptions), ...(value.PhysicalCoverage != null
    ? { PhysicalCoverage: readPhysicalCoverage(value.PhysicalCoverage) } : {}) } as StockMovementResult
}

export function normalizeStockMovementExport(raw: unknown): StockMovementExport {
  const value = normalizeStockMovementWire(raw)
  if (!record(value) || typeof value.DocumentURL !== 'string' || !value.DocumentURL || typeof value.FileName !== 'string' || !count(value.TotalRows))
    throw new Error('Сервер не повернув файл Excel.')
  return { DocumentURL: value.DocumentURL, FileName: value.FileName, TotalRows: value.TotalRows }
}

export function defaultStockMovementDraft(capability: StockMovementCapability): StockMovementDraft {
  const monthStart = `${capability.Today.slice(0, 7)}-01`
  return {
    from: monthStart < capability.MinimumFrom ? capability.MinimumFrom : monthStart,
    to: capability.Today,
    warehouseIds: [],
    organizationIds: [],
    articleMatch: 'equals',
    articleText: '',
    articleList: [],
    products: [],
    groups: [],
    productTops: [],
    measureUnitIds: [],
    filterRows: [],
    documentKinds: [],
    documentText: '',
    conditions: [],
    levels: capability.DefaultLevels.length ? [...capability.DefaultLevels] : ['warehouse', 'product', 'registrar'],
    measures: [...STOCK_MOVEMENT_MEASURES],
    grandTotals: true,
    negativeRed: true,
  }
}

export function parseArticleList(text: string): string[] {
  const seen = new Set<string>()
  return text.split(/[\n,;]+/).map(item => item.trim()).filter(item => {
    if (!item) return false
    const key = item.toLocaleLowerCase('uk')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function stockMovementFilterApplies(draft: StockMovementDraft, field: StockMovementFilterField): boolean {
  return !(draft.filterRows ?? []).some(row => row.field === field && !row.enabled)
}

export function clearStockMovementFilter(draft: StockMovementDraft, field: StockMovementFilterField): Partial<StockMovementDraft> {
  switch (field) {
    case 'organization': return { organizationIds: [] }
    case 'product': return { products: [] }
    case 'article': return { articleMatch: draft.articleMatch, articleText: '', articleList: [] }
    case 'top': return { productTops: [] }
    case 'group': return { groups: [] }
    case 'unit': return { measureUnitIds: [] }
    case 'warehouse': return { warehouseIds: [] }
    case 'documentKind': return { documentKinds: [] }
    case 'documentText': return { documentText: '' }
  }
}

function articleFilter(draft: StockMovementDraft): { match: StockMovementArticleMatch | ''; articles: string[] } {
  if (!stockMovementFilterApplies(draft, 'article')) return { match: '', articles: [] }
  if (draft.articleMatch === 'inList') {
    return draft.articleList.length ? { match: 'inList', articles: draft.articleList } : { match: '', articles: [] }
  }
  const text = draft.articleText.trim()
  return text ? { match: draft.articleMatch, articles: [text] } : { match: '', articles: [] }
}

type SelectionTreeNode = { Kind: number; Children?: SelectionTreeNode[]; SelectionIndex?: number }

export function stockMovementFilterActive(draft: StockMovementDraft, field: StockMovementFilterField): boolean {
  const request = buildStockMovementRequest({ ...draft, filterExpression: null })
  switch (field) {
    case 'organization': return request.OrganizationIds.length > 0
    case 'product': return request.ProductIds.length > 0
    case 'article': return request.ArticleMatch !== ''
    case 'top': return request.ProductTops.length > 0
    case 'group': return request.ProductGroupIds.length > 0
    case 'unit': return request.MeasureUnitIds.length > 0
    case 'warehouse': return request.WarehouseIds.length > 0
    case 'documentKind': return request.DocumentKinds.length > 0
    case 'documentText': return request.DocumentText !== null
  }
}

export function stockMovementFilterExpression(draft: StockMovementDraft): StockMovementFilterExpression | undefined {
  const root = draft.filterExpression?.Root as SelectionTreeNode | undefined
  if (!root) return undefined
  const rows = draft.filterRows ?? []
  function convert(node: SelectionTreeNode): StockMovementFilterNode | null {
    if (node.Kind === 3) {
      const field = node.SelectionIndex === undefined ? null : rows[node.SelectionIndex]?.field ?? null
      return field && stockMovementFilterActive(draft, field) ? { Kind: 3, Filter: field } : null
    }
    const children = (node.Children ?? []).flatMap(child => { const converted = convert(child); return converted ? [converted] : [] })
    return children.length ? { Kind: node.Kind === 2 ? 2 : 1, Children: children } : null
  }
  const converted = convert(root)
  return converted ? { Version: 1, Root: converted } : undefined
}

export function buildStockMovementRequest(draft: StockMovementDraft, offset = 0, limit = WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE): StockMovementRequest {
  const article = articleFilter(draft)
  const applies = (field: StockMovementFilterField) => stockMovementFilterApplies(draft, field)
  const ids = (field: StockMovementFilterField, values: readonly number[]) => applies(field) ? [...new Set(values)].sort((left, right) => left - right) : []
  const text = applies('documentText') ? draft.documentText.trim() : ''
  return {
    Version: 1,
    From: draft.from,
    To: draft.to,
    WarehouseIds: ids('warehouse', draft.warehouseIds),
    OrganizationIds: ids('organization', draft.organizationIds),
    ProductIds: ids('product', draft.products.map(item => item.id)),
    ArticleMatch: article.match,
    Articles: article.articles,
    ProductGroupIds: ids('group', draft.groups.map(item => item.id)),
    ProductTops: applies('top') ? [...new Set(draft.productTops ?? [])].sort() : [],
    MeasureUnitIds: ids('unit', draft.measureUnitIds ?? []),
    ...(draft.filterExpression ? (expression => expression ? { FilterExpression: expression } : {})(stockMovementFilterExpression(draft)) : {}),
    DocumentKinds: applies('documentKind') ? [...draft.documentKinds].sort() : [],
    DocumentText: text ? text : null,
    Conditions: draft.conditions.filter(condition => Number.isFinite(condition.Value)),
    Levels: [...draft.levels],
    Measures: STOCK_MOVEMENT_MEASURES.filter(measure => draft.measures.includes(measure)),
    GrandTotals: draft.grandTotals,
    NegativeRed: draft.negativeRed,
    Offset: offset,
    Limit: limit,
  }
}

export function stockMovementDraftError(draft: StockMovementDraft, capability: StockMovementCapability): string | null {
  if (!date(draft.from) || !date(draft.to)) return 'Вкажіть дати початку і кінця періоду.'
  if (draft.from < capability.MinimumFrom) return `Історія руху в GBA починається з ${displayDate(capability.MinimumFrom)}.`
  if (draft.to > capability.Today) return 'Дата кінця періоду не може бути пізнішою за сьогодні.'
  if (draft.from > draft.to) return 'Дата початку пізніша за дату кінця.'
  if (!draft.levels.length) return 'Оберіть хоча б одне групування рядків.'
  if (draft.levels.includes('registrar') && draft.levels[draft.levels.length - 1] !== 'registrar') return 'Документ руху може бути лише останнім групуванням.'
  const month = draft.levels.indexOf('month'), day = draft.levels.indexOf('day')
  if (month >= 0 && day >= 0 && day < month) return 'Групування за днем не може бути вищим за місяць.'
  if (!draft.measures.length) return 'Оберіть хоча б один показник.'
  if (draft.articleMatch === 'inList' && draft.articleList.length > 500) return 'Можна вказати до 500 артикулів.'
  if (draft.conditions.some(condition => !Number.isFinite(condition.Value))) return 'Вкажіть число в умові за показником.'
  if (draft.filterExpression) {
    const view = stockMovementExpressionView(draft, capability)
    return reportFilterExpressionError(view.data, view.dataset)
  }
  return null
}

export function stockMovementExpressionView(draft: StockMovementDraft, capability: StockMovementCapability) {
  const selections: ReportSelection[] = (draft.filterRows ?? []).map(row => {
    const definition = row.field ? STOCK_MOVEMENT_FILTER_DEFINITIONS[row.field] : null
    return {
      IsChecked: !!row.field && row.enabled && stockMovementFilterActive(draft, row.field),
      SelectedField: { Type: definition?.type ?? -1, Name: definition?.label ?? 'Поле не вибрано' },
      FilterCondition: { Type: 2, Name: definition?.condition ?? '' },
      Values: [],
    }
  })
  const cap = capability.FilterExpression
  const dataset = { Filters: [], FilterExpression: cap ? { Version: 1, MaximumDepth: cap.MaximumDepth, MaximumLeaves: cap.MaximumLeaves,
    MaximumNodes: 128, Operators: cap.Operators } : undefined } as unknown as ReportDataset
  const data = { selections, filterExpression: draft.filterExpression ?? undefined } as unknown as ReportRequestBody
  return { data, dataset }
}

export function moveLevel(levels: readonly StockMovementLevel[], level: StockMovementLevel, direction: -1 | 1): StockMovementLevel[] {
  const index = levels.indexOf(level), target = index + direction
  if (index < 0 || target < 0 || target >= levels.length) return [...levels]
  const next = [...levels]
  next[index] = next[target]
  next[target] = level
  return next
}

export function toggleLevel(levels: readonly StockMovementLevel[], level: StockMovementLevel, enabled: boolean): StockMovementLevel[] {
  if (!enabled) return levels.filter(item => item !== level)
  if (levels.includes(level)) return [...levels]
  const withoutRegistrar = levels.filter(item => item !== 'registrar')
  const next = level === 'registrar' ? [...withoutRegistrar, 'registrar' as const] : [...withoutRegistrar, level, ...(levels.includes('registrar') ? ['registrar' as const] : [])]
  return next
}

export function displayDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('.') : value
}

export function displayDateTime(value: string | null): string {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value) : null
  return match ? `${match[3]}.${match[2]}.${match[1]} ${match[4]}:${match[5]}` : value ?? ''
}

export function formatStockQuantity(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return ''
  const negative = value < 0
  const [integer, fraction = ''] = Math.abs(value).toFixed(8).split('.')
  const decimals = fraction.replace(/0+$/, '')
  return `${negative ? '-' : ''}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${decimals ? `,${decimals}` : ''}`
}

export function stockMovementPeriodPresets(today: string, minimum: string): { label: string; from: string; to: string }[] {
  const clamp = (value: string) => value < minimum ? minimum : value
  const month = `${today.slice(0, 7)}-01`
  const previousEnd = new Date(Date.parse(`${month}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const previousStart = `${previousEnd.slice(0, 7)}-01`
  return [
    { label: 'Уся історія GBA', from: minimum, to: today },
    { label: 'Поточний місяць', from: clamp(month), to: today },
    { label: 'Минулий місяць', from: clamp(previousStart), to: previousEnd < minimum ? minimum : previousEnd },
    { label: 'Поточний рік', from: clamp(`${today.slice(0, 4)}-01-01`), to: today },
  ]
}

export function summarizeStockMovementFilters(draft: StockMovementDraft, warehouses: readonly StockMovementLookupItem[],
  organizations: readonly StockMovementLookupItem[], kinds: readonly StockMovementDocumentKind[], units: readonly StockMovementLookupItem[] = []): string[] {
  const lines: string[] = []
  const request = buildStockMovementRequest(draft)
  const article = articleFilter(draft)
  if (request.OrganizationIds.length)
    lines.push(`Організація складу У списку (${request.OrganizationIds.map(id => organizations.find(item => item.Id === id)?.Name ?? `#${id}`).join('; ')})`)
  if (request.ProductIds.length) lines.push(`Номенклатура У списку (${draft.products.map(item => item.label).join('; ')})`)
  if (article.match) lines.push(`Номенклатура.Артикул ${STOCK_MOVEMENT_ARTICLE_LABELS[article.match]} ${article.articles.join('; ')}`)
  if (request.ProductTops.length) lines.push(`Топ У списку (${request.ProductTops.join('; ')})`)
  if (request.ProductGroupIds.length) lines.push(`Товарна група У групі (${draft.groups.map(item => item.label).join('; ')})`)
  if (request.MeasureUnitIds.length)
    lines.push(`Одиниця виміру У списку (${request.MeasureUnitIds.map(id => units.find(item => item.Id === id)?.Name ?? `#${id}`).join('; ')})`)
  if (request.WarehouseIds.length)
    lines.push(`Склад У списку (${request.WarehouseIds.map(id => warehouses.find(item => item.Id === id)?.Name ?? `#${id}`).join('; ')})`)
  if (request.DocumentKinds.length)
    lines.push(`Вид документа руху У списку (${request.DocumentKinds.map(code => kinds.find(kind => kind.Code === code)?.Name ?? code).join('; ')})`)
  if (request.DocumentText) lines.push(`Документ руху Містить ${request.DocumentText}`)
  for (const condition of draft.conditions)
    lines.push(`Кількість ${STOCK_MOVEMENT_MEASURE_LABELS[condition.Measure].toLocaleLowerCase('uk')} ${STOCK_MOVEMENT_COMPARISON_LABELS[condition.Comparison]} ${condition.Value}`)
  return lines
}
