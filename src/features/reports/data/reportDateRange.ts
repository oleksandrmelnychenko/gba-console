
export const FULL_REPORT_MIN_DATE = '1900-01-01'
export const FULL_REPORT_MAX_DATE = '9998-12-31'

export function isFullRangeReportDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || value < FULL_REPORT_MIN_DATE || value > FULL_REPORT_MAX_DATE) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
