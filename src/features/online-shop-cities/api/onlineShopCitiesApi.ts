import { apiRequest } from '../../../shared/api/apiClient'
import type { OnlineShopCity } from '../types'

export async function getOnlineShopCities(): Promise<OnlineShopCity[]> {
  const result = await apiRequest<unknown>('/seo/info/ecommerce/all')

  return normalizeOnlineShopCities(result)
}

export async function saveOnlineShopCity(city: OnlineShopCity): Promise<OnlineShopCity[]> {
  const result = await apiRequest<unknown>('/seo/info/ecommerce/update', {
    method: 'POST',
    body: city,
  })

  return normalizeOnlineShopCities(result)
}

function normalizeOnlineShopCities(result: unknown): OnlineShopCity[] {
  if (Array.isArray(result)) {
    return result as OnlineShopCity[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as OnlineShopCity[]
  }

  return []
}
