import type { ReportCatalogueEntry } from '../types'
import { businessDay, exactReportNumber, humanReportCaption, referenceSelection, wireExact, wireHash, wireObject, wireReference } from './originalDefaultReportValidation'

export const CLIENT_REPORT_SOURCE = 'fb9a5d53-8a42-4d2d-ab19-a58603d36bd9'
export const CLIENT_REPORT_DEFINITION = 'fd23adf25d791b4f155460692a76bf0c1fe08cc2370a9d56d17d91158027cd40'
export const clientFields = ['Организация', 'Контрагент', 'ДоговорКонтрагента'] as const
export type ClientField = typeof clientFields[number]
export const clientFieldLabels: Record<ClientField, string> = { Организация: 'Організації', Контрагент: 'Контрагенти', ДоговорКонтрагента: 'Договори' }
export const clientMeasures = ['СуммаНачальныйДолг', 'СуммаОплаченоДеб', 'СуммаПриход', 'СуммаРасход', 'КоличествоПриход', 'ЦенаПриход',
  'СуммаОплаченоКред', 'КоличествоРасход', 'ЦенаРасход', 'СуммаКонечныйДолг'] as const
export type ClientMeasure = typeof clientMeasures[number]
export const clientMeasureLabels = ['Початковий борг', 'Оплачено дебет', 'Прихід', 'Витрата', 'Кількість приходу', 'Ціна приходу',
  'Оплачено кредит', 'Кількість витрати', 'Ціна витрати', 'Кінцевий борг']
export type ClientValues = Record<ClientMeasure, string>
export type ClientSelection = Record<ClientField, string[]>
export type ClientChoice = { Key: string; Caption: string; CaptionAvailable: boolean }
export type ClientRow = ClientChoice & { Field: ClientField; Values: ClientValues; Children: ClientRow[] }
export type ClientCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  Executable: true; DefaultLayoutOnly: true; RequiresCompleteNormalInputs: true; RequiresAllParentSourceIdentities: true;
  DefaultRows: ClientField[]; Filters: ClientField[]; DefaultMeasures: ClientMeasure[]; MoneyPolicy: string; DatePolicy: string; ZeroRowPolicy: string;
  OptionalReportUnitResourcesImplemented: false; NativeDateParametersVerified: false; NativeVirtualZeroSuppressionVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type ClientRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Organizations: string[]; Counterparties: string[]; Agreements: string[] }
export type ClientResult = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string; Selectors: ClientSelection;
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: ClientRow[]; Totals: ClientValues | null; Choices: Partial<Record<ClientField, ClientChoice[]>>; MissingMonth: string | null;
  MoneyPolicy: string; ZeroRowPolicy: string; NativeDateParametersVerified: false; NativeVirtualZeroSuppressionVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export const emptyClientSelection = (): ClientSelection => ({ Организация: [], Контрагент: [], ДоговорКонтрагента: [] })
const moneyPolicy = 'SignedStoredManagementNetAndPaymentsNoVatAdditionOrFx'
const zeroPolicy = 'RetainedNormalContributionsNativeVirtualZeroSuppressionUnverified'
const identity = (value: Record<string, unknown>) => value.Version === 1 && value.World === 'fenix' && value.SourceId === CLIENT_REPORT_SOURCE && value.DefinitionSha256 === CLIENT_REPORT_DEFINITION
const limits = (value: Record<string, unknown>) => value.MoneyPolicy === moneyPolicy && value.ZeroRowPolicy === zeroPolicy && value.NativeDateParametersVerified === false
  && value.NativeVirtualZeroSuppressionVerified === false && value.SourceParityVerified === false && value.OriginalFullTaskAccepted === false
