import type { ReportCatalogueEntry } from '../types'
import { availabilityStages, readAvailabilityAmounts, sameAvailability, sumAvailability, type AvailabilityAmounts } from './originalCashAvailabilityMoney'
export const availabilityDefinition = { name: 'АнализДоступностиДенежныхСредств', source: '0742f621-fa58-46bb-9819-e4bc51a03f14', definition: '42a78845ce5e40bc90d9ce2f75c9b80cfbb3896f8955347aa17d34325072aeef', module: '7de4e0c7a605e68b7ea4175eba5b9bdc76faab5f0a9e5a6a7f3f2c4c8884ff1a' } as const
export const availabilityFields = ['Организация', 'ВидДенежныхСредств', 'БанковскийСчетКасса', 'ВалютаСчетаКассы'] as const
export type AvailabilityField = typeof availabilityFields[number]
export const availabilityLabels: Record<AvailabilityField, string> = { Организация: 'Організації', ВидДенежныхСредств: 'Види коштів', БанковскийСчетКасса: 'Банківські рахунки / каси', ВалютаСчетаКассы: 'Валюти рахунків / кас' }
export const availabilityOwnMeasures = ['ТекущийОстатокВВалютеДенСредств', 'СуммаКСписаниюВВалютеДенСредств', 'СуммаКПолучениюВВалютеДенСредств', 'СуммаВРезервеВВалютеДенСредств', 'СуммаСвободныйОстатокВВалютеДенСредств'] as const
export const availabilityManagementMeasures = ['ТекущийОстатокВУпрВалюте', 'СуммаКСписаниюВУпрВалюте', 'СуммаКПолучениюВУпрВалюте', 'СуммаВРезервеВУпрВалюте', 'СуммаСвободныйОстатокВУпрВалюте'] as const
export type AvailabilityFilter = { Field: AvailabilityField; Reference: string; Type: string | null; Table: string | null }
export type AvailabilityRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; DateKon: string; Filters: AvailabilityFilter[]; RowDimensions: AvailabilityField[]; IncludeManagement: boolean }
export type AvailabilityCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; Executable: boolean;
  EndpointPolicy: 'NativeBalanceBeforeExactDateKon_FxLatestAtOrBeforeDateKon'; FilterFields: AvailabilityField[]; DefaultFilters: AvailabilityField[]; DefaultRowDimensions: []; DefaultColumnDimensions: [];
  DefaultMeasures: string[]; ManagementMeasures: string[]; RequiresFourNormalFamilies: true; ManagementCurrencyPolicy: 'OrdinarySourceManagementCurrency_ExactOurMapping'; FxPolicy: 'StoredNormalizedCommercialCommonBaseHistory_ManualValuesPreserved';
  ExportUsesCompletedResult: true; NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type AvailabilityCurrency = { CurrencyId: number; NetUid: string; Code: string; SourceReference: string }
