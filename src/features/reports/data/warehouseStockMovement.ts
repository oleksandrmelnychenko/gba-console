export const WAREHOUSE_STOCK_MOVEMENT_ROUTE = '/report/constructors/warehouse-stock-movement'
export const WAREHOUSE_STOCK_MOVEMENT_TITLE = 'Рух товару — залишки, прихід і розхід'
export const WAREHOUSE_STOCK_MOVEMENT_MIN_DATE = '2025-01-01'
export const WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE = 200

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

export type StockMovementDocumentKind = { Code: string; Name: string }
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
}
export type StockMovementLookupItem = { Id: number; Name: string; Detail: string | null }
export type StockMovementCondition = { Measure: StockMovementMeasure; Comparison: StockMovementComparison; Value: number }
export type StockMovementSelection = { id: number; label: string }

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

export type StockMovementQuantity = { Opening: number; Incoming: number; Outgoing: number; Closing: number }
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
}
export type StockMovementResult = {
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

export function normalizeStockMovementWire(value: unknown): unknown {
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
  return value as StockMovementCapability
}

export function normalizeStockMovementLookup(raw: unknown): StockMovementLookupItem[] {
  const value = normalizeStockMovementWire(raw)
  if (!Array.isArray(value) || !value.every(item => record(item) && count(item.Id) && typeof item.Name === 'string' && optionalText(item.Detail ?? null)))
    throw new Error('Сервер повернув некоректний перелік для відбору.')
  return value.map(item => ({ Id: (item as StockMovementLookupItem).Id, Name: (item as StockMovementLookupItem).Name, Detail: (item as StockMovementLookupItem).Detail ?? null }))
}

function quantity(value: unknown): value is StockMovementQuantity {
  return record(value) && finite(value.Opening) && finite(value.Incoming) && finite(value.Outgoing) && finite(value.Closing)
}

export function balances(quantity: StockMovementQuantity): boolean {
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
  return value as StockMovementResult
}

export function normalizeStockMovementExport(raw: unknown): StockMovementExport {
  const value = normalizeStockMovementWire(raw)
  if (!record(value) || typeof value.DocumentURL !== 'string' || !value.DocumentURL || typeof value.FileName !== 'string' || !count(value.TotalRows))
    throw new Error('Сервер не повернув файл Excel.')
  return { DocumentURL: value.DocumentURL, FileName: value.FileName, TotalRows: value.TotalRows }
}

export function defaultStockMovementDraft(capability: StockMovementCapability): StockMovementDraft {
  return {
    from: capability.MinimumFrom,
    to: capability.Today,
    warehouseIds: [],
    organizationIds: [],
    articleMatch: 'equals',
    articleText: '',
    articleList: [],
    products: [],
    groups: [],
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

export function articleFilter(draft: StockMovementDraft): { match: StockMovementArticleMatch | ''; articles: string[] } {
  if (draft.articleMatch === 'inList') {
    return draft.articleList.length ? { match: 'inList', articles: draft.articleList } : { match: '', articles: [] }
  }
  const text = draft.articleText.trim()
  return text ? { match: draft.articleMatch, articles: [text] } : { match: '', articles: [] }
}

export function buildStockMovementRequest(draft: StockMovementDraft, offset = 0, limit = WAREHOUSE_STOCK_MOVEMENT_PAGE_SIZE): StockMovementRequest {
  const article = articleFilter(draft)
  const text = draft.documentText.trim()
  return {
    Version: 1,
    From: draft.from,
    To: draft.to,
    WarehouseIds: [...new Set(draft.warehouseIds)].sort((left, right) => left - right),
    OrganizationIds: [...new Set(draft.organizationIds)].sort((left, right) => left - right),
    ProductIds: [...new Set(draft.products.map(item => item.id))].sort((left, right) => left - right),
    ArticleMatch: article.match,
    Articles: article.articles,
    ProductGroupIds: [...new Set(draft.groups.map(item => item.id))].sort((left, right) => left - right),
    DocumentKinds: [...draft.documentKinds].sort(),
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
  return null
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

export function formatStockQuantity(value: number): string {
  if (value === 0) return ''
  const negative = value < 0
  const [integer, fraction = ''] = Math.abs(value).toFixed(3).split('.')
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
  organizations: readonly StockMovementLookupItem[], kinds: readonly StockMovementDocumentKind[]): string[] {
  const lines: string[] = []
  const article = articleFilter(draft)
  if (article.match) lines.push(`Номенклатура.Артикул ${STOCK_MOVEMENT_ARTICLE_LABELS[article.match]} ${article.articles.join('; ')}`)
  if (draft.products.length) lines.push(`Номенклатура У списку (${draft.products.map(item => item.label).join('; ')})`)
  if (draft.groups.length) lines.push(`Група товарів У списку (${draft.groups.map(item => item.label).join('; ')})`)
  if (draft.warehouseIds.length)
    lines.push(`Склад У списку (${draft.warehouseIds.map(id => warehouses.find(item => item.Id === id)?.Name ?? `#${id}`).join('; ')})`)
  if (draft.organizationIds.length)
    lines.push(`Організація складу У списку (${draft.organizationIds.map(id => organizations.find(item => item.Id === id)?.Name ?? `#${id}`).join('; ')})`)
  if (draft.documentKinds.length)
    lines.push(`Вид документа руху У списку (${draft.documentKinds.map(code => kinds.find(kind => kind.Code === code)?.Name ?? code).join('; ')})`)
  if (draft.documentText.trim()) lines.push(`Документ руху Містить ${draft.documentText.trim()}`)
  for (const condition of draft.conditions)
    lines.push(`Кількість ${STOCK_MOVEMENT_MEASURE_LABELS[condition.Measure].toLocaleLowerCase('uk')} ${STOCK_MOVEMENT_COMPARISON_LABELS[condition.Comparison]} ${condition.Value}`)
  return lines
}
