import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../../../shared/api/apiClient'
import type { Client } from '../types'
import { updateClient } from './clientFormApi'

vi.mock('../../../shared/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/apiClient')>()

  return {
    ...actual,
    apiRequest: vi.fn(),
  }
})

const apiRequestMock = vi.mocked(apiRequest)

describe('client aggregate update operation identity', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    vi.stubGlobal('sessionStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retains the same persisted operation id and payload after an unknown outcome', async () => {
    const client: Client = {
      NetUid: '22222222-2222-4222-8222-222222222222',
      Updated: '2026-07-26T12:00:00.1234567Z',
      FullName: 'Canonical client',
    }
    apiRequestMock
      .mockRejectedValueOnce(new ApiError('response lost', 503, null))
      .mockResolvedValueOnce({
        ...client,
        Updated: '2026-07-26T12:01:00.1234567Z',
      })

    await expect(updateClient({ ...client })).rejects.toThrow('response lost')
    expect(sessionStorage.length).toBe(1)

    await expect(updateClient({ ...client })).resolves.toMatchObject({
      NetUid: client.NetUid,
      Updated: '2026-07-26T12:01:00.1234567Z',
    })

    const firstOptions = apiRequestMock.mock.calls[0]?.[1]
    const retryOptions = apiRequestMock.mock.calls[1]?.[1]
    const firstOperationId = new Headers(firstOptions?.headers).get('Idempotency-Key')
    const retryOperationId = new Headers(retryOptions?.headers).get('Idempotency-Key')

    expect(firstOperationId).toBeTruthy()
    expect(retryOperationId).toBe(firstOperationId)
    expect(retryOptions?.body).toEqual(firstOptions?.body)
    expect(firstOptions?.dedupe).toBe(false)
    expect(retryOptions?.dedupe).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}
