import type { LegacyOneCTurnoverFilters, OneCTurnoverScopeSummary } from '../types'
export const EXACT_ONE_C_BUYER_ROOT_ID = '8AB2005056C0000811DEFC4535BB4D40'

// Same exact Fenix identities as server SyncOrganizationScope.FenixBaseOrganizations.
export const ORGANIZATION_ONLY_TURNOVER_IDS = [
  'A98BC3FAAC5CA23811E99CCA70CA60B9',
  '8AB2005056C0000811DEF92AB3F4DFF1',
  '8AB2005056C0000811DF04FAB939A4DE',
  '94B4005056C0000811DF1A0C73BC9A12',
] as const

export function isLegacyTurnoverScope(scope: OneCTurnoverScopeSummary): scope is OneCTurnoverScopeSummary & { Filters: LegacyOneCTurnoverFilters } {
  return scope.Filters.ScopeVersion == null
}

export function isOneCTurnoverScope(value: unknown): value is OneCTurnoverScopeSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  const filters = item.Filters as Record<string, unknown> | undefined
  const isReference = (id: unknown): id is string => typeof id === 'string' && /^[a-f\d]{32}$/i.test(id) && !/^0+$/.test(id)
  if (!filters || Array.isArray(filters) || !Array.isArray(filters.OrganizationIds)
    || filters.OrganizationIds.length < 1 || filters.OrganizationIds.length > 100 || !filters.OrganizationIds.every(isReference)) return false
  const organizations = new Set(filters.OrganizationIds.map(id => id.toUpperCase()))
  const supportedFilters = filters.ScopeVersion === 3
    ? organizations.size === ORGANIZATION_ONLY_TURNOVER_IDS.length
      && ORGANIZATION_ONLY_TURNOVER_IDS.every(id => organizations.has(id))
      && filters.ProductKindId == null && filters.ExcludeServices == null && filters.BuyerRootId == null
      && validPublishedDays(item.FirstDay, item.LastDay, item.LoadedDayCount)
      && validUtc(item.OldestReadCompletedUtc) && validUtc(item.NewestReadCompletedUtc)
      && Date.parse(item.OldestReadCompletedUtc) <= Date.parse(item.NewestReadCompletedUtc)
    : filters.ScopeVersion == null && isReference(filters.ProductKindId) && typeof filters.ExcludeServices === 'boolean'
      && (filters.BuyerRootId == null || typeof filters.BuyerRootId === 'string'
        && filters.BuyerRootId.toUpperCase() === EXACT_ONE_C_BUYER_ROOT_ID)
  return supportedFilters && typeof item.Key === 'string' && /^[a-f\d]{64}$/i.test(item.Key)
    && Array.isArray(item.OrganizationNames) && item.OrganizationNames.every(name => typeof name === 'string')
    && typeof item.FirstDay === 'string' && typeof item.LastDay === 'string'
    && typeof item.LoadedDayCount === 'number' && Number.isInteger(item.LoadedDayCount) && item.LoadedDayCount > 0
    && typeof item.OldestReadCompletedUtc === 'string' && typeof item.NewestReadCompletedUtc === 'string'
}

export function isOrganizationOnlyTurnoverScope(value: unknown): value is OneCTurnoverScopeSummary {
  return isOneCTurnoverScope(value) && value.Filters.ScopeVersion === 3
}

function validUtc(value: unknown): value is string {
  return typeof value === 'string' && /Z$/.test(value) && Number.isFinite(Date.parse(value))
}

export const ORGANIZATION_ONLY_TURNOVER_CHOICE = {
  reportId: 'builtin:ВаловаяПрибыль', world: 'fenix',
  sourceId: '65fb1537-c992-4962-9f97-5d9f96b9a034', dataSource: 1,
} as const

function validPublishedDays(first: unknown, last: unknown, count: unknown): boolean {
  const validDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= '2000-01-01' && value <= '7998-12-31' && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  return validDay(first) && validDay(last) && first <= last && typeof count === 'number'
    && count <= (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1
}
