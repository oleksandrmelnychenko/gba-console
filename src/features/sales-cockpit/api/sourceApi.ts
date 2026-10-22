import { apiRequest } from '../../../shared/api/apiClient'

export type CockpitSource = {
  sourceEnvironment: 'dev' | 'qa' | 'shared' | 'local'
  asOf: string
  watermark: string | null
  watermarkKind: 'latest_valid_sale_activity'
  syncFreshnessKnown: false
  historyStartDate: string
  sourceAvailable: boolean
  sourceReady: boolean
  taskStoreAvailable: boolean
  generationEnabled: boolean
  generationReady: boolean
  lastGenerationAt: string | null
}

export async function getCockpitSource(head: boolean, signal?: AbortSignal): Promise<CockpitSource> {
  const data = await apiRequest<CockpitSource>(`/sales/cockpit/${head ? 'head/' : ''}source`, { signal })
  if (!data || !['dev', 'qa', 'shared', 'local'].includes(data.sourceEnvironment)
    || !Number.isFinite(Date.parse(data.asOf)) || data.watermarkKind !== 'latest_valid_sale_activity'
    || data.syncFreshnessKnown !== false
    || (data.watermark !== null && !Number.isFinite(Date.parse(data.watermark)))
    || ['sourceAvailable', 'sourceReady', 'taskStoreAvailable', 'generationEnabled', 'generationReady'].some((key) => typeof data[key as keyof CockpitSource] !== 'boolean')) {
    throw new Error('Не вдалося перевірити джерело даних')
  }
  return data
}
