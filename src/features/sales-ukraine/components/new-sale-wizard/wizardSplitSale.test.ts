import { describe, expect, it, vi } from 'vitest'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import type { WizardSaleProduct } from './wizardSaleProduct'
import {
  addWizardSplitOrderItem,
  buildWizardSplitSale,
  commitWizardSplitMutation,
  createWizardSplitOrderItem,
  createWizardSplitRestoreMutation,
  ensureWizardSplitRestoreOperationNetUids,
  findRestorableWizardOrderItem,
  getWizardMutationContextKey,
  isWizardMutationContextCurrent,
  mapWizardSplitOrderItem,
  resolveWizardPendingSplitExtraction,
  restoreWizardSplitItemsDurably,
  restoreWizardSplitItemsSequentially,
  type WizardSplitOrderItem,
  type WizardSplitRecoverySource,
} from './wizardSplitSale'

const product: WizardSaleProduct = {
  Id: 11,
  NetUid: 'product-a',
  CurrentLocalPrice: 50,
  CurrentPrice: 10,
  CurrentPriceEurToUah: 60,
}

const recoverySource: WizardSplitRecoverySource = {
  agreementNetId: 'agreement-a',
  origin: 'ordinary',
  saleNetUid: 'sale-a',
  userKey: 'net:user-a',
}

function sourceItem(patch: Partial<SalesUkraineOrderItem> = {}): SalesUkraineOrderItem & { Product: WizardSaleProduct } {
  return {
    AssignedSpecification: { Id: 21, NetUid: 'spec-a', SpecificationCode: 'SPEC-A' },
    Comment: 'row comment',
    Discount: 4,
    Id: 101,
    IsFromReSale: false,
    NetUid: 'source-row-a',
    OneTimeDiscount: 7,
    OneTimeDiscountComment: 'approved discount',
    PricePerItem: 9.3,
    Product: product,
    Qty: 5,
    TotalAmount: 46.5,
    TotalAmountEurToUah: 279,
    TotalAmountLocal: 232.5,
    User: { Id: 8, NetUid: 'user-a', LastName: 'Manager' },
    ...patch,
  }
}

