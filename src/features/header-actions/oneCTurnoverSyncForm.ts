import { getFirstSyncDateRangeError, hasSyncDateRangeErrors, validateSyncDateRange, type SyncDateRange } from './syncSessionForm'
import type { OneCTurnoverSyncCatalog, OneCTurnoverSyncFilters } from './types'

export function validateOneCTurnoverSync(range: SyncDateRange, types: string[], filters: OneCTurnoverSyncFilters,
  catalog: OneCTurnoverSyncCatalog | null, today: string): string | null {
  const dateErrors = validateSyncDateRange(range, today)
  if (hasSyncDateRangeErrors(dateErrors)) return getFirstSyncDateRangeError(dateErrors)
  if ((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000 >= 31)
    return 'Для звітних рухів виберіть від 1 до 31 дня'
  if (types.length === 0) return 'Оберіть типи документів для щоденного запуску'
  if (!catalog) return 'Спочатку завантажте довідники Fenix'
  if (filters.oneCOrganizationIds.length < 1 || filters.oneCOrganizationIds.length > 100
    || filters.oneCOrganizationIds.some((id) => !catalog.Organizations.some((item) => item.Id === id)))
    return 'Виберіть організації Fenix для звіту'
  if (!catalog.ProductKinds.some((item) => item.Id === filters.oneCProductKindId))
    return 'Виберіть вид номенклатури Fenix'
  if (typeof filters.oneCExcludeServices !== 'boolean') return 'Задайте відбір послуг'
  return null
}
