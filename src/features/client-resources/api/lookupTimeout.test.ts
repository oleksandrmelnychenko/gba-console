import { afterEach, describe, expect, it, vi } from 'vitest'
import { withLookupTimeout } from './lookupTimeout'

describe('withLookupTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fails a lookup that never answers with the readable message', async () => {
    vi.useFakeTimers()
    const pending = withLookupTimeout(new Promise<never>(() => undefined), 'Сервер не повернув список типів цін.', 20_000)
    const assertion = expect(pending).rejects.toThrow('Сервер не повернув список типів цін.')

    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
  })

  it('passes a timely answer and the original error through', async () => {
    await expect(withLookupTimeout(Promise.resolve([1]), 'x')).resolves.toEqual([1])
    await expect(withLookupTimeout(Promise.reject(new Error('400 body')), 'x')).rejects.toThrow('400 body')
  })
})
