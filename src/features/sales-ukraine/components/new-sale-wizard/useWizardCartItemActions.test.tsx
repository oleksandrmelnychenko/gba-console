import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWizardCartItemActions } from './useWizardCartItemActions'
import type { WizardAvailabilityRow } from './newSaleWizardApi'
import type { WizardSplitOrderItem } from './wizardSplitSale'

const mocks = vi.hoisted(() => ({ notify: vi.fn(), stage: vi.fn(), agreement: vi.fn(), t: (key: string) => key }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('./newSaleWizardState', async (original) => ({
  ...await original<typeof import('./newSaleWizardState')>(),
  stageWizardSplitExtraction: mocks.stage, getWizardSplitAgreementNetId: mocks.agreement,
}))
beforeEach(() => { mocks.notify.mockClear(); mocks.stage.mockReset(); mocks.agreement.mockReset().mockReturnValue('agreement') })
afterEach(cleanup)
type Options = Parameters<typeof useWizardCartItemActions>[0]
const item = { NetUid: 'row-a', Qty: 3, Product: { NetUid: 'product-a' }, Comment: 'original' }
const shift: WizardAvailabilityRow = { NetId: 'source-sale', Amount: 5, OrderItem: { NetUid: 'source-row', Qty: 5 } }
function splitItem(): WizardSplitOrderItem {
  return { Product: { NetUid: 'product-b' }, Qty: 2, TotalAmount: 20, TotalAmountEurToUah: 800, TotalAmountLocal: 800 }
}
function options() {
  let locked = false
  const mutation = {
    beginBusy: vi.fn(() => { if (locked) return null; locked = true; return 'agreement:sale' }),
    endBusy: vi.fn(() => { locked = false }), isCurrentMutationContext: vi.fn(() => true),
    createCartMutation: vi.fn<Options['mutation']['createCartMutation']>((context, value) => ({
      ...value, context, operationId: 'operation-a', localCommit: value.localCommit ?? { kind: 'none' },
      localCommitted: false, inspect: () => 'unknown', mutate: async () => {},
    })),
    runCartMutation: vi.fn<Options['mutation']['runCartMutation']>(async () => true),
  }
  return { agreementNetId: 'agreement', saleNetUid: 'sale', user: undefined, orderItems: [item], editCart: null,
    getSplitRecoverySource: vi.fn(() => ({ agreementNetId: 'agreement', saleNetUid: 'sale', userKey: 'user', origin: 'ordinary' as const })),
    restoreSplitItem: vi.fn(async () => {}), clearProductPricingCache: vi.fn(), focusSearchInput: vi.fn(), mutation,
  } satisfies Options
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

describe('cart deletion and shift actions', () => {
  it.each(['row', 'selected', 'shift'] as const)('keeps the %s confirmation open when the mutation lock is unavailable', async (kind) => {
    const props = options()
    props.mutation.beginBusy.mockReturnValue(null)
    const { result } = renderHook(() => useWizardCartItemActions({ ...props,
      editCart: { isSplit: false, selected: { list: 'current', index: 0 }, splitItems: [] },
    }))
    act(() => { result.current.setRemoveRowItem(item); result.current.setRemoveConfirmOpen(true); result.current.setShiftRow(shift) })
    await act(async () => {
      if (kind === 'row') await result.current.confirmRemoveRow()
      else if (kind === 'selected') await result.current.confirmRemoveSelected()
      else await result.current.applyShift(1)
    })
    expect(result.current.removeRowItem).toBe(item)
    expect(result.current.removeConfirmOpen).toBe(true)
    expect(result.current.shiftRow).toBe(shift)
    expect(props.mutation.runCartMutation).not.toHaveBeenCalled()
    expect(props.mutation.endBusy).not.toHaveBeenCalled()
  })

  it('builds the same deletion request from a row and from the editor', async () => {
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions({ ...props,
      editCart: { isSplit: false, selected: { list: 'current', index: 0 }, splitItems: [] },
    }))
    act(() => result.current.setRemoveRowItem(item))
    await act(() => result.current.confirmRemoveRow())
    expect(result.current.removeRowItem).toBeNull()
    await act(() => result.current.confirmRemoveSelected())
    const operations = props.mutation.runCartMutation.mock.calls.map((call) => call[1])
    for (const operation of operations) expect(operation).toMatchObject({
      expectation: { kind: 'row-deleted', rowNetUid: 'row-a', beforeQty: 3 },
      request: { kind: 'delete', orderItemNetId: 'row-a' }, localCommit: { kind: 'none' },
    })
    expect(operations).toHaveLength(2)
    expect(props.clearProductPricingCache).toHaveBeenCalledTimes(2)
  })

  it.each([undefined, '', '00000000-0000-0000-0000-000000000000'])('does not delete a row without a persisted id: %s', async (NetUid) => {
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions(props))
    await act(() => result.current.removeItem({ ...item, NetUid }))
    expect(props.mutation.beginBusy).not.toHaveBeenCalled()
  })

  it('does not close a selected-row confirmation for an obsolete selection', async () => {
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions({ ...props,
      editCart: { isSplit: false, selected: { list: 'current', index: 99 }, splitItems: [] },
    }))
    act(() => result.current.setRemoveConfirmOpen(true))
    await act(() => result.current.confirmRemoveSelected())
    expect(result.current.removeConfirmOpen).toBe(true)
    expect(props.mutation.beginBusy).not.toHaveBeenCalled()
  })

  it.each([true, false])('stages split extraction before deletion, reusing the saved agreement=%s', async (sameAgreement) => {
    const props = options()
    mocks.agreement.mockReturnValue(sameAgreement ? 'agreement' : 'different')
    const splitItems = [splitItem()]
    props.mutation.runCartMutation.mockImplementation(async (_context, operation) => {
      expect(mocks.stage).toHaveBeenCalledWith(expect.objectContaining({
        fallbackItems: splitItems, source: props.getSplitRecoverySource(),
        mutation: { operationId: operation.operationId, request: operation.request, expectation: operation.expectation },
      }))
      return true
    })
    const { result } = renderHook(() => useWizardCartItemActions({ ...props,
      editCart: { isSplit: true, selected: { list: 'current', index: 0 }, splitItems },
    }))
    await act(() => result.current.confirmRemoveSelected())
    const commit = props.mutation.runCartMutation.mock.calls[0][1].localCommit
    expect(commit).toMatchObject({ kind: 'replace-split-items', failureSplitItems: splitItems, selected: { list: 'current', index: 0 } })
    if (commit.kind === 'replace-split-items') expect(commit.splitItems).toHaveLength(sameAgreement ? 2 : 1)
    expect(item.Qty).toBe(3)
  })

  it('does not delete when staging recovery fails and releases the lock', async () => {
    mocks.stage.mockImplementation(() => { throw new Error('Storage failed') })
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions({ ...props,
      editCart: { isSplit: true, selected: { list: 'current', index: 0 }, splitItems: [] },
    }))
    await act(() => result.current.confirmRemoveSelected())
    expect(props.mutation.runCartMutation).not.toHaveBeenCalled()
    expect(props.mutation.endBusy).toHaveBeenCalledOnce()
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'Storage failed' })
  })

  it('returns a selected split row through the existing restoration operation', async () => {
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions({ ...props,
      editCart: { isSplit: true, selected: { list: 'split', index: 0 }, splitItems: [splitItem()] },
    }))
    await act(() => result.current.confirmRemoveSelected())
    expect(props.restoreSplitItem).toHaveBeenCalledExactlyOnceWith('agreement:sale', { kind: 'remove', index: 0 })
    expect(props.mutation.runCartMutation).not.toHaveBeenCalled()
    expect(props.mutation.endBusy).toHaveBeenCalledOnce()
  })

  it.each(['sale', undefined, '00000000-0000-0000-0000-000000000000'])('moves a fractional amount to sale or agreement (sale=%s)', async (saleNetUid) => {
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions({ ...props, saleNetUid }))
    act(() => result.current.setShiftRow(shift))
    await act(() => result.current.applyShift(1.25))
    expect(props.mutation.createCartMutation).toHaveBeenCalledWith('agreement:sale', expect.objectContaining({
      expectation: { kind: 'operation-marker' }, request: {
        kind: 'shift', saleFromNetId: 'source-sale', saleToNetId: saleNetUid === 'sale' ? 'sale' : 'agreement',
        orderItem: { ...shift.OrderItem, Qty: 1.25 },
      },
    }))
    expect(result.current.shiftRow).toBeNull()
    expect(props.focusSearchInput).toHaveBeenCalledOnce()
    expect(props.clearProductPricingCache).toHaveBeenCalledOnce()
    expect(shift.OrderItem?.Qty).toBe(5)
  })

  it.each([0, -1, NaN, Infinity, 5.001])('retains the shift window for invalid quantity %s', async (qty) => {
    const props = options()
    const { result } = renderHook(() => useWizardCartItemActions(props))
    act(() => result.current.setShiftRow(shift))
    await act(() => result.current.applyShift(qty))
    expect(result.current.shiftRow).toBe(shift)
    expect(props.mutation.beginBusy).not.toHaveBeenCalled()
  })

  it('does not submit a shift without a destination or source row', async () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardCartItemActions, { initialProps: props as Options })
    act(() => result.current.setShiftRow({ NetId: 'source', Amount: 5 }))
    await act(() => result.current.applyShift(1))
    act(() => result.current.setShiftRow(shift))
    rerender({ ...props, saleNetUid: undefined, agreementNetId: null })
    await act(() => result.current.applyShift(1))
    expect(result.current.shiftRow).toBe(shift)
    expect(props.mutation.runCartMutation).not.toHaveBeenCalled()
  })

  it.each(['remove', 'shift'] as const)('blocks a repeated %s until the first operation settles', async (kind) => {
    const props = options()
    const pending = deferred<boolean>()
    props.mutation.runCartMutation.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useWizardCartItemActions(props))
    act(() => result.current.setShiftRow(shift))
    let first!: Promise<void>
    act(() => {
      first = kind === 'remove' ? result.current.removeItem(item) : result.current.applyShift(1)
      void (kind === 'remove' ? result.current.removeItem(item) : result.current.applyShift(1))
    })
    expect(props.mutation.runCartMutation).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve(true); await first })
    expect(props.mutation.endBusy).toHaveBeenCalledOnce()
  })

  it.each(['remove', 'shift'] as const)('suppresses success and failure effects for a stale %s', async (kind) => {
    const props = options()
    props.mutation.isCurrentMutationContext.mockReturnValue(false)
    const { result } = renderHook(() => useWizardCartItemActions(props))
    for (const fails of [false, true]) {
      if (fails) props.mutation.runCartMutation.mockRejectedValue(new Error('Late failure'))
      act(() => result.current.setShiftRow(shift))
      await act(() => kind === 'remove' ? result.current.removeItem(item) : result.current.applyShift(1))
    }
    expect(props.clearProductPricingCache).not.toHaveBeenCalled()
    expect(props.focusSearchInput).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(props.mutation.endBusy).toHaveBeenCalledTimes(2)
  })

  it.each(['remove', 'shift'] as const)('keeps %s errors in the mutation flow and releases the lock', async (kind) => {
    const props = options()
    props.mutation.runCartMutation.mockRejectedValue(new Error('Request failed'))
    const { result } = renderHook(() => useWizardCartItemActions(props))
    act(() => result.current.setShiftRow(shift))
    await act(() => kind === 'remove' ? result.current.removeItem(item) : result.current.applyShift(1))
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'Request failed' })
    expect(props.mutation.endBusy).toHaveBeenCalledOnce()
    expect(props.clearProductPricingCache).not.toHaveBeenCalled()
    expect(props.focusSearchInput).not.toHaveBeenCalled()
  })
})
