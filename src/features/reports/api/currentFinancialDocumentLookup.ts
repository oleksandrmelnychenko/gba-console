import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportEntity, ReportSearchParams } from '../types'
import { FINANCIAL_DOCUMENT_LOOKUP, financialDocumentKey, financialDocumentReference } from '../data/currentFinancialDocumentFilter'

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '1900-01-01' || day > '9998-12-31') return false
  const time = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day
}
/** This dedicated lookup is current35 only; callers must also hold capability/mode admission. */
export async function searchCurrentFinancialDocuments(from: string, to: string, params: ReportSearchParams, signal?: AbortSignal): Promise<ReportEntity[]> {
  if (!validDay(from) || !validDay(to) || from > to || Date.parse(to) - Date.parse(from) >= 62 * 86400000
    || !Number.isInteger(params.offset) || params.offset < 0 || params.offset > 10000
    || !Number.isInteger(params.limit) || params.limit < 1 || params.limit > 50 || params.value.length > 120)
    throw new Error('Оберіть коректний період пошуку документів до 62 календарних днів.')
  const result = await apiRequest<unknown>(FINANCIAL_DOCUMENT_LOOKUP, {
    query: { from, to, value: params.value.trim(), offset: params.offset, limit: params.limit }, signal,
  })
  if (!Array.isArray(result) || result.length > params.limit) throw new Error('Сервер повернув некоректний список документів.')
  const seen = new Set<string>()
  return result.map(item => {
    const ref = financialDocumentReference(item?.data)
    if (!ref || typeof item.data !== 'string' || item.id !== financialDocumentKey(ref)
      || typeof item.name !== 'string' || !item.name.trim() || seen.has(item.id))
      throw new Error('Сервер повернув некоректні або неоднозначні документи.')
    seen.add(item.id)
    return { Id: item.id, Name: item.name, documentRef: ref }
  })
}
