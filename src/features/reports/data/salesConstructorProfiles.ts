import { constructorPresentationError } from './constructorPresentation'
import type { ReportDataset, ReportRequestBody } from '../types'

export type SalesConstructorProfile = 'sales' | 'grossProfit'
export const SALES_CONSTRUCTOR_WORKBOOK = 'gba:sales-constructor:v1'
export const GROSS_PROFIT_CONSTRUCTOR_WORKBOOK = 'gba:gross-profit-constructor:v1'
export const SALES_CONSTRUCTOR_MEASURES = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15] as const
export const GROSS_PROFIT_CONSTRUCTOR_MEASURES = [0, 2, 3, 4, 6, 7, 8, 10] as const
export const salesConstructorTitle = (profile: SalesConstructorProfile) => profile === 'sales' ? 'Звіт по продажам' : 'Валовий прибуток'
export const salesConstructorWorkbook = (profile: SalesConstructorProfile) => profile === 'sales' ? SALES_CONSTRUCTOR_WORKBOOK : GROSS_PROFIT_CONSTRUCTOR_WORKBOOK
export function profileForWorkbook(marker: string | null | undefined): SalesConstructorProfile | undefined {
  return marker === SALES_CONSTRUCTOR_WORKBOOK ? 'sales' : marker === GROSS_PROFIT_CONSTRUCTOR_WORKBOOK ? 'grossProfit' : undefined
}
export function requestReportProfile(data: object): unknown {
  const values = Object.entries(data).filter(([key]) => key.toLowerCase() === 'reportprofile')
  return values.length === 1 ? values[0][1] : values.length ? { invalid: true } : undefined
}
export function readReportProfile(value: unknown): SalesConstructorProfile | undefined {
  return value === 'sales' || value === 'grossProfit' ? value : undefined
}
export function cloneReportProfile(data: object): Pick<ReportRequestBody, 'reportProfile'> {
  const value = requestReportProfile(data)
  return value === undefined ? {} : { reportProfile: structuredClone(value) }
}
export function salesConstructorSupported(dataset: ReportDataset | undefined, profile: SalesConstructorProfile): boolean {
  return dataset?.DataSource === 2 && Array.isArray(dataset.reportProfiles) && dataset.reportProfiles.includes(profile)
}
export function salesConstructorDataset(dataset: ReportDataset | undefined, profile: unknown): ReportDataset | undefined {
  if (!dataset || !readReportProfile(profile)) return dataset
  const allowed = new Set<number>(profile === 'grossProfit' ? GROSS_PROFIT_CONSTRUCTOR_MEASURES : SALES_CONSTRUCTOR_MEASURES)
  return { ...dataset, Measurements: dataset.Measurements.filter(field => allowed.has(field.Type)), Filters: dataset.Filters.filter(field => ![21, 64].includes(field.Type)) }
}
export function salesConstructorError(request: ReportRequestBody, dataset?: ReportDataset): string | null {
  const raw = requestReportProfile(request)
  if (raw === undefined) return constructorPresentationError(request, dataset)
  const profile = readReportProfile(raw)
  if (!profile || request.dataSource !== 2) return 'Невідомий профіль конструктора продажів.'
  if (dataset && !salesConstructorSupported(dataset, profile)) return 'Цей сервер ще не підтримує вибраний конструктор продажів.'
  const measures = new Set<number>(profile === 'grossProfit' ? GROSS_PROFIT_CONSTRUCTOR_MEASURES : SALES_CONSTRUCTOR_MEASURES)
  if (!Array.isArray(request.sorted?.Measurements) || request.sorted.Measurements.some(item => !measures.has(item.Type))) return 'Показник не належить до вибраного звіту.'
  return constructorPresentationError(request, dataset)
}
export function salesConstructorRequest(request: ReportRequestBody, marker: string, dataset: ReportDataset): ReportRequestBody {
  const profile = profileForWorkbook(marker)
  if (!profile || !salesConstructorSupported(dataset, profile)) return request
  const rows = profile === 'sales' ? [4, 7] : [4, 10, 7]
  const columns = profile === 'sales' ? [] : [2]
  const measures = profile === 'sales' ? [0, 2, 6, 10, 14] : [2, 6, 10]
  const axis = (types: number[]) => types.flatMap(type => dataset.Groupings.filter(field => field.Type === type).map(field => ({ type, key: field.Name, label: field.Name })))
  return { ...request, reportProfile: profile, sorted: { Row: axis(rows), Col: axis(columns),
    Measurements: measures.flatMap(type => dataset.Measurements.filter(field => field.Type === type && field.Selectable !== false).map(field => ({ Type: type, Name: field.Name, Label: field.Name, IsChecked: true, parentName: '' }))) } }
}
