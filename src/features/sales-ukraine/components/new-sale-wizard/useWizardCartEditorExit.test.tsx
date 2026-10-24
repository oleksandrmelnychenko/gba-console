import type { Dispatch, SetStateAction } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWizardCartEditorExit } from './useWizardCartEditorExit'
import type { WizardCartEditorState } from './wizardCartEditor'
import type { WizardSplitOrderItem } from './wizardSplitSale'

const mocks = vi.hoisted(() => ({ notify: vi.fn(), t: (key: string) => key }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
beforeEach(() => mocks.notify.mockClear())
afterEach(cleanup)
type Options = Parameters<typeof useWizardCartEditorExit>[0]
function item(id: string, qty = 1): WizardSplitOrderItem {
  return { Product: { NetUid: `product-${id}` }, Qty: qty, TotalAmount: qty * 2,
    TotalAmountEurToUah: qty * 80, TotalAmountLocal: qty * 80, RestoreOperationNetUid: `restore-${id}` }
}
function setup(items = [item('a'), item('b')]) {
  let state: WizardCartEditorState | null = { isSplit: true, selected: { list: 'split', index: 0 }, splitItems: items }
  let locked = false
  const mutation = {
    busy: false,
    beginBusy: vi.fn(() => { if (locked) return null; locked = true; return 'agreement:sale' }),
    endBusy: vi.fn(() => { locked = false }),
    isCurrentMutationContext: vi.fn(() => true),
    createCartMutation: vi.fn<Options['mutation']['createCartMutation']>((context, options) => ({
      ...options, context, operationId: options.operationId!, localCommit: options.localCommit ?? { kind: 'none' },
      localCommitted: false, inspect: () => 'unknown', mutate: async () => {},
    })),
    persistPendingCartMutation: vi.fn(),
    runCartMutation: vi.fn<Options['mutation']['runCartMutation']>(async () => true),
    setPendingMutationError: vi.fn(),
  } satisfies Options['mutation']
  const persistSplitItems = vi.fn()
  const setEditCart = vi.fn<Dispatch<SetStateAction<WizardCartEditorState | null>>>((update) => {
    state = typeof update === 'function' ? update(state) : update
  })
  const commitLocalChange = vi.fn<Options['commitLocalChange']>((commit) => {
    persistSplitItems(commit.splitItems, commit.agreementNetId)
    setEditCart((previous) => previous ? {
      ...previous,
      ...(commit.isSplit === undefined ? {} : { isSplit: commit.isSplit }),
      ...(commit.selected === undefined ? {} : { selected: commit.selected }),
      splitItems: commit.splitItems,
    } : previous)
  })
  const props = {
    agreementNetId: 'agreement', saleNetUid: 'sale', orderItems: [], editCart: state,
    commitLocalChange, persistSplitItems, clearProductPricingCache: vi.fn(), onRestored: vi.fn(), mutation,
  } satisfies Options
  return { props: { ...props, setEditCart }, mutation, getState: () => state }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

describe('cart editor exit', () => {
  it('closes an empty editor without starting restoration', async () => {
    const { props, mutation } = setup([])
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    await act(() => result.current())
    expect(props.onRestored).toHaveBeenCalledOnce()
    expect(mutation.beginBusy).not.toHaveBeenCalled()
    expect(props.persistSplitItems).not.toHaveBeenCalled()
  })

  it('reports failure to clear recovery without silently closing the editor', async () => {
    const { props } = setup([])
    props.onRestored.mockImplementation(() => { throw new Error('Recovery clear failed') })
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    await act(() => result.current())
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'Recovery clear failed' })
  })

  it('does nothing for a closed or busy editor', async () => {
    const { props, mutation } = setup()
    const { result, rerender } = renderHook(useWizardCartEditorExit, { initialProps: { ...props, editCart: null } as Options })
    await act(() => result.current())
    rerender({ ...props, mutation: { ...mutation, busy: true } })
    await act(() => result.current())
    expect(mutation.beginBusy).not.toHaveBeenCalled()
    expect(props.onRestored).not.toHaveBeenCalled()
  })

  it('does not change recovery or editor state when the mutation lock is unavailable', async () => {
    const { props, mutation } = setup()
    mutation.beginBusy.mockReturnValue(null)
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    await act(() => result.current())
    expect(props.persistSplitItems).not.toHaveBeenCalled()
    expect(props.setEditCart).not.toHaveBeenCalled()
    expect(mutation.endBusy).not.toHaveBeenCalled()
  })

  it.each([null, ''])('keeps extracted items when agreement is missing (%s)', async (agreementNetId) => {
    const { props, mutation } = setup()
    const { result } = renderHook(() => useWizardCartEditorExit({ ...props, agreementNetId }))
    await act(() => result.current())
    expect(props.onRestored).not.toHaveBeenCalled()
    expect(mutation.beginBusy).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledOnce()
  })

  it('restores sequentially, records the operation before the request, and blocks duplicate exit', async () => {
    const { props, mutation } = setup()
    const first = deferred<boolean>()
    mutation.runCartMutation.mockImplementationOnce(async (_context, operation) => {
      expect(mutation.persistPendingCartMutation).toHaveBeenLastCalledWith(operation)
      expect(props.persistSplitItems.mock.lastCall?.[0][0].RestoreMutation.operationId).toBe('restore-a')
      return first.promise
    })
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    let exit!: Promise<void>
    act(() => { exit = result.current(); void result.current() })
    expect(mutation.runCartMutation).toHaveBeenCalledTimes(1)
    expect(props.onRestored).not.toHaveBeenCalled()
    await act(async () => { first.resolve(true); await exit })
    expect(mutation.runCartMutation.mock.calls.map((call) => call[1].operationId)).toEqual(['restore-a', 'restore-b'])
    expect(props.onRestored).toHaveBeenCalledOnce()
    expect(props.persistSplitItems).toHaveBeenLastCalledWith([], 'agreement')
    expect(mutation.endBusy).toHaveBeenCalledOnce()
  })

  it('accumulates quantities when several extracted entries restore the same source row', async () => {
    const items = [{ ...item('a', 1.25), SourceOrderItemNetUid: 'source' }, { ...item('b', 2), SourceOrderItemNetUid: 'source' }]
    const { props, mutation } = setup(items)
    const { result } = renderHook(() => useWizardCartEditorExit({ ...props, orderItems: [{ NetUid: 'source', Qty: 3 }] }))
    await act(() => result.current())
    const operations = mutation.createCartMutation.mock.results.map((entry) => entry.value)
    expect(operations.map((op) => op.expectation)).toEqual([
      { kind: 'row-quantity', rowNetUid: 'source', beforeQty: 3, afterQty: 4.25 },
      { kind: 'row-quantity', rowNetUid: 'source', beforeQty: 4.25, afterQty: 6.25 },
    ])
    expect(operations.map((op) => op.request.kind === 'update' && op.request.orderItem.Qty)).toEqual([4.25, 6.25])
  })

  it('reconciles an uncertain operation using the identical operation before continuing', async () => {
    const { props, mutation } = setup()
    mutation.runCartMutation.mockResolvedValueOnce(false).mockResolvedValue(true)
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    await act(() => result.current())
    const calls = mutation.runCartMutation.mock.calls
    expect(calls.map((call) => [call[1].operationId, call[2]])).toEqual([
      ['restore-a', false], ['restore-a', true], ['restore-b', false],
    ])
    expect(calls[0][1]).toBe(calls[1][1])
    expect(props.onRestored).toHaveBeenCalledOnce()
  })

  it('retains only the unfinished tail after partial restoration', async () => {
    const { props, mutation, getState } = setup([item('a'), item('b'), item('c')])
    mutation.runCartMutation.mockResolvedValueOnce(true).mockResolvedValue(false)
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    await act(() => result.current())
    expect(props.onRestored).not.toHaveBeenCalled()
    expect(mutation.runCartMutation.mock.calls.map((call) => call[1].operationId)).toEqual(['restore-a', 'restore-b', 'restore-b'])
    expect(getState()?.splitItems.map((row) => row.RestoreOperationNetUid)).toEqual(['restore-b', 'restore-c'])
    expect(getState()?.selected).toEqual({ list: 'split', index: 0 })
    expect(getState()?.splitItems[0].RestoreAttempted).toBe(true)
    expect(mutation.setPendingMutationError).toHaveBeenCalledOnce()
    expect(mutation.endBusy).toHaveBeenCalledOnce()
  })

  it('releases the lock and keeps the editor open when persisting recovery fails', async () => {
    const { props, mutation } = setup()
    props.persistSplitItems.mockImplementation(() => { throw new Error('Storage failed') })
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    await act(() => result.current())
    expect(mutation.runCartMutation).not.toHaveBeenCalled()
    expect(props.onRestored).not.toHaveBeenCalled()
    expect(props.setEditCart).not.toHaveBeenCalled()
    expect(mutation.endBusy).toHaveBeenCalledOnce()
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'Storage failed' })
  })

  it('does not close or update a different sale after an in-flight request completes', async () => {
    const { props, mutation } = setup([item('a'), item('b')])
    const pending = deferred<boolean>()
    mutation.runCartMutation.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    let exit!: Promise<void>
    act(() => { exit = result.current() })
    const updates = props.setEditCart.mock.calls.length
    const writes = props.persistSplitItems.mock.calls.length
    mutation.isCurrentMutationContext.mockReturnValue(false)
    await act(async () => { pending.resolve(true); await exit })
    expect(props.setEditCart).toHaveBeenCalledTimes(updates)
    expect(props.persistSplitItems).toHaveBeenCalledTimes(writes)
    expect(props.onRestored).not.toHaveBeenCalled()
    expect(props.clearProductPricingCache).not.toHaveBeenCalled()
    expect(mutation.runCartMutation).toHaveBeenCalledOnce()
    expect(mutation.setPendingMutationError).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mutation.endBusy).toHaveBeenCalledOnce()
  })

  it('ignores reconciliation completion after the context changes', async () => {
    const { props, mutation } = setup()
    const retry = deferred<boolean>()
    mutation.runCartMutation.mockResolvedValueOnce(false).mockReturnValueOnce(retry.promise)
    const { result } = renderHook(() => useWizardCartEditorExit(props))
    let exit!: Promise<void>
    await act(async () => { exit = result.current(); await Promise.resolve(); await Promise.resolve() })
    expect(mutation.runCartMutation).toHaveBeenCalledTimes(2)
    mutation.isCurrentMutationContext.mockReturnValue(false)
    await act(async () => { retry.resolve(false); await exit })
    expect(mutation.runCartMutation).toHaveBeenCalledTimes(2)
    expect(mutation.setPendingMutationError).not.toHaveBeenCalled()
    expect(props.onRestored).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it.each(['success', 'incomplete', 'failure', 'stale'] as const)('delegates restoration and handles %s', async (outcome) => {
    const { props, mutation } = setup()
    const restore = vi.fn(async () => {
      if (outcome === 'failure') throw new Error('Restore failed')
      if (outcome === 'stale') mutation.isCurrentMutationContext.mockReturnValue(false)
      return outcome !== 'incomplete'
    })
    const { result } = renderHook(() => useWizardCartEditorExit({ ...props, onRestoreSplitItems: restore }))
    await act(() => result.current())
    expect(restore).toHaveBeenCalledOnce()
    expect(props.onRestored).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0)
    expect(props.clearProductPricingCache).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0)
    expect(mutation.runCartMutation).not.toHaveBeenCalled()
    expect(mutation.endBusy).toHaveBeenCalledOnce()
  })
})
