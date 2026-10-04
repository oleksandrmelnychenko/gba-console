import { readSettlementCounterpartyAttributes, type SettlementCounterpartyAttributes } from './settlementSourceAttributes'
import { readClientDiscountRegions, type ClientDiscountRegions } from './originalClientDiscounts'
import { CURRENT_VPARIVANIE_PRODUCT_FIELDS, CURRENT_VPARIVANIE_FULL_NOTE } from './currentVparivanie'
import { validateCurrentVparivanieColumns } from './currentVparivanieColumns'

export type NativeReportPreviewScalar = { Kind: string; Value: string | null; Provenance: string }
export type CurrentVparivanieProduct = { RowSourceIndex: number } & Record<typeof CURRENT_VPARIVANIE_PRODUCT_FIELDS[number], string | null>
export type CurrentVparivanieProducts = { Version: 1 | 2; ResultSha256: string; Rows: CurrentVparivanieProduct[] }
export type NativeReportPreviewAxis = { Ordinal: number; SourceIndex: number; Values: { Caption: string; Identity?: NativeReportPreviewScalar }[] }
export type NativeReportPreviewCell = { RowSourceIndex: number; ColumnSourceIndex: number; Value: NativeReportPreviewScalar }
export type NativeReportPreviewFilter = { Field: string; Condition: string; Values: string[]; IgnoredReason: string | null }
export type NativeReportPreviewRequest = {
  DataSource: string
  IsCurrentSnapshot: boolean
  ObservationStartedAtUtc: string | null
  ObservationCompletedAtUtc: string | null
  HasPeriod: boolean
  PeriodFrom: string | null
  PeriodTo: string | null
  ComparisonPeriodFrom: string | null
  ComparisonPeriodTo: string | null
  RowGroupings: string[] | null
  ColumnGroupings: string[] | null
  Measures: string[] | null
  Filters: NativeReportPreviewFilter[] | null
  IgnoredFilters: NativeReportPreviewFilter[] | null
  Notes: string[] | null
}
export type NativeReportPreview = {
  Version: number
  ResultSha256: string
  PresentationOnly: boolean
  Request: NativeReportPreviewRequest | null
  Page: { Offset: number; Limit: number; TotalVisibleRows: number; ReturnedRows: number; HasMore: boolean }
  RowSchema: { Caption: string }[]
  ColumnSchema: { Caption: string; Identity?: string; KeyKind?: string }[]
  Rows: NativeReportPreviewAxis[]
  Columns: NativeReportPreviewAxis[]
  Cells: NativeReportPreviewCell[]
  CurrentVparivanieProducts?: CurrentVparivanieProducts
  SettlementCounterpartyAttributes?: SettlementCounterpartyAttributes
  ClientDiscountRecipientRegions?: ClientDiscountRegions
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const boundedInteger = (value: unknown, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max
const scalar = (value: unknown): value is NativeReportPreviewScalar => record(value)
  && typeof value.Kind === 'string' && typeof value.Provenance === 'string'
  && (value.Value === null || typeof value.Value === 'string')

// Match NativeReportInlineProjector: one combined list budget, including
// filter entries and their values, and strict UTF-8 bytes for each string.
const maximumRequestItems = 4096
const maximumStringBytes = 65536
const utf8 = new TextEncoder()
function attributionText(value: unknown): string {
  if (typeof value !== 'string' || value.length > maximumStringBytes)
    throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
    }
  }
  if (utf8.encode(value).length > maximumStringBytes)
    throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
  return value
}

