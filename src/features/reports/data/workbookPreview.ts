import { readCurrentProductPreview } from './currentProductFieldsPreview'
import { validFinancialAxes } from './financialAxes'
import { validCurrentFinancialAxes, usesCurrentFinancialAxes } from './currentFinancialAxes'
import { hasFinancialProductTimeAxes, validCurrentFinancialProductTimeAxes } from './currentFinancialProductTimeAxes'
import { validFinancialProductTimeIdentity } from './currentFinancialProductTimePreview'
import { hasFinancialDocumentAxes, validCurrentFinancialDocumentAxes } from './currentFinancialDocumentAxes'
import { validFinancialDocumentIdentity } from './currentFinancialDocumentPreview'
import type { NativeReportPreview } from './nativeReportPreview'
import { isCurrentProductVersion, readWorkbookSelection, sameWorkbookSelection, workbookSources, workbookText, workbookHasText,
  type WorkbookField, type WorkbookSelection } from './workbookPresentation'
import type { ReportRequestBody } from '../types'
import { requestWorkbookPresentation, workbookConfigurationError } from './workbookPresentation'

export type WorkbookReference = { id: string; netUid: string; caption: string | null }
export type WorkbookAttribute = { type: number; state: 'known' | 'mixed' | 'unavailable' | 'null'; values: string[]; inputSha256: string | null; references?: WorkbookReference[] }
export type WorkbookCurrency = { id: string; netUid: string; name: string | null; code: string | null; available: boolean }
export type WorkbookRow = { rowSourceIndex: number; rowKeySha256: string; values: WorkbookAttribute[]; currencyWitnesses: WorkbookCurrency[] }
export type WorkbookPreview = { version: 1 | 2 | 3 | 4; resultSha256: string; selection: WorkbookSelection; fields: WorkbookField[]; rows: WorkbookRow[] }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).sort().join(',') === [...names].sort().join(',')
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
const guid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value)
const fail = (): never => { throw new Error('Сервер повернув непідтверджені додаткові поля форми або прив’язку до результату.') }
const sources = new Map([['NativeDayOrganizationGrossProfit', 35], ['NativeCashPeriod', 40], ['NativeSettlementPeriod', 41]])