describe('wizard split sale mapping', () => {
  it('preserves source provenance, resale state, and one-time discount fields in the new-sale payload', () => {
    const splitItem = createWizardSplitOrderItem(sourceItem({ IsFromReSale: true }), 2, undefined)
    const current: SalesUkraineSale = {
      ClientAgreement: { NetUid: 'agreement-a' },
      IsVatSale: false,
      NetUid: 'sale-a',
      OneTimeDiscountComment: 'sale approval',
      Order: { OrderSource: 3 },
    }

    const payload = buildWizardSplitSale(current, [splitItem])
    const payloadItem = payload.Order?.OrderItems?.[0]

    expect(payload.OneTimeDiscountComment).toBe('sale approval')
    expect(payload.Order?.OrderSource).toBe(3)
    expect(payloadItem).toMatchObject({
      Comment: 'row comment',
      Discount: 4,
      Id: 0,
      IsFromReSale: true,
      NetUid: '00000000-0000-0000-0000-000000000000',
      OneTimeDiscount: 7,
      OneTimeDiscountComment: 'approved discount',
      PricePerItem: 9.3,
      Qty: 2,
      SourceOrderItemNetUid: 'source-row-a',
      TotalAmount: 18.6,
      TotalAmountEurToUah: 111.6,
      TotalAmountLocal: 93,
      AssignedSpecification: { Id: 21, NetUid: 'spec-a', SpecificationCode: 'SPEC-A' },
    })
  })

  it('merges repeated quantities only when the complete row identity matches', () => {
    const source = sourceItem()
    const first = addWizardSplitOrderItem([], source, 2, source.Comment)
    const next = addWizardSplitOrderItem(first, source, 1, source.Comment)

    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ Qty: 3, SourceOrderItemNetUid: 'source-row-a', TotalAmount: 27.9 })
  })

  it('keeps same-product rows separate when source, resale, discount, or provenance differs', () => {
    const original = sourceItem()
    const first = addWizardSplitOrderItem([], original, 1, original.Comment)
    const variants: Array<[string, SalesUkraineOrderItem & { Product: WizardSaleProduct }]> = [
      ['product source', sourceItem({ Product: { ...product, NetUid: 'product-b' } })],
      ['source row', sourceItem({ NetUid: 'source-row-b' })],
      ['resale state', sourceItem({ IsFromReSale: true })],
      ['base discount', sourceItem({ Discount: 5 })],
      ['one-time discount', sourceItem({ OneTimeDiscount: 8 })],
      ['one-time discount comment', sourceItem({ OneTimeDiscountComment: 'different approval' })],
      [
        'assigned specification',
        sourceItem({ AssignedSpecification: { Id: 22, NetUid: 'spec-b', SpecificationCode: 'SPEC-B' } }),
      ],
    ]

    for (const [label, variant] of variants) {
      const result = addWizardSplitOrderItem(first, variant, 1, variant.Comment)

      expect(result, label).toHaveLength(2)
    }
  })

  it('uses the current persisted row as the split source instead of stale inherited provenance', () => {
    const splitItem = createWizardSplitOrderItem(
      sourceItem({ NetUid: 'current-row', SourceOrderItemNetUid: 'older-row' }),
      1,
      'new comment',
    )

    expect(splitItem.SourceOrderItemNetUid).toBe('current-row')
  })

  it('preserves an explicit split comment instead of restoring the source comment', () => {
    const splitItem = createWizardSplitOrderItem(sourceItem({ Comment: 'source comment' }), 1, 'explicit split comment')

    expect(splitItem.Comment).toBe('explicit split comment')
    expect(mapWizardSplitOrderItem(splitItem).Comment).toBe('explicit split comment')
  })

  it('restores to the exact persisted source row even when split metadata changed', () => {
    const original = sourceItem({ Comment: 'original', NetUid: 'source-row-a' })
    const sibling = sourceItem({ Comment: 'changed', NetUid: 'source-row-b' })
    const splitItem = createWizardSplitOrderItem(original, 1, 'changed')
    splitItem.AssignedSpecification = { Id: 99, NetUid: 'changed-spec' }

    expect(findRestorableWizardOrderItem([sibling, original], splitItem)?.NetUid).toBe('source-row-a')
  })

  it('does not mutate the split row while mapping it for submission', () => {
    const splitItem: WizardSplitOrderItem = createWizardSplitOrderItem(sourceItem(), 2, undefined)
    const before = structuredClone(splitItem)

    buildWizardSplitSale({ NetUid: 'sale-a' }, [splitItem])

    expect(splitItem).toEqual(before)
  })

  it('does not commit a local split mutation when the server write fails', async () => {
    const commitLocal = vi.fn()

    await expect(
      commitWizardSplitMutation(() => Promise.reject(new Error('server rejected')), commitLocal),
    ).rejects.toThrow('server rejected')

    expect(commitLocal).not.toHaveBeenCalled()
  })

  it('reports the committed prefix and retains every un-restored item after a partial restore', async () => {
    const items = ['a', 'b', 'c'].map((suffix) =>
      createWizardSplitOrderItem(sourceItem({ NetUid: `source-row-${suffix}` }), 1, undefined),
    )
    const attempts: string[] = []
    const remainingAfterCommits: string[][] = []

    const result = await restoreWizardSplitItemsSequentially(
      items,
      async (item, index) => {
        attempts.push(item.SourceOrderItemNetUid ?? '')

        if (index === 2) {
          throw new Error('third restore failed')
        }
      },
      ({ remaining }) => {
        remainingAfterCommits.push(remaining.map((item) => item.SourceOrderItemNetUid ?? ''))
      },
    )

    expect(attempts).toEqual(['source-row-a', 'source-row-b', 'source-row-c'])
    expect(result.committed.map((item) => item.SourceOrderItemNetUid)).toEqual(['source-row-a', 'source-row-b'])
    expect(result.remaining.map((item) => item.SourceOrderItemNetUid)).toEqual(['source-row-c'])
    expect(result.error).toEqual(expect.objectContaining({ message: 'third restore failed' }))
    expect(result.reconciliationError).toBe(null)
    expect(remainingAfterCommits).toEqual([
      ['source-row-b', 'source-row-c'],
      ['source-row-c'],
    ])
  })

  it('tracks restore operation ids before the first write and reconciles a first-item failure', async () => {
    const operationIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]
    const createOperationId = vi.fn(() => operationIds.shift() as string)
    const tracked = ensureWizardSplitRestoreOperationNetUids(
      [
        createWizardSplitOrderItem(sourceItem({ NetUid: 'source-row-a' }), 1, undefined),
        createWizardSplitOrderItem(sourceItem({ NetUid: 'source-row-b' }), 1, undefined),
      ],
      createOperationId,
    )
    const restoreItem = vi.fn<(
      item: WizardSplitOrderItem,
      index: number,
      operationId: string,
      isRetry: boolean,
    ) => Promise<void>>(async () => {
      throw new Error('response lost')
    })
    const reconcileFailure = vi.fn(async () => 'pending' as const)

    const first = await restoreWizardSplitItemsSequentially(
      tracked,
      restoreItem,
      undefined,
      reconcileFailure,
    )
    const second = await restoreWizardSplitItemsSequentially(
      first.remaining,
      restoreItem,
      undefined,
      reconcileFailure,
    )

    expect(createOperationId).toHaveBeenCalledTimes(2)
    expect(restoreItem.mock.calls[0]?.[2]).toBe('11111111-1111-4111-8111-111111111111')
    expect(restoreItem.mock.calls[1]?.[2]).toBe('11111111-1111-4111-8111-111111111111')
    expect(restoreItem.mock.calls[0]?.[3]).toBe(false)
    expect(restoreItem.mock.calls[1]?.[3]).toBe(true)
    expect(reconcileFailure).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ SourceOrderItemNetUid: 'source-row-a' }),
      0,
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ message: 'response lost' }),
    )
    expect(first.committed).toEqual([])
    expect(first.remaining[0]?.RestoreOperationNetUid).toBe('11111111-1111-4111-8111-111111111111')
    expect(second.remaining[0]?.RestoreOperationNetUid).toBe(first.remaining[0]?.RestoreOperationNetUid)
  })

  it('drops restore tracking after a definitive failure so corrected retry gets a new key', async () => {
    const item = createWizardSplitOrderItem(sourceItem({ NetUid: 'source-row-a' }), 1, undefined)
    item.RestoreAttempted = true
    item.RestoreOperationNetUid = '33333333-3333-4333-8333-333333333333'

    const result = await restoreWizardSplitItemsSequentially(
      [item],
      async () => {
        throw new Error('server rejected corrected state')
      },
      undefined,
      async () => 'definitive',
    )

    expect(result.remaining[0]?.RestoreAttempted).toBeUndefined()
    expect(result.remaining[0]?.RestoreOperationNetUid).toBeUndefined()

    const next = ensureWizardSplitRestoreOperationNetUids(
      result.remaining,
      () => '44444444-4444-4444-8444-444444444444',
    )

    expect(next[0]?.RestoreOperationNetUid).toBe('44444444-4444-4444-8444-444444444444')
  })

  it('clears restore tracking and returns the corrected remaining row after an initial 4xx', async () => {
    const item = createWizardSplitOrderItem(sourceItem({ NetUid: 'source-row-a' }), 1, undefined)
    const tracked = ensureWizardSplitRestoreOperationNetUids(
      [item],
      () => '55555555-5555-4555-8555-555555555555',
    )

    const result = await restoreWizardSplitItemsSequentially(
      tracked,
      async () => {
        throw new Error('400 validation')
      },
      undefined,
      async () => 'definitive',
    )

    expect(result.committed).toEqual([])
    expect(result.remaining).toHaveLength(1)
    expect(result.remaining[0]?.SourceOrderItemNetUid).toBe('source-row-a')
    expect(result.remaining[0]?.RestoreAttempted).toBeUndefined()
    expect(result.remaining[0]?.RestoreOperationNetUid).toBeUndefined()
  })

  it('commits a successful same-key retry and leaves no stale split row', async () => {
    const operationId = '66666666-6666-4666-8666-666666666666'
    const item = createWizardSplitOrderItem(sourceItem({ NetUid: 'source-row-a' }), 1, undefined)
    const tracked = ensureWizardSplitRestoreOperationNetUids([item], () => operationId)
    const first = await restoreWizardSplitItemsSequentially(
      tracked,
      async () => {
        throw new Error('response lost')
      },
      undefined,
      async () => 'pending',
    )
    const retryCalls: Array<{ isRetry: boolean; operationId: string }> = []
    const retry = await restoreWizardSplitItemsSequentially(
      first.remaining,
      async (_item, _index, stableOperationId, isRetry) => {
        retryCalls.push({ isRetry, operationId: stableOperationId })
      },
    )

    expect(first.remaining[0]?.RestoreOperationNetUid).toBe(operationId)
    expect(retryCalls).toEqual([{ isRetry: true, operationId }])
    expect(retry.committed).toHaveLength(1)
    expect(retry.remaining).toEqual([])
    expect(retry.error).toBe(null)
  })

  it('clears the key when a pending restore receives a definitive 4xx on retry', async () => {
    const operationId = '77777777-7777-4777-8777-777777777777'
    const item = createWizardSplitOrderItem(sourceItem({ NetUid: 'source-row-a' }), 1, undefined)
    const tracked = ensureWizardSplitRestoreOperationNetUids([item], () => operationId)
    const first = await restoreWizardSplitItemsSequentially(
      tracked,
      async () => {
        throw new Error('timeout')
      },
      undefined,
      async () => 'pending',
    )
    const retry = await restoreWizardSplitItemsSequentially(
      first.remaining,
      async () => {
        throw new Error('400 conflict')
      },
      undefined,
      async () => 'definitive',
    )

    expect(retry.remaining[0]?.RestoreOperationNetUid).toBeUndefined()
    expect(retry.remaining[0]?.RestoreAttempted).toBeUndefined()
  })

  it('persists the exact restore request before sending and resumes after reload without restoring twice', async () => {
    const operationId = '88888888-8888-4888-8888-888888888888'
    const item = createWizardSplitOrderItem(sourceItem(), 2, undefined)
    item.RestoreOperationNetUid = operationId
    const before: SalesUkraineSale = {
      NetUid: 'sale-a',
      Order: { OrderItems: [sourceItem({ Qty: 3, TotalAmount: 27.9 })] },
    }
    const committed: SalesUkraineSale = {
      NetUid: 'sale-a',
      Order: {
        OrderItems: [sourceItem({ OperationNetUid: operationId, Qty: 5 })],
      },
    }
    let requestReachedServer = false
    let reconciliationUnavailable = true
    let persisted: WizardSplitOrderItem[] = []
    const loadSale = vi.fn(async () => {
      if (!requestReachedServer) {
        return before
      }

      if (reconciliationUnavailable) {
        reconciliationUnavailable = false
        throw new Error('reload interrupted reconciliation')
      }

      return committed
    })
    const execute = vi.fn(async () => {
      expect(persisted[0]?.RestoreAttempted).toBe(true)
      expect(persisted[0]?.RestoreMutation).toMatchObject({ operationId })
      requestReachedServer = true
      throw new TypeError('response lost after commit')
    })
    const persist = (items: WizardSplitOrderItem[]) => {
      persisted = structuredClone(items)
    }

    const interrupted = await restoreWizardSplitItemsDurably({
      execute,
      items: [item],
      loadSale,
      persist,
      source: recoverySource,
    })

    expect(interrupted.error).toEqual(expect.objectContaining({ message: 'reload interrupted reconciliation' }))
    expect(interrupted.remaining[0]?.RestoreMutation).toMatchObject({
      expectation: { afterQty: 5, beforeQty: 3, kind: 'row-quantity', rowNetUid: 'source-row-a' },
      operationId,
      request: {
        kind: 'update',
        orderItem: expect.objectContaining({ OperationNetUid: operationId, Qty: 5 }),
      },
    })

    const settled = vi.fn()
    const resumed = await restoreWizardSplitItemsDurably({
      execute,
      items: structuredClone(interrupted.remaining),
      loadSale,
      onOperationSettled: settled,
      persist,
      source: recoverySource,
    })

    expect(resumed).toMatchObject({ error: null, remaining: [] })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ operationId }))
    expect(persisted).toEqual([])
  })

  it('retries an explicitly absent marker and accepts one carrying the same operation id', async () => {
    const operationId = '99999999-9999-4999-8999-999999999999'
    const mutation = createWizardSplitRestoreMutation(
      recoverySource,
      createWizardSplitOrderItem(sourceItem(), 1, undefined),
      { NetUid: 'sale-a', Order: { OrderItems: [sourceItem({ Qty: 4 })] } },
      operationId,
    )
    const pending = { fallbackItems: [], mutation, phase: 'unknown' as const }
    const execute = vi.fn(async () => {})
    const rolledBack = await resolveWizardPendingSplitExtraction(
      pending,
      async () => ({ NetUid: 'sale-a', Order: { OrderItems: [sourceItem({ Qty: 4 })] } }),
      execute,
    )
    const committed = await resolveWizardPendingSplitExtraction(
      pending,
      async () => ({
        NetUid: 'sale-a',
        Order: { OrderItems: [sourceItem({ OperationNetUid: operationId, Qty: 5 })] },
      }),
      execute,
    )

    expect(rolledBack).toEqual({ status: 'committed' })
    expect(committed).toEqual({ status: 'committed' })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('keeps local extraction pending after any rejection received after request entry', async () => {
    const operationId = '99999999-9999-4999-8999-999999999998'
    const pending = {
      fallbackItems: [],
      mutation: {
        expectation: { kind: 'operation-marker' as const },
        operationId,
        request: {
          clientAgreementNetId: 'agreement-a',
          kind: 'add' as const,
          orderItem: createWizardSplitOrderItem(sourceItem(), 1, undefined),
          saleNetId: 'sale-a',
        },
      },
      phase: 'unknown' as const,
    }
    const execute = vi.fn(async () => {
      throw new Error('request rejected')
    })

    const result = await resolveWizardPendingSplitExtraction(
      pending,
      async () => ({ NetUid: 'sale-a', Order: { OrderItems: [sourceItem({ Qty: 4 })] } }),
      execute,
    )

    expect(result).toMatchObject({
      error: expect.objectContaining({ message: 'request rejected' }),
      status: 'pending',
    })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('rejects stale async commits after the wizard agreement or sale changes', () => {
    const captured = getWizardMutationContextKey('agreement-a', 'sale-a')

    expect(isWizardMutationContextCurrent(captured, getWizardMutationContextKey('agreement-a', 'sale-a'))).toBe(true)
    expect(isWizardMutationContextCurrent(captured, getWizardMutationContextKey('agreement-b', 'sale-a'))).toBe(false)
    expect(isWizardMutationContextCurrent(captured, getWizardMutationContextKey('agreement-a', 'sale-b'))).toBe(false)
    expect(isWizardMutationContextCurrent(captured, captured, false)).toBe(false)
  })
})
