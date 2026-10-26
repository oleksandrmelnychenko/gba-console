import { apiRequest } from '../../../shared/api/apiClient'
import {
  normalizeStockMovementCapability, normalizeStockMovementExport, normalizeStockMovementLookup, normalizeStockMovementResult,
  WAREHOUSE_STOCK_MOVEMENT_ROUTE, type StockMovementCapability, type StockMovementExport, type StockMovementLookupItem,
  type StockMovementRequest, type StockMovementResult,
} from '../data/warehouseStockMovement'

export async function getStockMovementCapability(signal?: AbortSignal): Promise<StockMovementCapability> {
  return normalizeStockMovementCapability(await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/capabilities`, { signal }))
}

export async function getStockMovementWarehouses(signal?: AbortSignal): Promise<StockMovementLookupItem[]> {
  return normalizeStockMovementLookup(await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/warehouses`, { signal }))
}

export async function getStockMovementOrganizations(signal?: AbortSignal): Promise<StockMovementLookupItem[]> {
  return normalizeStockMovementLookup(await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/organizations`, { signal }))
}

export async function searchStockMovementProducts(query: string, signal?: AbortSignal): Promise<StockMovementLookupItem[]> {
  return normalizeStockMovementLookup(await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/products`,
    { signal, query: { query, offset: 0, limit: 50 } }))
}

export async function searchStockMovementGroups(query: string, signal?: AbortSignal): Promise<StockMovementLookupItem[]> {
  return normalizeStockMovementLookup(await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/product-groups`,
    { signal, query: { query, offset: 0, limit: 50 } }))
}

export async function previewStockMovement(request: StockMovementRequest, signal?: AbortSignal): Promise<StockMovementResult> {
  const value = await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeStockMovementResult(value, request)
}

export async function exportStockMovement(request: StockMovementRequest, signal?: AbortSignal): Promise<StockMovementExport> {
  const value = await apiRequest<unknown>(`${WAREHOUSE_STOCK_MOVEMENT_ROUTE}/export`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeStockMovementExport(value)
}
