import { apiRequest } from '../../../shared/api/apiClient'
import { isWarehouseMonetaryCapability, normalizeWarehouseMonetary, type WarehouseMonetaryCapability,
  type WarehouseMonetaryRequest, type WarehouseMonetaryResult } from '../data/originalWarehouseMonetary'
const route = '/report/originals/warehouse-monetary'
export async function getWarehouseMonetaryCapability(signal?: AbortSignal): Promise<WarehouseMonetaryCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isWarehouseMonetaryCapability(value) || value.World !== 'fenix') throw new Error('Сервер не підтвердив відомість Fenix за період.')
  return value
}
export async function readWarehouseMonetary(request: WarehouseMonetaryRequest, signal?: AbortSignal): Promise<WarehouseMonetaryResult> {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal })
  return normalizeWarehouseMonetary(value, request)
}
