import { apiRequest } from '../../../shared/api/apiClient'
import { isLotAnalysisCapability, normalizeLotAnalysis, type LotAnalysisCapability, type LotAnalysisRequest, type LotAnalysisResult } from '../data/originalLotBalanceAnalysis'
const route = '/report/originals/lot-balance-analysis'
export async function getLotAnalysisCapability(signal?: AbortSignal): Promise<LotAnalysisCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isLotAnalysisCapability(value)) throw new Error('Сервер не підтвердив аналіз залишків партій Fenix.')
  return value
}
export async function readLotAnalysis(request: LotAnalysisRequest, signal?: AbortSignal): Promise<LotAnalysisResult> {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal })
  return normalizeLotAnalysis(value, request)
}
