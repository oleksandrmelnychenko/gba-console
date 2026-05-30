import { apiRequest } from '../../../shared/api/apiClient'
import type { SyncDocument, SyncDocumentsResult, SyncDocumentsSearchParams } from '../types'

export async function getSyncDocuments(params: SyncDocumentsSearchParams): Promise<SyncDocumentsResult> {
  const result = await apiRequest<unknown>('/documents/sync/get', {
    query: {
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
      name: params.name,
      type: params.type,
    },
  })

  return normalizeSyncDocuments(result)
}

function normalizeSyncDocuments(result: unknown): SyncDocumentsResult {
  const items = extractItems(result)

  return {
    items,
    totalQty: items.length > 0 ? items[0].TotalQty || 0 : 0,
  }
}

function extractItems(result: unknown): SyncDocument[] {
  if (Array.isArray(result)) {
    return result as SyncDocument[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.Data)
      ? payload.Data
      : Array.isArray(payload.Collection)
        ? payload.Collection
        : []

  return items as SyncDocument[]
}
