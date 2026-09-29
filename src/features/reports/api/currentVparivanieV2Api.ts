import { apiRequest } from '../../../shared/api/apiClient'
import { currentVparivanieV2Available, normalizeCurrentVparivanieV2,
  CURRENT_VPARIVANIE_V2_DAY, type CurrentVparivanieV2Result } from '../data/currentVparivanieV2'
import type { ReportDataset } from '../types'

export async function readCurrentVparivanieV2(dataset: ReportDataset, buyerId?: string,
  buyerManager?: string, signal?: AbortSignal): Promise<CurrentVparivanieV2Result> {
  if (!currentVparivanieV2Available(dataset))
    throw new Error('Сервер ще не підтвердив регіональну матрицю V2.')
  if (buyerId && !/^[1-9]\d{0,18}$/.test(buyerId)
    || buyerManager && !/^[\da-f]{32}$/i.test(buyerManager))
    throw new Error('Оберіть точний ID покупця або менеджера для V2.')
  const result = await apiRequest<unknown>('/report/datasets/39/region-v2', {
    query: { day: CURRENT_VPARIVANIE_V2_DAY, ...(buyerId ? { buyerId } : {}),
      ...(buyerManager ? { buyerManager: buyerManager.toUpperCase() } : {}) }, signal,
  })
  return normalizeCurrentVparivanieV2(result)
}
