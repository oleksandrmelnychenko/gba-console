import type { DashboardMetricComparison } from '../types'

const field = (row: Record<string, unknown>, name: string) => Object.hasOwn(row, name) ? row[name] : row[name[0].toUpperCase() + name.slice(1)]
const nullableNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const day = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const date = value.slice(0, 10)
  const parsed = Date.parse(`${date}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date ? date : null
}

/** Keep the current KPI usable when additive comparison evidence is unavailable. */
export function normalizeMetricComparison(raw: unknown, current: { from: string; to: string; value: number; hasData: boolean; timeBasis: string }): DashboardMetricComparison | undefined {
  if (raw == null) return undefined
  const unknown = (reason: string): DashboardMetricComparison => ({ from: null, to: null, value: null, delta: null, deltaPercent: null, unknownReason: reason })
  if (typeof raw !== 'object' || Array.isArray(raw)) return unknown('Дані порівняння не підтверджено')
  const row = raw as Record<string, unknown>
  const from = day(field(row, 'from')), to = day(field(row, 'to')), currentFrom = day(current.from), currentTo = day(current.to)
  if (!from || !to || !currentFrom || !currentTo || current.timeBasis !== 'period' || to !== currentFrom
    || Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) !== Date.parse(currentTo) - Date.parse(currentFrom))
    return unknown('Період порівняння не підтверджено')
  const value = nullableNumber(field(row, 'value'))
  const known = value !== null && current.hasData
  const delta = known ? nullableNumber(field(row, 'delta')) : null
  const deltaPercent = known && value !== 0 ? nullableNumber(field(row, 'deltaPercent')) : null
  const reason = field(row, 'unknownReason')
  let unknownReason = typeof reason === 'string' ? reason : ''
  if (!unknownReason && !known) unknownReason = 'Недостатньо даних для порівняння'
  if (!unknownReason && known && value === 0) unknownReason = 'Відсоток не визначено: попереднє значення дорівнює нулю'
  return { from, to, value, delta, deltaPercent, unknownReason }
}