function normalizeRequest(value: unknown): NativeReportPreviewRequest | null {
  if (value === undefined || value === null) return null
  if (!record(value) || typeof value.IsCurrentSnapshot !== 'boolean' || typeof value.HasPeriod !== 'boolean')
    throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
  let items = 0
  const consume = (count: number) => {
    if (count > maximumRequestItems - items)
      throw new Error('Сервер перевищив межі опису розрахунку звіту.')
    items += count
  }
  const nullableText = (text: unknown) => text == null ? null : attributionText(text)
  const strings = (list: unknown): string[] | null => {
    if (list == null) return null
    if (!Array.isArray(list)) throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
    consume(list.length)
    return list.map(attributionText)
  }
  const filters = (list: unknown): NativeReportPreviewFilter[] | null => {
    if (list == null) return null
    if (!Array.isArray(list)) throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
    consume(list.length)
    return list.map(filter => {
      if (!record(filter) || !Array.isArray(filter.Values))
        throw new Error('Сервер повернув некоректний опис розрахунку звіту.')
      return { Field: attributionText(filter.Field), Condition: attributionText(filter.Condition),
        Values: strings(filter.Values)!, IgnoredReason: nullableText(filter.IgnoredReason) }
    })
  }
  return {
    DataSource: attributionText(value.DataSource), IsCurrentSnapshot: value.IsCurrentSnapshot,
    ObservationStartedAtUtc: nullableText(value.ObservationStartedAtUtc),
    ObservationCompletedAtUtc: nullableText(value.ObservationCompletedAtUtc), HasPeriod: value.HasPeriod,
    // These are server display strings (for example dd.MM.yyyy), not ISO dates.
    PeriodFrom: nullableText(value.PeriodFrom), PeriodTo: nullableText(value.PeriodTo),
    ComparisonPeriodFrom: nullableText(value.ComparisonPeriodFrom), ComparisonPeriodTo: nullableText(value.ComparisonPeriodTo),
    RowGroupings: strings(value.RowGroupings), ColumnGroupings: strings(value.ColumnGroupings),
    Measures: strings(value.Measures), Filters: filters(value.Filters), IgnoredFilters: filters(value.IgnoredFilters),
    Notes: strings(value.Notes),
  }
}

export function normalizeNativeReportPreview(response: unknown, fullCurrentVparivanie = false): NativeReportPreview {
  const preview = record(response) ? response.Preview : undefined
  if (!record(preview) || preview.Version !== 1 || preview.PresentationOnly !== true
    || typeof preview.ResultSha256 !== 'string' || !/^[a-f\d]{64}$/i.test(preview.ResultSha256)
    || !record(preview.Page) || !boundedInteger(preview.Page.Offset, 500000)
    || !boundedInteger(preview.Page.Limit, 50) || preview.Page.Limit === 0
    || !boundedInteger(preview.Page.TotalVisibleRows, 500000)
    || !boundedInteger(preview.Page.ReturnedRows, 50)
    || typeof preview.Page.HasMore !== 'boolean'
    || !Array.isArray(preview.RowSchema) || preview.RowSchema.length > 64
    || !preview.RowSchema.every(item => record(item) && typeof item.Caption === 'string')
    || !Array.isArray(preview.ColumnSchema) || preview.ColumnSchema.length > 66
    || !preview.ColumnSchema.every(item => record(item) && typeof item.Caption === 'string')
    || !Array.isArray(preview.Rows) || preview.Rows.length > 50
    || !Array.isArray(preview.Columns) || preview.Columns.length > 256
    || !Array.isArray(preview.Cells) || preview.Cells.length > 12800)
    throw new Error('Сервер повернув некоректний попередній перегляд звіту.')

  const axis = (item: unknown, max: number): item is NativeReportPreviewAxis => record(item)
    && boundedInteger(item.Ordinal, max) && boundedInteger(item.SourceIndex, 500000)
    && Array.isArray(item.Values) && item.Values.length <= 66
    && item.Values.every(value => record(value) && typeof value.Caption === 'string')
  const page = preview.Page as NativeReportPreview['Page']
  if (!preview.Rows.every(item => axis(item, 500000)) || !preview.Columns.every(item => axis(item, 256))
    || page.ReturnedRows !== preview.Rows.length
    || preview.Rows.some((row, index) => row.Ordinal !== page.Offset + index)
    || preview.Columns.some((column, index) => column.Ordinal !== index))
    throw new Error('Сервер повернув некоректні осі попереднього перегляду.')

  const rowIds = new Set(preview.Rows.map(row => row.SourceIndex))
  const columnIds = new Set(preview.Columns.map(column => column.SourceIndex))
  const coordinates = new Set<string>()
  for (const cell of preview.Cells) {
    if (!record(cell) || !boundedInteger(cell.RowSourceIndex, 500000) || !boundedInteger(cell.ColumnSourceIndex, 256)
      || !rowIds.has(cell.RowSourceIndex) || !columnIds.has(cell.ColumnSourceIndex) || !scalar(cell.Value))
      throw new Error('Сервер повернув некоректні клітинки попереднього перегляду.')
    const coordinate = `${cell.RowSourceIndex}:${cell.ColumnSourceIndex}`
    if (coordinates.has(coordinate)) throw new Error('Сервер повернув повторні клітинки попереднього перегляду.')
    coordinates.add(coordinate)
  }
  const request = normalizeRequest(preview.Request)
  const attributes = readSettlementCounterpartyAttributes(preview.SettlementCounterpartyAttributes,
    preview.ResultSha256 as string, (preview.Rows as NativeReportPreviewAxis[]).map(row => row.SourceIndex))
  if (attributes && (request?.DataSource !== 'NativeSettlementPeriod'
    || (preview.RowSchema as { Identity?: string }[]).at(-1)?.Identity !== 'SettlementCounterparty'))
    throw new Error('Реквізити покупця не відповідають набору взаєморозрахунків.')
  const regions = readClientDiscountRegions(preview.ClientDiscountRecipientRegions,
    preview.ResultSha256 as string, (preview.Rows as NativeReportPreviewAxis[]).map(row => row.SourceIndex))
  if (regions && (request?.DataSource !== 'NativeOneCClientDiscounts' || preview.RowSchema.length !== 1
    || (preview.RowSchema as { Identity?: string }[])[0]?.Identity !== 'OneCDiscountClient'))
    throw new Error('Код регіону не відповідає рядку одержувача знижки.')
  const productDisplay = normalizeCurrentVparivanieProducts(preview, request, fullCurrentVparivanie)
  return { ...preview, Request: request, ...(productDisplay ? { CurrentVparivanieProducts: productDisplay } : {}), ...(attributes ? { SettlementCounterpartyAttributes: attributes } : {}), ...(regions ? { ClientDiscountRecipientRegions: regions } : {}) } as NativeReportPreview
}

