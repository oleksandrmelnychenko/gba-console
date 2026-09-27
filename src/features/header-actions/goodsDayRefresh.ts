import { apiRequest } from '../../shared/api/apiClient'
import { isStrictSyncDate } from './syncSessionForm'

export const GOODS_REFRESH_TIMEOUT_MS = 110_000
const kyivDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
})

// Numeric enums are the server's PascalCase JSON contract.
export type GoodsRefreshStatus = 0 | 1 | 2 | 3 // Needed, Skipped, Completed, Unavailable
export type GoodsRefreshReason = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
export type GoodsRefreshSummary = {
  KyivDay: string
  Status: 1 | 2 | 3 // EmptyDay, Published, AlreadyCurrent
  FactCount: number
  ProductKeyCount: number
  ElapsedMs: number
}
export type GoodsRefreshResult = {
  Status: GoodsRefreshStatus
  ClosedKyivDay: string
  Reason: GoodsRefreshReason
  Refresh: GoodsRefreshSummary | null
}

export function todayInKyiv(now = new Date()): string {
  const parts = kyivDateFormatter.formatToParts(now)
  const value = (name: string) => parts.find((part) => part.type === name)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function isClosedGoodsDay(day: string, now = new Date()): boolean {
  return isStrictSyncDate(day) && day >= '1900-01-01' && day <= '9998-12-31' && day < todayInKyiv(now)
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

export function parseGoodsRefreshResult(value: unknown, day: string): GoodsRefreshResult {
  const invalid = () => new Error('goods_refresh_invalid_result')
  if (!record(value) || value.ClosedKyivDay !== day || !integer(value.Status, 0, 3)
    || !integer(value.Reason, 0, 11) || value.NativeSaleImportRequested !== false
    || value.HistoricalXlsParityVerified !== false || value.AllReportsReady !== false) throw invalid()
  const summary = value.Refresh
  if (value.Status !== 2) {
    if (summary !== null) throw invalid()
    return { Status: value.Status as GoodsRefreshStatus, ClosedKyivDay: day,
      Reason: value.Reason as GoodsRefreshReason, Refresh: null }
  }
  if (value.Reason !== 0 || !record(summary) || summary.KyivDay !== day || !integer(summary.Status, 1, 3)
    || !integer(summary.FactCount, 0, 20_000) || !integer(summary.ProductKeyCount, 0, 1024)
    || summary.ProductKeyCount > summary.FactCount || !integer(summary.ElapsedMs, 0, 89_999)
    || summary.CompleteCurrentNativeCensusVerified !== true || summary.CompleteSourceCatalogue !== false
    || summary.WholeSourceSalesDayVerified !== false || summary.HistoricalXlsParityVerified !== false
    || summary.SourceWrites !== 0) throw invalid()
  const empty = summary.Status === 1
  if (empty ? summary.FactCount !== 0 || summary.ProductKeyCount !== 0
    : summary.FactCount === 0 || summary.ProductKeyCount === 0) throw invalid()
  return { Status: 2, ClosedKyivDay: day, Reason: 0, Refresh: {
    KyivDay: day, Status: summary.Status as 1 | 2 | 3, FactCount: summary.FactCount,
    ProductKeyCount: summary.ProductKeyCount, ElapsedMs: summary.ElapsedMs,
  } }
}

export async function refreshGoodsDay(day: string, signal: AbortSignal): Promise<GoodsRefreshResult> {
  if (!isClosedGoodsDay(day)) throw new Error('goods_refresh_day_not_closed')
  signal.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, GOODS_REFRESH_TIMEOUT_MS)
  try {
    const response = await apiRequest<unknown>('/data/sync/online-shop-seo/report-goods/refresh-day', {
      method: 'POST', signal: controller.signal,
      query: { closedKyivDay: day, forAmg: false, type: 'Sales' },
      errorMessages: { 403: 'Немає дозволу на оновлення класифікації товарів',
        default: 'Не вдалося підтвердити оновлення класифікації товарів',
        network: 'Не вдалося отримати результат оновлення класифікації товарів' },
    })
    controller.signal.throwIfAborted()
    return parseGoodsRefreshResult(response, day)
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

export function goodsRefreshMessage(result: GoodsRefreshResult): string {
  if (result.Status === 2) return result.Refresh?.Status === 1
    ? 'За цю добу немає продажів для класифікації товарів.'
    : 'Класифікацію товарів за добу оновлено. Оновіть звіт, щоб побачити результат.'
  switch (result.Reason) {
    case 4: case 5: case 8: return 'Оновлення класифікації товарів вимкнено на сервері.'
    case 7: return 'Синхронізація виконується. Оновлення класифікації не запущено.'
    case 1: case 2: case 3: return 'Оберіть одну завершену добу Fenix за часом Києва.'
    case 6: return 'Оновлення класифікації товарів наразі недоступне на сервері.'
    case 9: case 10: case 11: return 'Сервер не підтвердив оновлення класифікації. Перевірте стан перед повторним запуском.'
    default: return 'Класифікацію товарів ще потрібно оновити. Оновлення не підтверджено.'
  }
}
