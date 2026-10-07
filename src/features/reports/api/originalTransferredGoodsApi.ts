import { apiRequest } from '../../../shared/api/apiClient'
import { isTransferredCapability, normalizeTransferred, type TransferredCapability, type TransferredRequest, type TransferredResult } from '../data/originalTransferredGoods'
const route = '/report/originals/transferred-goods'
export async function getTransferredCapability(signal?: AbortSignal): Promise<TransferredCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities?world=fenix`, { signal })
  if (!isTransferredCapability(value) || value.World !== 'fenix') throw new Error('Сервер не підтвердив відомість переданих товарів Fenix.')
  return value
}
export async function readTransferred(request: TransferredRequest, signal?: AbortSignal): Promise<TransferredResult> {
  return normalizeTransferred(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
