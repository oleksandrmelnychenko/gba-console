import type { ReportCatalogueEntry } from '../types'
import { plannedPeriodError } from './originalPlannedCash'
export const cashDefinition = { source: '977cb58d-ff0b-46b7-90fd-124a560ec6ff', name: 'ВедомостьДенежныеСредства', definition: '51785ecc8fb8b57fb53b4728bc3a2552c3352d5f8d5c2549237f351a7bedbdcd',
  module: 'f1e5f0b3bf0c4145a6fc72aa8af48255af12bafb50574339cc11efb2706e939a' } as const
export const cashFields = ['BankAccountCash', 'CashKind', 'CashCurrency', 'Organization'] as const
export type CashField = typeof cashFields[number]
export const cashLabels: Record<CashField, string> = { BankAccountCash: 'Банківський рахунок / каса', CashKind: 'Вид коштів', CashCurrency: 'Валюта коштів', Organization: 'Організація' }
export const cashDefaultMeasures = ['Сумма', 'СуммаУпр'].flatMap(resource => ['НачальныйОстаток', 'Приход', 'Расход', 'КонечныйОстаток'].map(stage => resource + stage))
export const cashTurnoverMeasures = ['СуммаОборот', 'СуммаУпрОборот']
export type CashAccount = { Type: string; Table: string; Reference: string }
export type CashFilter = { Field: CashField; Reference: string; Type: string | null; Table: string | null }
export type CashCapability = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; CommonBuilderModuleSha256: string;
  Executable: boolean; DefaultRow: 'BankAccountCash'; FilterFields: CashField[]; DefaultMeasures: string[]; TurnoverMeasures: string[]; RequiresCompleteNormalInputs: true;
  PeriodPolicy: 'InclusiveCalendarWholeSeconds'; MoneyUnitPolicy: 'NativeStoredOwnAndManagementResourcesNoFx'; AppliesFxConversion: false; NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type CashRequest = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; From: string; Through: string; Filters: CashFilter[]; IncludeTurnover: boolean }
export type CashMeasure = { Opening: string; Incoming: string; Outgoing: string; Closing: string; Turnover: string }
export type CashAmounts = { Own: CashMeasure; Management: CashMeasure }
export type CashChoice = { Value: CashFilter; Caption: string; WitnessSha256: string }
export type CashRow = { Account: CashAccount; Caption: string | null; Amounts: CashAmounts }
export type CashResult = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; From: string; Through: string; Filters: CashFilter[]; IncludeTurnover: boolean;
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: CashRow[]; Totals: CashAmounts | null; Choices: CashChoice[]; MissingCaptionMappings: CashField[]; CurrencyAttributeScopeComplete: boolean;
  MoneyUnitPolicy: 'NativeStoredOwnAndManagementResourcesNoFx'; AppliesFxConversion: false; NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const hex = (v: unknown, width: number): v is string => typeof v === 'string' && new RegExp(`^[A-F0-9]{${width}}$`).test(v)
const field = (v: unknown): v is CashField => v === 'BankAccountCash' || v === 'CashKind' || v === 'CashCurrency' || v === 'Organization'
const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i])
const policy = (v: Record<string, unknown>) => v.MoneyUnitPolicy === 'NativeStoredOwnAndManagementResourcesNoFx' && v.AppliesFxConversion === false
  && v.NativeVirtualTableVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg') && v.SourceId === cashDefinition.source && v.DefinitionSha256 === cashDefinition.definition && policy(v)
