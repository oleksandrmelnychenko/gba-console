import { apiRequest } from '../../../shared/api/apiClient'
import {
  createCurrencyRateDynamicsRequest, isCurrencyRateDynamicsCapabilities, normalizeCurrencyRateDynamicsDefinitions,
  normalizeCurrencyRateDynamicsReport, type CurrencyRateDynamicsCapabilities, type CurrencyRateDynamicsDefinition,
  type CurrencyRateDynamicsReport,
} from '../data/currencyRateDynamics'

const route = '/report/constructors/currency-rate-dynamics'
export async function getCurrencyRateDynamicsCapabilities(signal?: AbortSignal): Promise<CurrencyRateDynamicsCapabilities> {
  const value = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isCurrencyRateDynamicsCapabilities(value)) throw new Error('Сервер не підтвердив параметри цього конструктора.')
  return value
}
export async function getCurrencyRateDynamicsDefinitions(query: string, offset = 0, limit = 25,
  signal?: AbortSignal): Promise<CurrencyRateDynamicsDefinition[]> {
  if (query.length > 120 || !Number.isInteger(offset) || offset < 0 || offset > 10000
    || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Некоректні параметри пошуку валютних пар.')
  const params = new URLSearchParams({ query, offset: String(offset), limit: String(limit) })
  return normalizeCurrencyRateDynamicsDefinitions(await apiRequest<unknown>(`${route}/rates?${params}`, { signal }))
}
export async function previewCurrencyRateDynamics(capability: CurrencyRateDynamicsCapabilities, month: string,
  definition: CurrencyRateDynamicsDefinition): Promise<CurrencyRateDynamicsReport> {
  const request = createCurrencyRateDynamicsRequest(capability, month, definition)
  const value = await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request })
  return normalizeCurrencyRateDynamicsReport(value, request, definition)
}
