import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import type { ProductCapitalizationCreatePayload } from './types'

const FIRST_OPERATION_ID =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SECOND_OPERATION_ID =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const FIRST_OWNER =
  '11111111-1111-4111-8111-111111111111'
const SECOND_OWNER =
  '22222222-2222-4222-8222-222222222222'

describe('product capitalization operation', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    sessionStorage.clear()
    setOwner(FIRST_OWNER)
  })

  it(
    'retains the immutable payload and key after 504, then clears on success',
    async () => {
      const operation =
        await import('./productCapitalizationOperation')
      const requests: Array<{
        context: {
          headers: HeadersInit
          operationId: string
          ownerNetUid: string
        }
        payload: unknown
      }> = []
      const request = vi.fn(async (payload, context) => {
        requests.push({ context, payload })
        if (requests.length === 1) {
          throw new ApiError('unknown', 504, null)
        }
        return { Id: 501 }
      })

      await expect(
        operation.executeProductCapitalizationMutation({
          operation: { operationId: FIRST_OPERATION_ID },
          payload: createPayload(),
          request,
        }),
      ).rejects.toBeInstanceOf(ApiError)
      expect(sessionStorage.length).toBe(1)

      const retryPayload = structuredClone(createPayload())
      const result =
        await operation.executeProductCapitalizationMutation({
          payload: retryPayload,
          request,
        })

      expect(result).toEqual({ Id: 501 })
      expect(requests).toHaveLength(2)
      expect(requests.map(({ context }) => context.operationId))
        .toEqual([FIRST_OPERATION_ID, FIRST_OPERATION_ID])
      expect(requests.map(({ context }) =>
        new Headers(context.headers).get(
          operation.PRODUCT_CAPITALIZATION_OWNER_HEADER,
        ))).toEqual([FIRST_OWNER, FIRST_OWNER])
      expect(requests[1].payload).toBe(requests[0].payload)
      expect(sessionStorage.length).toBe(0)
    },
    15_000,
  )

  it('recovers the same pending operation and payload after module reload', async () => {
    let operation =
      await import('./productCapitalizationOperation')
    const firstRequest = vi.fn().mockRejectedValue(
      new ApiError('network', 0, null),
    )

    await expect(
      operation.executeProductCapitalizationMutation({
        operation: { operationId: FIRST_OPERATION_ID },
        payload: createPayload(),
        request: firstRequest,
      }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(
      operation.getPendingProductCapitalizationOperation()
        ?.operationId,
    ).toBe(FIRST_OPERATION_ID)

    vi.resetModules()
    operation =
      await import('./productCapitalizationOperation')
    const request = vi.fn().mockResolvedValue({ Id: 501 })
    const pending =
      operation.getPendingProductCapitalizationOperation()

    expect(pending?.operationId).toBe(FIRST_OPERATION_ID)
    expect(pending?.payload.Comment).toBe('immutable')
    await operation.executeProductCapitalizationMutation({
      payload: structuredClone(createPayload()),
      request,
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][1].operationId)
      .toBe(FIRST_OPERATION_ID)
  })

  it('deduplicates identical in-flight submissions', async () => {
    const operation =
      await import('./productCapitalizationOperation')
    let resolveRequest!: (value: { Id: number }) => void
    const response = new Promise<{ Id: number }>((resolve) => {
      resolveRequest = resolve
    })
    const request = vi.fn(() => response)
    const identity = {}
    const options = {
      operation: {
        identity,
        operationId: FIRST_OPERATION_ID,
      },
      payload: createPayload(),
      request,
    }

    const first =
      operation.executeProductCapitalizationMutation(options)
    const second =
      operation.executeProductCapitalizationMutation(options)
    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledTimes(1))
    resolveRequest({ Id: 501 })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { Id: 501 },
      { Id: 501 },
    ])
  })

  it('does not reuse an owner-scoped pending key after an owner switch', async () => {
    const operation =
      await import('./productCapitalizationOperation')
    const identity = {}
    const request = vi.fn().mockRejectedValue(
      new ApiError('unknown', 504, null),
    )

    await expect(
      operation.executeProductCapitalizationMutation({
        operation: {
          identity,
          operationId: FIRST_OPERATION_ID,
        },
        payload: createPayload(),
        request,
      }),
    ).rejects.toBeInstanceOf(ApiError)

    setOwner(SECOND_OWNER)
    await expect(
      operation.executeProductCapitalizationMutation({
        operation: { identity },
        payload: createPayload(),
        request,
      }),
    ).rejects.toThrow('different immutable payload or owner')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each(['not-entered', 'rolled-back'])(
    'clears only after a server-proven %s response',
    async (ledgerState) => {
      const operation =
        await import('./productCapitalizationOperation')
      const operationIds: string[] = []
      const request = vi.fn(async (_payload, context) => {
        operationIds.push(context.operationId)
        if (operationIds.length === 1) {
          throw new ApiError('definitive', 409, null, {
            [operation.PRODUCT_CAPITALIZATION_LEDGER_STATE_HEADER]:
              ledgerState,
          })
        }
        return { Id: 501 }
      })

      await expect(
        operation.executeProductCapitalizationMutation({
          operation: { operationId: FIRST_OPERATION_ID },
          payload: createPayload(),
          request,
        }),
      ).rejects.toBeInstanceOf(ApiError)
      await operation.executeProductCapitalizationMutation({
        operation: { operationId: SECOND_OPERATION_ID },
        payload: {
          ...createPayload(),
          Comment: 'changed after rollback',
        },
        request,
      })

      expect(operationIds).toEqual([
        FIRST_OPERATION_ID,
        SECOND_OPERATION_ID,
      ])
    },
  )

  it.each([408, 500, 504])(
    'retains the same key for unknown HTTP %s outcomes',
    async (status) => {
      const operation =
        await import('./productCapitalizationOperation')
      const operationIds: string[] = []
      const request = vi.fn(async (_payload, context) => {
        operationIds.push(context.operationId)
        if (operationIds.length === 1) {
          throw new ApiError('unknown', status, null, {
            [operation.PRODUCT_CAPITALIZATION_LEDGER_STATE_HEADER]:
              'rolled-back',
          })
        }
        return { Id: 501 }
      })

      await expect(
        operation.executeProductCapitalizationMutation({
          operation: { operationId: FIRST_OPERATION_ID },
          payload: createPayload(),
          request,
        }),
      ).rejects.toBeInstanceOf(ApiError)
      await operation.executeProductCapitalizationMutation({
        payload: createPayload(),
        request,
      })

      expect(operationIds).toEqual([
        FIRST_OPERATION_ID,
        FIRST_OPERATION_ID,
      ])
    },
  )

  it('rejects invalid runtime payload before allocating or sending a key', async () => {
    const operation =
      await import('./productCapitalizationOperation')
    const request = vi.fn()
    const payload = createPayload()
    payload.ProductCapitalizationItems[0].Qty =
      Number.POSITIVE_INFINITY

    await expect(
      operation.executeProductCapitalizationMutation({
        payload,
        request,
      }),
    ).rejects.toThrow('quantity must be finite')
    expect(request).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it('does not issue a request when the pending operation cannot be persisted', async () => {
    const operation =
      await import('./productCapitalizationOperation')
    const request = vi.fn()
    const descriptor =
      Object.getOwnPropertyDescriptor(
        window,
        'sessionStorage',
      )
    const blockedStorage: Storage = {
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new DOMException(
          'Storage unavailable',
          'QuotaExceededError',
        )
      }),
    }
    Object.defineProperty(
      window,
      'sessionStorage',
      {
        configurable: true,
        value: blockedStorage,
      },
    )

    try {
      await expect(
        operation.executeProductCapitalizationMutation({
          operation: { operationId: FIRST_OPERATION_ID },
          payload: createPayload(),
          request,
        }),
      ).rejects.toThrow('could not be persisted')
      expect(request).not.toHaveBeenCalled()
    } finally {
      if (descriptor) {
        Object.defineProperty(
          window,
          'sessionStorage',
          descriptor,
        )
      } else {
        Reflect.deleteProperty(
          window,
          'sessionStorage',
        )
      }
    }
  })
})

function setOwner(ownerNetUid: string) {
  localStorage.setItem(
    'gba_console_session',
    JSON.stringify({ userNetUid: ownerNetUid }),
  )
}

function createPayload(): ProductCapitalizationCreatePayload {
  return {
    Comment: 'immutable',
    FromDate: '2026-07-26T10:00:00.000Z',
    Organization: {
      Id: 11,
      NetUid: '33333333-3333-4333-8333-333333333333',
    },
    ProductCapitalizationItems: [{
      Product: {
        Id: 31,
        NetUid: '55555555-5555-4555-8555-555555555555',
      },
      ProductId: 31,
      Qty: 2,
      UnitPrice: 10,
      Weight: 0.5,
    }],
    Storage: {
      Id: 21,
      NetUid: '44444444-4444-4444-8444-444444444444',
    },
  }
}
