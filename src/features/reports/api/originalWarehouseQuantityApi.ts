import { apiRequest } from '../../../shared/api/apiClient'
import { isWarehouseQuantityCapability, normalizeWarehouseQuantity, type WarehouseQuantityCapability,
  type WarehouseQuantityRequest, type WarehouseQuantityResult } from '../data/originalWarehouseQuantity'
const route = '/report/originals/warehouse-quantity'
export async function getWarehouseQuantityCapability(signal?: AbortSignal): Promise<WarehouseQuantityCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isWarehouseQuantityCapability(value) || value.World !== 'fenix') throw new Error('Сервер не підтвердив відомість Fenix за період.')
  return value
}
export async function readWarehouseQuantity(request: WarehouseQuantityRequest, signal?: AbortSignal): Promise<WarehouseQuantityResult> {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal })
  return normalizeWarehouseQuantity(value, request)
}