export function isCashCapability(v: unknown): v is CashCapability {
  return object(v) && identity(v) && v.Executable === (v.World === 'fenix') && v.ModuleSha256 === cashDefinition.module
    && v.CommonBuilderModuleSha256 === 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17' && v.DefaultRow === 'BankAccountCash'
    && v.RequiresCompleteNormalInputs === true && v.PeriodPolicy === 'InclusiveCalendarWholeSeconds'
    && Array.isArray(v.FilterFields) && same(v.FilterFields, cashFields) && Array.isArray(v.DefaultMeasures) && same(v.DefaultMeasures, cashDefaultMeasures)
    && Array.isArray(v.TurnoverMeasures) && same(v.TurnoverMeasures, cashTurnoverMeasures)
}
export function cashCatalogueMatches(report: ReportCatalogueEntry, worlds: readonly string[]): boolean {
  return worlds.includes('fenix') && report.Id === `builtin:${cashDefinition.name}`
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === cashDefinition.source && source.DefinitionSha256 === cashDefinition.definition)
}
export const cashFilterKey = (v: CashFilter) => JSON.stringify([v.Field, v.Type, v.Table, v.Reference])
export const cashAccountKey = (v: CashAccount) => JSON.stringify([v.Type, v.Table, v.Reference])
function readFilter(v: unknown): CashFilter {
  if (!object(v) || !field(v.Field) || !hex(v.Reference, 32) || (v.Field === 'BankAccountCash' ? !hex(v.Type, 2) || !hex(v.Table, 8) : v.Type !== null || v.Table !== null)) throw invalid()
  return { Field: v.Field, Reference: v.Reference, Type: v.Type === null ? null : String(v.Type), Table: v.Table === null ? null : String(v.Table) }
}
export function cashRequest(capability: CashCapability, from: string, through: string, filters: readonly CashFilter[], turnover: boolean): CashRequest {
  if (!isCashCapability(capability) || !capability.Executable || plannedPeriodError(from, through) || filters.length > 256
    || new Set(filters.map(cashFilterKey)).size !== filters.length) throw invalid()
  return { Version: 1, World: capability.World, SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256, From: from, Through: through,
    Filters: filters.map(readFilter), IncludeTurnover: turnover }
}
export function cashCents(v: unknown): bigint {
  if (typeof v !== 'string' || v.length > 100 || !/^-?(0|[1-9]\d*)\.\d{2}$/.test(v) || v === '-0.00') throw invalid()
  return BigInt(v.replace('.', ''))
}
function readMeasure(v: unknown): CashMeasure {
  if (!object(v)) throw invalid()
  const opening = cashCents(v.Opening), incoming = cashCents(v.Incoming), outgoing = cashCents(v.Outgoing), closing = cashCents(v.Closing), turnover = cashCents(v.Turnover)
  if (closing !== opening + incoming - outgoing || turnover !== incoming - outgoing) throw invalid()
  return { Opening: String(v.Opening), Incoming: String(v.Incoming), Outgoing: String(v.Outgoing), Closing: String(v.Closing), Turnover: String(v.Turnover) }
}
function readAmounts(v: unknown): CashAmounts { if (!object(v)) throw invalid(); return { Own: readMeasure(v.Own), Management: readMeasure(v.Management) } }
function readChoices(values: unknown[]): CashChoice[] {
  const keys = new Set<string>()
  return values.map(v => {
    if (!object(v) || typeof v.Caption !== 'string' || !v.Caption.trim() || !hash(v.WitnessSha256)) throw invalid()
    const filter = readFilter(v.Value), key = cashFilterKey(filter)
    if (keys.has(key) || filter.Reference === '0'.repeat(32)) throw invalid(); keys.add(key)
    return { Value: filter, Caption: v.Caption, WitnessSha256: v.WitnessSha256 }
  })
}
const resultCodes = new Set(['OUR_complete', 'amg_normal_publication_unavailable', 'normal_storage_unavailable', 'opening_publication_unavailable', 'month_publication_unavailable', 'currency_attribute_unavailable', 'normal_journal_invalid', 'prefix_scope_exceeded', 'raw_visibility_unavailable', 'account_attribute_ambiguous', 'caption_ambiguous'].map(code => `original_cash_statement_${code}`))
const stages = ['Opening', 'Incoming', 'Outgoing', 'Closing', 'Turnover'] as const
const resources = ['Own', 'Management'] as const
function readRows(values: unknown[], choices: CashChoice[]): CashRow[] {
  const keys = new Set<string>(), captions = new Map(choices.filter(choice => choice.Value.Field === 'BankAccountCash').map(choice => [cashFilterKey(choice.Value), choice.Caption]))
  return values.map(v => {
    if (!object(v) || !object(v.Account) || !hex(v.Account.Type, 2) || !hex(v.Account.Table, 8) || !hex(v.Account.Reference, 32)
      || v.Caption !== null && (typeof v.Caption !== 'string' || !v.Caption.trim())) throw invalid()
    const account = { Type: v.Account.Type, Table: v.Account.Table, Reference: v.Account.Reference }, key = cashAccountKey(account)
    if (keys.has(key) || v.Caption !== null && captions.get(cashFilterKey({ Field: 'BankAccountCash', ...account })) !== v.Caption) throw invalid(); keys.add(key)
    return { Account: account, Caption: v.Caption, Amounts: readAmounts(v.Amounts) }
  })
}
/** One authenticated complete identity-bound calculation for screen and every export. No JS monetary Number conversion. */
export function normalizeCashResult(v: unknown, request: CashRequest): CashResult {
  if (!object(v) || !identity(v) || v.World !== request.World || v.SourceId !== request.SourceId || v.DefinitionSha256 !== request.DefinitionSha256 || v.From !== request.From || v.Through !== request.Through
    || v.IncludeTurnover !== request.IncludeTurnover || !Array.isArray(v.Filters) || v.Filters.length !== request.Filters.length || v.Filters.some((f, i) => cashFilterKey(readFilter(f)) !== cashFilterKey(request.Filters[i]))
    || typeof v.Available !== 'boolean' || typeof v.Code !== 'string' || !resultCodes.has(v.Code) || typeof v.NormalInputsComplete !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || typeof v.CurrencyAttributeScopeComplete !== 'boolean' || !Array.isArray(v.Rows) || !Array.isArray(v.Choices) || !Array.isArray(v.MissingCaptionMappings) || v.MissingCaptionMappings.some(f => !field(f))) throw invalid()
  const choices = readChoices(v.Choices), rows = readRows(v.Rows, choices), totals = v.Totals === null ? null : readAmounts(v.Totals)
  if (v.Available) {
    if (request.World !== 'fenix' || !v.NormalInputsComplete || !v.OurSnapshotVerified || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256)
      || v.Code !== 'original_cash_statement_OUR_complete'
      || request.Filters.some(f => f.Field === 'CashCurrency') && !v.CurrencyAttributeScopeComplete || (rows.length === 0) !== (totals === null)) throw invalid()
    if (totals && resources.some(resource => stages.some(stage => cashCents(totals[resource][stage]) !== rows.reduce((sum, row) => sum + cashCents(row.Amounts[resource][stage]), 0n)))) throw invalid()
  } else if (rows.length || choices.length || totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null) throw invalid()
  return { ...request, Available: v.Available, Code: v.Code, NormalInputsComplete: v.NormalInputsComplete, OurSnapshotVerified: v.OurSnapshotVerified,
    InputWitnessSha256: v.InputWitnessSha256 === null ? null : String(v.InputWitnessSha256), ResultSha256: v.ResultSha256 === null ? null : String(v.ResultSha256), Rows: rows, Totals: totals, Choices: choices,
    MissingCaptionMappings: v.MissingCaptionMappings.filter(field), CurrencyAttributeScopeComplete: v.CurrencyAttributeScopeComplete,
    MoneyUnitPolicy: 'NativeStoredOwnAndManagementResourcesNoFx', AppliesFxConversion: false, NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
function invalid() { return new Error('Сервер не підтвердив повну оригінальну відомість коштів.') }
