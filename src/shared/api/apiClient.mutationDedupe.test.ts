import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'

function okResponse() {
  return new Response(JSON.stringify({ Body: { ok: true } }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

describe('apiRequest mutation dedupe (rapid-click guard)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one network request between identical concurrent POSTs', async () => {
    let releaseResponse: (response: Response) => void = () => undefined
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => {
        releaseResponse = resolve
      }),
    )

    const first = apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })
    const second = apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })

    releaseResponse(okResponse())

    await expect(first).resolves.toEqual({ ok: true })
    await expect(second).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not merge mutations with different bodies', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await Promise.all([
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'A' } }),
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'B' } }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends a fresh request once the previous mutation settled', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })
    await apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('respects dedupe:false opt-out', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await Promise.all([
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' }, dedupe: false }),
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' }, dedupe: false }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
