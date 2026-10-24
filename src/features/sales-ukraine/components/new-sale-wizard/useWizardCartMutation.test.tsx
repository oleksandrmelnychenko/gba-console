import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import { clearAllSalesPendingMutations, loadSalesPendingMutation } from '../../pendingSalesMutationRegistry'
import { installSalesMutationStorageHarness, type SalesMutationStorageHarness } from '../../salesMutationStorageTestHarness'
import type { SalesUkraineSale } from '../../types'
import { clearAllWizardSplitRecoveries } from './newSaleWizardState'
import { useWizardCartMutation } from './useWizardCartMutation'

const mocks = vi.hoisted(() => ({ remove: vi.fn(), notify: vi.fn(), t: (key: string) => key }))
vi.mock('../../api/salesUkraineApi', async (original) => ({
  ...await original<typeof import('../../api/salesUkraineApi')>(),
  deleteOrderItem: mocks.remove,
}))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))

const item = { NetUid: 'row-1', Product: { NetUid: 'product-1' }, Qty: 2 }
const sale: SalesUkraineSale = { NetUid: 'sale-1', Order: { OrderItems: [item] } }
const scope = { context: 'agreement-1:sale-1', kind: 'cart', userKey: 'net:user-a' } as const
let storage: SalesMutationStorageHarness
beforeEach(() => {
  storage = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
  mocks.remove.mockReset().mockResolvedValue(null)
  mocks.notify.mockClear()
})
afterEach(() => {
  cleanup()
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
  storage.dispose()
})

function options() {
  return {
    agreementNetId: 'agreement-1', sale, pendingMutationUserKey: 'net:user-a',
    activeProductNetUid: 'product-1', hasSearchResults: true, orderItems: [item],
    onBusyChange: vi.fn(), onPendingMutationChange: vi.fn(),
    onCartChanged: vi.fn(async (): Promise<SalesUkraineSale> => ({ ...sale, Order: { OrderItems: [] } })),
    persistSplitItems: vi.fn(), commitLocalChange: vi.fn(), clearProductPricingCache: vi.fn(),
    refreshVisibleProductAvailability: vi.fn(async () => {}),
  }
}
function deletion(controller: ReturnType<typeof useWizardCartMutation>, context: string) {
  return controller.createCartMutation(context, {
    expectation: { kind: 'row-deleted', rowNetUid: 'row-1', beforeQty: 2 },
    fallbackMessage: 'delete failed', request: { kind: 'delete', orderItemNetId: 'row-1' },
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe('wizard cart mutation controller', () => {
  it('acquires the busy guard synchronously and clears the journal before refreshing visible stock', async () => {
    const props = options()
    props.refreshVisibleProductAvailability.mockImplementation(async () => {
      expect(loadSalesPendingMutation(scope)).toBeNull()
    })
    const { result } = renderHook(useWizardCartMutation, { initialProps: props })
    let context!: string
    act(() => {
      context = result.current.beginBusy() as string
      expect(result.current.beginBusy()).toBeNull()
    })
    expect(result.current.busy).toBe(true)
    await act(async () => {
      const completed = await result.current.runCartMutation(context, deletion(result.current, context))
      expect(completed).toBe(true)
      result.current.endBusy(context)
    })
    expect(mocks.remove).toHaveBeenCalledOnce()
    expect(props.onCartChanged).toHaveBeenCalledOnce()
    expect(props.refreshVisibleProductAvailability).toHaveBeenCalledWith(context, 'product-1')
    expect(result.current.busy).toBe(false)
  })

  it('restores an unknown operation after remount and retries the same key', async () => {
    const props = options()
    props.onCartChanged.mockResolvedValue(sale)
    mocks.remove.mockRejectedValueOnce(new ApiError('response lost', 503, null))
    const first = renderHook(useWizardCartMutation, { initialProps: props })
    let operationId!: string
    await act(async () => {
      const context = first.result.current.beginBusy() as string
      const operation = deletion(first.result.current, context)
      operationId = operation.operationId
      expect(await first.result.current.runCartMutation(context, operation)).toBe(false)
      first.result.current.endBusy(context)
    })
    expect(loadSalesPendingMutation(scope)).toMatchObject({ operationId, phase: 'unknown' })
    first.unmount()
    const second = renderHook(useWizardCartMutation, { initialProps: props })
    await waitFor(() => expect(second.result.current.pendingMutationError).not.toBeNull())
    props.onCartChanged.mockResolvedValue({ ...sale, Order: { OrderItems: [] } })
    await act(async () => { await second.result.current.retryPendingCartMutation() })
    // Reconciliation may confirm the committed delete without another POST.
    expect(loadSalesPendingMutation(scope)).toBeNull()
    expect(second.result.current.pendingMutationError).toBeNull()
    expect(mocks.remove.mock.calls.every((call) => call[1].operationId === operationId)).toBe(true)
  })

  it('settles an acknowledged operation without refreshing a different sale after a context switch', async () => {
    const pending = deferred<null>()
    mocks.remove.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender } = renderHook(useWizardCartMutation, { initialProps: props })
    let request!: Promise<boolean>
    act(() => {
      const context = result.current.beginBusy() as string
      request = result.current.runCartMutation(context, deletion(result.current, context))
    })
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledOnce())
    rerender({ ...props, sale: { ...sale, NetUid: 'sale-2' } })
    await act(async () => { pending.resolve(null); expect(await request).toBe(false) })
    expect(loadSalesPendingMutation(scope)).toBeNull()
    expect(props.onCartChanged).not.toHaveBeenCalled()
    expect(props.commitLocalChange).not.toHaveBeenCalled()
    expect(props.refreshVisibleProductAvailability).not.toHaveBeenCalled()
  })
})
