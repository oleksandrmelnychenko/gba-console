import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from './salesMutationStorageTestHarness'
import type { SalesUkraineOrderItem, SalesUkraineSale } from './types'
import {
  createAddOrUpdateSalesCartMutation,
  finalizeSuccessfulPersistentCartMutation,
  usePersistentSalesCartMutation,
} from './usePersistentSalesCartMutation'

const { updateOrderItemMock } = vi.hoisted(() => ({
  updateOrderItemMock: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

vi.mock('./api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api/salesUkraineApi')>()

  return {
    ...original,
    updateOrderItem: updateOrderItemMock,
  }
})

const context = 'sale-editor:sale-1'
const scope: SalesPendingMutationScope = {
  context,
  kind: 'cart',
  userKey: 'net:user-a',
}
const existingItem: SalesUkraineOrderItem = {
  Deleted: false,
  NetUid: 'row-1',
  Product: { NetUid: 'product-1' },
  Qty: 2,
}
const staleSale: SalesUkraineSale = {
  NetUid: 'sale-1',
  Order: { OrderItems: [existingItem] },
}

let storageHarness: SalesMutationStorageHarness

beforeEach(() => {
  storageHarness = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
  updateOrderItemMock.mockReset()
})

afterEach(() => {
  clearAllSalesPendingMutations()
  storageHarness.dispose()
})

describe('persistent sales cart mutation helpers', () => {
  it('uses an additive request and a row expectation when the complete identity matches', () => {
    const identityItem: SalesUkraineOrderItem = {
      ...existingItem,
      AssignedSpecification: { Id: 7, NetUid: 'spec-1', SpecificationCode: 'SPEC-1' },
      Comment: 'row comment',
      Discount: 4,
      IsFromReSale: true,
      OneTimeDiscount: 6,
      OneTimeDiscountComment: 'approved',
      PricePerItem: 12.5,
      SourceOrderItemNetUid: 'source-row-1',
    }
    const addedItem: SalesUkraineOrderItem = {
      ...identityItem,
      NetUid: '00000000-0000-0000-0000-000000000000',
      Product: { NetUid: 'PRODUCT-1' },
      Qty: 3,
    }
    const mutation = createAddOrUpdateSalesCartMutation({
      clientAgreementNetId: 'agreement-1',
      orderItem: addedItem,
      orderItems: [identityItem],
      saleNetId: 'sale-1',
    })

    expect(mutation).toEqual({
      expectation: {
        afterQty: 5,
        beforeQty: 2,
        kind: 'row-quantity',
        rowNetUid: 'row-1',
      },
      request: {
        clientAgreementNetId: 'agreement-1',
        kind: 'add',
        orderItem: addedItem,
        saleNetId: 'sale-1',
      },
    })
    expect(identityItem.Qty).toBe(2)
  })

  it.each([
    ['assigned specification', { AssignedSpecification: { Id: 8, NetUid: 'spec-2' } }],
    ['provenance', { SourceOrderItemNetUid: 'source-row-2' }],
    ['resale source', { IsFromReSale: false }],
    ['base discount', { Discount: 5 }],
    ['one-time discount', { OneTimeDiscount: 7 }],
    ['discount comment', { OneTimeDiscountComment: 'different approval' }],
    ['row comment', { Comment: 'different row comment' }],
    ['price', { PricePerItem: 13 }],
  ] satisfies Array<[string, Partial<SalesUkraineOrderItem>]>) (
    'does not predict a same-product merge when %s differs',
    (_, patch) => {
      const identityItem: SalesUkraineOrderItem = {
        ...existingItem,
        AssignedSpecification: { Id: 7, NetUid: 'spec-1', SpecificationCode: 'SPEC-1' },
        Comment: 'row comment',
        Discount: 4,
        IsFromReSale: true,
        OneTimeDiscount: 6,
        OneTimeDiscountComment: 'approved',
        PricePerItem: 12.5,
        SourceOrderItemNetUid: 'source-row-1',
      }
      const addedItem: SalesUkraineOrderItem = {
        ...identityItem,
        ...patch,
        NetUid: '00000000-0000-0000-0000-000000000000',
        Product: { NetUid: 'product-1' },
        Qty: 3,
      }

      const mutation = createAddOrUpdateSalesCartMutation({
        clientAgreementNetId: 'agreement-1',
        orderItem: addedItem,
        orderItems: [identityItem],
        saleNetId: 'sale-1',
      })

      expect(mutation.expectation).toEqual({ kind: 'operation-marker' })
      expect(mutation.request).toEqual({
        clientAgreementNetId: 'agreement-1',
        kind: 'add',
        orderItem: addedItem,
        saleNetId: 'sale-1',
      })
    },
  )

  it('uses an operation marker when duplicate complete identities make the target row ambiguous', () => {
    const mutation = createAddOrUpdateSalesCartMutation({
      clientAgreementNetId: 'agreement-1',
      orderItem: {
        Deleted: false,
        NetUid: '00000000-0000-0000-0000-000000000000',
        Product: { NetUid: 'product-1' },
        Qty: 3,
      },
      orderItems: [existingItem, { ...existingItem, NetUid: 'row-2' }],
      saleNetId: 'sale-1',
    })

    expect(mutation.expectation).toEqual({ kind: 'operation-marker' })
  })

  it('clears a confirmed restored item after acknowledged reconciliation', async () => {
    const calls: string[] = []

    await expect(finalizeSuccessfulPersistentCartMutation('acknowledged', {
      clear: () => calls.push('clear'),
      finish: () => calls.push('finish'),
      reconcileAcknowledged: async () => {
        calls.push('reconcile')

        return true
      },
    })).resolves.toBe(true)

    expect(calls).toEqual(['finish', 'reconcile', 'clear'])
  })
})

describe('usePersistentSalesCartMutation', () => {
  it('keeps a submitted 4xx unknown and permits only exact same-operation retry', async () => {
    const validationError = new ApiError('quantity conflict', 400, null)
    updateOrderItemMock
      .mockRejectedValueOnce(validationError)
      .mockResolvedValueOnce(undefined)
    const reconcile = vi.fn(async () => staleSale)
    const { result } = renderHook(() => usePersistentSalesCartMutation({ context, reconcile }))

    await act(async () => {
      await expect(result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 3 } },
        { afterQty: 3, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'update failed',
      )).resolves.toBe(false)
    })

    expect(loadSalesPendingMutation(scope)).toMatchObject({ phase: 'unknown' })
    expect(result.current.pendingError).toBe('quantity conflict')

    await act(async () => {
      await expect(result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 4 } },
        { afterQty: 4, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'update failed',
      )).rejects.toThrow('інша непідтверджена зміна')
    })

    await act(async () => {
      await expect(result.current.retryPending()).resolves.toBe(true)
    })

    const firstOperationId = updateOrderItemMock.mock.calls[0]?.[1]?.operationId
    const retriedOperationId = updateOrderItemMock.mock.calls[1]?.[1]?.operationId

    expect(firstOperationId).toBeTruthy()
    expect(retriedOperationId).toBe(firstOperationId)
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('blocks a different intent while allowing explicit replay of the same frozen request', async () => {
    updateOrderItemMock
      .mockRejectedValueOnce(new ApiError('response lost', 503, null))
      .mockResolvedValueOnce(undefined)
    const reconcile = vi.fn(async () => staleSale)
    const { result } = renderHook(() => usePersistentSalesCartMutation({ context, reconcile }))

    await act(async () => {
      await expect(result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 3 } },
        { afterQty: 3, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'update failed',
      )).resolves.toBe(false)
    })

    const pending = loadSalesPendingMutation(scope)
    const firstOperationId = updateOrderItemMock.mock.calls[0]?.[1]?.operationId

    expect(pending?.operationId).toBe(firstOperationId)
    expect(result.current.pendingError).toBe('response lost')

    await act(async () => {
      await expect(result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 99 } },
        { afterQty: 99, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'different request must not run',
      )).rejects.toThrow('інша непідтверджена зміна кошика')
    })

    expect(updateOrderItemMock).toHaveBeenCalledTimes(1)
    expect(loadSalesPendingMutation(scope)?.operationId).toBe(firstOperationId)

    await act(async () => {
      await expect(result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 3 } },
        { afterQty: 3, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'update failed',
      )).resolves.toBe(true)
    })

    expect(updateOrderItemMock).toHaveBeenCalledTimes(2)
    expect(updateOrderItemMock.mock.calls[1]?.[0]).toMatchObject({ NetUid: 'row-1', Qty: 3 })
    expect(updateOrderItemMock.mock.calls[1]?.[1]?.operationId).toBe(firstOperationId)
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('retries the exact persisted cart intent after tab close without rebuilding it from current UI state', async () => {
    updateOrderItemMock
      .mockRejectedValueOnce(new ApiError('response lost', 503, null))
      .mockResolvedValueOnce(undefined)
    const reconcile = vi.fn(async () => staleSale)
    const firstMount = renderHook(() => usePersistentSalesCartMutation({ context, reconcile }))

    await act(async () => {
      await expect(firstMount.result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 3 } },
        { afterQty: 3, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'update failed',
      )).resolves.toBe(false)
    })

    const operationId = loadSalesPendingMutation(scope)?.operationId
    firstMount.unmount()
    storageHarness.closeTab('tab-a')
    storageHarness.openTab('tab-a')
    const reopened = renderHook(() => usePersistentSalesCartMutation({ context, reconcile }))

    await act(async () => {
      await expect(reopened.result.current.retryPending()).resolves.toBe(true)
    })

    expect(updateOrderItemMock).toHaveBeenCalledTimes(2)
    expect(updateOrderItemMock.mock.calls[1]?.[0]).toMatchObject({ NetUid: 'row-1', Qty: 3 })
    expect(updateOrderItemMock.mock.calls[1]?.[1]?.operationId).toBe(operationId)
    expect(loadSalesPendingMutation(scope)).toBe(null)
    reopened.unmount()
  })

  it('releases an in-memory operation when durable persistence fails before sending', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const unavailableStorage = {
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }),
    } satisfies Storage
    Object.defineProperty(window, 'localStorage', { configurable: true, value: unavailableStorage })

    try {
      const reconcile = vi.fn(async () => staleSale)
      const { result } = renderHook(() => usePersistentSalesCartMutation({ context, reconcile }))
      const run = () => result.current.run(
        { kind: 'update', orderItem: { ...existingItem, Qty: 3 } },
        { afterQty: 3, beforeQty: 2, kind: 'row-quantity', rowNetUid: 'row-1' },
        'update failed',
      )

      await act(async () => {
        await expect(run()).rejects.toThrow('Запит не надіслано')
      })
      await act(async () => {
        await expect(run()).rejects.toThrow('Запит не надіслано')
      })

      expect(updateOrderItemMock).not.toHaveBeenCalled()
      expect(reconcile).not.toHaveBeenCalled()
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    }
  })
})
