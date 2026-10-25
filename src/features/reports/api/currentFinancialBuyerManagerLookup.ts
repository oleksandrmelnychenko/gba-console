import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportEntity, ReportSearchParams } from '../types'
import { FINANCIAL_BUYER_MANAGER_LOOKUP, financialBuyerManagerReference } from '../data/currentFinancialBuyerManagerFilter'

/** Current buyer ownership directory; changing a report date never changes this lookup scope. */
export async function searchCurrentFinancialBuyerManagers(params: ReportSearchParams, signal?: AbortSignal): Promise<ReportEntity[]> {
  if (!Number.isInteger(params.offset) || params.offset < 0 || params.offset > 10000
    || !Number.isInteger(params.limit) || params.limit < 1 || params.limit > 50 || params.value.length > 120)
    throw new Error('Уточніть пошук менеджера покупця: до 120 символів, не більше 50 результатів.')
  const result = await apiRequest<unknown>(FINANCIAL_BUYER_MANAGER_LOOKUP, {
    query: { value: params.value.trim(), offset: params.offset, limit: params.limit }, signal,
  })
  if (!Array.isArray(result) || result.length > params.limit) throw new Error('Сервер повернув некоректний список менеджерів покупця.')
  const seen = new Set<string>()
  return result.map(item => {
    const reference = financialBuyerManagerReference(item?.data)
    if (!reference || typeof item.data !== 'string' || item.id !== reference.Id
      || typeof item.name !== 'string' || !item.name.trim() || seen.has(item.id))
      throw new Error('Сервер повернув некоректних або неоднозначних менеджерів покупця.')
    seen.add(item.id)
    return { Id: reference.Id, Name: item.name, buyerManagerRef: reference }
  })
}
