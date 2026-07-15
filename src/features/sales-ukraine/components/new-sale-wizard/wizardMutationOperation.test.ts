import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import type { SalesUkraineSale } from '../../types'
import {
  attemptWizardMutation,
  createWizardOperationId,
  inspectWizardCartMutation,
  isUnknownWizardMutationOutcome,
  retryWizardMutation,
  type WizardMutationOperation,
} from './wizardMutationOperation'

const operationId = '11111111-1111-4111-8111-111111111111'

function sale(items: NonNullable<SalesUkraineSale['Order']>['OrderItems']): SalesUkraineSale {
  return { NetUid: 'sale-1', Order: { OrderItems: items } }
}

describe('wizard mutation idempotency and reconciliation', () => {
  it('keeps unmarked 4xx unknown and recognizes only marked pre-ledger rejection as definitive', () => {
    expect(isUnknownWizardMutationOutcome(new ApiError('domain conflict', 409, null))).toBe(true)
    expect(isUnknownWizardMutationOutcome(new ApiError(
      'model validation',
      400,
      { MutationLedgerState: 'not-entered' },
    ))).toBe(false)
  })

  it('creates one client operation id and does not regenerate it while building the operation', () => {
    const factory = vi.fn(() => operationId)

    expect(createWizardOperationId(factory)).toBe(operationId)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('treats a lost response as committed when the fresh cart carries the same operation id', async () => {
    const mutate = vi.fn(async () => {
      throw new ApiError('connection lost after commit', 0, null)
    })
    const reconcile = vi.fn(async () => sale([{ NetUid: 'item-1', OperationNetUid: operationId, Qty: 2 }]))
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, { kind: 'operation-marker' }),
      mutate,
      operationId,
    }

    await expect(attemptWizardMutation(operation, reconcile)).resolves.toMatchObject({
      status: 'committed-after-reconcile',
    })
    expect(mutate).toHaveBeenCalledOnce()
    expect(mutate).toHaveBeenCalledWith(operationId)
    expect(reconcile).toHaveBeenCalledOnce()
  })

  it('reconciles before retry and reuses the exact same key after an unknown first outcome', async () => {
    const callOrder: string[] = []
    const mutate = vi
      .fn<(id: string) => Promise<void>>()
      .mockImplementationOnce(async (id) => {
        callOrder.push(`mutate:${id}:first`)
        throw new ApiError('network timeout', 0, null)
      })
      .mockImplementationOnce(async (id) => {
        callOrder.push(`mutate:${id}:retry`)
      })
    const reconcile = vi.fn(async () => {
      callOrder.push('reconcile')

      return sale([{ NetUid: 'row-1', Qty: 1 }])
    })
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, {
        afterQty: 2,
        beforeQty: 1,
        kind: 'row-quantity',
        rowNetUid: 'row-1',
      }),
      mutate,
      operationId,
    }

    await expect(attemptWizardMutation(operation, reconcile)).resolves.toMatchObject({ status: 'pending-retry' })
    await expect(retryWizardMutation(operation, reconcile)).resolves.toEqual({ status: 'acknowledged' })

    expect(mutate.mock.calls.map(([id]) => id)).toEqual([operationId, operationId])
    expect(callOrder).toEqual([
      `mutate:${operationId}:first`,
      'reconcile',
      'reconcile',
      `mutate:${operationId}:retry`,
    ])
  })

  it('keeps the exact operation pending after a 400 received after request entry', async () => {
    const mutate = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError('response lost', 500, null))
      .mockRejectedValueOnce(new ApiError('quantity conflict', 400, null))
    const reconcile = vi.fn(async () => sale([{ NetUid: 'row-1', Qty: 1 }]))
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, {
        afterQty: 2,
        beforeQty: 1,
        kind: 'row-quantity',
        rowNetUid: 'row-1',
      }),
      mutate,
      operationId,
    }

    await expect(attemptWizardMutation(operation, reconcile)).resolves.toMatchObject({ status: 'pending-retry' })
    await expect(retryWizardMutation(operation, reconcile)).resolves.toMatchObject({
      status: 'pending-retry',
    })
    expect(mutate.mock.calls.map(([id]) => id)).toEqual([operationId, operationId])
  })

  it('retains an unknown pending retry after another 5xx and keeps the same key', async () => {
    const mutate = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError('first timeout', 500, null))
      .mockRejectedValueOnce(new ApiError('retry timeout', 503, null))
    const reconcile = vi.fn(async () => sale([{ NetUid: 'row-1', Qty: 1 }]))
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, {
        afterQty: 2,
        beforeQty: 1,
        kind: 'row-quantity',
        rowNetUid: 'row-1',
      }),
      mutate,
      operationId,
    }

    await expect(attemptWizardMutation(operation, reconcile)).resolves.toMatchObject({ status: 'pending-retry' })
    await expect(retryWizardMutation(operation, reconcile)).resolves.toMatchObject({ status: 'pending-retry' })
    expect(mutate.mock.calls.map(([id]) => id)).toEqual([operationId, operationId])
  })

  it('does not replay when reconciliation cannot distinguish the mutation from a concurrent change', async () => {
    const mutate = vi.fn<(id: string) => Promise<void>>()
    const reconcile = vi.fn(async () => sale([{ NetUid: 'row-1', Qty: 4 }]))
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, {
        afterQty: 5,
        beforeQty: 2,
        kind: 'row-quantity',
        rowNetUid: 'row-1',
      }),
      mutate,
      operationId,
    }

    await expect(retryWizardMutation(operation, reconcile)).resolves.toMatchObject({
      reconciliationError: null,
      snapshot: sale([{ NetUid: 'row-1', Qty: 4 }]),
      status: 'pending-retry',
    })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('retries an operation marker only when the server projection proves the marker absent', async () => {
    const mutate = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined)
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, { kind: 'operation-marker' }),
      mutate,
      operationId,
    }

    await expect(retryWizardMutation(
      operation,
      async () => ({ NetUid: 'sale-1', OperationNetUid: '', Order: { OrderItems: [] } }),
    )).resolves.toEqual({ status: 'acknowledged' })
    expect(mutate).toHaveBeenCalledExactlyOnceWith(operationId)
  })

  it('does not endlessly resend when the server omitted operation markers from its projection', async () => {
    const mutate = vi.fn<(id: string) => Promise<void>>()
    const operation: WizardMutationOperation<SalesUkraineSale> = {
      context: 'agreement-1:sale-1',
      inspect: (snapshot) => inspectWizardCartMutation(snapshot, operationId, { kind: 'operation-marker' }),
      mutate,
      operationId,
    }

    await expect(retryWizardMutation(
      operation,
      async () => ({ NetUid: 'sale-1', Order: { OrderItems: [] } }),
    )).resolves.toMatchObject({ status: 'pending-retry' })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('does not infer a committed quantity change from row identity and quantity alone', () => {
    const snapshot = sale([
      { NetUid: 'row-a', Product: { Id: 7 }, Qty: 2 },
      { NetUid: 'row-b', Product: { Id: 7 }, Qty: 9 },
    ])

    expect(
      inspectWizardCartMutation(snapshot, operationId, {
        afterQty: 2,
        beforeQty: 5,
        kind: 'row-quantity',
        rowNetUid: 'row-a',
      }),
    ).toBe('unknown')
    expect(
      inspectWizardCartMutation(snapshot, operationId, {
        afterQty: 9,
        beforeQty: 5,
        kind: 'row-quantity',
        rowNetUid: 'missing-row',
      }),
    ).toBe('unknown')
  })

  it('requires the exact row operation marker and expected projection to prove a commit', () => {
    expect(inspectWizardCartMutation(sale([{
      NetUid: 'row-a',
      OperationNetUid: '22222222-2222-4222-8222-222222222222',
      Qty: 5,
    }]), operationId, {
      afterQty: 5,
      beforeQty: 3,
      kind: 'row-quantity',
      rowNetUid: 'row-a',
    })).toBe('unknown')

    expect(inspectWizardCartMutation(sale([{
      NetUid: 'row-a',
      OperationNetUid: operationId,
      Qty: 5,
    }]), operationId, {
      afterQty: 5,
      beforeQty: 3,
      kind: 'row-quantity',
      rowNetUid: 'row-a',
    })).toBe('committed')

    expect(inspectWizardCartMutation(sale([{
      Deleted: true,
      NetUid: 'row-a',
      Qty: 3,
    }]), operationId, {
      beforeQty: 3,
      kind: 'row-deleted',
      rowNetUid: 'row-a',
    })).toBe('unknown')
  })

  it('uses an exact sale marker to prove deletion when the deleted row is absent', () => {
    const snapshot: SalesUkraineSale = {
      NetUid: 'sale-1',
      OperationNetUid: operationId,
      Order: { OrderItems: [] },
    }

    expect(inspectWizardCartMutation(snapshot, operationId, {
      beforeQty: 3,
      kind: 'row-deleted',
      rowNetUid: 'row-a',
    })).toBe('committed')
  })

  it('does not treat an operation marker on a soft-deleted restored row as committed', () => {
    const snapshot: SalesUkraineSale = {
      NetUid: 'sale-1',
      OperationNetUid: operationId,
      Order: {
        OrderItems: [{
          Deleted: true,
          NetUid: 'row-a',
          OperationNetUid: operationId,
          Qty: 5,
        }],
      },
    }

    expect(inspectWizardCartMutation(snapshot, operationId, {
      afterQty: 5,
      beforeQty: 3,
      kind: 'row-quantity',
      rowNetUid: 'row-a',
    })).toBe('unknown')
    expect(inspectWizardCartMutation(snapshot, operationId, {
      beforeQty: 5,
      kind: 'row-deleted',
      rowNetUid: 'row-a',
    })).toBe('committed')
  })
})
