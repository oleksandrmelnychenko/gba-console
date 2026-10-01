import type { ReportDataset, ReportRequestBody } from '../types'
import { groupedCashConfigurationError, groupedCashSupported, requestGroupedCashPeriod, GROUPED_CASH_FILTERS } from './groupedCashPeriod'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'

export const CASH_PERIOD_SOURCE = 40
export const CASH_PERIOD_TITLE = 'Кошти: залишки та рух за період'
export const CASH_PERIOD_ROWS = [43, 40, 42, 41] as const
export const CASH_PERIOD_MEASURES = [84, 85, 86, 87] as const
export const CASH_PERIOD_MANAGEMENT_MEASURES = [92, 93, 94, 95] as const
export const CASH_PERIOD_ALL_MEASURES = [...CASH_PERIOD_MEASURES, ...CASH_PERIOD_MANAGEMENT_MEASURES] as const

export type CashPeriodScope = {
  CurrencyRegisterId: string
  CurrencyRegisterNetUid: string
} & ({ Version: 1; CurrencyBasis: 'AccountCurrency' }
  | { Version: 2; CurrencyBasis: 'AccountAndManagementCurrency' })

export type CashPeriodLeg = {
  CurrencyRegisterId: string
  CurrencyRegisterNetUid: string
  AccountName: string
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
export function cashPeriodExactId(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value)) return null
  return BigInt(value) <= maxLong ? value : null
}

export function cashPeriodExactGuid(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)
    || /^0{8}-(?:0{4}-){3}0{12}$/.test(value)) return null
  return value.toLowerCase()
}

export function readCashPeriodScope(value: unknown): CashPeriodScope | null {
  if (!object(value) || sortedKeys(value) !== 'CurrencyBasis,CurrencyRegisterId,CurrencyRegisterNetUid,Version'
    || !((value.Version === 1 && value.CurrencyBasis === 'AccountCurrency')
      || (value.Version === 2 && value.CurrencyBasis === 'AccountAndManagementCurrency'))) return null
  const id = cashPeriodExactId(value.CurrencyRegisterId)
  const guid = cashPeriodExactGuid(value.CurrencyRegisterNetUid)
  if (!id || !guid) return null
  return value.Version === 2
    ? { Version: 2, CurrencyRegisterId: id, CurrencyRegisterNetUid: guid, CurrencyBasis: 'AccountAndManagementCurrency' }
    : { Version: 1, CurrencyRegisterId: id, CurrencyRegisterNetUid: guid, CurrencyBasis: 'AccountCurrency' }
}

export const cashPeriodMeasurements = (scope: CashPeriodScope | null | undefined): readonly number[] =>
  scope?.Version === 2 ? CASH_PERIOD_ALL_MEASURES : CASH_PERIOD_MEASURES

export function readCashPeriodLeg(value: unknown): CashPeriodLeg | null {
  if (!object(value) || sortedKeys(value) !== 'AccountName,CurrencyCode,CurrencyName,CurrencyRegisterId,CurrencyRegisterNetUid,OrganizationName') return null
  const id = cashPeriodExactId(value.CurrencyRegisterId)
  const guid = cashPeriodExactGuid(value.CurrencyRegisterNetUid)
  if (!id || !guid || !['AccountName', 'CurrencyName', 'CurrencyCode', 'OrganizationName'].every(key =>
    typeof value[key] === 'string') || !/^\d{3}$/.test(value.CurrencyCode as string)) return null
  return { CurrencyRegisterId: id, CurrencyRegisterNetUid: guid,
    AccountName: value.AccountName as string, CurrencyName: value.CurrencyName as string,
    CurrencyCode: value.CurrencyCode as string, OrganizationName: value.OrganizationName as string }
}

export function isCashPeriodCapability(value: unknown): boolean {
  return object(value) && value.MaximumDays === 31 && value.PeriodCalendar === 'Europe/Kyiv'
    && value.RequiresCurrencyRegisterNetUid === true
    && value.RequiresOneCompleteClosingDayGeneration === true
    && value.CurrentDaySupported === false
    && exact(value.FixedRowGroupings, CASH_PERIOD_ROWS)
    && ((value.Version === 1 && value.CurrencyBasis === 'AccountCurrency'
      && value.ManagementCurrencySupported === false && exact(value.FixedMeasurements, CASH_PERIOD_MEASURES))
      || (value.Version === 2 && value.CurrencyBasis === 'AccountAndManagementCurrency'
        && value.ManagementCurrencySupported === true && exact(value.FixedMeasurements, CASH_PERIOD_ALL_MEASURES)))
}

