import { apiRequest } from '../../../shared/api/apiClient'
import type { PlacementProduct, PlacementStorage, PlacementSupplyOrder } from '../placementsTypes'

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

export async function createProductIncomeFromDynamicPlacements(
  order: PlacementSupplyOrder,
  fromDate: string,
  storageNetId: string,
): Promise<PlacementSupplyOrder> {
  const result = await apiRequest<unknown>('/products/incomes/new/supply/ukraine/dynamic', {
    method: 'POST',
    query: { fromDate, storageNetId },
    body: order,
  })

  return normalizeOrder(result ?? order)
}

export async function recordProductIncomeFromDynamicPlacementsHistory(
  order: PlacementSupplyOrder,
): Promise<void> {
  await apiRequest<unknown>('/history/order/item/new/supply/ukraine/dynamic', {
    method: 'POST',
    body: order,
  })
}

export async function searchPlacementProducts(value: string): Promise<PlacementProduct[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcode', {
    query: { limit: 20, offset: 0, value: value.trim() },
  })

  if (Array.isArray(result)) {
    return result as PlacementProduct[]
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>

    if (Array.isArray(payload.Items)) {
      return payload.Items as PlacementProduct[]
    }
  }

  return []
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
