import type { ReportDataset, ReportRequestBody } from '../types'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'

export const SETTLEMENT_PERIOD_SOURCE = 41
export const SETTLEMENT_PERIOD_TITLE = 'Взаєморозрахунки за договором: залишки та рух'
export const SETTLEMENT_PERIOD_ROWS = [4, 41, 76, 77] as const
export const SETTLEMENT_PERIOD_MEASURES = [88, 89, 90, 91] as const

export type SettlementSourceWorld = 'Fenix' | 'Amg'
export type SettlementNativeFamily = 'ClientAgreement' | 'SupplyOrganizationAgreement'
export const isSettlementWorld = (value: unknown): value is SettlementSourceWorld => value === 'Fenix' || value === 'Amg'
export const isSettlementFamily = (value: unknown): value is SettlementNativeFamily => value === 'ClientAgreement' || value === 'SupplyOrganizationAgreement'

export type SettlementPeriodScope = {
  Version: 1
  SourceWorld: SettlementSourceWorld
  NativeFamily: SettlementNativeFamily
  AgreementId: string
  AgreementNetUid: string
  CurrencyBasis: 'SettlementCurrency'
}

export type SettlementPeriodAgreement = {
  SourceWorld: SettlementSourceWorld
  NativeFamily: SettlementNativeFamily
  CounterpartyName: string
  AgreementId: string
  AgreementNetUid: string
  AgreementName: string
  CurrencyName: string
  CurrencyCode: string
  OrganizationName: string
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown, expected: readonly number[]) => Array.isArray(value)
  && value.length === expected.length && value.every((item, index) => item === expected[index])
const sortedKeys = (value: Record<string, unknown>) => Object.keys(value).sort().join(',')
const maxLong = 9223372036854775807n
export function settlementPeriodExactId(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value)) return null
  return BigInt(value) <= maxLong ? value : null
}

export function settlementPeriodExactGuid(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)
    || /^0{8}-(?:0{4}-){3}0{12}$/.test(value)) return null
  return value.toLowerCase()
}

export function readSettlementPeriodScope(value: unknown): SettlementPeriodScope | null {
  if (!object(value) || sortedKeys(value) !== 'AgreementId,AgreementNetUid,CurrencyBasis,NativeFamily,SourceWorld,Version'
    || value.Version !== 1 || value.CurrencyBasis !== 'SettlementCurrency'
    || !isSettlementWorld(value.SourceWorld) || !isSettlementFamily(value.NativeFamily)) return null
  const id = settlementPeriodExactId(value.AgreementId)
  const guid = settlementPeriodExactGuid(value.AgreementNetUid)
  return id && guid ? { Version: 1, SourceWorld: value.SourceWorld, NativeFamily: value.NativeFamily, AgreementId: id, AgreementNetUid: guid,
    CurrencyBasis: 'SettlementCurrency' } : null
}

export function readSettlementPeriodAgreement(value: unknown): SettlementPeriodAgreement | null {
  if (!object(value) || sortedKeys(value) !== 'AgreementId,AgreementName,AgreementNetUid,CounterpartyName,CurrencyCode,CurrencyName,NativeFamily,OrganizationName,SourceWorld'
    || !isSettlementWorld(value.SourceWorld) || !isSettlementFamily(value.NativeFamily)) return null
  const id = settlementPeriodExactId(value.AgreementId)
  const guid = settlementPeriodExactGuid(value.AgreementNetUid)
  const captions = ['AgreementName', 'CounterpartyName', 'CurrencyName', 'OrganizationName'] as const
  if (!id || !guid || !captions.every(key => value[key] === null || typeof value[key] === 'string')
    || typeof value.CurrencyCode !== 'string' || !/^\d{3}$/.test(value.CurrencyCode) || value.CurrencyCode === '000') return null
  return { SourceWorld: value.SourceWorld, NativeFamily: value.NativeFamily, AgreementId: id, AgreementNetUid: guid,
    AgreementName: value.AgreementName as string ?? '', CounterpartyName: value.CounterpartyName as string ?? '',
    CurrencyName: value.CurrencyName as string ?? '', OrganizationName: value.OrganizationName as string ?? '', CurrencyCode: value.CurrencyCode }
}