function currency(value: unknown): WorkbookCurrency {
  if (!record(value) || !keys(value, ['id', 'netUid', 'name', 'code', 'available'])
    || typeof value.id !== 'string' || !/^(?:0|-?[1-9]\d{0,18})$/.test(value.id)
    || BigInt(value.id) < -9223372036854775808n || BigInt(value.id) > 9223372036854775807n
    || !guid(value.netUid) || !(value.name === null || workbookText(value.name))
    || !(value.code === null || workbookText(value.code)) || typeof value.available !== 'boolean'
    || value.available && (BigInt(value.id) <= 0n || /^0{8}-(?:0{4}-){3}0{12}$/.test(value.netUid))) return fail()
  return { id: value.id, netUid: value.netUid, name: value.name, code: value.code, available: value.available }
}
function attribute(value: unknown): WorkbookAttribute {
  if (!record(value) || !keys(value, ['type', 'state', 'values', 'inputSha256']) || !Number.isSafeInteger(value.type)
    || !['known', 'mixed', 'unavailable', 'null'].includes(String(value.state)) || !Array.isArray(value.values)
    || !value.values.every(workbookText)
    || value.state === 'mixed' && ![30, 33].includes(value.type as number)
    || value.type === 33 && !value.values.every(caption => ['Банківський рахунок', 'Каса'].includes(caption))
    || value.state === 'known' && value.values.length !== 1 || value.state === 'mixed' && value.values.length === 0
    || (value.state === 'unavailable' || value.state === 'null') && value.values.length !== 0
    || !(value.inputSha256 === null || hash(value.inputSha256))) return fail()
  return { type: value.type as number, state: value.state as WorkbookAttribute['state'], values: [...value.values], inputSha256: value.inputSha256 }
}
/** Validate server attribution; typed server row hashes must never be recomputed from JavaScript numbers. */
export function readWorkbookPreview(raw: unknown, preview: NativeReportPreview): WorkbookPreview | undefined {
  if (raw === undefined || raw === null) return undefined
  if (record(raw) && isCurrentProductVersion(raw.version)) return readCurrentProductPreview(raw, preview)
  const source = sources.get(preview.Request?.DataSource ?? '')
  const expected = source === undefined ? undefined : workbookSources.get(source)
  if (!source || !expected || !record(raw) || !keys(raw, ['version', 'resultSha256', 'selection', 'fields', 'rows'])
    || raw.version !== 1 || raw.resultSha256 !== preview.ResultSha256 || !hash(raw.resultSha256)
    || new TextEncoder().encode(JSON.stringify(raw)).length > 1048576) return fail()
  const selected = record(raw.selection) && keys(raw.selection, ['version', 'additionalFields', 'ordering'])
    ? readWorkbookSelection(raw.selection) : null
  if (!selected || selected.version !== 1 || selected.additionalFields.some(type => !expected.some(field => field[0] === type))
    || selected.ordering !== null && source !== 35 || !Array.isArray(raw.fields)
    || raw.fields.length !== selected.additionalFields.length || !Array.isArray(raw.rows)) return fail()
  const fields: WorkbookField[] = raw.fields.map((field, index) => {
    if (!record(field) || !keys(field, ['type', 'caption', 'placement']) || field.type !== selected.additionalFields[index]
      || field.placement !== expected.find(item => item[0] === field.type)?.[1]
      || !workbookText(field.caption) || !workbookHasText(field.caption)) return fail()
    return { type: field.type as number, caption: field.caption, placement: field.placement as WorkbookField['placement'] }
  })
  if (source === 35) {
    const identities = preview.RowSchema.map(field => (field as { Identity?: string }).Identity)
    if (raw.rows.length !== 0 || identities.length < 1 || identities.length > 2
      || new Set(identities).size !== identities.length || identities.some(identity => !['Day', 'Organization'].includes(identity ?? '')
        && !(preview.Request?.ProfitReadMode === 0 && ['Year', 'Quarter', 'Month', 'Product', 'CustomerName', 'CustomerContract', 'CurrentFinancialDocument'].includes(identity ?? '')))) return fail()
  } else if (raw.rows.length !== preview.Rows.length || preview.SettlementCounterpartyAttributes
    || source === 40 && !['PaymentRegister', 'PaymentBalanceRecord']
      .includes(preview.RowSchema.map(field => (field as { Identity?: string }).Identity).join(','))
    || source === 41 && !['Organization,PaymentCurrency,SettlementCounterparty', 'Organization,SettlementCounterparty']
      .includes(preview.RowSchema.map(field => (field as { Identity?: string }).Identity).join(','))) return fail()
  const visible = new Set(preview.Rows.map(row => row.SourceIndex))
  const seen = new Set<number>()
  const rowHashes = new Set<string>()
  const rows: WorkbookRow[] = raw.rows.map((row, index) => {
    if (!record(row) || !keys(row, ['rowSourceIndex', 'rowKeySha256', 'values', 'currencyWitnesses'])
      || !Number.isSafeInteger(row.rowSourceIndex) || !visible.has(row.rowSourceIndex as number) || seen.has(row.rowSourceIndex as number)
      || !hash(row.rowKeySha256) || rowHashes.has(row.rowKeySha256) || !Array.isArray(row.values)
      || row.rowSourceIndex !== preview.Rows[index].SourceIndex
      || row.values.length !== fields.length || !Array.isArray(row.currencyWitnesses) || row.currencyWitnesses.length === 0) return fail()
    seen.add(row.rowSourceIndex as number)
    rowHashes.add(row.rowKeySha256)
    const values = row.values.map(attribute)
    const witnesses = row.currencyWitnesses.map(currency)
    if (values.some((item, index) => item.type !== fields[index].type || item.state === 'null' && ![60, 61].includes(item.type)
      || item.values.length > Math.max(2, witnesses.length)
      || [60, 61].includes(item.type) && item.inputSha256 === null
      || [30, 33].includes(item.type) && item.inputSha256 !== null)) return fail()
    validateCurrencyAttribution(values, witnesses)
    return { rowSourceIndex: row.rowSourceIndex as number, rowKeySha256: row.rowKeySha256, values, currencyWitnesses: witnesses }
  })
  return { version: 1, resultSha256: raw.resultSha256, selection: selected, fields, rows }
}

function validateCurrencyAttribution(values: WorkbookAttribute[], witnesses: WorkbookCurrency[]): void {
  const identity = new Set<string>()
  const complete = witnesses.length > 0 && witnesses.every(witness => {
    const key = `${witness.id}:${witness.netUid.toLowerCase()}`
    if (identity.has(key)) return false
    identity.add(key)
    return witness.available && (workbookHasText(witness.name) || workbookHasText(witness.code))
  })
  const value = values.find(item => item.type === 30)
  if (!value) return // The full witness remains retained even when Currency is unselected.
  const captions = witnesses.map(item => !workbookHasText(item.code) ? item.name! : !workbookHasText(item.name) || item.name === item.code
    ? item.code : `${item.name} (${item.code})`)
  const state = !complete ? 'unavailable' : identity.size === 1 ? 'known' : 'mixed'
  if (value.state !== state || JSON.stringify(value.values) !== JSON.stringify(complete ? captions : [])) fail()
}

export function bindWorkbookPreview(request: ReportRequestBody, preview: NativeReportPreview): void {
  const raw = requestWorkbookPresentation(request)
  const selection = raw == null ? null : readWorkbookSelection(raw)
  if (isCurrentProductVersion(selection?.version) && workbookConfigurationError(request)) fail()
  if (raw != null && selection === null || (selection === null) !== (preview.WorkbookPresentation === undefined)
    || selection && (!preview.WorkbookPresentation || !sameWorkbookSelection(selection, preview.WorkbookPresentation.selection))) fail()
}
export function workbookAttributeText(value?: WorkbookAttribute): string {
  if (!value || value.state === 'unavailable') return '—'
  if (value.state === 'null') return '∅'
  return `${value.state === 'mixed' ? 'Кілька значень: ' : ''}${value.values.join(', ')}`
}

