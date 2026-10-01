import { apiRequest } from '../../../shared/api/apiClient'
import { ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS, originalBuyerSalesShareVariant, createOriginalBuyerSalesShareRequest,
  isOriginalBuyerSalesShareCapabilities, normalizeOriginalBuyerSalesShareReport,
  type OriginalBuyerSalesShareCapabilities, type OriginalBuyerSalesShareReport, type OriginalBuyerSalesShareVariant } from '../data/originalBuyerSalesShare'

export async function getOriginalBuyerSalesShareCapabilities(variant: OriginalBuyerSalesShareVariant, signal?: AbortSignal): Promise<OriginalBuyerSalesShareCapabilities> {
  const result = await apiRequest<unknown>(`${ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].Route}/capabilities`, { signal })
  if (!isOriginalBuyerSalesShareCapabilities(result, variant)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return result
}
/** One caller-bound preview returns all scalar cells, totals and both export links. */
export async function previewOriginalBuyerSalesShare(capability: OriginalBuyerSalesShareCapabilities, month: string): Promise<OriginalBuyerSalesShareReport> {
  const request = createOriginalBuyerSalesShareRequest(capability, month)
  const variant = originalBuyerSalesShareVariant(request.SourceIdentity)!
  const result = await apiRequest<unknown>(`${ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].Route}/preview`, { method: 'POST', body: request, dedupe: false })
  return normalizeOriginalBuyerSalesShareReport(result, request)
}
