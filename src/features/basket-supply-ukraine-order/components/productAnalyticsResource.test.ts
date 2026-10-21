import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProductAnalytics } from '../../assortment/api/assortmentApi'
import { clearProductAnalyticsResource, loadProductAnalytics } from './productAnalyticsResource'
import { clearSession, notifyUnauthorized, saveSession } from '../../../shared/auth/session'
vi.mock('../../assortment/api/assortmentApi', () => ({ getProductAnalytics: vi.fn() }))
const result = { sales_series: [] } as unknown as Awaited<ReturnType<typeof getProductAnalytics>>
beforeEach(() => { clearSession(); clearProductAnalyticsResource(); vi.mocked(getProductAnalytics).mockReset() })
describe('product analytics resource', () => {
  it('shares requests and separates periods and as-of dates', async () => {
    vi.mocked(getProductAnalytics).mockResolvedValue(result)
    const first = loadProductAnalytics(42, 12, '2026-10-21')
    expect(loadProductAnalytics(42, 12, '2026-10-21')).toBe(first)
    await first
    expect(loadProductAnalytics(42, 12, '2026-10-21')).toBe(first)
    await loadProductAnalytics(42, 3, '2026-10-21')
    await loadProductAnalytics(42, 12, '2026-10-20')
    expect(getProductAnalytics).toHaveBeenCalledTimes(3)
  })
  it('does not cache failures', async () => {
    vi.mocked(getProductAnalytics).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result)
    await expect(loadProductAnalytics(42, 12)).rejects.toThrow('offline')
    await expect(loadProductAnalytics(42, 12)).resolves.toBe(result)
    expect(getProductAnalytics).toHaveBeenCalledTimes(2)
  })
  it('never reuses another signed-in session’s completed analytics', async () => {
    saveSession({ userNetUid: 'user-a', csrfToken: 'session-a' })
    vi.mocked(getProductAnalytics).mockResolvedValue(result)
    const first = loadProductAnalytics(42, 12)
    await first
    clearSession()
    saveSession({ userNetUid: 'user-b', csrfToken: 'session-b' })
    const second = loadProductAnalytics(42, 12)
    expect(second).not.toBe(first)
    await second
    expect(getProductAnalytics).toHaveBeenCalledTimes(2)
  })
  it('aborts an old pending request and rejects its result even if the transport ignores abort', async () => {
    let finish!: (value: typeof result) => void
    saveSession({ userNetUid: 'user-a', csrfToken: 'session-a' })
    vi.mocked(getProductAnalytics).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const first = loadProductAnalytics(42, 12)
    const rejection = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const oldSignal = vi.mocked(getProductAnalytics).mock.calls[0][3]
    clearSession()
    saveSession({ userNetUid: 'user-a', csrfToken: 'session-a-new' })
    expect(oldSignal?.aborted).toBe(true)
    vi.mocked(getProductAnalytics).mockResolvedValueOnce(result)
    const second = loadProductAnalytics(42, 12)
    await second
    finish(result)
    await rejection
    expect(loadProductAnalytics(42, 12)).toBe(second)
  })
  it('invalidates cached responses immediately on unauthorized events', async () => {
    vi.mocked(getProductAnalytics).mockResolvedValue(result)
    const first = loadProductAnalytics(42, 12)
    await first
    notifyUnauthorized()
    const second = loadProductAnalytics(42, 12)
    await second
    expect(second).not.toBe(first)
    expect(getProductAnalytics).toHaveBeenCalledTimes(2)
  })
})
