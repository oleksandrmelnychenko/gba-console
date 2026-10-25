import { getProductShopGalleryImageUrl } from './utils'

const MAX_PROBES = 30
const BATCH_SIZE = 4
const CACHE_LIMIT = 100
const COMPLETE_TTL_MS = 5 * 60 * 1000
const MISSING_TTL_MS = 30 * 1000
const PROBE_TIMEOUT_MS = 10 * 1000

type ProbeResult = 'found' | 'missing' | 'timeout'
type Request = { controller: AbortController; promise: Promise<string[]>; readers: number }

function probeImage(url: string, signal: AbortSignal): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const image = new window.Image()
    const timer = setTimeout(() => finish('timeout'), PROBE_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timer)
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', abort)
    }
    const finish = (result: ProbeResult) => {
      cleanup()
      if (result === 'timeout') image.removeAttribute('src')
      resolve(result)
    }
    const abort = () => {
      cleanup()
      image.removeAttribute('src')
      reject(new DOMException('Aborted', 'AbortError'))
    }
    image.onload = () => finish('found')
    image.onerror = () => finish('missing')
    signal.addEventListener('abort', abort, { once: true })
    image.src = url
  })
}

/** Shared discovery: closing one card must not cancel another card's gallery. */
export function createShopGalleryLoader() {
  const cache = new Map<string, { urls: string[]; expiresAt: number }>()
  const pending = new Map<string, Request>()

  async function discover(code: string, signal: AbortSignal) {
    const urls: string[] = []
    let ttl = COMPLETE_TTL_MS
    for (let start = 1; start <= MAX_PROBES; start += BATCH_SIZE) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const batch = Array.from({ length: Math.min(BATCH_SIZE, MAX_PROBES - start + 1) }, (_, index) => getProductShopGalleryImageUrl(code, start + index))
      const results = await Promise.all(batch.map(url => probeImage(url, signal)))
      const missing = results.findIndex(result => result !== 'found')
      urls.push(...batch.slice(0, missing < 0 ? batch.length : missing))
      // Image.onerror cannot distinguish a missing file from a transient network failure.
      // Retry incomplete galleries soon; timed-out probes never enter the cache.
      if (results.includes('timeout')) ttl = 0
      else if (missing >= 0) ttl = MISSING_TTL_MS
      if (missing >= 0) break
    }
    if (!signal.aborted && ttl > 0) {
      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value
        if (oldest) cache.delete(oldest)
      }
      cache.set(code, { urls, expiresAt: Date.now() + ttl })
    }
    return urls
  }

  return function acquire(vendorCode: string) {
    const code = vendorCode.trim().toLowerCase()
    const cached = cache.get(code)
    if (cached && cached.expiresAt > Date.now()) return { promise: Promise.resolve(cached.urls), release: () => {} }
    cache.delete(code)
    let request = pending.get(code)
    if (!request) {
      const controller = new AbortController()
      const created: Request = { controller, readers: 0, promise: Promise.resolve([]) }
      created.promise = discover(code, controller.signal).finally(() => {
        if (pending.get(code) === created) pending.delete(code)
      })
      request = created
      pending.set(code, request)
    }
    request.readers += 1
    const current = request
    let released = false
    return {
      promise: current.promise,
      release: () => {
        if (released) return
        released = true
        current.readers -= 1
        if (current.readers === 0 && pending.get(code) === current) {
          pending.delete(code)
          current.controller.abort()
        }
      },
    }
  }
}
