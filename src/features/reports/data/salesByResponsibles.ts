import type { ReportDataset } from '../types'

export const SALES_BY_RESPONSIBLES_SOURCE = 43
export const SALES_BY_RESPONSIBLES_SOURCE_NAME = 'NativeSalesByResponsibles'
export const SALES_BY_RESPONSIBLES_WORKBOOK_FILE = 'Продажі по менеджерам.xls'
export const SALES_BY_RESPONSIBLES_TITLE = 'Продажі по менеджерах'
export const SALES_BY_RESPONSIBLES_ROWS: readonly number[] = [4, 22]
export const SALES_BY_RESPONSIBLES_COLUMNS: readonly number[] = [23]
export const SALES_BY_RESPONSIBLES_MEASURES: readonly number[] = [2, 4]
export const SALES_BY_RESPONSIBLES_RESPONSIBLE_FILTERS: ReadonlySet<number> = new Set([62, 63])

const RESPONSIBLE_KEY = /^(?:USER:[1-9]\d{0,18}|1C:(?![0]{32})[0-9A-F]{32}|RETURN|NO_ORDER|UNASSIGNED|UNDEFINED)$/

export function isSalesResponsibleKey(value: unknown): value is string {
  return typeof value === 'string' && RESPONSIBLE_KEY.test(value)
}

export function isSalesByResponsiblesDataset(dataset: ReportDataset | undefined): boolean {
  if (!dataset || dataset.DataSource !== SALES_BY_RESPONSIBLES_SOURCE || dataset.PeriodRequired !== true
    || dataset.PeriodSupported === false) return false
  const groupings = new Set(dataset.Groupings.map(field => field.Type))
  const measures = new Set(dataset.Measurements.map(field => field.Type))
  return [...SALES_BY_RESPONSIBLES_ROWS, ...SALES_BY_RESPONSIBLES_COLUMNS].every(type => groupings.has(type))
    && SALES_BY_RESPONSIBLES_MEASURES.every(type => measures.has(type))
    && dataset.Filters.some(field => field.Type === 0)
}
