import { apiRequest } from '../../../shared/api/apiClient'
import type { GeographyMetric, GeographyParams, SalesGeographySummary, SalesRegionAggregate } from '../types'

const contractError = () => new Error('Некоректні дані карти продажів. Оновіть дані або зверніться до адміністратора.')
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const count = (value: unknown): value is number => finiteNumber(value) && Number.isSafeInteger(value) && value >= 0
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const sameAmount = (left: number, right: number) =>
  Math.abs(left - right) <= Math.max(0.000001, Number.EPSILON * Math.max(Math.abs(left), Math.abs(right)) * 8)

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function getSalesGeography(
  params: GeographyParams = {},
  signal?: AbortSignal,
): Promise<SalesGeographySummary> {
  const metric = params.metric ?? 'sales'
  const query: Record<string, string | number> = { metric }
  if (metric === 'sales') {
    if (params.period) query.period = params.period
    else query.months = params.months ?? 12
    if (params.from) query.from = params.from
    if (params.to) query.to = params.to
  }
  const result = await apiRequest<unknown>('/sales/geography/summary', { query, signal })
  return readSummary(result, metric)
}

function readSummary(value: unknown, metric: GeographyMetric): SalesGeographySummary {
  if (
    !record(value) ||
    value.Metric !== metric ||
    value.Currency !== 'EUR' ||
    value.TimeZone !== 'Europe/Kyiv' ||
    value.RegionBasis !== 'current-client-region' ||
    typeof value.ImportCompletenessConfirmed !== 'boolean' ||
    value.AmountBasis !==
      (metric === 'sales'
        ? 'confirmed-invoices-minus-active-returns-with-vat'
        : 'current-positive-receivables-historical-fx') ||
    value.UnresolvedUnit !== (metric === 'sales' ? 'lines' : 'debts') ||
    typeof value.AsOfUtc !== 'string' ||
    !/(?:Z|\+00:00)$/.test(value.AsOfUtc) ||
    !Number.isFinite(Date.parse(value.AsOfUtc)) ||
    !Array.isArray(value.Rows) ||
    !finiteNumber(value.KnownTotalEur) ||
    !count(value.ClientCount) ||
    !count(value.UnresolvedAmountCount)
  )
    throw contractError()

  for (const key of ['From', 'To', 'AvailableFrom', 'LatestDocumentDate']) {
    if (value[key] !== null && !calendarDate(value[key])) throw contractError()
  }
  if (metric === 'sales') {
    if (!calendarDate(value.From) || !calendarDate(value.To) || value.From > value.To) throw contractError()
  } else if (
    value.From !== null ||
    value.To !== null ||
    value.AvailableFrom !== null ||
    value.LatestDocumentDate !== null
  )
    throw contractError()
  if (
    typeof value.AvailableFrom === 'string' &&
    typeof value.LatestDocumentDate === 'string' &&
    value.AvailableFrom > value.LatestDocumentDate
  )
    throw contractError()

  const rows = value.Rows.map(readRow)
  if (rows.some((row) => row.RegionCode === '200') || new Set(rows.map((row) => row.RegionCode)).size !== rows.length)
    throw contractError()
  if (
    rows.reduce((sum, row) => sum + row.ClientCount, 0) !== value.ClientCount ||
    rows.reduce((sum, row) => sum + row.UnresolvedAmountCount, 0) !== value.UnresolvedAmountCount ||
    !sameAmount(
      rows.reduce((sum, row) => sum + row.KnownValueEur, 0),
      value.KnownTotalEur,
    )
  )
    throw contractError()
  checkAmount(value.TotalEur, value.KnownTotalEur, value.UnresolvedAmountCount)
  if (metric === 'debt' && rows.some((row) => row.KnownValueEur < 0 || (row.ValueEur !== null && row.ValueEur < 0)))
    throw contractError()
  return { ...value, Rows: rows } as SalesGeographySummary
}

function readRow(value: unknown): SalesRegionAggregate {
  if (
    !record(value) ||
    !(value.RegionCode === null || (typeof value.RegionCode === 'string' && value.RegionCode.trim())) ||
    !finiteNumber(value.KnownValueEur) ||
    !count(value.ClientCount) ||
    !count(value.UnresolvedAmountCount)
  )
    throw contractError()
  checkAmount(value.ValueEur, value.KnownValueEur, value.UnresolvedAmountCount)
  return {
    RegionCode: typeof value.RegionCode === 'string' ? value.RegionCode.trim().toUpperCase() : null,
    ValueEur: value.ValueEur as number | null,
    KnownValueEur: value.KnownValueEur,
    ClientCount: value.ClientCount,
    UnresolvedAmountCount: value.UnresolvedAmountCount,
  }
}

function checkAmount(value: unknown, known: number, unresolved: number) {
  if (unresolved > 0 ? value !== null : !finiteNumber(value) || !sameAmount(value, known)) throw contractError()
}
