import { apiRequest } from '../../../shared/api/apiClient'
import { isMovementCapability, normalizeMovementWire, normalizeMovementPublications, normalizeMovementResult, type MovementPublication, type MovementRequest } from '../data/originalWarehouseMovement'
const route = '/report/originals/warehouse-movement'
export async function getMovementCapability(signal?: AbortSignal) {
  const value = normalizeMovementWire(await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal }))
  if (!isMovementCapability(value)) throw new Error('Ця версія сервера не підтвердила рух товару.')
  return value
}
export async function getMovementPublications(signal?: AbortSignal) {
  return normalizeMovementPublications(await apiRequest<unknown>(`${route}/publications`, { signal }))
}
export async function readMovement(request: MovementRequest, publication: MovementPublication, signal?: AbortSignal) {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false })
  return normalizeMovementResult(value, request, publication)
}