/** Bind editable profit axes to request identities, never translated display captions. */
export function bindProfitPreviewGrouping(request: ReportRequestBody, preview: NativeReportPreview): void {
  if (request.dataSource !== 35 && request.dataSource !== 38) return
  const identities: Readonly<Record<number, string>> = request.dataSource === 35
    ? { 0: 'Year', 1: 'Quarter', 2: 'Month', 3: 'Day', 4: 'Organization', 5: 'Product', 12: 'CustomerName', 15: 'CustomerContract', 81: 'CurrentFinancialDocument' }
    : { 73: 'SourceReceiptStorage', 78: 'SourceRegistrarWarehouse', 4: 'Organization', 21: 'Supplier' }
  const expected = request.sorted.Row.map(row => identities[row.type])
  const actual = preview.RowSchema.map(field => (field as { Identity?: string }).Identity)
  const columns = request.sorted.Col.map(column => identities[column.type])
  const matrix = columns.length > 0
  const columnSchema = [...columns, '$measureGroup', '$measure']
  const validCurrentAxes = validCurrentFinancialAxes(request) || validCurrentFinancialProductTimeAxes(request) || validCurrentFinancialDocumentAxes(request)
  const invalidColumns = matrix && (request.dataSource !== 35 || !(validFinancialAxes(request) || validCurrentAxes)
    || preview.ColumnSchema.length !== columnSchema.length
    || preview.ColumnSchema.some((field, index) => field.Identity !== columnSchema[index])
    || preview.Columns.some(column => column.Values.length !== columnSchema.length
      || column.Values.some(value => !value.Identity || typeof value.Identity.Kind !== 'string'
        || typeof value.Identity.Provenance !== 'string' || !(value.Identity.Value === null || typeof value.Identity.Value === 'string'))
      || column.Values.at(-1)?.Identity?.Kind !== 'reportField'))
  const clientDimensions = [...request.sorted.Row, ...request.sorted.Col].some(field => field.type === 12 || field.type === 15)
  const validIdentity = (identity: NativeReportPreview['Rows'][number]['Values'][number]['Identity']) => !!identity
    && (identity.Kind === 'null' && identity.Value === null || identity.Kind === 'signedInteger'
      && typeof identity.Value === 'string' && /^[1-9]\d{0,18}$/.test(identity.Value) && BigInt(identity.Value) <= 9223372036854775807n)
  const invalidClientAxes = request.dataSource === 35 && clientDimensions && (!usesCurrentFinancialAxes(request)
    || !validCurrentAxes || preview.Request?.ProfitReadMode !== 0
    || preview.Rows.some(row => expected.some((identity, index) => ['CustomerName', 'CustomerContract'].includes(identity) && !validIdentity(row.Values[index]?.Identity)))
    || preview.Columns.some(column => columns.some((identity, index) => ['CustomerName', 'CustomerContract'].includes(identity) && !validIdentity(column.Values[index]?.Identity))))
  const invalidProductTimeAxes = hasFinancialProductTimeAxes(request) && (!validCurrentAxes
    || preview.Request?.ProfitReadMode !== 0
    || preview.Rows.some(row => request.sorted.Row.some((field, index) => [0, 1, 2, 5].includes(field.type)
      && !validFinancialProductTimeIdentity(field.type, row.Values[index]?.Identity)))
    || preview.Columns.some(column => request.sorted.Col.some((field, index) => [0, 1, 2, 5].includes(field.type)
      && !validFinancialProductTimeIdentity(field.type, column.Values[index]?.Identity))))
  const invalidDocumentAxes = hasFinancialDocumentAxes(request) && (!validCurrentFinancialDocumentAxes(request)
    || preview.Request?.ProfitReadMode !== 0
    || preview.Rows.some(row => request.sorted.Row.some((field, index) => field.type === 81
      && !validFinancialDocumentIdentity(row.Values[index]?.Identity)))
    || preview.Columns.some(column => request.sorted.Col.some((field, index) => field.type === 81
      && !validFinancialDocumentIdentity(column.Values[index]?.Identity))))
  if (invalidDocumentAxes || invalidProductTimeAxes || invalidClientAxes || preview.Request?.DataSource !== (request.dataSource === 35 ? 'NativeDayOrganizationGrossProfit' : 'NativeSupplierGrossProfit')
    || expected.length === 0 || expected.length > (request.dataSource === 35 ? 2 : 3) || expected.some(identity => !identity)
    || new Set(expected).size !== expected.length || invalidColumns
    || expected.includes('SourceReceiptStorage') && expected.includes('SourceRegistrarWarehouse')
    || actual.length !== expected.length || actual.some((identity, index) => identity !== expected[index])
    || preview.Rows.some(row => row.Values.length !== expected.length))
    throw new Error('Сервер повернув інше групування рядків прибутку, ніж було запитано.')
}