export function isSettlementPeriodCapability(value: unknown): boolean {
  return object(value) && value.Version === 1 && value.MaximumDays === 31
    && value.CurrencyBasis === 'SettlementCurrency' && value.PeriodCalendar === 'Europe/Kyiv'
    && value.RequiresAgreementNetUid === true
    && value.RequiresOneCompleteClosingDayGeneration === true
    && value.ManagementCurrencySupported === false && value.CurrentDaySupported === false
    && value.AllCounterpartiesSupported === false && value.NonDocumentAgreementsSupported === false
    && Array.isArray(value.SourceWorlds) && value.SourceWorlds.length === 2
    && value.SourceWorlds[0] === 'Fenix' && value.SourceWorlds[1] === 'Amg'
    && Array.isArray(value.NativeFamilies) && value.NativeFamilies.length === 2
    && value.NativeFamilies[0] === 'ClientAgreement' && value.NativeFamilies[1] === 'SupplyOrganizationAgreement'
    && exact(value.FixedRowGroupings, SETTLEMENT_PERIOD_ROWS)
    && exact(value.FixedMeasurements, SETTLEMENT_PERIOD_MEASURES)
}

export function isSettlementPeriodDataset(dataset: ReportDataset): boolean {
  return dataset.DataSource === SETTLEMENT_PERIOD_SOURCE && dataset.PeriodRequired === true
    && dataset.PeriodSupported === true && isSettlementPeriodCapability(dataset.settlementPeriod)
    && exact(dataset.Groupings.map(item => item.Type), SETTLEMENT_PERIOD_ROWS)
    && exact(dataset.Measurements.map(item => item.Type), SETTLEMENT_PERIOD_MEASURES)
    && dataset.Groupings.every(item => item.Selectable !== false)
    && dataset.Measurements.every(item => item.Selectable !== false)
    && dataset.Filters.length === 0
}

function validDay(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 1900 || year > 7998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validSettlementPeriodDays(from: string, to: string, todayKyiv = formatKyivBusinessDate()): boolean {
  if (!validDay(from) || !validDay(to) || !validDay(todayKyiv) || from > to || to >= todayKyiv) return false
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 < 31
}

/** Client guard; the server remains final authority on a complete closing-day generation. */
export function settlementPeriodConfigurationError(data: ReportRequestBody, dataset?: ReportDataset,
  todayKyiv?: string): string | null {
  if (data.dataSource !== SETTLEMENT_PERIOD_SOURCE) return data.settlementPeriod != null || data.SettlementPeriod != null
    ? 'Налаштування взаєморозрахунків застосовується лише до відповідного набору даних.' : null
  if (dataset && !isSettlementPeriodDataset(dataset)) return 'Сервер не підтвердив звіт взаєморозрахунків за договором.'
  if (!validDay(data.from) || !validDay(data.to) || data.from > data.to)
    return 'Оберіть коректний включний період взаєморозрахунків.'
  const today = todayKyiv ?? formatKyivBusinessDate()
  if (!validDay(today) || data.to >= today) return 'Звіт доступний лише за завершені дні Києва.'
  const days = (Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86_400_000 + 1
  if (days > 31) return 'Період взаєморозрахунків може охоплювати щонайбільше 31 день.'
  if (!readSettlementPeriodScope(data.settlementPeriod)) return 'Оберіть базу, тип і точний договір зі списку GBA.'
  const allowed = new Set(['dataSource', 'from', 'to', 'sorted', 'selections', 'settlementPeriod'])
  if (Object.entries(data).some(([key, value]) => !allowed.has(key) && value != null))
    return 'Для взаєморозрахунків недоступні додаткові відбори, FX, управлінська валюта й перетворення.'
  if (!Array.isArray(data.selections) || data.selections.length !== 0
    || !data.sorted || !exact(data.sorted.Row?.map(item => item.type), SETTLEMENT_PERIOD_ROWS)
    || !Array.isArray(data.sorted.Col) || data.sorted.Col.length !== 0
    || !exact(data.sorted.Measurements?.map(item => item.Type), SETTLEMENT_PERIOD_MEASURES)
    || data.sorted.Measurements.some(item => item.IsChecked === false))
    return 'Структура звіту фіксована: організація → валюта → контрагент → договір, чотири показники.'
  return null
}
