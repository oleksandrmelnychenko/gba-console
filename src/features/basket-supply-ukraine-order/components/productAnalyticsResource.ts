import { getProductAnalytics } from '../../assortment/api/assortmentApi'
import type { ProductAnalytics } from '../../assortment/types'
import { AUTH_SESSION_CHANGED_EVENT, AUTH_UNAUTHORIZED_EVENT, readSession } from '../../../shared/auth/session'

type Entry = { promise: Promise<ProductAnalytics>; expiresAt: number; controller: AbortController }
const cache = new Map<string, Entry>()
const MAX_ENTRIES = 60
const TTL_MS = 60_000
const invalidationListeners = new Set<() => void>()
let generation = 0
let sessionScope: string | null = null

function readSessionScope(): string | null {
  try {
    const session = readSession()
    return JSON.stringify([session?.userNetUid ?? session?.user?.NetUid ?? session?.user?.Id ?? null, session?.csrfToken ?? null])
  } catch {
    // Without session storage, do not reuse data whose owner cannot be verified.
    return null
  }
}

function synchronizeSessionScope() {
  const current = readSessionScope()
  if (current !== sessionScope) {
    sessionScope = current
    clearProductAnalyticsResource()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, synchronizeSessionScope)
  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearProductAnalyticsResource)
  window.addEventListener('storage', synchronizeSessionScope)
  if (import.meta.hot) import.meta.hot.dispose(() => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, synchronizeSessionScope)
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearProductAnalyticsResource)
    window.removeEventListener('storage', synchronizeSessionScope)
    clearProductAnalyticsResource()
  })
}

/** Share in-flight requests across expanded rows; never cache failures. */
export function loadProductAnalytics(productId: number, months: number, asOfDate?: string) {
  synchronizeSessionScope()
  const today = new Date()
  const day = asOfDate ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const key = `${productId}:${day}:${months}`
  const current = sessionScope === null ? undefined : cache.get(key)
  if (current && current.expiresAt > Date.now()) return current.promise
  const requestGeneration = generation
  const controller = new AbortController()
  const entry: Entry = {
    controller,
    expiresAt: Number.POSITIVE_INFINITY,
    promise: getProductAnalytics(productId, asOfDate, months, controller.signal).then((data) => {
      synchronizeSessionScope()
      if (controller.signal.aborted || requestGeneration !== generation) {
        throw new DOMException('Analytics session changed', 'AbortError')
      }
      entry.expiresAt = Date.now() + TTL_MS
      return data
    }).catch((error: unknown) => {
      if (cache.get(key) === entry) cache.delete(key)
      throw error
    }),
  }
  if (sessionScope !== null) cache.set(key, entry)
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  return entry.promise
}

export function clearProductAnalyticsResource() {
  generation += 1
  for (const entry of cache.values()) entry.controller.abort()
  cache.clear()
  invalidationListeners.forEach((listener) => listener())
}

export function getProductAnalyticsGeneration() { return generation }

export function subscribeProductAnalyticsGeneration(listener: () => void) {
  invalidationListeners.add(listener)
  return () => { invalidationListeners.delete(listener) }
}
