import { apiRequest } from '../../../shared/api/apiClient'
import { isMatrixCapability, normalizeMatrixResult, type MatrixCapability, type MatrixRequest } from '../data/originalVparivanie'
const route = '/report/originals/vparivanie'
export async function getOriginalMatrixCapability(signal?: AbortSignal): Promise<MatrixCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isMatrixCapability(value) || value.World !== 'fenix') throw new Error('Сервер не підтвердив оригінальну матрицю Fenix.')
  return value
}
export async function readOriginalMatrix(request: MatrixRequest, signal?: AbortSignal) {
  return normalizeMatrixResult(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, signal, dedupe: false }), request)
}
