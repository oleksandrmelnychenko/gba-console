import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient'
import {
  ACCOUNTING_MUTATION_LEDGER_FINGERPRINT_CONFLICT,
  ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED,
  ACCOUNTING_MUTATION_LEDGER_STATE_HEADER,
  classifyAccountingMutationFailure,
  clearPendingAccountingMutation,
  createAccountingMutationOperationId,
  executeAccountingMutation,
  snapshotImmutableAccountingPayload,
} from './accountingMutationOperation'

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}))

vi.mock('./apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./apiClient')>()

  return {
    ...actual,
    apiRequest: apiRequestMock,
  }
})

const firstOperationId = '11111111-1111-4111-8111-111111111111'
const secondOperationId = '22222222-2222-4222-8222-222222222222'

describe('accounting mutation operation', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

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

  it('uses an exact retry to recover a committed mutation whose response was lost', async () => {
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
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('recovers a completed response-loss operation before accepting changed payload', async () => {
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        throw new ApiError('response lost', 503, null)
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)

        return { NetUid: 'income-replayed' }
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)

        return { NetUid: 'income-corrected' }
      })

    await expect(executeAccountingMutation({
      kind: 'income-payment:add-reconciled',
      payload: { Amount: 100 },
      request,
    })).rejects.toThrow('response lost')

    apiRequestMock.mockResolvedValue({
      OperationKind: 'income-payment:add-reconciled',
      OperationNetUid: operationIds[0],
      State: 'completed',
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:add-reconciled',
      payload: { Amount: 101 },
      request,
    })).rejects.toThrow(
      'вже виконано',
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/mutations/status',
      {
        dedupe: false,
        query: {
          operationNetUid: operationIds[0],
        },
      },
    )
    expect(operationIds).toHaveLength(1)

    await expect(executeAccountingMutation({
      kind: 'income-payment:add-reconciled',
      payload: { Amount: 100 },
      request,
    })).resolves.toEqual({ NetUid: 'income-replayed' })
    await expect(executeAccountingMutation({
      kind: 'income-payment:add-reconciled',
      payload: { Amount: 101 },
      request,
    })).resolves.toEqual({ NetUid: 'income-corrected' })

    expect(operationIds).toHaveLength(3)
    expect(operationIds[1]).not.toBe(operationIds[0])
    expect(operationIds[2]).not.toBe(operationIds[0])
    expect(operationIds[2]).not.toBe(operationIds[1])
  })

  it('keeps changed payload blocked when status is pending', async () => {
    const operationIds: string[] = []
    const request = vi.fn(async (_payload, context) => {
      operationIds.push(context.operationId)
      throw new ApiError('timeout', 0, null)
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:update-status',
      payload: { Amount: 200 },
      request,
    })).rejects.toThrow('timeout')

    apiRequestMock.mockResolvedValue({
      OperationKind: 'income-payment:update-status',
      OperationNetUid: firstOperationId,
      State: 'pending',
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:update-status',
      payload: { Amount: 201 },
      request,
    })).rejects.toThrow(
      'ще обробляється',
    )

    expect(request).toHaveBeenCalledOnce()
    expect(operationIds).toHaveLength(1)
    expect(clearPendingAccountingMutation(operationIds[0] || '')).toBe(true)
  })

  it('reuses the operation id for changed payload when status is missing', async () => {
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        throw new ApiError('timeout', 0, null)
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        return context.operationId
      })

    await expect(executeAccountingMutation({
      kind: 'income-payment:update-status-missing',
      payload: { Amount: 200 },
      request,
    })).rejects.toThrow('timeout')

    apiRequestMock.mockResolvedValue(null)

    await expect(executeAccountingMutation({
      kind: 'income-payment:update-status-missing',
      payload: { Amount: 201 },
      request,
    })).resolves.toBe(operationIds[0])

    expect(request).toHaveBeenCalledTimes(2)
    expect(operationIds[1]).toBe(operationIds[0])
    expect(clearPendingAccountingMutation(operationIds[0] || '')).toBe(false)
  })

  it('keeps changed payload blocked when reconciliation status is unknown', async () => {
    const operationIds: string[] = []
    const request = vi.fn(async (_payload, context) => {
      operationIds.push(context.operationId)
      throw new ApiError('timeout', 0, null)
    })

    await expect(executeAccountingMutation({
      kind: 'income-payment:update-status-error',
      payload: { Amount: 300 },
      request,
    })).rejects.toThrow('timeout')

    apiRequestMock.mockRejectedValue(
      new ApiError('status unavailable', 503, null),
    )

    await expect(executeAccountingMutation({
      kind: 'income-payment:update-status-error',
      payload: { Amount: 301 },
      request,
    })).rejects.toThrow('status unavailable')

    expect(request).toHaveBeenCalledOnce()
    expect(clearPendingAccountingMutation(operationIds[0] || '')).toBe(true)
  })

  it.each([
    [
      'validation marked not-entered',
      new ApiError('validation', 400, {
        MutationLedgerState: ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED,
      }),
    ],
    [
      'explicit not-entered',
      new ApiError('not entered', 409, {
        MutationLedgerState: ACCOUNTING_MUTATION_LEDGER_NOT_ENTERED,
      }),
    ],
  ])('allows changed payload after %s failure', async (_label, failure) => {
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        throw failure
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)

        return { NetUid: 'income-after-validation' }
      })

    await expect(executeAccountingMutation({
      kind: `income-payment:validation-${failure.status}`,
      payload: { Amount: 400 },
      request,
    })).rejects.toThrow(failure.message)
    await expect(executeAccountingMutation({
      kind: `income-payment:validation-${failure.status}`,
      payload: { Amount: 401 },
      request,
    })).resolves.toEqual({ NetUid: 'income-after-validation' })

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).not.toBe(operationIds[0])
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it.each([
    [
      'timeout',
      () => new ApiError('timeout', 0, null),
    ],
    [
      'abort',
      () => new DOMException('aborted', 'AbortError'),
    ],
  ])('keeps the operation id for an exact retry after %s', async (
    label,
    createFailure,
  ) => {
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        throw createFailure()
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)

        return { NetUid: `income-${label}` }
      })

    await expect(executeAccountingMutation({
      kind: `income-payment:exact-${label}`,
      payload: { Amount: 500 },
      request,
    })).rejects.toThrow()
    await expect(executeAccountingMutation({
      kind: `income-payment:exact-${label}`,
      payload: { Amount: 500 },
      request,
    })).resolves.toEqual({ NetUid: `income-${label}` })

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).toBe(operationIds[0])
    expect(apiRequestMock).not.toHaveBeenCalled()
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

  it('keeps a changed payload blocked while the previous operation is pending', async () => {
    const input = {
      Amount: 100,
    }
    let capturedOperationId = ''
    apiRequestMock.mockResolvedValue({
      OperationKind: 'outcome-payment:add',
      OperationNetUid: firstOperationId,
      State: 'pending',
    })
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
      'ще обробляється',
    )
    expect(request).toHaveBeenCalledOnce()
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/mutations/status',
      {
        dedupe: false,
        query: {
          operationNetUid: capturedOperationId,
        },
      },
    )
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

  it('clears after an explicit not-entered 4xx marker', async () => {
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

  it('keeps ambiguous 4xx and network failures unknown without blocking validation', () => {
    expect(classifyAccountingMutationFailure(
      new ApiError('validation', 400, null),
    )).toBe('unknown-outcome')
    expect(classifyAccountingMutationFailure(
      new ApiError('validation', 422, null),
    )).toBe('unknown-outcome')
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

  it('persists only SHA-256 signatures and operation ids for reload recovery', async () => {
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

  it('keeps a changed payload fail-closed from the persisted journal after reload', async () => {
    const storage = createMemoryStorage()
    let operationId = ''
    vi.stubGlobal('sessionStorage', storage)

    await expect(executeAccountingMutation({
      kind: 'outcome-payment:reload-reconcile',
      payload: { Amount: 600 },
      request: async (_payload, context) => {
        operationId = context.operationId
        throw new ApiError('response lost', 503, null)
      },
    })).rejects.toThrow('response lost')

    vi.resetModules()
    apiRequestMock.mockResolvedValue({
      OperationKind: 'outcome-payment:reload-reconcile',
      OperationNetUid: operationId,
      State: 'pending',
    })
    const restored = await import('./accountingMutationOperation')
    const changedRequest = vi.fn()

    await expect(restored.executeAccountingMutation({
      kind: 'outcome-payment:reload-reconcile',
      payload: { Amount: 601 },
      request: changedRequest,
    })).rejects.toThrow(
      'ще обробляється',
    )

    expect(changedRequest).not.toHaveBeenCalled()
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/mutations/status',
      {
        dedupe: false,
        query: {
          operationNetUid: operationId,
        },
      },
    )
    const exactRequest = vi.fn(async (_payload, context) =>
      context.operationId)

    await expect(restored.executeAccountingMutation({
      kind: 'outcome-payment:reload-reconcile',
      payload: { Amount: 600 },
      request: exactRequest,
    })).resolves.toBe(operationId)

    expect(exactRequest).toHaveBeenCalledOnce()
    expect(storage.length).toBe(0)
    expect(clearPendingAccountingMutation(operationId)).toBe(true)
  })

  it('reuses the unresolved operation id for a changed payload when the ledger has no record after reload', async () => {
    const storage = createMemoryStorage()
    let operationId = ''
    vi.stubGlobal('sessionStorage', storage)

    await expect(executeAccountingMutation({
      kind: 'income-payment:reload-missing',
      payload: { Amount: 700 },
      request: async (_payload, context) => {
        operationId = context.operationId
        throw new ApiError('response lost', 503, null)
      },
    })).rejects.toThrow('response lost')

    vi.resetModules()
    apiRequestMock.mockRejectedValue(
      new ApiError('not found', 404, null),
    )
    const restored = await import('./accountingMutationOperation')
    const changedRequest = vi.fn(async (_payload, context) =>
      context.operationId)

    await expect(restored.executeAccountingMutation({
      kind: 'income-payment:reload-missing',
      payload: { Amount: 701 },
      request: changedRequest,
    })).resolves.toBe(operationId)

    expect(changedRequest).toHaveBeenCalledOnce()
    expect(storage.length).toBe(0)
    expect(clearPendingAccountingMutation(operationId)).toBe(true)
  })

  it('recovers a delayed fingerprint conflict instead of retrying it forever', async () => {
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        throw new ApiError('response lost', 503, null)
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        throw new ApiError(
          'The idempotency key was already used for a different accounting mutation.',
          409,
          null,
          {
            [ACCOUNTING_MUTATION_LEDGER_STATE_HEADER]:
              ACCOUNTING_MUTATION_LEDGER_FINGERPRINT_CONFLICT,
          },
        )
      })
      .mockImplementationOnce(async (_payload, context) => {
        operationIds.push(context.operationId)
        return context.operationId
      })

    await expect(executeAccountingMutation({
      kind: 'income-payment:delayed-ledger-entry',
      payload: { Amount: 710 },
      request,
    })).rejects.toThrow('response lost')

    apiRequestMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        OperationKind: 'income-payment:delayed-ledger-entry',
        OperationNetUid: operationIds[0],
        State: 'completed',
      })

    await expect(executeAccountingMutation({
      kind: 'income-payment:delayed-ledger-entry',
      payload: { Amount: 711 },
      request,
    })).rejects.toThrow('вже виконано')

    expect(operationIds[1]).toBe(operationIds[0])

    await expect(executeAccountingMutation({
      kind: 'income-payment:delayed-ledger-entry',
      payload: { Amount: 711 },
      request,
    })).resolves.not.toBe(operationIds[0])

    expect(operationIds[2]).not.toBe(operationIds[0])
  })

  it('recovers an exact payload from a legacy v1 unresolved journal', async () => {
    const storage = createMemoryStorage()
    let operationId = ''
    vi.stubGlobal('sessionStorage', storage)

    await expect(executeAccountingMutation({
      kind: 'income-payment:legacy-reload',
      payload: { Amount: 800 },
      request: async (_payload, context) => {
        operationId = context.operationId
        throw new ApiError('response lost', 503, null)
      },
    })).rejects.toThrow('response lost')

    const storageKey = 'gba:accounting-mutation-operations:v1'
    const legacyJournal = JSON.parse(
      storage.getItem(storageKey) || '{}',
    ) as Record<string, unknown>
    delete legacyJournal.unresolved
    storage.setItem(storageKey, JSON.stringify(legacyJournal))

    vi.resetModules()
    apiRequestMock.mockRejectedValue(
      new ApiError('not found', 404, null),
    )
    const restored = await import('./accountingMutationOperation')
    const exactRequest = vi.fn(async (_payload, context) =>
      context.operationId)

    await expect(restored.executeAccountingMutation({
      kind: 'income-payment:legacy-reload',
      payload: { Amount: 800 },
      request: exactRequest,
    })).resolves.toBe(operationId)

    expect(exactRequest).toHaveBeenCalledOnce()
    expect(storage.length).toBe(0)
    expect(clearPendingAccountingMutation(operationId)).toBe(true)
  })

  it('never scans a legacy v1 journal across authenticated users', async () => {
    const sessionStorage = createMemoryStorage()
    const localStorage = createMemoryStorage()
    let firstUserOperationId = ''
    vi.stubGlobal('sessionStorage', sessionStorage)
    vi.stubGlobal('localStorage', localStorage)
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }))

    await expect(executeAccountingMutation({
      kind: 'income-payment:legacy-user-scope',
      payload: { Amount: 801 },
      request: async (_payload, context) => {
        firstUserOperationId = context.operationId
        throw new ApiError('response lost', 503, null)
      },
    })).rejects.toThrow('response lost')

    const storageKey = 'gba:accounting-mutation-operations:v1'
    const legacyJournal = JSON.parse(
      sessionStorage.getItem(storageKey) || '{}',
    ) as Record<string, unknown>
    delete legacyJournal.unresolved
    sessionStorage.setItem(storageKey, JSON.stringify(legacyJournal))

    vi.resetModules()
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }))
    const restored = await import('./accountingMutationOperation')
    const secondUserRequest = vi.fn(async (_payload, context) =>
      context.operationId)
    const secondUserOperationId =
      await restored.executeAccountingMutation({
        kind: 'income-payment:legacy-user-scope',
        payload: { Amount: 801 },
        request: secondUserRequest,
      })

    expect(secondUserOperationId).not.toBe(firstUserOperationId)
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(secondUserRequest).toHaveBeenCalledOnce()
    expect(clearPendingAccountingMutation(firstUserOperationId)).toBe(true)
  })

  it('clears a completed unresolved operation and allows a fresh mutation after acknowledgement', async () => {
    const storage = createMemoryStorage()
    let operationId = ''
    vi.stubGlobal('sessionStorage', storage)

    await expect(executeAccountingMutation({
      kind: 'income-payment:reload-completed',
      payload: { Amount: 900 },
      request: async (_payload, context) => {
        operationId = context.operationId
        throw new ApiError('response lost', 503, null)
      },
    })).rejects.toThrow('response lost')

    vi.resetModules()
    apiRequestMock.mockResolvedValue({
      OperationKind: 'income-payment:reload-completed',
      OperationNetUid: operationId,
      State: 'completed',
    })
    const restored = await import('./accountingMutationOperation')
    const changedRequest = vi.fn(async (_payload, context) =>
      context.operationId)

    await expect(restored.executeAccountingMutation({
      kind: 'income-payment:reload-completed',
      payload: { Amount: 901 },
      request: changedRequest,
    })).rejects.toThrow('вже виконано')
    expect(storage.length).toBe(0)

    const nextOperationId = await restored.executeAccountingMutation({
      kind: 'income-payment:reload-completed',
      payload: { Amount: 901 },
      request: changedRequest,
    })

    expect(nextOperationId).not.toBe(operationId)
    expect(changedRequest).toHaveBeenCalledOnce()
    expect(clearPendingAccountingMutation(operationId)).toBe(true)
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
