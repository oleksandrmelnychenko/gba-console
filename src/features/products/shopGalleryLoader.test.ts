import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createShopGalleryLoader } from './shopGalleryLoader'

class Probe {
  static pending: Probe[] = []
  static auto = true
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  url = ''
  cancelled = false
  set src(url: string) {
    this.url = url
    Probe.pending.push(this)
    if (Probe.auto) queueMicrotask(() => /_1_water/.test(url) ? this.onload?.() : this.onerror?.())
  }
  removeAttribute() { this.cancelled = true }
}
const original = window.Image
beforeEach(() => {
  Probe.pending = []; Probe.auto = true
  Object.defineProperty(window, 'Image', { configurable: true, value: Probe })
})
afterEach(() => {
  Object.defineProperty(window, 'Image', { configurable: true, value: original })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('shares a batch between cards and only aborts when the last reader closes', async () => {
  Probe.auto = false
  const load = createShopGalleryLoader()
  const first = load('CODE'), second = load(' code ')
  const rejected = first.promise.catch(error => error)
  expect(first.promise).toBe(second.promise)
  expect(Probe.pending).toHaveLength(4)
  first.release()
  expect(Probe.pending.every(image => !image.cancelled)).toBe(true)
  second.release()
  expect(Probe.pending.every(image => image.cancelled && image.onload === null && image.onerror === null)).toBe(true)
  expect((await rejected).name).toBe('AbortError')
  Probe.auto = true
  const retry = load('code')
  expect(await retry.promise).toHaveLength(1)
  expect(Probe.pending).toHaveLength(8)
  retry.release()
})

it('expires incomplete galleries so a transient failure does not last for the whole session', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const load = createShopGalleryLoader()
  expect(await load('cached').promise).toHaveLength(1)
  expect(await load('cached').promise).toHaveLength(1)
  expect(Probe.pending).toHaveLength(4)
  now.mockReturnValue(31001)
  await load('cached').promise
  expect(Probe.pending).toHaveLength(8)
})

it('bounds completed cache entries and stops probing at the first missing batch', async () => {
  const load = createShopGalleryLoader()
  for (let index = 0; index < 101; index++) await load(`code-${index}`).promise
  expect(Probe.pending).toHaveLength(404)
  await load('code-100').promise
  expect(Probe.pending).toHaveLength(404)
  await load('code-0').promise
  expect(Probe.pending).toHaveLength(408)
})

it('times out hung image probes and permits a fresh attempt without caching the timeout', async () => {
  vi.useFakeTimers()
  Probe.auto = false
  const load = createShopGalleryLoader()
  const request = load('slow')
  await vi.advanceTimersByTimeAsync(10000)
  expect(await request.promise).toEqual([])
  expect(Probe.pending.every(image => image.cancelled)).toBe(true)
  const retry = load('slow')
  const rejected = retry.promise.catch(error => error)
  expect(Probe.pending).toHaveLength(8)
  retry.release()
  expect((await rejected).name).toBe('AbortError')
})
