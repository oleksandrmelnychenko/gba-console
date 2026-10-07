import { apiRequest } from '../../../shared/api/apiClient'
import {
  createCollectionCoefficientRequest,
  isCollectionCoefficientCapabilities,
  normalizeCollectionCoefficientReport,
  type CollectionCoefficientCapabilities,
  type CollectionCoefficientReport,
} from '../data/collectionCoefficient'

const route = '/report/constructors/collection-coefficient'

export async function getCollectionCoefficientCapabilities(signal?: AbortSignal): Promise<CollectionCoefficientCapabilities> {
  const result = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isCollectionCoefficientCapabilities(result)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return result
}

/** Preview and both files use one authorized server calculation. */
export async function previewCollectionCoefficient(capability: CollectionCoefficientCapabilities, month: string): Promise<CollectionCoefficientReport> {
  const request = createCollectionCoefficientRequest(capability, month)
  const result = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false })
  return normalizeCollectionCoefficientReport(result, request)
}
