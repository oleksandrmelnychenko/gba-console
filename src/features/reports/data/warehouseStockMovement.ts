import { reportFilterExpressionError } from './reportFilterExpression'
import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { readPhysicalQuantityExceptions, type PhysicalQuantityException } from '../../../shared/ui/product-movement-history/physicalQuantityExceptions'
import { readPhysicalCoverage, type PhysicalCoverage } from '../../../shared/ui/product-movement-history/physicalCoverage'

export const WAREHOUSE_STOCK_MOVEMENT_ROUTE = '/report/constructors/warehouse-stock-movement'
export const WAREHOUSE_STOCK_MOVEMENT_TITLE = 'Рух товару — залишки, прихід і розхід'
export const WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE = 200
export const STOCK_MOVEMENT_UNCONFIRMED_TOTAL_NOTE = '«—» у підсумку: кількість частини руху не підтверджена партією, тому підсумок не визначено.'
export const STOCK_MOVEMENT_UNKNOWN_TOTAL_NOTE = '«—» у підсумку: значення не визначено.'
export const STOCK_MOVEMENT_UNCONFIRMED_CELL_NOTE = 'Кількість частини руху не підтверджена партією, тому значення не визначено.'
export const STOCK_MOVEMENT_UNKNOWN_CELL_NOTE = 'Значення не визначено.'

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
export const STOCK_MOVEMENT_ARTICLE_CONDITIONS: Record<StockMovementArticleMatch, string> = { equals: 'Рівне', contains: 'Містить', inList: 'В списку' }

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
  MaximumFilterRows?: number
  Notes: string[]
  FilterExpression?: StockMovementFilterExpressionCapability
}
export type StockMovementFilterExpressionCapability = { Version: 1; MaximumDepth: number; MaximumLeaves: number; Operators: Array<1 | 2> }
export type StockMovementFilterNode = { Kind: 1 | 2; Children: StockMovementFilterNode[] } | { Kind: 3; Filter: StockMovementFilterField } | { Kind: 3; SelectionIndex: number }
export type StockMovementFilterExpression = { Version: 1; Root: StockMovementFilterNode }
export type StockMovementLookupItem = { Id: number; Name: string; Detail: string | null }
type StockMovementCondition = { Measure: StockMovementMeasure; Comparison: StockMovementComparison; Value: number }
export type StockMovementSelection = { id: number; label: string }
export const STOCK_MOVEMENT_FILTER_FIELDS = ['organization', 'product', 'article', 'top', 'group', 'unit', 'warehouse', 'documentKind', 'documentText'] as const
export type StockMovementFilterField = typeof STOCK_MOVEMENT_FILTER_FIELDS[number]
export type StockMovementFilterRow = {
  id: number
  field: StockMovementFilterField | null
  enabled: boolean
  ids?: number[]
  items?: StockMovementSelection[]
  values?: string[]
  articleMatch?: StockMovementArticleMatch
  text?: string
}
export type StockMovementFilterWire = { Field: StockMovementFilterField; Ids?: number[]; Values?: string[]; ArticleMatch?: StockMovementArticleMatch; Text?: string; Row?: number }
export type StockMovementNames = { warehouses?: readonly StockMovementLookupItem[]; organizations?: readonly StockMovementLookupItem[]; units?: readonly StockMovementLookupItem[] }
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
  listed: boolean
  filterRows: StockMovementFilterRow[]
  filterExpression?: { Version: 1; Root: unknown } | null
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
  Filters?: StockMovementFilterWire[]
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
    || !count(value.MaximumLimit) || !strings(value.Notes) || (value.MaximumFilterRows != null && !count(value.MaximumFilterRows)))
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
    listed: stockMovementListedFilters(capability),
    filterRows: [],
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

export function stockMovementListedFilters(capability: StockMovementCapability): boolean {
  return (capability.MaximumFilterRows ?? 0) > 0
}

function articleOf(row: StockMovementFilterRow): { match: StockMovementArticleMatch; articles: string[] } | null {
  const match = row.articleMatch ?? 'equals'
  if (match === 'inList') {
    const articles = parseArticleList(row.text ?? '')
    return articles.length ? { match, articles } : null
  }
  const text = (row.text ?? '').trim()
  return text ? { match, articles: [text] } : null
}

