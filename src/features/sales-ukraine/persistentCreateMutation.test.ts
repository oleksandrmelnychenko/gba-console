import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
} from './pendingSalesMutationRegistry'
import {
  createPersistentCreateMutationScope,
  runPersistentCreateMutation,
  type PersistentCreateMutationFlow,
  type PersistentCreateMutationRequest,
} from './persistentCreateMutation'
import {
  SalesMutationPreflightValidationError,
  type SalesMutationOperationOptions,
} from './salesMutationOperation'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from './salesMutationStorageTestHarness'

const userKey = 'net:user-a'
let storageHarness: SalesMutationStorageHarness

beforeEach(() => {
  storageHarness = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
})

afterEach(() => {
  clearAllSalesPendingMutations()
  storageHarness.dispose()
})

describe('persistent create mutation', () => {
  it.each([
    ['offer', 'new'],
    ['preorder', 'agreement-1:product-1'],
    ['future-reservation', 'client-1:product-1'],
  ] satisfies Array<[PersistentCreateMutationFlow, string]>)(
    'retries %s after a timeout with the same key and frozen payload',
    async (flow, context) => {
      const attempts: Array<{
        frozen: boolean
        operationId: string
        payload: string
      }> = []
      const request: PersistentCreateMutationRequest<Record<string, unknown>, string> = vi.fn(
        async (payload, operation) => {
          const nested = payload.nested

          attempts.push({
            frozen: Object.isFrozen(payload) && Boolean(nested) && Object.isFrozen(nested),
            operationId: operation.operationId,
            payload: JSON.stringify(payload),
          })

          if (attempts.length === 1) {
            throw new ApiError('gateway timeout', 504, null)
          }

          return 'created'
        },
      )
      const initialPayload = { nested: { label: 'frozen' }, qty: 1 }
      const editedPayload = { nested: { label: 'edited' }, qty: 2 }
      const scope = createPersistentCreateMutationScope(flow, context, userKey)

      await expect(runPersistentCreateMutation({
        context,
        flow,
        payload: initialPayload,
        request,
        userKey,
      })).rejects.toThrow('gateway timeout')

      expect(loadSalesPendingMutation(scope)).toMatchObject({
        operationId: attempts[0]?.operationId,
        phase: 'unknown',
      })

      await expect(runPersistentCreateMutation({
        context,
        flow,
        payload: editedPayload,
        request,
        userKey,
      })).resolves.toBe('created')

      expect(attempts).toHaveLength(2)
      expect(attempts[0]?.frozen).toBe(true)
      expect(attempts[1]?.frozen).toBe(true)
      expect(attempts[1]?.operationId).toBe(attempts[0]?.operationId)
      expect(attempts[1]?.payload).toBe(attempts[0]?.payload)
      expect(attempts[1]?.payload).toContain('frozen')
      expect(attempts[1]?.payload).not.toContain('edited')
      expect(loadSalesPendingMutation(scope)).toBe(null)
    },
  )

  it('keeps an unmarked 4xx response pending for reconciliation', async () => {
    const flow = 'preorder'
    const context = 'agreement-2:product-2'
    const scope = createPersistentCreateMutationScope(flow, context, userKey)
    const request = vi.fn(async () => {
      throw new ApiError('conflict without ledger proof', 409, null)
    })

    await expect(runPersistentCreateMutation({
      context,
      flow,
      payload: { qty: 1 },
      request,
      userKey,
    })).rejects.toThrow('conflict without ledger proof')

    expect(loadSalesPendingMutation(scope)).toMatchObject({ phase: 'unknown' })
  })

  it.each([
    new SalesMutationPreflightValidationError('invalid before transport'),
    new ApiError('not entered', 422, { MutationLedgerState: 'not-entered' }),
  ])('clears a definitive pre-ledger failure and permits a corrected operation', async (failure) => {
    const flow = 'future-reservation'
    const context = 'client-2:product-2'
    const scope = createPersistentCreateMutationScope(flow, context, userKey)
    const operationIds: string[] = []
    let attempts = 0
    const request = vi.fn(async (
      _payload: Record<string, unknown>,
      operation: SalesMutationOperationOptions,
    ) => {
      operationIds.push(operation.operationId)
      attempts += 1

      if (attempts === 1) {
        throw failure
      }

      return 'created'
    })

    await expect(runPersistentCreateMutation({
      context,
      flow,
      payload: { qty: 0 },
      request,
      userKey,
    })).rejects.toThrow(failure.message)

    expect(loadSalesPendingMutation(scope)).toBe(null)

    await expect(runPersistentCreateMutation({
      context,
      flow,
      payload: { qty: 1 },
      request,
      userKey,
    })).resolves.toBe('created')

    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).not.toBe(operationIds[0])
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('does not send when the frozen record cannot be persisted', async () => {
    const request = vi.fn(async () => 'created')

    storageHarness.failNextLocalStorage('setItem')

    await expect(runPersistentCreateMutation({
      context: 'new',
      flow: 'offer',
      payload: { lines: [{ qty: 1 }] },
      request,
      userKey,
    })).rejects.toThrow('Запит не надіслано')

    expect(request).not.toHaveBeenCalled()
  })
})
