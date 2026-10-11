import { apiRequest } from '../../../shared/api/apiClient'
import { isMatrixCapability, normalizeMatrixResult, type MatrixCapability, type MatrixRequest } from '../data/originalVparivanie'
import { matrixBindingRequest, normalizeMatrixScopeBinding, normalizeScopedMatrixResult, type MatrixScope, type MatrixScopeBinding } from '../data/originalVparivanieScope'
const route = '/report/originals/vparivanie'
export async function getOriginalMatrixCapability(signal?: AbortSignal): Promise<MatrixCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isMatrixCapability(value) || value.World !== 'fenix') throw new Error('Сервер не підтвердив оригінальну матрицю Fenix.')
  return value
}
export async function readOriginalMatrix(request: MatrixRequest, signal?: AbortSignal) {
  return normalizeMatrixResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
export async function getOriginalMatrixScopeBinding(capability: MatrixCapability, scope: MatrixScope, signal?: AbortSignal) {
  const value = await apiRequest<unknown>(`${route}/group`, { signal,
    query: { world: scope.World, from: scope.From, through: scope.Through, groupId: scope.GroupId } })
  return normalizeMatrixScopeBinding(value, capability, scope)
}
export async function readScopedOriginalMatrix(binding: MatrixScopeBinding, signal?: AbortSignal) {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: matrixBindingRequest(binding), signal, dedupe: false })
  return normalizeScopedMatrixResult(value, binding)
}