const sortedIds = (values: readonly number[]) => [...new Set(values)].sort((left, right) => left - right)

export function stockMovementRowWire(row: StockMovementFilterRow): StockMovementFilterWire | null {
  if (!row.enabled || !row.field) return null
  const field = row.field
  switch (field) {
    case 'organization': case 'unit': case 'warehouse': {
      const ids = sortedIds(row.ids ?? [])
      return ids.length ? { Field: field, Ids: ids } : null
    }
    case 'product': case 'group': {
      const ids = sortedIds((row.items ?? []).map(item => item.id))
      return ids.length ? { Field: field, Ids: ids } : null
    }
    case 'top': case 'documentKind': {
      const values = [...new Set(row.values ?? [])].sort()
      return values.length ? { Field: field, Values: values } : null
    }
    case 'article': {
      const article = articleOf(row)
      return article ? { Field: field, ArticleMatch: article.match, Values: article.articles } : null
    }
    case 'documentText': {
      const text = (row.text ?? '').trim()
      return text ? { Field: field, Text: text } : null
    }
  }
}

export function stockMovementRowActive(row: StockMovementFilterRow): boolean {
  return stockMovementRowWire(row) !== null
}

export function copyStockMovementRow(row: StockMovementFilterRow, id: number): StockMovementFilterRow {
  return { ...row, id, ids: row.ids ? [...row.ids] : undefined, items: row.items ? row.items.map(item => ({ ...item })) : undefined,
    values: row.values ? [...row.values] : undefined }
}

type SelectionTreeNode = { Kind: number; Children?: SelectionTreeNode[]; SelectionIndex?: number }

export function stockMovementFilterExpression(draft: StockMovementDraft): StockMovementFilterExpression | undefined {
  const root = draft.filterExpression?.Root as SelectionTreeNode | undefined
  if (!root) return undefined
  const rows = draft.filterRows ?? []
  const positions = new Map<number, number>()
  rows.forEach((row, index) => { if (stockMovementRowActive(row)) positions.set(index, positions.size) })
  function convert(node: SelectionTreeNode): StockMovementFilterNode | null {
    if (node.Kind === 3) {
      if (node.SelectionIndex === undefined || !positions.has(node.SelectionIndex)) return null
      return draft.listed ? { Kind: 3, SelectionIndex: positions.get(node.SelectionIndex)! } : { Kind: 3, Filter: rows[node.SelectionIndex].field! }
    }
    const children = (node.Children ?? []).flatMap(child => { const converted = convert(child); return converted ? [converted] : [] })
    return children.length ? { Kind: node.Kind === 2 ? 2 : 1, Children: children } : null
  }
  const converted = convert(root)
  return converted ? { Version: 1, Root: converted } : undefined
}

function legacyFields(wires: readonly StockMovementFilterWire[]) {
  const first = (field: StockMovementFilterField) => wires.find(wire => wire.Field === field)
  const article = first('article')
  return {
    WarehouseIds: first('warehouse')?.Ids ?? [],
    OrganizationIds: first('organization')?.Ids ?? [],
    ProductIds: first('product')?.Ids ?? [],
    ArticleMatch: article?.ArticleMatch ?? '' as const,
    Articles: article?.Values ?? [],
    ProductGroupIds: first('group')?.Ids ?? [],
    ProductTops: first('top')?.Values ?? [],
    MeasureUnitIds: first('unit')?.Ids ?? [],
    DocumentKinds: first('documentKind')?.Values ?? [],
    DocumentText: first('documentText')?.Text ?? null,
  }
}