export function isClientCapability(value: unknown): value is ClientCapability {
  if (!wireObject(value) || !identity(value) || !limits(value)) return false
  return value.ModuleSha256 === '805274e8127587045902233f9478502fbef080a66b66313861ed48b48dd29d46'
    && value.QuerySha256 === '5d4d2d0965a86f558061510fdcdae7df9842b5e80b4d948b977eebec226c563f' && value.Executable === true && value.DefaultLayoutOnly === true
    && value.RequiresCompleteNormalInputs === true && value.RequiresAllParentSourceIdentities === true && wireExact(value.DefaultRows, clientFields)
    && wireExact(value.Filters, clientFields) && wireExact(value.DefaultMeasures, clientMeasures) && value.DatePolicy === 'DeclaredInclusiveBusinessDaysThroughLastWholeSecond'
    && value.OptionalReportUnitResourcesImplemented === false
}
export function clientPeriodError(from: string, through: string): string | null {
  const start = businessDay(from), end = businessDay(through)
  if (!start || !end || start > end || start.getUTCFullYear() < 2000 || end.getUTCFullYear() > 2099) return 'Оберіть коректні початок і кінець періоду.'
  const year = start.getUTCFullYear() + 1, month = start.getUTCMonth(), last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return end >= new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), last))) ? 'Період має бути коротшим за дванадцять місяців.' : null
}
export function clientRequest(capability: ClientCapability, from: string, through: string, selection = emptyClientSelection()): ClientRequest {
  if (!isClientCapability(capability) || clientPeriodError(from, through) || clientFields.some(field => selection[field].some(value => !keyFor(value, field)))) throw new Error('Некоректний запит звіту за клієнтами.')
  return { Version: 1, World: 'fenix', SourceId: CLIENT_REPORT_SOURCE, DefinitionSha256: CLIENT_REPORT_DEFINITION, From: from, Through: through,
    Organizations: referenceSelection(selection.Организация), Counterparties: referenceSelection(selection.Контрагент, true), Agreements: referenceSelection(selection.ДоговорКонтрагента) }
}
const keyFor = (value: unknown, field: ClientField): value is string => wireReference(value) || field === 'Контрагент' && value === 'NULL'
function choice(value: unknown, field: ClientField): value is ClientChoice {
  return wireObject(value) && keyFor(value.Key, field) && typeof value.CaptionAvailable === 'boolean'
    && (value.Key !== 'NULL' || value.CaptionAvailable === true && value.Caption === 'Не задано')
    && (value.CaptionAvailable ? humanReportCaption(value.Caption) : value.Caption === 'Назва недоступна')
}
function values(value: unknown): value is ClientValues {
  return wireObject(value) && Object.keys(value).length === 10 && clientMeasures.every(measure => exactReportNumber(value[measure], measure.startsWith('Количество') ? 3 : 2))
}
function completeChoices(value: Record<string, unknown>): value is Record<ClientField, ClientChoice[]> {
  return Object.keys(value).length === 3 && clientFields.every(field => {
    const items = value[field]
    return Array.isArray(items) && items.length <= 500_000 && items.every(item => choice(item, field)) && new Set(items.map(item => item.Key)).size === items.length
  })
}
function selectorsMatch(value: unknown, selection: ClientSelection): boolean {
  return wireObject(value) && Object.keys(value).length === 3 && clientFields.every(field => wireExact(value[field], selection[field]))
}
function zeroTotals(value: ClientValues): boolean {
  return clientMeasures.every(measure => value[measure] === (measure.startsWith('Количество') ? '0.000' : '0.00'))
}
function validRows(rows: unknown[], selection: ClientSelection, choices: Record<ClientField, ClientChoice[]>): boolean {
  const maps = Object.fromEntries(clientFields.map(field => [field, new Map(choices[field].map(item => [item.Key, item]))])) as Record<ClientField, Map<string, ClientChoice>>
  const selected = Object.fromEntries(clientFields.map(field => [field, new Set(selection[field])])) as Record<ClientField, Set<string>>
  let count = 0
  function level(items: unknown[], depth: number): boolean {
    const field = clientFields[depth], keys = new Set<string>()
    for (const item of items) {
      if (++count > 1_500_000 || !wireObject(item) || item.Field !== field || !choice(item, field) || keys.has(item.Key) || !values(item.Values)
        || !Array.isArray(item.Children) || selected[field].size && !selected[field].has(item.Key)) return false
      keys.add(item.Key)
      const named = maps[field].get(item.Key)
      if (!named || named.Caption !== item.Caption || named.CaptionAvailable !== item.CaptionAvailable) return false
      if (depth === 2 ? item.Children.length !== 0 : !item.Children.length || !level(item.Children, depth + 1)) return false
    }
    return true
  }
  return level(rows, 0)
}
export function normalizeClientResult(value: unknown, request: ClientRequest): ClientResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний звіт за клієнтами для цього періоду та відборів.') }
  const selection: ClientSelection = { Организация: request.Organizations, Контрагент: request.Counterparties, ДоговорКонтрагента: request.Agreements }
  if (!wireObject(value) || !identity(value) || !limits(value) || value.From !== request.From || value.Through !== request.Through || !selectorsMatch(value.Selectors, selection)
    || typeof value.Available !== 'boolean' || value.NormalInputsComplete !== value.Available || value.OurSnapshotVerified !== true
    || typeof value.Code !== 'string' || !value.Code.startsWith('original_client_report_') || !Array.isArray(value.Rows) || !wireObject(value.Choices)) return fail()
  if (!value.Available) {
    if (value.Rows.length || value.Totals !== null || value.InputWitnessSha256 !== null || value.ResultSha256 !== null || Object.keys(value.Choices).length
      || value.MissingMonth !== null && (typeof value.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.MissingMonth))) return fail()
    return value as unknown as ClientResult
  }
  if (!['original_client_report_declared_calendar_complete', 'original_client_report_declared_calendar_empty'].includes(value.Code) || value.MissingMonth !== null
    || !wireHash(value.InputWitnessSha256) || !wireHash(value.ResultSha256) || !values(value.Totals) || !completeChoices(value.Choices)
    || !validRows(value.Rows, selection, value.Choices) || !value.Rows.length && !zeroTotals(value.Totals)
    || value.Code !== `original_client_report_declared_calendar_${value.Rows.length ? 'complete' : 'empty'}`) return fail()
  return value as unknown as ClientResult
}
export function clientFieldSelectable(result: ClientResult | null, field: ClientField): boolean {
  const choices = result?.Choices[field]
  return !!result?.Available && !!choices?.length && choices.every(item => item.CaptionAvailable)
}
export function isClientReportCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ОтчетПоКлиентам' && worlds.includes('fenix')
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === CLIENT_REPORT_SOURCE && source.DefinitionSha256 === CLIENT_REPORT_DEFINITION)
}
