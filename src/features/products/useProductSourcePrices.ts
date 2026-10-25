import { useI18n } from '../../shared/i18n/useI18n'
import { getProductSourcePriceComparison } from './api/productsApi'
import type { ProductSourcePriceComparison } from './types'
import { useProductResource } from './useProductResource'

const CACHE_TTL_MS = 2 * 60 * 1000
const CACHE_LIMIT = 100
const cache = new Map<string, { expiresAt: number; value: ProductSourcePriceComparison }>()

function cachedPrices(key: string) {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value
}

async function loadPrices(key: string, signal?: AbortSignal) {
  const cached = cachedPrices(key)
  if (cached) return cached
  const [productNetId] = JSON.parse(key) as [string, number]
  const result = await getProductSourcePriceComparison(productNetId, signal)
  // An aborted request must not populate the shared cache even if its transport resolves late.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (!result || (result.ProductNetId && result.ProductNetId.toLowerCase() !== productNetId.toLowerCase())) throw new Error()
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}

export function useProductSourcePrices(productNetId?: string, refreshKey = 0) {
  const { t } = useI18n()
  const key = productNetId ? JSON.stringify([productNetId, refreshKey]) : undefined
  const resource = useProductResource(key, loadPrices, null, t('Не вдалося завантажити ціни з джерел'))
  const comparison = resource.value ?? (key ? cachedPrices(key) : null)
  return { comparison, error: resource.error, isLoading: resource.isLoading, retry: resource.refresh }
}
