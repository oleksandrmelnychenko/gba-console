import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'

afterEach(() => vi.unstubAllGlobals())
describe('explicit API envelope response mode', () => {
  it.each([[], null])('retains metadata for empty Body %j, with default body behavior unchanged', async Body => {
    const payload = { Body, PhysicalCoverage: [{ ImportedPeriodComplete: false }] }
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const [envelope, body] = await Promise.all([
      apiRequest('/coverage-test', { responseMode: 'envelope' }), apiRequest('/coverage-test'),
    ])
    expect(envelope).toEqual(payload)
    expect(body).toEqual(Body)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty('responseMode')
  })
  it('still rejects a non-success envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ErrorCode: 1, ErrorMessage: 'Failed', Body: [] }), { status: 400 })))
    await expect(apiRequest('/coverage-error', { responseMode: 'envelope' })).rejects.toThrow()
  })
})
