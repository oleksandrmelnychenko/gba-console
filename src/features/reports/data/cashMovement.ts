import type { ReportCatalogueEntry } from '../types'

export type CashMovementKind = 'receipts' | 'payouts'
export const CASH_MOVEMENT_DEFINITIONS = {
  receipts: { SourceIdentity: { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfe606a8c1461',
    DefinitionSha256: '4392a6c757f89cc9652b6ff3c63396049aedf5a87d4f4dc75ea32a61780f7b91' },
    Title: 'Поступления денежных средств', Periodicity: 'Quarter', Route: '/report/constructors/cash-receipts/current-quarter' },
  payouts: { SourceIdentity: { World: 'fenix', SourceId: '0xb4b500055d78a52511ddfe606a8c1463',
    DefinitionSha256: 'd68b8a9a78d9f0d8279944693d8fd5c482fad426d4594c54d663cc9dc895f19b' },
    Title: 'Выплаты денежных средств', Periodicity: 'Month', Route: '/report/constructors/cash-payouts/current-month' },
} as const
export const CASH_MOVEMENT_INPUT_BASIS = 'GBA: complete normal cash movement months; signed management amount'
export const CASH_MOVEMENT_PRESENTATION_BASIS = 'GBA current periods; original DEFAULT columns; percent format2'
export const CASH_MOVEMENT_COLUMNS = [
  { Key: 'ТекущееЗначение', Caption: 'Текущее значение', DecimalPlaces: null },
  { Key: 'ПредыдущееЗначение', Caption: 'Значение предыдущего периода', DecimalPlaces: null },
  { Key: 'UserFields.field1', Caption: 'Изменение %', DecimalPlaces: 2 },
  { Key: 'UserFields.field2', Caption: 'Изменение (абс)', DecimalPlaces: null },
] as const
export const CASH_MOVEMENT_UNSUPPORTED_FILTERS = ['Cfo', 'AccountCurrency', 'CashKind', 'CashFlowArticle', 'Project',
  'Counterparty', 'Agreement', 'Deal', 'BankAccount'] as const
