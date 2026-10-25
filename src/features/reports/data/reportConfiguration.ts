import { presentationCurrencyError } from './reportPresentationCurrency'
import { financialAxesConfigurationError, requestFinancialAxesCapability } from './financialAxes'
import { currentVparivanieAnalysisCapability, requestCurrentVparivanieAnalysis } from './currentVparivanieAnalysis'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import type { ReportDataset, ReportRequestBody } from '../types'
import { hasFixedReportAxes } from './nativeReportProfiles'

export type ReportConfiguration = {
  version: 1; axisMode: 'flexible' | 'rowsOnly' | 'fixedLayouts' | 'profitRows'
  allowedRows: number[]; allowedColumns: number[]; maximumColumns?: number; maximumTotalDimensions?: number; filters?: number[]; minimumRows: number; maximumRows: number
  allowRowReorder: boolean; rowLayouts: number[][]; columnLayouts: number[][]; mutuallyExclusiveRows: number[][]
  period: { required: boolean; supported: boolean; maximumDays: number | null; maximumMonths: number | null; minimumDate: string | null; maximumDate?: string | null; endDatePolicy?: 'unrestricted' | 'beforeKyivToday' | 'throughKyivToday'; inclusiveEnd?: boolean }
  variants: Array<Partial<Omit<ReportConfiguration, 'variants'>> & { key: string; filters?: number[] }>
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const ints = (value: unknown): value is number[] => Array.isArray(value) && value.every(Number.isInteger) && new Set(value).size === value.length
const layouts = (value: unknown): value is number[][] => Array.isArray(value) && value.every(ints)
export function readReportConfiguration(value: unknown): ReportConfiguration | undefined {
  if (!record(value) || value.version !== 1 || !['flexible', 'rowsOnly', 'fixedLayouts', 'profitRows'].includes(value.axisMode as string)
    || !ints(value.allowedRows) || !ints(value.allowedColumns) || !Number.isInteger(value.minimumRows)
    || !Number.isInteger(value.maximumRows) || (value.minimumRows as number) < 0 || (value.maximumRows as number) < (value.minimumRows as number)
    || typeof value.allowRowReorder !== 'boolean' || !layouts(value.rowLayouts) || !layouts(value.columnLayouts)
    || !layouts(value.mutuallyExclusiveRows) || !record(value.period) || typeof value.period.required !== 'boolean'
    || typeof value.period.supported !== 'boolean' || !Array.isArray(value.variants)
    || value.variants.some(variant => !record(variant) || typeof variant.key !== 'string'
      || variant.allowedRows != null && !ints(variant.allowedRows) || variant.allowedColumns != null && !ints(variant.allowedColumns)
      || variant.rowLayouts != null && !layouts(variant.rowLayouts) || variant.columnLayouts != null && !layouts(variant.columnLayouts))) return undefined
  return { ...value, variants: value.variants.map(variant => Object.fromEntries(Object.entries(variant as Record<string, unknown>).filter(([, replacement]) => replacement !== null))) } as ReportConfiguration
}
function option(data: ReportRequestBody, name: string): unknown {
  const key = Object.keys(data).find(key => key.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : (data as unknown as Record<string, unknown>)[key]
}
export function effectiveReportConfiguration(dataset: ReportDataset | undefined, data: ReportRequestBody): ReportConfiguration | undefined {
  let analysis = false
  try { analysis = !!requestCurrentVparivanieAnalysis(data) } catch { /* Strict request validation reports malformed aliases. */ }
  const capability = analysis ? currentVparivanieAnalysisCapability(dataset) : undefined
  if (capability) return { version: 1, axisMode: 'flexible', allowedRows: capability.groupings.map(f => f.type).filter(type => type !== 74),
    allowedColumns: [...new Set([74, ...capability.groupings.map(f => f.type)])], minimumRows: 1, maximumRows: 8,
    allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [], filters: capability.filters.map(f => f.type),
    period: { required: true, supported: true, maximumDays: 366, maximumMonths: null, minimumDate: null }, variants: [] }
  const base = readReportConfiguration(dataset?.configuration)
  if (!base) return undefined
  const mode = option(data, data.dataSource === 40 ? 'cashReadMode' : data.dataSource === 41 ? 'settlementReadMode' : 'profitReadMode')
  const basis = option(data, data.dataSource === 35 ? 'dayOrganizationBasis' : 'supplierBasis')
  let key = mode === 0 ? 'currentDocuments' : mode === 1 ? 'originalNormal' : ''
  if (data.dataSource === 35) {
    const classification = option(data, 'productClassification')
    const scoped = option(data, 'sourceOrganizations') != null && option(data, 'sourceBuyerSubtree') != null && record(classification) && classification.SourceWorld === 0
    if (basis === 1 || basis == null && scoped) key = 'signedRegister'
    else if (mode == null && basis === 0 && scoped) key = 'originalNormal'
  }
  if (data.dataSource === 38 && basis === 1) key = 'completeSaleAllocations'
  if (data.dataSource === 38 && mode == null && basis === 0) key = option(data, 'supplierSourceWorld') === 0 ? 'originalNormal' : 'operationalLegacy'
  if (data.dataSource === 40 && option(data, 'cashPeriod') != null) key = 'exactRecord'
  if (data.dataSource === 41 && option(data, 'settlementPeriod') != null) key = 'exactAgreement'
  if (data.dataSource === 2 && option(data, 'returnsOnly') === true) key = 'returnsOnly'
  const sales = option(data, 'priceTypeSalesComparison')
  if (data.dataSource === 27 && record(sales) && (sales.SalesBasis ?? sales.salesBasis) === 0) key = 'operational'
  const groupedSettlement = option(data, 'groupedSettlementPeriod')
  if (data.dataSource === 41 && mode == null && record(groupedSettlement)
    && (groupedSettlement.SourceWorld ?? groupedSettlement.sourceWorld) === 'Fenix' && option(data, 'sourceBuyerSubtree') != null) key = 'originalNormal'
  let result = { ...base, ...base.variants.find(variant => variant.key === key) }
  if (data.dataSource === 40 && option(data, 'workbookPresentation') != null) {
    const row = data.sorted.Row.map(item => item.type).join(',')
    result = { ...result, ...base.variants.find(variant => variant.key === (row === '40' ? 'presentationAccount' : row === '42' ? 'presentationCurrencyRecord' : '')) }
  }
  const financial = requestFinancialAxesCapability(dataset, data)
  if (data.dataSource === 35 && financial) result = { ...result, axisMode: 'flexible',
    allowedRows: financial.allowedRows, allowedColumns: financial.allowedColumns,
    minimumRows: financial.minimumRows, maximumRows: financial.maximumRows, maximumColumns: financial.maximumColumns,
    maximumTotalDimensions: 'maximumTotalDimensions' in financial ? financial.maximumTotalDimensions : undefined }
  return result
}
export function reportAxesPolicy(dataset: ReportDataset | undefined, data: ReportRequestBody) {
  const config = effectiveReportConfiguration(dataset, data)
  const fixed = config ? config.axisMode === 'fixedLayouts' : hasFixedReportAxes(data.dataSource ?? 0) || data.dataSource === 35
  return { config, fixed, rowsOnly: config ? config.axisMode === 'profitRows' || config.axisMode === 'rowsOnly' || config.allowedColumns.length === 0 : fixed || data.dataSource === 13 }
}
export function reportConfigurationError(data: ReportRequestBody, dataset?: ReportDataset, draft = false): string | null {
  const currencyError = presentationCurrencyError(data, dataset)
  if (currencyError) return currencyError
  const currentAxesError = financialAxesConfigurationError(data, dataset)
  if (currentAxesError) return currentAxesError
  const warehouseKeys = Object.keys(data).filter(key => key.toLowerCase() === 'supplierwarehouse')
  const warehouse = option(data, 'supplierWarehouse')
  if (warehouseKeys.length > 1 || warehouse != null && (data.dataSource !== 38 || warehouse !== 73 && warehouse !== 78
    || option(data, 'supplierBasis') === 0 && warehouse !== 78
    || data.sorted.Row.some(row => (row.type === 73 || row.type === 78) && row.type !== warehouse))) return 'Основа складу постачальника несумісна з вибраним розрахунком.'
  if (dataset?.configuration !== undefined && !readReportConfiguration(dataset.configuration)) return 'Сервер повернув непідтримувані можливості структури звіту.'
  const config = effectiveReportConfiguration(dataset, data)
  if (!config) return null
  const rows = data.sorted.Row.map(item => item.type), columns = data.sorted.Col.map(item => item.type)
  const allowedRows = new Set(config.allowedRows), allowedColumns = new Set(config.allowedColumns)
  const same = (left: number[], right: number[]) => left.join(',') === right.join(',')
  if ((!draft && rows.length < config.minimumRows) || rows.length > config.maximumRows
    || rows.some(row => !allowedRows.has(row)) || columns.some(column => !allowedColumns.has(column))
    || config.maximumColumns !== undefined && columns.length > config.maximumColumns
    || config.maximumTotalDimensions !== undefined && rows.length + columns.length > config.maximumTotalDimensions
    || new Set([...rows, ...columns]).size !== rows.length + columns.length
    || config.mutuallyExclusiveRows.some(group => rows.filter(row => group.includes(row)).length > 1)
    || config.axisMode === 'fixedLayouts' && (!config.rowLayouts.some(layout => same(layout, rows)) || !config.columnLayouts.some(layout => same(layout, columns))))
    return 'Вибране групування не підтримується цим способом розрахунку звіту.'
  const allowedFilters = config.filters ? new Set(config.filters) : null
  if (allowedFilters && data.selections.some(selection => selection.IsChecked !== false && !allowedFilters.has(selection.SelectedField.Type))) return 'Цей спосіб розрахунку не підтримує вибрані відбори. Налаштування збережено без змін.'
  if (draft) return null
  const period = config.period
  if (!period.supported && (data.from || data.to)) return 'Цей звіт не підтримує період.'
  if (period.required && (!data.from || !data.to || data.from > data.to)) return 'Оберіть коректний період звіту.'
  if (data.to && period.endDatePolicy && period.endDatePolicy !== 'unrestricted'
    && data.to > reportMaximumDate(config, formatKyivBusinessDate())!) return 'Оберіть підтримувану кінцеву дату київського періоду звіту.'
  if (data.to && period.maximumDate && data.to > period.maximumDate) return `Період доступний до ${period.maximumDate}.`
  if (data.from && period.minimumDate && data.from < period.minimumDate) return `Період доступний від ${period.minimumDate}.`
  if (data.from && data.to && period.maximumDays && (Date.parse(data.to) - Date.parse(data.from)) / 86400000 >= period.maximumDays)
    return `Період звіту — не більше ${period.maximumDays} календарних днів.`
  if (data.from && data.to && period.maximumMonths) {
    const touchedMonths = (Number(data.to.slice(0, 4)) - Number(data.from.slice(0, 4))) * 12 + Number(data.to.slice(5, 7)) - Number(data.from.slice(5, 7)) + 1
    if (touchedMonths > period.maximumMonths) return `Період звіту — не більше ${period.maximumMonths} місяців.`
  }
  return null
}
export function reportMaximumDate(config: ReportConfiguration | undefined, today: string): string | undefined {
  if (!config) return undefined
  if (config.period.endDatePolicy === 'throughKyivToday') return today
  if (config.period.endDatePolicy === 'beforeKyivToday') {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - 1)
    return date.toISOString().slice(0, 10)
  }
  return config.period.maximumDate ?? '9998-12-31'
}
export function validProfitRows(data: ReportRequestBody, allowed: number[], maximum: number): boolean {
  const rows = data.sorted?.Row
  const allowedTypes = new Set(allowed)
  return Array.isArray(rows) && rows.length > 0 && rows.length <= maximum && rows.every(row => allowedTypes.has(row.type))
    && new Set(rows.map(row => row.type)).size === rows.length && !(rows.some(row => row.type === 73) && rows.some(row => row.type === 78))
    && Array.isArray(data.sorted.Col) && data.sorted.Col.length === 0
}
