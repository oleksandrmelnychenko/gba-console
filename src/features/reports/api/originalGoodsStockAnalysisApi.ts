import { apiRequest } from '../../../shared/api/apiClient'
import { isGoodsAnalysisCapability, normalizeGoodsAnalysis, type GoodsAnalysisCapability, type GoodsAnalysisRequest, type GoodsAnalysisResult } from '../data/originalGoodsStockAnalysis'
const route = '/report/originals/goods-stock-analysis'
export async function getGoodsAnalysisCapability(signal?: AbortSignal): Promise<GoodsAnalysisCapability> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isGoodsAnalysisCapability(value)) throw new Error('Сервер не підтвердив аналіз товарних залишків Fenix.')
  return value
}
export async function readGoodsAnalysis(request: GoodsAnalysisRequest, signal?: AbortSignal): Promise<GoodsAnalysisResult> {
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal })
  return normalizeGoodsAnalysis(value, request)
}