export type AvailabilityGrain = { Account: { Type: string; Table: string; Reference: string }; CashKind: string; Organization: string; CurrencyId: number; CurrencyNetUid: string; CurrencyCode: string; CurrencyReference: string }
export type AvailabilityRow = { Grain: AvailabilityGrain; Own: AvailabilityAmounts; Management: AvailabilityAmounts; UnavailableInputs: string[]; RawInputHashes: string[] }
export type AvailabilityTotal = { Amounts: AvailabilityAmounts; MixedOwnCurrencies: boolean; Currencies: AvailabilityCurrency[] }
export type AvailabilityChoice = { Value: AvailabilityFilter; Caption: string; WitnessSha256: string }
export type AvailabilityResult = AvailabilityRequest & { Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: AvailabilityRow[]; OwnTotals: AvailabilityTotal | null; ManagementTotals: AvailabilityTotal | null; Table: { Columns: string[]; Rows: (string | null)[][] }; Choices: AvailabilityChoice[];
  UnavailableInputs: string[]; MissingCaptionMappings: AvailabilityField[]; ManagementCurrencyId: number | null; ManagementCurrencySourceReference: string | null; CommonBaseCurrencyId: number | null; ManagementCurrency: AvailabilityCurrency | null;
  FullAccountMappingsComplete: boolean; UnselectedUnmappedGrains: number; NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const hex = (v: unknown, size: number): v is string => typeof v === 'string' && v.length === size && /^[0-9A-F]+$/.test(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) && v !== '0'.repeat(64)
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const guid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const field = (v: unknown): v is AvailabilityField => availabilityFields.includes(v as AvailabilityField)
const sameList = (v: unknown, wanted: readonly unknown[]) => Array.isArray(v) && v.length === wanted.length && v.every((item, index) => item === wanted[index])
const unaccepted = (v: Record<string, unknown>) => v.NativeVirtualTableVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === availabilityDefinition.source && v.DefinitionSha256 === availabilityDefinition.definition && unaccepted(v)
export const availabilityError = () => new Error('Сервер не підтвердив звіт доступних коштів.')
export function availabilityCatalogueMatches(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return worlds.includes('fenix') && report.Id === `builtin:${availabilityDefinition.name}` && report.Sources.some(s => s.World === 'fenix' && s.SourceId === availabilityDefinition.source && s.DefinitionSha256 === availabilityDefinition.definition)
}
export function isAvailabilityCapability(v: unknown): v is AvailabilityCapability {
  return record(v) && identity(v) && v.ModuleSha256 === availabilityDefinition.module && typeof v.Executable === 'boolean'
    && v.EndpointPolicy === 'NativeBalanceBeforeExactDateKon_FxLatestAtOrBeforeDateKon' && sameList(v.FilterFields, availabilityFields)
    && sameList(v.DefaultFilters, [availabilityFields[0], availabilityFields[2], availabilityFields[1]]) && sameList(v.DefaultRowDimensions, []) && sameList(v.DefaultColumnDimensions, [])
    && sameList(v.DefaultMeasures, availabilityOwnMeasures) && sameList(v.ManagementMeasures, availabilityManagementMeasures) && v.RequiresFourNormalFamilies === true
    && v.ManagementCurrencyPolicy === 'OrdinarySourceManagementCurrency_ExactOurMapping' && v.FxPolicy === 'StoredNormalizedCommercialCommonBaseHistory_ManualValuesPreserved' && v.ExportUsesCompletedResult === true
}
export function availabilityDateError(value: string): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!parts) return 'Оберіть точну дату й час із секундами.'
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number), leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year < 1900 || year >= 3999 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59 ? 'Некоректна дата або час.' : null
}
// datetime-local may omit explicitly zero seconds; this appends literal :00, never a timezone/day adjustment.
export const availabilityDateInput = (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v
export function readAvailabilityFilter(v: unknown): AvailabilityFilter {
  if (!record(v) || !field(v.Field) || !hex(v.Reference, 32)) throw availabilityError()
  if (v.Field === 'БанковскийСчетКасса') {
    if (v.Type !== '08' || !['0000000F', '00000038'].includes(String(v.Table))) throw availabilityError()
  } else if (v.Type !== null || v.Table !== null) throw availabilityError()
  return { Field: v.Field, Reference: v.Reference, Type: v.Type === null ? null : String(v.Type), Table: v.Table === null ? null : String(v.Table) }
}
export const availabilityFilterKey = (v: AvailabilityFilter) => JSON.stringify([v.Field, v.Type, v.Table, v.Reference])
export function availabilityRequest(capability: AvailabilityCapability, dateKon: string, filters: AvailabilityFilter[], dimensions: AvailabilityField[], management: boolean): AvailabilityRequest {
  if (!isAvailabilityCapability(capability) || !capability.Executable || availabilityDateError(dateKon) || filters.length > 256 || dimensions.length > 4
    || dimensions.some(v => !field(v)) || new Set(dimensions).size !== dimensions.length || new Set(filters.map(availabilityFilterKey)).size !== filters.length) throw availabilityError()
  return { Version: 1, World: 'fenix', SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256, DateKon: dateKon, Filters: filters.map(readAvailabilityFilter), RowDimensions: [...dimensions], IncludeManagement: management }
}
function strings(v: unknown): string[] { if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw availabilityError(); return v.slice() }
function readCurrency(v: unknown): AvailabilityCurrency {
  if (!record(v) || !id(v.CurrencyId) || !guid(v.NetUid) || typeof v.Code !== 'string' || !v.Code.trim() || v.Code !== v.Code.trim() || v.Code.length > 32 || /[\p{Cc}]/u.test(v.Code) || !hex(v.SourceReference, 32)) throw availabilityError()
  return { CurrencyId: v.CurrencyId, NetUid: v.NetUid, Code: v.Code, SourceReference: v.SourceReference }
}
function readGrain(v: unknown): AvailabilityGrain {
  if (!record(v) || !record(v.Account) || !hex(v.CashKind, 32) || !hex(v.Organization, 32) || !guid(v.CurrencyNetUid)) throw availabilityError()
  const account = readAvailabilityFilter({ ...v.Account, Field: 'БанковскийСчетКасса' }), currency = readCurrency({ CurrencyId: v.CurrencyId, NetUid: v.CurrencyNetUid, Code: v.CurrencyCode, SourceReference: v.CurrencyReference })
  return { Account: { Type: account.Type!, Table: account.Table!, Reference: account.Reference }, CashKind: v.CashKind, Organization: v.Organization, CurrencyId: currency.CurrencyId, CurrencyNetUid: currency.NetUid, CurrencyCode: currency.Code, CurrencyReference: currency.SourceReference }
}
export function availabilityGrainFilter(v: AvailabilityGrain, f: AvailabilityField): AvailabilityFilter {
  const refs = { Организация: v.Organization, ВидДенежныхСредств: v.CashKind, БанковскийСчетКасса: v.Account.Reference, ВалютаСчетаКассы: v.CurrencyReference }
  return { Field: f, Reference: refs[f], Type: f === 'БанковскийСчетКасса' ? v.Account.Type : null, Table: f === 'БанковскийСчетКасса' ? v.Account.Table : null }
}
function readRows(v: unknown): AvailabilityRow[] {
  if (!Array.isArray(v)) throw availabilityError()
  const keys = new Set<string>()
  return v.map(row => {
    if (!record(row)) throw availabilityError()
    const grain = readGrain(row.Grain), key = JSON.stringify(grain), raw = strings(row.RawInputHashes)
    if (keys.has(key) || raw.some(h => !hash(h))) throw availabilityError(); keys.add(key)
    return { Grain: grain, Own: readAvailabilityAmounts(row.Own), Management: readAvailabilityAmounts(row.Management), UnavailableInputs: strings(row.UnavailableInputs), RawInputHashes: raw }
  })
}
function readTotal(v: unknown): AvailabilityTotal | null {
  if (v === null) return null
  if (!record(v) || typeof v.MixedOwnCurrencies !== 'boolean' || !Array.isArray(v.Currencies)) throw availabilityError()
  return { Amounts: readAvailabilityAmounts(v.Amounts), MixedOwnCurrencies: v.MixedOwnCurrencies, Currencies: v.Currencies.map(readCurrency) }
}
function verifyTotal(total: AvailabilityTotal | null, rows: AvailabilityRow[], management: boolean) {
  if (!total) return
  const key = (v: AvailabilityCurrency) => JSON.stringify([v.CurrencyId, v.NetUid, v.Code, v.SourceReference])
  const currencies = new Set(rows.map(row => key({ CurrencyId: row.Grain.CurrencyId, NetUid: row.Grain.CurrencyNetUid, Code: row.Grain.CurrencyCode, SourceReference: row.Grain.CurrencyReference })))
  if (total.Currencies.length !== currencies.size || new Set(total.Currencies.map(key)).size !== currencies.size
    || total.Currencies.some(v => !currencies.has(key(v))) || total.MixedOwnCurrencies !== (!management && currencies.size > 1)) throw availabilityError()
  for (const stage of availabilityStages) {
    const values = rows.map(row => (management ? row.Management : row.Own)[stage]), actual = total.Amounts[stage]
    if (values.some(v => v === null)) { if (actual !== null) throw availabilityError() }
    else if (actual && !sameAvailability(actual, sumAvailability(values.filter(v => v !== null)))) throw availabilityError()
  }
}
function verifySelection(rows: AvailabilityRow[], request: AvailabilityRequest) {
  for (const row of rows) for (const f of availabilityFields) {
    const selected = request.Filters.filter(v => v.Field === f)
    if (selected.length && !selected.some(v => availabilityFilterKey(v) === availabilityFilterKey(availabilityGrainFilter(row.Grain, f)))) throw availabilityError()
  }
}
function verifyTable(table: AvailabilityResult['Table'], rows: AvailabilityRow[], own: AvailabilityTotal, management: AvailabilityTotal, choices: AvailabilityChoice[], request: AvailabilityRequest) {
  const names = new Map(choices.map(v => [availabilityFilterKey(v.Value), v.Caption])), groups = new Map<string, AvailabilityRow[]>()
  for (const row of rows) {
    const key = JSON.stringify(request.RowDimensions.map(f => availabilityGrainFilter(row.Grain, f)))
    const values = groups.get(key)
    if (values) values.push(row); else groups.set(key, [row])
  }
  const sum = (values: AvailabilityRow[], managed: boolean) => availabilityStages.map(stage => {
    const numbers = values.map(v => (managed ? v.Management : v.Own)[stage])
    return numbers.some(v => v === null) ? null : sumAvailability(numbers.filter(v => v !== null)).Display
  })
  const expected = request.RowDimensions.length === 0
    ? [[...availabilityStages.map(v => own.Amounts[v]?.Display ?? null), ...(request.IncludeManagement ? availabilityStages.map(v => management.Amounts[v]?.Display ?? null) : [])]]
    : [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, values]) => [
      ...request.RowDimensions.map(f => names.get(availabilityFilterKey(availabilityGrainFilter(values[0].Grain, f))) ?? null),
      ...sum(values, false), ...(request.IncludeManagement ? sum(values, true) : [])])
  if (table.Rows.length !== expected.length || table.Rows.some((row, i) => !sameList(row, expected[i]))) throw availabilityError()
}
function readChoices(v: unknown): AvailabilityChoice[] {
  if (!Array.isArray(v)) throw availabilityError()
  const keys = new Set<string>()
  return v.map(choice => {
    if (!record(choice) || typeof choice.Caption !== 'string' || !choice.Caption.trim() || !hash(choice.WitnessSha256)) throw availabilityError()
    const value = readAvailabilityFilter(choice.Value), key = availabilityFilterKey(value)
    if (keys.has(key)) throw availabilityError(); keys.add(key)
    return { Value: value, Caption: choice.Caption, WitnessSha256: choice.WitnessSha256 }
  })
}
function readTable(v: unknown, request: AvailabilityRequest) {
  const columns = [...request.RowDimensions, ...availabilityOwnMeasures, ...(request.IncludeManagement ? availabilityManagementMeasures : [])]
  if (!record(v) || !sameList(v.Columns, columns) || !Array.isArray(v.Rows)) throw availabilityError()
  const rows = v.Rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns.length) throw availabilityError()
    return row.map((cell, index) => {
      if (cell !== null && (typeof cell !== 'string' || index >= request.RowDimensions.length && (!/^-?(0|[1-9]\d*)\.\d{2}$/.test(cell) || cell === '-0.00'))) throw availabilityError()
      return cell as string | null
    })
  })
  return { Columns: columns, Rows: rows }
}
function verifyResponse(v: unknown, request: AvailabilityRequest): asserts v is Record<string, unknown> {
  if (!record(v) || !identity(v) || v.DateKon !== request.DateKon || v.IncludeManagement !== request.IncludeManagement || !sameList(v.RowDimensions, request.RowDimensions)
    || !Array.isArray(v.Filters) || v.Filters.length !== request.Filters.length || v.Filters.some((f, index) => availabilityFilterKey(readAvailabilityFilter(f)) !== availabilityFilterKey(request.Filters[index]))) throw availabilityError()
  for (const key of ['Available', 'NormalInputsComplete', 'OurSnapshotVerified', 'FullAccountMappingsComplete']) if (typeof v[key] !== 'boolean') throw availabilityError()
  if (typeof v.Code !== 'string' || !/^(normal_cash_|original_cash_availability_)[A-Za-z_]+$/.test(v.Code) || !Number.isSafeInteger(v.UnselectedUnmappedGrains) || Number(v.UnselectedUnmappedGrains) < 0) throw availabilityError()
}
export function normalizeAvailabilityResult(v: unknown, request: AvailabilityRequest): AvailabilityResult {
  verifyResponse(v, request)
  const rows = readRows(v.Rows), own = readTotal(v.OwnTotals), management = readTotal(v.ManagementTotals), choices = readChoices(v.Choices)
  const bound = v.ResultSha256 !== null
  if (v.InputWitnessSha256 !== null && !hash(v.InputWitnessSha256) || bound && (!hash(v.ResultSha256) || !hash(v.InputWitnessSha256) || !v.OurSnapshotVerified)) throw availabilityError()
  if (!bound && (rows.length || choices.length || own !== null || management !== null)) throw availabilityError()
  if (v.Available && (!bound || !v.NormalInputsComplete || !v.OurSnapshotVerified || v.Code !== 'original_cash_availability_OUR_complete' || !own?.Amounts.Free || request.IncludeManagement && !management?.Amounts.Free)) throw availabilityError()
  verifySelection(rows, request); verifyTotal(own, rows, false); verifyTotal(management, rows, true)
  const missing = strings(v.MissingCaptionMappings); if (missing.some(f => !field(f))) throw availabilityError()
  const table = bound ? readTable(v.Table, request) : { Columns: [], Rows: [] }
  if (!bound && (!record(v.Table) || !sameList(v.Table.Columns, []) || !sameList(v.Table.Rows, []))) throw availabilityError()
  if (bound) {
    if (own === null || management === null) throw availabilityError()
    verifyTable(table, rows, own, management, choices, request)
  }
  const managementCurrency = v.ManagementCurrency === null ? null : readCurrency(v.ManagementCurrency)
  const managementId = v.ManagementCurrencyId === null ? null : id(v.ManagementCurrencyId) ? v.ManagementCurrencyId : null
  if (v.ManagementCurrencyId !== null && managementId === null || v.CommonBaseCurrencyId !== null && !id(v.CommonBaseCurrencyId)
    || v.ManagementCurrencySourceReference !== null && !hex(v.ManagementCurrencySourceReference, 32)
    || managementCurrency && (managementCurrency.CurrencyId !== managementId || managementCurrency.SourceReference !== v.ManagementCurrencySourceReference)) throw availabilityError()
  return { ...request, Available: v.Available as boolean, Code: String(v.Code), NormalInputsComplete: v.NormalInputsComplete as boolean, OurSnapshotVerified: v.OurSnapshotVerified as boolean,
    InputWitnessSha256: v.InputWitnessSha256 as string | null, ResultSha256: v.ResultSha256 as string | null, Rows: rows, OwnTotals: own, ManagementTotals: management, Table: table, Choices: choices,
    UnavailableInputs: strings(v.UnavailableInputs), MissingCaptionMappings: missing as AvailabilityField[], ManagementCurrencyId: managementId,
    ManagementCurrencySourceReference: v.ManagementCurrencySourceReference as string | null, CommonBaseCurrencyId: v.CommonBaseCurrencyId as number | null, ManagementCurrency: managementCurrency,
    FullAccountMappingsComplete: v.FullAccountMappingsComplete as boolean, UnselectedUnmappedGrains: v.UnselectedUnmappedGrains as number,
    NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
