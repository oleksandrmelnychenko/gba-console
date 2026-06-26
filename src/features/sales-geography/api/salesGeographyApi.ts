import { apiRequest } from '../../../shared/api/apiClient'
import type { GeographyParams, SalesRegionAggregate } from '../types'

// Mirrors how the sales cockpit calls gba-server (see getHeadTasks in
// salesCockpitApi.ts): same apiRequest client, same base path. apiRequest already
// prepends /api/v1/{lang} and unwraps the { Body } envelope.
export async function getSalesGeography(params: GeographyParams = {}): Promise<SalesRegionAggregate[]> {
  const result = await apiRequest<unknown>('/sales/geography', {
    query: {
      metric: params.metric ?? 'sales',
      months: params.months ?? 12,
    },
  })

  return normalizeAggregates(result)
}

function normalizeAggregates(result: unknown): SalesRegionAggregate[] {
  if (!Array.isArray(result)) {
    return []
  }

  return result.reduce<SalesRegionAggregate[]>((acc, value) => {
    const row = normalizeAggregate(value)
    if (row) {
      acc.push(row)
    }
    return acc
  }, [])
}

function normalizeAggregate(value: unknown): SalesRegionAggregate | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Partial<SalesRegionAggregate>

  if (typeof row.RegionCode !== 'string' || !row.RegionCode) {
    return null
  }

  return {
    RegionCode: row.RegionCode.trim().toUpperCase(),
    ValueEur: toNumber(row.ValueEur),
    ClientCount: toNumber(row.ClientCount),
  }
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
