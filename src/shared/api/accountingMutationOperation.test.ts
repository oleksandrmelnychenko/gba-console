import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient'
import {
  ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED,
  ACCOUNTING_MUTATION_LEDGER_STATE_HEADER,
  classifyAccountingMutationFailure,
  clearPendingAccountingMutation,
  createAccountingMutationOperationId,
  executeAccountingMutation,
  snapshotImmutableAccountingPayload,
} from './accountingMutationOperation'

const firstOperationId = '11111111-1111-4111-8111-111111111111'
const secondOperationId = '22222222-2222-4222-8222-222222222222'

describe('accounting mutation operation', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('normalizes a securely generated UUID and rejects an empty identity', () => {
    expect(createAccountingMutationOperationId(() => firstOperationId.toUpperCase()))
      .toBe(firstOperationId)
    expect(() => createAccountingMutationOperationId(
      () => '00000000-0000-0000-0000-000000000000',
    )).toThrow('OperationNetUid must be a non-empty UUID')
  })

  it('creates a detached deeply frozen JSON snapshot', () => {
    const payload = {
      Amount: 100,
      Nested: {
        Purpose: 'Оплата',
      },
    }

    const snapshot = snapshotImmutableAccountingPayload(payload)
    payload.Nested.Purpose = 'changed'

    expect(snapshot).toEqual({
      Amount: 100,
      Nested: {
        Purpose: 'Оплата',
      },
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.Nested)).toBe(true)
  })

  it('retains the exact key and snapshot after an unknown 5xx, then clears after success', async () => {
    const attempts: Array<{ operationId: string; payload: unknown }> = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (payload, context) => {
        attempts.push({
          operationId: new Headers(context.headers).get('Idempotency-Key') || '',
          payload,
        })
        throw new ApiError('response lost', 503, null)
      })
      .mockImplementationOnce(async (payload, context) => {
        attempts.push({
          operationId: new Headers(context.headers).get('Idempotency-Key') || '',
          payload,
        })

        return { NetUid: 'income-1' }
      })
      .mockImplementationOnce(async (payload, context) => {
        attempts.push({
          operationId: new Headers(context.headers).get('Idempotency-Key') || '',
          payload,
        })

        return { NetUid: 'income-2' }
      })
    const input = {
      Amount: 100,
      Comment: 'Оплата',
    }

    await expect(executeAccountingMutation({
      kind: 'income-payment:add',
      payload: input,
      request,
    })).rejects.toThrow('response lost')
    await expect(executeAccountingMutation({
      kind: 'income-payment:add',
      payload: { Comment: 'Оплата', Amount: 100 },
      request,
    })).resolves.toEqual({ NetUid: 'income-1' })
    await expect(executeAccountingMutation({
      kind: 'income-payment:add',
      payload: input,
      request,
    })).resolves.toEqual({ NetUid: 'income-2' })

    expect(attempts[0]?.operationId).toBeTruthy()
    expect(attempts[1]?.operationId).toBe(attempts[0]?.operationId)
    expect(attempts[2]?.operationId).not.toBe(attempts[0]?.operationId)
    expect(attempts[0]?.payload).toEqual(input)
    expect(attempts[1]?.payload).toBe(attempts[0]?.payload)
  })

  it('coalesces simultaneous equal mutations before asynchronous hashing completes', async () => {
    let resolveRequest: ((value: { NetUid: string }) => void) | undefined
    const operationIds: string[] = []
    const request = vi.fn((_payload, context) => {
      operationIds.push(context.operationId)

      return new Promise<{ NetUid: string }>((resolve) => {
        resolveRequest = resolve
      })
    })

    const first = executeAccountingMutation({
      kind: 'income-payment:add',
      payload: { Amount: 100, Comment: 'parallel' },
      request,
    })
    const second = executeAccountingMutation({
      kind: 'income-payment:add',
      payload: { Comment: 'parallel', Amount: 100 },
      request,
    })

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledOnce()
    })
    resolveRequest?.({ NetUid: 'income-parallel' })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { NetUid: 'income-parallel' },
      { NetUid: 'income-parallel' },
    ])
    expect(operationIds).toHaveLength(1)
    expect(operationIds[0]).toBeTruthy()
  })

  it('does not silently resend a stale snapshot when the same identity changes', async () => {
    const input = {
      Amount: 100,
    }
    let capturedOperationId = ''
    const request = vi.fn(async (_payload, context) => {
      capturedOperationId = context.operationId
      throw new ApiError('network timeout', 0, null)
    })

    await expect(executeAccountingMutation({
      identity: input,
      kind: 'outcome-payment:add',
      payload: input,
      request,
    })).rejects.toThrow('network timeout')

    input.Amount = 200

    await expect(executeAccountingMutation({
      identity: input,
      kind: 'outcome-payment:add',
      payload: input,
      request,
    })).rejects.toThrow(
      'already pending with a different immutable payload',
    )
    expect(request).toHaveBeenCalledOnce()
    expect(clearPendingAccountingMutation(capturedOperationId)).toBe(true)
  })

  it('rejects reuse of an explicit operation id with another payload', async () => {
    const request = vi.fn(async () => {
      throw new ApiError('unknown', 500, null)
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:update',
      operation: { operationId: firstOperationId },
      payload: { Amount: 10 },
      request,
    })).rejects.toThrow('unknown')

    await expect(executeAccountingMutation({
      kind: 'income-payment:update',
      operation: { operationId: firstOperationId },
      payload: { Amount: 11 },
      request,
    })).rejects.toThrow(
      'already pending with a different immutable payload',
    )
    expect(clearPendingAccountingMutation(firstOperationId)).toBe(true)
  })

  it('clears only after an explicit not-entered 4xx marker', async () => {
    const operationIds: string[] = []
    const request = vi.fn(async (_payload, context) => {
      operationIds.push(context.operationId)
      throw new ApiError('validation', 400, {
        MutationLedgerState: ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED,
      })
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:cancel',
      payload: { netId: 'income-1' },
      request,
    })).rejects.toThrow('validation')
    await expect(executeAccountingMutation({
      kind: 'income-payment:cancel',
      payload: { netId: 'income-1' },
      request,
    })).rejects.toThrow('validation')

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).not.toBe(operationIds[0])
  })

  it('keeps unmarked 4xx and network failures unknown', () => {
    expect(classifyAccountingMutationFailure(
      new ApiError('domain conflict', 409, null),
    )).toBe('unknown-outcome')
    expect(classifyAccountingMutationFailure(
      new ApiError('network', 0, null),
    )).toBe('unknown-outcome')
    expect(classifyAccountingMutationFailure(
      new ApiError('not entered', 409, null, {
        [ACCOUNTING_MUTATION_LEDGER_STATE_HEADER]:
          ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED,
      }),
    )).toBe('definitive-failure')
  })

  it('never silently expires or rekeys an unresolved operation over time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T10:00:00.000Z'))
    const operationIds: string[] = []
    const request = vi.fn(async (_payload, context) => {
      operationIds.push(context.operationId)
      throw new ApiError('unknown', 503, null)
    })

    await expect(executeAccountingMutation({
      kind: 'outcome-payment:cancel',
      payload: { netId: 'outcome-expiring' },
      request,
    })).rejects.toThrow('unknown')

    vi.setSystemTime(new Date('2026-07-25T10:00:00.001Z'))

    await expect(executeAccountingMutation({
      kind: 'outcome-payment:cancel',
      payload: { netId: 'outcome-expiring' },
      request,
    })).rejects.toThrow('unknown')

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).toBe(operationIds[0])
    expect(clearPendingAccountingMutation(operationIds[0] || '')).toBe(true)
  })

  it('persists only a SHA-256 signature and operation id for reload recovery', async () => {
    const storage = createMemoryStorage()
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('localStorage', createMemoryStorage())
    let operationId = ''

    await expect(executeAccountingMutation({
      kind: 'outcome-payment:add',
      payload: {
        Amount: 500,
        Comment: 'sensitive-accounting-purpose',
      },
      request: async (_payload, context) => {
        operationId = context.operationId
        throw new ApiError('unknown', 503, null)
      },
    })).rejects.toThrow('unknown')

    const persisted = storage.getItem(
      'gba:accounting-mutation-operations:v1',
    ) || ''

    expect(persisted).toContain(operationId)
    expect(persisted).not.toContain('sensitive-accounting-purpose')
    expect(Object.keys(JSON.parse(persisted) as object)[0]).toMatch(
      /^[0-9a-f]{64}$/,
    )
    expect(clearPendingAccountingMutation(operationId)).toBe(true)
    expect(storage.length).toBe(0)
  })

  it('never reuses a pending accounting key across authenticated users', async () => {
    const localStorage = createMemoryStorage()
    const operationIds: string[] = []
    vi.stubGlobal('localStorage', localStorage)
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }))

    const request = vi.fn(async (_payload, context) => {
      operationIds.push(context.operationId)
      throw new ApiError('unknown', 503, null)
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:add',
      payload: { Amount: 500 },
      request,
    })).rejects.toThrow('unknown')

    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }))

    await expect(executeAccountingMutation({
      kind: 'income-payment:add',
      payload: { Amount: 500 },
      request,
    })).rejects.toThrow('unknown')

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).not.toBe(operationIds[0])
    expect(clearPendingAccountingMutation(operationIds[0] || '')).toBe(true)
    expect(clearPendingAccountingMutation(operationIds[1] || '')).toBe(true)
  })

  it('forwards an optional abort signal without changing the operation identity', async () => {
    const controller = new AbortController()
    const request = vi.fn(async (_payload, context) => ({
      operationId: context.operationId,
      signal: context.signal,
    }))

    await expect(executeAccountingMutation({
      kind: 'income-payment:add',
      operation: {
        operationId: secondOperationId,
        signal: controller.signal,
      },
      payload: { Amount: 1 },
      request,
    })).resolves.toEqual({
      operationId: secondOperationId,
      signal: controller.signal,
    })
  })
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    get length() {
      return values.size
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}