export type CashMovementIdentity = typeof CASH_MOVEMENT_DEFINITIONS[CashMovementKind]['SourceIdentity']
export type CashMovementCapabilities = {
  Version: 1; SourceIdentity: CashMovementIdentity; Title: string; Executable: boolean; Periodicity: 'Quarter' | 'Month'
  Columns: Array<typeof CASH_MOVEMENT_COLUMNS[number]>; Filters: Array<'Quarter' | 'Month'>; UnsupportedFilters: string[]
  CfoAvailable: false; AccountCurrencyAvailable: false; InputBasis: typeof CASH_MOVEMENT_INPUT_BASIS
  PresentationBasis: typeof CASH_MOVEMENT_PRESENTATION_BASIS; EffectiveSourcePeriodsVerified: false; SourceParityVerified: false
}
export type CashMovementRequest = { Version: 1; SourceIdentity: CashMovementIdentity; Period: string }
export type CashMovementCell = { Key: typeof CASH_MOVEMENT_COLUMNS[number]['Key']; Available: boolean; Value: string | null; FormattedValue: string | null }
export type CashMovementMonth = { Month: string; RunId: string | null; Available: boolean; PhysicalRows: number; ActiveRows: number; IncludedRows: number; Code: string }
export type CashMovementCurrency = {
  Available: boolean; Code: string; SourceCurrencyRRef: string | null; SourceCurrencyCode: string | null; SourceCurrencyMarked: string | null
  Currency: { Id: string; NetUid: string; Code: string; Name: string } | null
}
export type CashMovementInput = { Available: boolean; Code: string; Publication: {
  CompletePublication: boolean; Code: string; Months: CashMovementMonth[]; ManagementCurrency: CashMovementCurrency
} }
export type CashMovementRow = { GroupKey: string; NameAvailable: boolean; Name: string | null; Cells: CashMovementCell[]; Complete: boolean }
export type CashMovementReport = {
  Version: 1; SourceIdentity: CashMovementIdentity; Period: string; Periodicity: 'Quarter' | 'Month'
  CurrentPeriod: { From: string; ThroughExclusive: string }; PreviousPeriod: { From: string; ThroughExclusive: string }
  Columns: Array<typeof CASH_MOVEMENT_COLUMNS[number]>; Rows: CashMovementRow[]; Totals: CashMovementCell[]
  Inputs: { Current: CashMovementInput; Previous: CashMovementInput }; Complete: boolean; HasRows: boolean
  Code: 'available' | 'query_empty' | 'query_input_unavailable' | 'decimal_projection_unavailable'
  InputBasis: typeof CASH_MOVEMENT_INPUT_BASIS; PresentationBasis: typeof CASH_MOVEMENT_PRESENTATION_BASIS
  CfoAvailable: false; AccountCurrencyAvailable: false; EffectiveSourcePeriodsVerified: false; SourceParityVerified: false
  ObservationStartedAtUtc: string; ObservationCompletedAtUtc: string; RequestSha256: string; ResultSha256: string
  DocumentURL: string; PdfDocumentURL: string
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const code = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const decimal = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d+)?$/.test(value)
function identity(value: unknown, kind: CashMovementKind): boolean {
  return record(value) && Object.entries(CASH_MOVEMENT_DEFINITIONS[kind].SourceIdentity).every(([key, expected]) => value[key] === expected)
}
function columns(value: unknown): boolean {
  return Array.isArray(value) && value.length === 4 && value.every((column, index) => record(column)
    && Object.entries(CASH_MOVEMENT_COLUMNS[index]).every(([key, expected]) => column[key] === expected))
}
function basis(value: Record<string, unknown>): boolean {
  return value.InputBasis === CASH_MOVEMENT_INPUT_BASIS && value.PresentationBasis === CASH_MOVEMENT_PRESENTATION_BASIS
    && value.CfoAvailable === false && value.AccountCurrencyAvailable === false
    && value.EffectiveSourcePeriodsVerified === false && value.SourceParityVerified === false
}
export function cashMovementKind(value: Pick<CashMovementCapabilities, 'SourceIdentity'>): CashMovementKind | null {
  return identity(value.SourceIdentity, 'receipts') ? 'receipts' : identity(value.SourceIdentity, 'payouts') ? 'payouts' : null
}
export function cashMovementCatalogueKind(report: ReportCatalogueEntry): CashMovementKind | null {
  for (const kind of ['receipts', 'payouts'] as const) {
    const source = CASH_MOVEMENT_DEFINITIONS[kind].SourceIdentity
    const matches = report.Sources.filter(item => item.World === source.World && item.SourceId === source.SourceId)
    if (report.Id === `custom:fenix:${source.SourceId}` && matches.length === 1
      && (matches[0].DefinitionSha256 === null || matches[0].DefinitionSha256 === source.DefinitionSha256)) return kind
  }
  return null
}
export function isCashMovementCapabilities(value: unknown, expectedKind?: CashMovementKind): value is CashMovementCapabilities {
  if (!record(value) || value.Version !== 1 || !basis(value) || !columns(value.Columns)
    || typeof value.Executable !== 'boolean') return false
  const kind = identity(value.SourceIdentity, 'receipts') ? 'receipts' : identity(value.SourceIdentity, 'payouts') ? 'payouts' : null
  if (!kind || expectedKind && kind !== expectedKind) return false
  const definition = CASH_MOVEMENT_DEFINITIONS[kind]
  return value.Title === definition.Title && value.Periodicity === definition.Periodicity
    && Array.isArray(value.Filters) && value.Filters.length === 1 && value.Filters[0] === definition.Periodicity
    && Array.isArray(value.UnsupportedFilters) && value.UnsupportedFilters.length === CASH_MOVEMENT_UNSUPPORTED_FILTERS.length
    && value.UnsupportedFilters.every((item, index) => item === CASH_MOVEMENT_UNSUPPORTED_FILTERS[index])
}
export function cashMovementPeriodError(kind: CashMovementKind, period: string): string | null {
  const valid = kind === 'receipts' ? /^\d{4}-Q[1-4]$/.test(period) : /^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)
  const lower = kind === 'receipts' ? '0001-Q1' : '0001-01', upper = kind === 'receipts' ? '7999-Q4' : '7999-12'
  return !valid || period <= lower || period >= upper ? 'Оберіть допустимий квартал або місяць із попереднім періодом.' : null
}
export function initialCashMovementPeriod(kind: CashMovementKind, month: string): string {
  return kind === 'receipts' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)
    ? `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5)) - 1) / 3) + 1}` : month
}
/** Calendar-only scope; monetary values always come from the server. */
export function cashMovementPeriods(kind: CashMovementKind, period: string): Pick<CashMovementReport, 'CurrentPeriod' | 'PreviousPeriod'> {
  if (cashMovementPeriodError(kind, period)) throw new Error('Некоректний період руху коштів.')
  const months = kind === 'receipts' ? 3 : 1, year = Number(period.slice(0, 4))
  const month = kind === 'receipts' ? (Number(period.slice(6)) - 1) * 3 + 1 : Number(period.slice(5))
  const shifted = (offset: number) => {
    const index = year * 12 + month - 1 + offset
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01T00:00:00`
  }
  return { CurrentPeriod: { From: shifted(0), ThroughExclusive: shifted(months) }, PreviousPeriod: { From: shifted(-months), ThroughExclusive: shifted(0) } }
}
export function createCashMovementRequest(capability: CashMovementCapabilities, period: string): CashMovementRequest {
  if (!isCashMovementCapabilities(capability) || !capability.Executable) throw new Error('Сервер не підтвердив доступність цього конструктора.')
  const kind = cashMovementKind(capability)!
  const error = cashMovementPeriodError(kind, period)
  if (error) throw new Error(error)
  return { Version: 1, SourceIdentity: { ...CASH_MOVEMENT_DEFINITIONS[kind].SourceIdentity }, Period: period }
}
function currency(value: unknown): value is CashMovementCurrency {
  if (!record(value) || typeof value.Available !== 'boolean' || !code(value.Code)
    || ![value.SourceCurrencyRRef, value.SourceCurrencyCode, value.SourceCurrencyMarked].every(item => item === null || typeof item === 'string')) return false
  const mapped = record(value.Currency) && typeof value.Currency.Id === 'string' && /^[1-9]\d*$/.test(value.Currency.Id)
    && guid(value.Currency.NetUid) && value.Currency.Code === value.SourceCurrencyCode && typeof value.Currency.Name === 'string'
  if (!value.Available) return value.Currency === null || mapped
  return typeof value.SourceCurrencyRRef === 'string' && /^[0-9A-F]{32}$/.test(value.SourceCurrencyRRef)
    && value.SourceCurrencyRRef !== '0'.repeat(32) && typeof value.SourceCurrencyCode === 'string' && /^\d{3}$/.test(value.SourceCurrencyCode)
    && (value.SourceCurrencyMarked === '00' || value.SourceCurrencyMarked === '01') && mapped
}
function monthsFor(from: string, through: string): string[] {
  const begin = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1
  const end = Number(through.slice(0, 4)) * 12 + Number(through.slice(5, 7)) - 1
  return Array.from({ length: end - begin }, (_, index) => `${String(Math.floor((begin + index) / 12)).padStart(4, '0')}-${String((begin + index) % 12 + 1).padStart(2, '0')}`)
}
function input(value: unknown, period: CashMovementReport['CurrentPeriod']): value is CashMovementInput {
  if (!record(value) || typeof value.Available !== 'boolean' || !code(value.Code) || !record(value.Publication)) return false
  const publication = value.Publication
  if (typeof publication.CompletePublication !== 'boolean' || !code(publication.Code) || !currency(publication.ManagementCurrency)
    || !Array.isArray(publication.Months)) return false
  const expected = monthsFor(period.From, period.ThroughExclusive)
  const months = publication.Months
  return months.length === expected.length && months.every((month, index) => record(month) && month.Month === expected[index]
    && typeof month.Available === 'boolean' && code(month.Code) && (month.RunId === null || guid(month.RunId))
    && [month.PhysicalRows, month.ActiveRows, month.IncludedRows].every(count)
    && (month.PhysicalRows as number) >= (month.ActiveRows as number) && (month.ActiveRows as number) >= (month.IncludedRows as number)
    && (!month.Available || guid(month.RunId)))
    && publication.CompletePublication === months.every(month => (month as CashMovementMonth).Available)
    && (!value.Available || publication.CompletePublication)
}
function cells(value: unknown): value is CashMovementCell[] {
  return Array.isArray(value) && value.length === 4 && value.every((cell, index) => {
    if (!record(cell) || cell.Key !== CASH_MOVEMENT_COLUMNS[index].Key || typeof cell.Available !== 'boolean') return false
    if (!cell.Available) return cell.Value === null && cell.FormattedValue === null
    if (cell.Value === null) return index < 2 && cell.FormattedValue === null
    return decimal(cell.Value) && decimal(cell.FormattedValue) && (index !== 2 || /^-?\d+\.\d{2}$/.test(cell.FormattedValue))
  })
}
function row(value: unknown): value is CashMovementRow {
  return record(value) && hash(value.GroupKey) && typeof value.NameAvailable === 'boolean'
    && (value.NameAvailable ? typeof value.Name === 'string' && value.Name.trim().length > 0 : value.Name === null)
    && typeof value.Complete === 'boolean' && cells(value.Cells)
}
function utc(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value) && Number.isFinite(Date.parse(value))
}
export function normalizeCashMovementReport(value: unknown, request: CashMovementRequest): CashMovementReport {
  const kind = cashMovementKind(request)
  if (!kind) throw new Error('Некоректна форма руху коштів.')
  const periods = cashMovementPeriods(kind, request.Period)
  if (!record(value) || value.Version !== 1 || !identity(value.SourceIdentity, kind) || value.Period !== request.Period
    || value.Periodicity !== CASH_MOVEMENT_DEFINITIONS[kind].Periodicity || !columns(value.Columns) || !basis(value)
    || !record(value.CurrentPeriod) || !record(value.PreviousPeriod)
    || !Object.entries(periods.CurrentPeriod).every(([key, expected]) => value.CurrentPeriod && (value.CurrentPeriod as Record<string, unknown>)[key] === expected)
    || !Object.entries(periods.PreviousPeriod).every(([key, expected]) => value.PreviousPeriod && (value.PreviousPeriod as Record<string, unknown>)[key] === expected)
    || !record(value.Inputs) || !input(value.Inputs.Current, periods.CurrentPeriod) || !input(value.Inputs.Previous, periods.PreviousPeriod)
    || !Array.isArray(value.Rows) || value.Rows.length > 200000 || !value.Rows.every(row) || !cells(value.Totals)
    || new Set(value.Rows.map(item => (item as CashMovementRow).GroupKey)).size !== value.Rows.length
    || typeof value.Complete !== 'boolean' || typeof value.HasRows !== 'boolean'
    || !utc(value.ObservationStartedAtUtc) || !utc(value.ObservationCompletedAtUtc)
    || Date.parse(value.ObservationCompletedAtUtc) < Date.parse(value.ObservationStartedAtUtc)
    || !hash(value.RequestSha256) || !hash(value.ResultSha256) || typeof value.DocumentURL !== 'string' || typeof value.PdfDocumentURL !== 'string') throw invalidResult()
  const result = value as unknown as CashMovementReport
  const current = result.Inputs.Current, previous = result.Inputs.Previous
  const included = (period: CashMovementInput) => period.Publication.Months.reduce((sum, month) => sum + month.IncludedRows, 0)
  const currentRows = current.Available ? included(current) : 0, previousRows = previous.Available ? included(previous) : 0
  if (currentRows + previousRows > 200000 || result.HasRows !== (result.Rows.length !== 0)
    || result.HasRows !== (currentRows + previousRows > 0) || result.Complete !== (current.Available && previous.Available)
    || result.Rows.some(item => item.Complete !== result.Complete)) throw invalidResult()
  for (const [index, period] of [current, previous].entries()) {
    const cell = result.Totals[index]
    if (!period.Available && cell.Available || period.Available && included(period) === 0 && (!cell.Available || cell.Value !== null)
      || period.Available && included(period) > 0 && cell.Available && cell.Value === null) throw invalidResult()
  }
  const unavailable = [...result.Totals, ...result.Rows.flatMap(item => item.Cells)].some(cell => !cell.Available)
  const expectedCode = !result.Complete ? 'query_input_unavailable' : !result.HasRows ? 'query_empty' : unavailable ? 'decimal_projection_unavailable' : 'available'
  if (result.Code !== expectedCode) throw invalidResult()
  return result
}
function invalidResult() { return new Error('Сервер повернув некоректний результат руху коштів або іншу форму чи період.') }
