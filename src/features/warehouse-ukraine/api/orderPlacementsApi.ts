import { apiRequest } from '../../../shared/api/apiClient'
import type {
  DynamicProductPlacementColumn,
  DynamicProductPlacementRow,
  PlacementProduct,
  PlacementStorage,
  PlacementSupplyOrder,
} from '../placementsTypes'

function normalizeOrder(result: unknown): PlacementSupplyOrder {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}

  return {
    ...(payload as PlacementSupplyOrder),
    SupplyOrderUkraineItems: Array.isArray(payload.SupplyOrderUkraineItems)
      ? (payload.SupplyOrderUkraineItems as PlacementSupplyOrder['SupplyOrderUkraineItems'])
      : [],
    DynamicProductPlacementColumns: Array.isArray(payload.DynamicProductPlacementColumns)
      ? (payload.DynamicProductPlacementColumns as DynamicProductPlacementColumn[]).map(normalizePlacementColumn)
      : [],
  }
}

function normalizePlacementColumn(column: DynamicProductPlacementColumn): DynamicProductPlacementColumn {
  return {
    ...column,
    DynamicProductPlacementRows: Array.isArray(column.DynamicProductPlacementRows)
      ? column.DynamicProductPlacementRows.map(normalizePlacementRow)
      : [],
  }
}

function normalizePlacementRow(row: DynamicProductPlacementRow): DynamicProductPlacementRow {
  return {
    ...row,
    DynamicProductPlacements: Array.isArray(row.DynamicProductPlacements) ? row.DynamicProductPlacements : [],
  }
}

export async function getSupplyOrderUkraineById(netId: string): Promise<PlacementSupplyOrder> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/warehouse-ukraine/placement', {
    query: { netId },
  })

  return normalizeOrder(result)
}

export async function updateSupplyOrderUkraine(order: PlacementSupplyOrder): Promise<PlacementSupplyOrder> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/warehouse-ukraine/placement/save', {
    method: 'POST',
    body: order,
  })

  return normalizeOrder(result)
}

export async function updateSupplyOrderUkraineForReconciliation(
  order: PlacementSupplyOrder,
): Promise<PlacementSupplyOrder> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/warehouse-ukraine/placement/reconciliation', {
    method: 'POST',
    body: order,
  })

  return normalizeOrder(result)
}

export async function saveDynamicPlacementRow(
  row: DynamicProductPlacementRow,
): Promise<DynamicProductPlacementRow> {
  const endpoint = row.Id && row.Id > 0
    ? '/supplies/ukraine/order/placements/dynamic/rows/warehouse-ukraine/update'
    : '/supplies/ukraine/order/placements/dynamic/rows/warehouse-ukraine/new'
  const result = await apiRequest<unknown>(endpoint, {
    method: 'POST',
    body: row,
  })

  return normalizePlacementRow(result as DynamicProductPlacementRow)
}

export async function createProductIncomeFromDynamicPlacements(
  order: PlacementSupplyOrder,
  fromDate: string,
  storageNetId: string,
): Promise<PlacementSupplyOrder> {
  const endpoint = order.IsPlaced
    ? '/products/incomes/warehouse-ukraine/dynamic/post'
    : '/products/incomes/warehouse-ukraine/dynamic/capitalize'
  const result = await apiRequest<unknown>(endpoint, {
    method: 'POST',
    query: { fromDate, storageNetId },
    body: order,
  })

  return normalizeOrder(result ?? order)
}

export async function searchPlacementProducts(value: string): Promise<PlacementProduct[]> {
  const result = await apiRequest<unknown>('/products/orders-ukraine/placement/search/vendorcode', {
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
  const result = await apiRequest<unknown>('/storages/orders-ukraine/placement/nondefective')

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

/**
 * The storage this order has already been received to: the storage of its latest
 * product income, or null when nothing has been received yet. It only presets the
 * «Склад» select, so any failure (no permission, server error) means "unknown".
 */
export async function getOrderReceivedStorageNetId(orderNetId: string): Promise<string | null> {
  try {
    const result = await apiRequest<unknown>('/products/incomes/supply/order/ukraine/get', {
      query: { netId: orderNetId },
    })

    if (!result || typeof result !== 'object') {
      return null
    }

    const storage = (result as { Storage?: PlacementStorage | null }).Storage

    return storage?.NetUid || null
  } catch {
    return null
  }
}