export function cashPeriodSupportsManagement(dataset: ReportDataset | undefined): boolean {
  return Boolean(dataset && isCashPeriodCapability(dataset.cashPeriod)
    && object(dataset.cashPeriod) && dataset.cashPeriod.Version === 2)
}

export function isCashPeriodDataset(dataset: ReportDataset): boolean {
  return dataset.DataSource === CASH_PERIOD_SOURCE && dataset.PeriodRequired === true
    && dataset.PeriodSupported === true && isCashPeriodCapability(dataset.cashPeriod)
    && exact(dataset.Groupings.map(item => item.Type), CASH_PERIOD_ROWS)
    && exact(dataset.Measurements.map(item => item.Type), cashPeriodSupportsManagement(dataset)
      ? CASH_PERIOD_ALL_MEASURES : CASH_PERIOD_MEASURES)
    && dataset.Groupings.every(item => item.Selectable !== false)
    && dataset.Measurements.every(item => item.Selectable !== false)
    && (groupedCashSupported(dataset) ? exact(dataset.Filters.map(item => item.Type), GROUPED_CASH_FILTERS)
      : dataset.Filters.length === 0)
}

function validDay(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 1900 || year > 7998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function previousKyivDay(todayKyiv: string): string {
  if (!validDay(todayKyiv)) return ''
  return new Date(Date.parse(`${todayKyiv}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

/** Client guard; the server remains final authority on a complete closing-day generation. */
export function cashPeriodConfigurationError(data: ReportRequestBody, dataset?: ReportDataset,
  todayKyiv?: string): string | null {
  const groupedError = groupedCashConfigurationError(data, dataset)
  if (groupedError) return groupedError
  const grouped = requestGroupedCashPeriod(data) != null
  if (data.dataSource !== CASH_PERIOD_SOURCE) return data.cashPeriod != null || data.CashPeriod != null || grouped
    ? 'Налаштування руху коштів застосовується лише до відповідного набору даних.' : null
  if (dataset && !isCashPeriodDataset(dataset)) return 'Сервер не підтвердив звіт руху коштів за рахунком.'
  if (!validDay(data.from) || !validDay(data.to) || data.from > data.to)
    return 'Оберіть коректний включний період руху коштів.'
  const today = todayKyiv ?? formatKyivBusinessDate()
  if (!validDay(today) || data.to >= today) return 'Звіт доступний лише за завершені дні Києва.'
  const days = (Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86_400_000 + 1
  if (days > 31) return 'Період руху коштів може охоплювати щонайбільше 31 день.'
  const scope = readCashPeriodScope(data.cashPeriod)
  if (!grouped && !scope) return 'Оберіть точний рахунок і його валюту зі списку GBA.'
  if (scope?.Version === 2 && dataset && !cashPeriodSupportsManagement(dataset))
    return 'Сервер ще не підтримує управлінські колонки руху коштів.'
  const allowed = new Set(['dataSource', 'from', 'to', 'sorted', 'selections', grouped ? 'groupedCashPeriod' : 'cashPeriod'])
  if (Object.entries(data).some(([key, value]) => !allowed.has(key) && !(grouped && key === 'GroupedCashPeriod') && value != null))
    return 'Для руху коштів недоступні додаткові відбори та перерахунок за поточним курсом.'
  if (!Array.isArray(data.selections) || !grouped && data.selections.length !== 0
    || !data.sorted || !exact(data.sorted.Row?.map(item => item.type), CASH_PERIOD_ROWS)
    || !Array.isArray(data.sorted.Col) || data.sorted.Col.length !== 0
    || !exact(data.sorted.Measurements?.map(item => item.Type), grouped ? CASH_PERIOD_ALL_MEASURES : cashPeriodMeasurements(scope))
    || data.sorted.Measurements.some(item => item.IsChecked === false))
    return 'Структура звіту руху коштів фіксована: організація → рахунок → запис → валюта рахунку, чотири або вісім показників відповідно до вибраних валют.'
  return null
}
