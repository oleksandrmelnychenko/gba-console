import { describe, expect, it } from 'vitest'
import { prepareWizardSplitItemRestore } from './wizardSplitItemRestore'
import { createPersistedWizardCartMutation } from './wizardCartMutation'
import { stageWizardSplitRestoreMutation, toWizardSplitMutationSnapshot, type WizardSplitOrderItem } from './wizardSplitSale'

function item(patch: Partial<WizardSplitOrderItem> = {}): WizardSplitOrderItem {
  return {
    Product: { NetUid: 'product-a', CurrentPrice: 10, CurrentPriceEurToUah: 400 },
    Qty: 4, TotalAmount: 40, TotalAmountEurToUah: 1600, TotalAmountLocal: 1200, TotalVat: 8,
    SourceOrderItemNetUid: 'source-a', RestoreOperationNetUid: 'restore-a',
    Comment: 'Keep comment', Discount: 3, OneTimeDiscount: 5, OneTimeDiscountComment: 'Approved',
    PricePerItem: 10, IsFromReSale: true, AssignedSpecification: { NetUid: 'spec-a' }, ...patch,
  }
}
function options(items = [item()]): Parameters<typeof prepareWizardSplitItemRestore>[0] {
  return { items, orderItems: [], agreementNetId: 'agreement-a', saleNetUid: 'sale-a', action: { kind: 'quantity', index: 0, qty: 1.25 } }
}

