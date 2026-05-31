import { apiRequest } from '../../../shared/api/apiClient'
import type { PlacementStorage, PlacementSupplyOrder } from '../placementsTypes'

function normalizeOrder(result: unknown): PlacementSupplyOrder {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}

  return {
    ...(payload as PlacementSupplyOrder),
    SupplyOrderUkraineItems: Array.isArray(payload.SupplyOrderUkraineItems)
      ? (payload.SupplyOrderUkraineItems as PlacementSupplyOrder['SupplyOrderUkraineItems'])
      : [],
    DynamicProductPlacementColumns: Array.isArray(payload.DynamicProductPlacementColumns)
      ? (payload.DynamicProductPlacementColumns as PlacementSupplyOrder['DynamicProductPlacementColumns'])
      : [],
  }
}

export async function getSupplyOrderUkraineById(netId: string): Promise<PlacementSupplyOrder> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/get', {
    query: { netId },
  })

  return normalizeOrder(result)
}

export async function updateSupplyOrderUkraine(order: PlacementSupplyOrder): Promise<PlacementSupplyOrder> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/update', {
    method: 'POST',
    body: order,
  })

  return normalizeOrder(result)
}

export async function getNonDefectiveStorages(): Promise<PlacementStorage[]> {
  const result = await apiRequest<unknown>('/storages/all/nondefective')

  if (Array.isArray(result)) {
    return result as PlacementStorage[]
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>

    if (Array.isArray(payload.Items)) {
      return payload.Items as PlacementStorage[]
    }

    if (Array.isArray(payload.Storages)) {
      return payload.Storages as PlacementStorage[]
    }
  }

  return []
}