function normalizeCurrentVparivanieProducts(preview: Record<string, unknown>, request: NativeReportPreviewRequest | null, full: boolean): CurrentVparivanieProducts | undefined {
  const value = preview.CurrentVparivanieProducts
  const current = request?.DataSource === 'NativeCurrentVparivanie'
  if (!current && value === undefined && !full) return undefined
  const fail = () => { throw new Error('Сервер повернув непідтверджені атрибути товарів матриці «Впарювання».') }
  if (!current || !request.HasPeriod || request.IsCurrentSnapshot || !request.PeriodFrom || !request.PeriodTo
    || request.RowGroupings?.length !== 1 || request.ColumnGroupings?.length !== 2
    || request.Measures?.join(',') !== 'Результат'
    || !record(preview.Page) || !boundedInteger(preview.Page.TotalVisibleRows, full ? 500000 : 128)
    || !Array.isArray(preview.RowSchema) || preview.RowSchema.length !== 1 || preview.RowSchema[0]?.Identity !== 'Product'
    || !Array.isArray(preview.ColumnSchema) || preview.ColumnSchema.slice(0, 2).map(item => item.Identity).join(',') !== 'CurrentVparivanieGroup,CurrentVparivanieCounterparty'
    || !Array.isArray(preview.Columns) || new Set(preview.Columns.map(column => column.SourceIndex)).size !== preview.Columns.length
    || !record(value) || value.Version !== (full ? 2 : 1) || value.ResultSha256 !== preview.ResultSha256
    || !Array.isArray(value.Rows) || !Array.isArray(preview.Rows) || value.Rows.length !== preview.Rows.length) return fail()
  if (full && !request.Notes?.includes(CURRENT_VPARIVANIE_FULL_NOTE)) return fail()
  if (full && Number(preview.Page.TotalVisibleRows) * (7 + preview.Columns.length) > 1000000) return fail()
  validateCurrentVparivanieColumns(preview.ColumnSchema as NativeReportPreview['ColumnSchema'], preview.Columns as NativeReportPreviewAxis[])
  const rowIds = new Set((preview.Rows as NativeReportPreviewAxis[]).map(row => row.SourceIndex))
  const seen = new Set<number>()
  if (rowIds.size !== preview.Rows.length) return fail()
  const rows: CurrentVparivanieProduct[] = value.Rows.map(row => {
    if (!record(row) || !boundedInteger(row.RowSourceIndex, 500000) || !rowIds.has(row.RowSourceIndex) || seen.has(row.RowSourceIndex)
      || Object.keys(row).sort().join(',') !== ['RowSourceIndex', ...CURRENT_VPARIVANIE_PRODUCT_FIELDS].sort().join(',')) return fail()
    seen.add(row.RowSourceIndex)
    const display = Object.fromEntries(CURRENT_VPARIVANIE_PRODUCT_FIELDS.map(key => [key, row[key] === null ? null : attributionText(row[key])]))
    return { RowSourceIndex: row.RowSourceIndex, ...display } as CurrentVparivanieProduct
  })
  return { Version: full ? 2 : 1, ResultSha256: value.ResultSha256 as string, Rows: rows }
}

export function previewScalarText(value: NativeReportPreviewScalar | undefined): string {
  if (value === undefined) return '—'
  if (value.Kind === 'null') return '∅'
  return value.Value ?? '∅'
}