describe('single split-item restoration plan', () => {
  it('prepares a fractional add with proportional totals, metadata and recovery snapshots', () => {
    const props = options()
    const before = structuredClone(props)
    const plan = prepareWizardSplitItemRestore(props)!
    expect(plan.mutation.request).toMatchObject({ kind: 'add', clientAgreementNetId: 'agreement-a', saleNetId: 'sale-a', orderItem: {
      Qty: 1.25, TotalAmount: 12.5, TotalAmountEurToUah: 500, TotalAmountLocal: 375, TotalVat: 2.5,
      SourceOrderItemNetUid: 'source-a', Comment: 'Keep comment', Discount: 3, OneTimeDiscount: 5,
      OneTimeDiscountComment: 'Approved', IsFromReSale: true, AssignedSpecification: { NetUid: 'spec-a' },
    } })
    expect(plan.mutation.expectation).toEqual({ kind: 'operation-marker' })
    expect(plan.mutation.operationId).toBe('restore-a')
    expect(plan.mutation.localCommit.splitItems[0]).toMatchObject({ Qty: 2.75, TotalAmount: 27.5, TotalAmountEurToUah: 1100 })
    expect(plan.mutation.localCommit.splitItems[0].RestoreOperationNetUid).toBeUndefined()
    expect(plan.mutation.localCommit.failureSplitItems?.[0].Qty).toBe(4)
    expect(plan.mutation.localCommit.failureSplitItems?.[0].RestoreOperationNetUid).toBeUndefined()
    expect(plan.mutation.localCommit).not.toHaveProperty('selected')
    expect(props).toEqual(before)
  })

  it('updates the original source row and preserves its metadata', () => {
    const props = options()
    props.orderItems = [{ NetUid: 'source-a', Qty: 2, Comment: 'Current comment', OneTimeDiscount: 9 }]
    const plan = prepareWizardSplitItemRestore(props)!
    expect(plan.mutation.request).toEqual({ kind: 'update', orderItem: { NetUid: 'source-a', Qty: 3.25, Comment: 'Current comment', OneTimeDiscount: 9 } })
    expect(plan.mutation.expectation).toEqual({ kind: 'row-quantity', rowNetUid: 'source-a', beforeQty: 2, afterQty: 3.25 })
  })

  it('changes the selected occurrence when two split rows have identical metadata', () => {
    const first = item(), second = item({ RestoreOperationNetUid: 'restore-b' })
    const props = options([first, second])
    props.action = { kind: 'quantity', index: 1, qty: 1 }
    const plan = prepareWizardSplitItemRestore(props)!
    expect(plan.mutation.localCommit.splitItems.map((row) => row.Qty)).toEqual([4, 3])
    expect(plan.mutation.localCommit.splitItems[0]).toBe(first)
    expect(plan.mutation.operationId).toBe('restore-b')
    expect(second.Qty).toBe(4)
  })

  it('removes the selected split row and selects the preceding remaining row', () => {
    const props = options([item(), item({ RestoreOperationNetUid: 'restore-b' }), item({ RestoreOperationNetUid: 'restore-c' })])
    props.action = { kind: 'remove', index: 1 }
    const plan = prepareWizardSplitItemRestore(props)!
    expect(plan.mutation.localCommit.splitItems.map((row) => row.RestoreOperationNetUid)).toEqual(['restore-a', 'restore-c'])
    expect(plan.mutation.localCommit.selected).toEqual({ list: 'split', index: 0 })
    expect(plan.mutation.localCommit.isSplit).toBe(true)
    expect(plan.mutation.request).toMatchObject({ kind: 'add', orderItem: { Qty: 4, TotalAmount: 40 } })
  })

  it.each(['quantity', 'remove'] as const)('clears split mode after restoring the final row through %s', (kind) => {
    const props = options()
    props.action = kind === 'quantity' ? { kind, index: 0, qty: 4 } : { kind, index: 0 }
    const plan = prepareWizardSplitItemRestore(props)!
    expect(plan.mutation.localCommit.splitItems).toEqual([])
    expect(plan.mutation.localCommit.isSplit).toBe(false)
    if (kind === 'remove') expect(plan.mutation.localCommit.selected).toBeNull()
    else expect(plan.mutation.localCommit).not.toHaveProperty('selected')
  })

  it.each([0, -1, NaN, Infinity, 4.001])('rejects invalid quantity %s before assigning operation tracking', (qty) => {
    const source = item({ RestoreOperationNetUid: undefined })
    expect(prepareWizardSplitItemRestore({ ...options([source]), action: { kind: 'quantity', index: 0, qty } })).toBeNull()
    expect(source.RestoreOperationNetUid).toBeUndefined()
  })

  it('rejects invalid source quantities and missing selected rows', () => {
    expect(prepareWizardSplitItemRestore(options([item({ Qty: NaN })]))).toBeNull()
    expect(() => prepareWizardSplitItemRestore({ ...options(), action: { kind: 'remove', index: 9 } })).toThrow('missing split item')
  })

  it('requires a destination sale when adding, but can update an existing source row', () => {
    const props = { ...options(), agreementNetId: null, saleNetUid: undefined }
    expect(() => prepareWizardSplitItemRestore(props)).toThrow('without a current sale')
    expect(prepareWizardSplitItemRestore({ ...props, orderItems: [{ NetUid: 'source-a', Qty: 1 }] })?.mutation.request.kind).toBe('update')
  })

  it('keeps an existing recovery operation id and does not alter other rows recovery metadata', () => {
    const snapshot = { operationId: 'restore-a', expectation: { kind: 'operation-marker' as const }, request: { kind: 'delete' as const, orderItemNetId: 'row' } }
    const first = item({ RestoreOperationNetUid: undefined, RestoreMutation: snapshot, RestoreAttempted: true })
    const second = item({ RestoreOperationNetUid: 'restore-b', RestoreAttempted: true })
    const plan = prepareWizardSplitItemRestore(options([first, second]))!
    expect(plan.mutation.operationId).toBe('restore-a')
    expect(plan.trackedItems[0].RestoreAttempted).toBe(true)
    expect(plan.mutation.localCommit.failureSplitItems?.[0].RestoreMutation).toBeUndefined()
    expect(plan.mutation.localCommit.failureSplitItems?.[1]).toBe(second)
  })

  it('produces a persistable operation whose staged snapshot retains the exact request', () => {
    const plan = prepareWizardSplitItemRestore(options())!
    const operation = createPersistedWizardCartMutation({ ...plan.mutation, context: 'agreement-a:sale-a', fallbackMessage: 'Failed' })
    const staged = stageWizardSplitRestoreMutation(plan.trackedItems, 0, toWizardSplitMutationSnapshot(operation))
    expect(staged[0]).toMatchObject({ RestoreAttempted: true, RestoreOperationNetUid: operation.operationId, RestoreMutation: {
      operationId: operation.operationId, request: operation.request, expectation: operation.expectation,
    } })
    expect(plan.trackedItems[0].RestoreAttempted).toBeUndefined()
  })
})