export function buildStockMovementRequest(draft: StockMovementDraft, offset = 0, limit = WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE): StockMovementRequest {
  const wires = (draft.filterRows ?? []).flatMap((row, index) => { const wire = stockMovementRowWire(row); return wire ? [{ ...wire, Row: index + 1 }] : [] })
  const legacy = legacyFields(draft.listed ? [] : wires)
  const expression = draft.filterExpression ? stockMovementFilterExpression(draft) : undefined
  return {
    Version: 1,
    From: draft.from,
    To: draft.to,
    WarehouseIds: legacy.WarehouseIds,
    OrganizationIds: legacy.OrganizationIds,
    ProductIds: legacy.ProductIds,
    ArticleMatch: legacy.ArticleMatch,
    Articles: legacy.Articles,
    ProductGroupIds: legacy.ProductGroupIds,
    ProductTops: legacy.ProductTops,
    MeasureUnitIds: legacy.MeasureUnitIds,
    ...(draft.listed && wires.length ? { Filters: wires } : {}),
    ...(expression ? { FilterExpression: expression } : {}),
    DocumentKinds: legacy.DocumentKinds,
    DocumentText: legacy.DocumentText,
    Conditions: draft.conditions.filter(condition => Number.isFinite(condition.Value)),
    Levels: [...draft.levels],
    Measures: STOCK_MOVEMENT_MEASURES.filter(measure => draft.measures.includes(measure)),
    GrandTotals: draft.grandTotals,
    NegativeRed: draft.negativeRed,
    Offset: offset,
    Limit: limit,
  }
}

export function stockMovementSearchKey(request: StockMovementRequest): string {
  const typed = (request.Filters ?? []).filter(wire => wire.Field === 'article' || wire.Field === 'documentText')
  return JSON.stringify([request.ArticleMatch, request.Articles, request.DocumentText, typed])
}

export function stockMovementTypedText(draft: StockMovementDraft): string {
  return JSON.stringify((draft.filterRows ?? []).filter(row => row.field === 'article' || row.field === 'documentText')
    .map(row => [row.id, row.field, row.articleMatch ?? '', row.text ?? '']))
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
  const rows = draft.filterRows ?? []
  const incomplete = rows.findIndex(row => row.enabled && !stockMovementRowActive(row))
  if (incomplete >= 0) {
    const field = rows[incomplete].field
    return field ? `Умова відбору №${incomplete + 1} (${STOCK_MOVEMENT_FILTER_DEFINITIONS[field].label}): додайте значення або зніміть галочку`
      : `Умова відбору №${incomplete + 1}: оберіть поле або зніміть галочку`
  }
  for (let index = 0; index < rows.length; index++) {
    const problem = stockMovementRowLimitError(rows[index])
    if (problem) return `Умова відбору №${index + 1}: ${problem}`
  }
  if (!draft.listed) {
    const repeated = rows.find((row, index) => row.field && rows.findIndex(other => other.field === row.field) !== index)
    if (repeated?.field) return `Поле «${STOCK_MOVEMENT_FILTER_DEFINITIONS[repeated.field].label}» можна вибрати лише один раз.`
  }
  if (draft.listed && capability.MaximumFilterRows && rows.filter(stockMovementRowActive).length > capability.MaximumFilterRows)
    return `Можна задати до ${capability.MaximumFilterRows} умов відбору.`
  if (draft.conditions.some(condition => !Number.isFinite(condition.Value))) return 'Вкажіть число в умові за показником.'
  if (draft.filterExpression) {
    const view = stockMovementExpressionView(draft, capability)
    return reportFilterExpressionError(view.data, view.dataset)
  }
  return null
}

const STOCK_MOVEMENT_ID_LIMITS: Partial<Record<StockMovementFilterField, [number, string]>> = {
  organization: [50, 'організацій'], product: [1000, 'товарів'], group: [100, 'груп товарів'], unit: [100, 'одиниць виміру'], warehouse: [500, 'складів'],
}

export function stockMovementRowLimitError(row: StockMovementFilterRow): string | null {
  const wire = stockMovementRowWire(row)
  if (!wire) return null
  const limit = STOCK_MOVEMENT_ID_LIMITS[wire.Field]
  if (limit && (wire.Ids?.length ?? 0) > limit[0]) return `можна вибрати до ${limit[0]} ${limit[1]}.`
  if (wire.Field === 'article') {
    if ((wire.Values?.length ?? 0) > 500) return 'можна вказати до 500 артикулів.'
    if (wire.Values?.some(value => value.length > 128)) return 'артикул не може бути довшим за 128 символів.'
  }
  if (wire.Field === 'top' && (wire.Values?.length ?? 0) > 100) return 'можна вибрати до 100 значень топу товару.'
  if (wire.Field === 'documentText' && (wire.Text?.length ?? 0) > 64) return 'текст документа не може бути довшим за 64 символи.'
  return null
}

