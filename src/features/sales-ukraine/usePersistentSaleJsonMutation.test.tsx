import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  usePersistentSaleJsonMutation,
  usePersistentSaleJsonMutationRunner,
} from './usePersistentSaleJsonMutation'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

beforeEach(clearAllSalesPendingMutations)
afterEach(clearAllSalesPendingMutations)

describe('usePersistentSaleJsonMutation', () => {
  it('does not call a full sale update when its frozen fenced journal cannot be persisted', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const values = new Map<string, string>()
    const storage = {
      clear: vi.fn(() => values.clear()),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      key: vi.fn((index: number) => [...values.keys()][index] ?? null),
      get length() {
        return values.size
      },
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }),
    } satisfies Storage
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
    const request = vi.fn(async () => null)
    const { result } = renderHook(() => usePersistentSaleJsonMutationRunner('sale-update'))

    try {
      await act(async () => {
        await expect(result.current(
          'sale-update:packing-acceptance:sale-1',
          { IsAcceptedToPacking: true, NetUid: 'sale-1' },
          request,
        )).rejects.toThrow('Запит не надіслано')
      })

      expect(request).not.toHaveBeenCalled()
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    }
  })

  it('reconciles the frozen payload before allowing edited data under a new key', async () => {
    const bodies: string[] = []
    const keys: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (payload, operation) => {
        bodies.push(JSON.stringify(payload))
        keys.push(operation.operationId)
        throw new ApiError('response lost', 503, null)
      })
      .mockImplementationOnce(async (payload, operation) => {
        bodies.push(JSON.stringify(payload))
        keys.push(operation.operationId)
      })
      .mockImplementationOnce(async (payload, operation) => {
        bodies.push(JSON.stringify(payload))
        keys.push(operation.operationId)
      })
    const { result } = renderHook(() => usePersistentSaleJsonMutationRunner('sale-update'))
    const context = 'sale-update:invoice-print:sale-1'

    await act(async () => {
      await expect(result.current(
        context,
        { Comment: 'frozen', IsInvoice: true, NetUid: 'sale-1' },
        request,
      )).resolves.toMatchObject({ completed: false, error: expect.any(ApiError) })
    })

    await act(async () => {
      await expect(result.current(
        context,
        { Comment: 'edited', IsInvoice: true, NetUid: 'sale-1' },
        request,
      )).resolves.toMatchObject({
        completed: false,
        error: expect.objectContaining({ message: expect.stringContaining('не відправлено') }),
      })
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(keys[1]).toBe(keys[0])
    expect(bodies[1]).toBe(bodies[0])
    expect(bodies[1]).toContain('frozen')
    expect(bodies[1]).not.toContain('edited')

    await act(async () => {
      await expect(result.current(
        context,
        { Comment: 'edited', IsInvoice: true, NetUid: 'sale-1' },
        request,
      )).resolves.toMatchObject({ completed: true })
    })

    expect(request).toHaveBeenCalledTimes(3)
    expect(keys[2]).not.toBe(keys[0])
    expect(bodies[2]).toContain('edited')
    expect(bodies[0]).toContain('frozen')
    expect(bodies[0]).not.toContain('edited')
  })

  it('reconciles a restored frozen operation before sending edited UI data', async () => {
    const firstBodies: string[] = []
    const firstKeys: string[] = []
    const firstRequest = vi.fn(async (payload, operation) => {
      firstBodies.push(JSON.stringify(payload))
      firstKeys.push(operation.operationId)
      throw new ApiError('timeout', 500, null)
    })
    const firstMount = renderHook(() => usePersistentSaleJsonMutation('discount:sale-1', 'sale-discount'))

    await act(async () => {
      await firstMount.result.current.run({ Comment: 'frozen', NetUid: 'sale-1' }, firstRequest)
    })
    expect(firstMount.result.current.hasPending).toBe(true)
    firstMount.unmount()

    const replayBodies: string[] = []
    const replayKeys: string[] = []
    const replayRequest = vi.fn(async (payload, operation) => {
      replayBodies.push(JSON.stringify(payload))
      replayKeys.push(operation.operationId)

      return { NetUid: 'sale-1' }
    })
    const secondMount = renderHook(() => usePersistentSaleJsonMutation('discount:sale-1', 'sale-discount'))

    await waitFor(() => expect(secondMount.result.current.hasPending).toBe(true))
    let reconciliation: Awaited<ReturnType<typeof secondMount.result.current.run>> | undefined

    await act(async () => {
      reconciliation = await secondMount.result.current.run(
        { Comment: 'edited', NetUid: 'sale-1' },
        replayRequest,
      )
    })

    expect(reconciliation).toEqual({ completed: false })
    expect(replayRequest).toHaveBeenCalledTimes(1)
    expect(secondMount.result.current.hasPending).toBe(false)
    expect(secondMount.result.current.pendingError).toContain('не відправлено')
    expect(replayBodies[0]).toBe(firstBodies[0])
    expect(replayBodies[0]).toContain('frozen')
    expect(replayBodies[0]).not.toContain('edited')
    expect(replayKeys[0]).toBe(firstKeys[0])

    let corrected: Awaited<ReturnType<typeof secondMount.result.current.run>> | undefined
    await act(async () => {
      corrected = await secondMount.result.current.run(
        { Comment: 'edited', NetUid: 'sale-1' },
        replayRequest,
      )
    })

    expect(corrected).toMatchObject({ completed: true })
    expect(replayRequest).toHaveBeenCalledTimes(2)
    expect(replayBodies[1]).toContain('edited')
    expect(replayKeys[1]).not.toBe(firstKeys[0])
    expect(secondMount.result.current.hasPending).toBe(false)
  })

  it('settles a marked pre-ledger journal and permits a corrected request with a new key', async () => {
    const context = 'sale-comment:sale-4'
    const scope: SalesPendingMutationScope = {
      context,
      kind: 'sale-comment',
      userKey: 'net:user-a',
    }
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (_payload, operation) => {
        operationIds.push(operation.operationId)
        throw new ApiError('comment is too long', 400, { MutationLedgerState: 'not-entered' })
      })
      .mockImplementationOnce(async (_payload, operation) => {
        operationIds.push(operation.operationId)
      })
    const { result } = renderHook(() => usePersistentSaleJsonMutationRunner('sale-comment'))

    await act(async () => {
      await expect(result.current(context, { Comment: 'invalid' }, request)).resolves.toMatchObject({
        completed: false,
        error: expect.any(ApiError),
      })
    })

    expect(loadSalesPendingMutation(scope)).toBe(null)

    await act(async () => {
      await expect(result.current(context, { Comment: 'corrected' }, request)).resolves.toMatchObject({
        completed: true,
      })
    })

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).not.toBe(operationIds[0])
  })

  it('does not retain a stale payload when durable persistence fails before sending', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    const values = new Map<string, string>()
    let failNextWrite = true
    const storage = {
      clear: vi.fn(() => values.clear()),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => {
        if (failNextWrite) {
          failNextWrite = false
          throw new DOMException('quota exceeded', 'QuotaExceededError')
        }

        values.set(key, value)
      }),
    } satisfies Storage
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage })

    try {
      const request = vi.fn(async (payload) => payload)
      const { result } = renderHook(() => usePersistentSaleJsonMutation('discount:sale-2', 'sale-discount'))

      await act(async () => {
        await expect(result.current.run({ Comment: 'stale', NetUid: 'sale-2' }, request))
          .rejects.toThrow('Запит не надіслано')
      })
      await act(async () => {
        await expect(result.current.run({ Comment: 'corrected', NetUid: 'sale-2' }, request))
          .resolves.toMatchObject({ completed: true, result: { Comment: 'corrected' } })
      })

      expect(request).toHaveBeenCalledTimes(1)
      expect(request.mock.calls[0]?.[0]).toMatchObject({ Comment: 'corrected' })
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'sessionStorage', descriptor)
      }
    }
  })

  it('distinguishes a nullable acknowledged response from pending reconciliation', async () => {
    const scope: SalesPendingMutationScope = {
      context: 'shift:sale-3',
      kind: 'sale-shift-current',
      userKey: 'net:user-a',
    }
    const request = vi.fn(async () => null)
    const { result } = renderHook(() => (
      usePersistentSaleJsonMutation(scope.context, 'sale-shift-current')
    ))
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined

    await act(async () => {
      outcome = await result.current.run({ NetUid: 'sale-3' }, request)
    })

    expect(outcome).toEqual({ completed: true, result: null })
    expect(result.current.hasPendingOperation()).toBe(false)
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })
})