function namesOf(items: readonly StockMovementLookupItem[] | undefined, ids: readonly number[]): string[] {
  return ids.map(id => items?.find(item => item.Id === id)?.Name ?? `#${id}`)
}

export function stockMovementRowCondition(row: StockMovementFilterRow): string {
  if (!row.field) return ''
  return row.field === 'article' ? STOCK_MOVEMENT_ARTICLE_CONDITIONS[row.articleMatch ?? 'equals'] : STOCK_MOVEMENT_FILTER_DEFINITIONS[row.field].condition
}

export function stockMovementRowValueNames(row: StockMovementFilterRow, capability: StockMovementCapability, names: StockMovementNames = {}): string[] {
  const wire = stockMovementRowWire({ ...row, enabled: true })
  if (!wire) return []
  switch (wire.Field) {
    case 'organization': return namesOf(names.organizations, wire.Ids ?? [])
    case 'warehouse': return namesOf(names.warehouses, wire.Ids ?? [])
    case 'unit': return namesOf(names.units, wire.Ids ?? [])
    case 'product': case 'group': return (row.items ?? []).map(item => item.label)
    case 'documentKind': return (wire.Values ?? []).map(code => capability.DocumentKinds.find(kind => kind.Code === code)?.Name ?? code)
    case 'documentText': return [wire.Text ?? '']
    default: return wire.Values ?? []
  }
}

export function stockMovementExpressionView(draft: StockMovementDraft, capability: StockMovementCapability, names: StockMovementNames = {}) {
  const selections: ReportSelection[] = (draft.filterRows ?? []).map(row => {
    const definition = row.field ? STOCK_MOVEMENT_FILTER_DEFINITIONS[row.field] : null
    return {
      IsChecked: stockMovementRowActive(row),
      SelectedField: { Type: definition?.type ?? -1, Name: definition?.label ?? 'Поле не вибрано' },
      FilterCondition: { Type: 2, Name: stockMovementRowCondition(row) },
      Values: stockMovementRowValueNames(row, capability, names).map((Name, index) => ({ Name, Value: index, Data: { Id: index } })),
    }
  })
  const cap = capability.FilterExpression
  const leaves = cap ? Math.min(64, Math.max(cap.MaximumLeaves, draft.listed ? capability.MaximumFilterRows ?? 0 : 0)) : 0
  const dataset = { Filters: [], FilterExpression: cap ? { Version: 1, MaximumDepth: cap.MaximumDepth, MaximumLeaves: leaves,
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
  const capability = { DocumentKinds: kinds } as StockMovementCapability
  const names = { warehouses, organizations, units }
  for (const row of draft.filterRows ?? []) {
    const wire = stockMovementRowWire(row)
    if (!wire) continue
    const values = stockMovementRowValueNames(row, capability, names).join('; ')
    switch (wire.Field) {
      case 'organization': lines.push(`Організація складу У списку (${values})`); break
      case 'product': lines.push(`Номенклатура У списку (${values})`); break
      case 'article': lines.push(`Номенклатура.Артикул ${STOCK_MOVEMENT_ARTICLE_LABELS[wire.ArticleMatch ?? 'equals']} ${values}`); break
      case 'top': lines.push(`Топ У списку (${values})`); break
      case 'group': lines.push(`Товарна група У групі (${values})`); break
      case 'unit': lines.push(`Одиниця виміру У списку (${values})`); break
      case 'warehouse': lines.push(`Склад У списку (${values})`); break
      case 'documentKind': lines.push(`Вид документа руху У списку (${values})`); break
      case 'documentText': lines.push(`Документ руху Містить ${values}`); break
    }
  }
  for (const condition of draft.conditions)
    lines.push(`Кількість ${STOCK_MOVEMENT_MEASURE_LABELS[condition.Measure].toLocaleLowerCase('uk')} ${STOCK_MOVEMENT_COMPARISON_LABELS[condition.Comparison]} ${condition.Value}`)
  return lines
}
