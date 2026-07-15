import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSaleById } from '../../api/salesUkraineApi'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import type { SalesUkraineSale } from '../../types'
import {
  clearAllWizardSplitRecoveries,
  getWizardSplitOrderItems,
  getWizardSplitRecovery,
  setWizardSplitOrderItems,
  stageWizardSplitFinalMutation,
  stageWizardSplitExtraction,
} from './newSaleWizardState'
import {
  createPersistedWizardCartMutation,
  executeWizardCartMutationRequest,
  type WizardCartMutationRequest,
} from './wizardCartMutation'
import {
  createWizardSplitRestoreMutation,
  createWizardSplitOrderItem,
  getWizardMutationContextKey,
  restorePersistedWizardSplitRecovery,
  type WizardSplitRecoverySource,
} from './wizardSplitSale'
import type { WizardSaleProduct } from './wizardSaleProduct'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from '../../salesMutationStorageTestHarness'

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return { ...actual, getSaleById: vi.fn() }
})

vi.mock('./wizardCartMutation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./wizardCartMutation')>()

  return { ...actual, executeWizardCartMutationRequest: vi.fn() }
})

const product: WizardSaleProduct = {
  CurrentLocalPrice: 40,
  CurrentPrice: 10,
  CurrentPriceEurToUah: 40,
  NetUid: 'product-1',
}

function sourceRow(qty: number) {
  return {
    Comment: 'source',
    NetUid: 'source-row-1',
    Product: product,
    Qty: qty,
    TotalAmount: qty * 10,
    TotalAmountEurToUah: qty * 40,
    TotalAmountLocal: qty * 40,
  }
}

let storageHarness: SalesMutationStorageHarness

beforeEach(() => {
  storageHarness = installSalesMutationStorageHarness()
  clearAllWizardSplitRecoveries()
  clearAllSalesPendingMutations()
  vi.clearAllMocks()
})

afterEach(() => {
  clearAllWizardSplitRecoveries()
  clearAllSalesPendingMutations()
  storageHarness.dispose()
})

describe('wizard split abandonment recovery', () => {
  it.each(['ordinary', 'merged'] as const)(
    'restores an abandoned %s source sale once and removes its reload journal',
    async (origin) => {
      const source: WizardSplitRecoverySource = {
        agreementNetId: 'agreement-1',
        origin,
        saleNetUid: `${origin}-source-sale`,
        userKey: 'net:user-1',
      }
      const splitItem = createWizardSplitOrderItem(sourceRow(5), 2, undefined)
      let serverSale: SalesUkraineSale = {
        NetUid: source.saleNetUid,
        Order: { OrderItems: [sourceRow(3)] },
      }

      setWizardSplitOrderItems([splitItem], source.agreementNetId, source)
      vi.mocked(getSaleById).mockImplementation(async (saleNetUid) => {
        expect(saleNetUid).toBe(source.saleNetUid)

        return structuredClone(serverSale)
      })
      vi.mocked(executeWizardCartMutationRequest).mockImplementation(async (
        request: WizardCartMutationRequest,
        operationId: string,
      ) => {
        expect(request.kind).toBe('update')

        if (request.kind !== 'update') {
          return
        }

        serverSale = {
          ...serverSale,
          Order: {
            ...serverSale.Order,
            OrderItems: [{ ...request.orderItem, OperationNetUid: operationId }],
          },
        }
      })

      const restored = await restorePersistedWizardSplitRecovery(source.userKey)
      const duplicateAttempt = await restorePersistedWizardSplitRecovery(source.userKey)

      expect(restored).toMatchObject({
        changed: true,
        error: null,
        source: expect.objectContaining({ origin, saleNetUid: source.saleNetUid }),
        succeeded: true,
      })
      expect(serverSale.Order?.OrderItems?.[0]?.Qty).toBe(5)
      expect(executeWizardCartMutationRequest).toHaveBeenCalledTimes(1)
      expect(getWizardSplitOrderItems()).toEqual([])
      expect(getWizardSplitRecovery()).toBe(null)
      expect(duplicateAttempt).toEqual({
        changed: false,
        error: null,
        sale: null,
        source: null,
        succeeded: true,
      })
    },
  )

  it('recovers a reload after the persisted source row was deleted but before the split committed locally', async () => {
    const source: WizardSplitRecoverySource = {
      agreementNetId: 'agreement-1',
      origin: 'ordinary',
      saleNetUid: 'sale-1',
      userKey: 'net:user-1',
    }
    const splitItem = createWizardSplitOrderItem(sourceRow(2), 2, undefined)
    const extractionOperationId = '11111111-1111-4111-8111-111111111111'
    let serverSale: SalesUkraineSale = {
      NetUid: source.saleNetUid,
      OperationNetUid: extractionOperationId,
      Order: { OrderItems: [] },
    }

    stageWizardSplitExtraction({
      fallbackItems: [],
      items: [splitItem],
      mutation: {
        expectation: { beforeQty: 2, kind: 'row-deleted', rowNetUid: 'source-row-1' },
        operationId: extractionOperationId,
        request: { kind: 'delete', orderItemNetId: 'source-row-1' },
      },
      source,
    })
    vi.mocked(getSaleById).mockImplementation(async () => structuredClone(serverSale))
    vi.mocked(executeWizardCartMutationRequest).mockImplementation(async (
      request: WizardCartMutationRequest,
      operationId: string,
    ) => {
      expect(request.kind).toBe('add')

      if (request.kind !== 'add') {
        return
      }

      serverSale = {
        ...serverSale,
        Order: {
          ...serverSale.Order,
          OrderItems: [{ ...request.orderItem, NetUid: 'restored-row-1', OperationNetUid: operationId }],
        },
      }
    })

    const result = await restorePersistedWizardSplitRecovery(source.userKey)

    expect(result).toMatchObject({ changed: true, error: null, succeeded: true })
    expect(executeWizardCartMutationRequest).toHaveBeenCalledTimes(1)
    expect(vi.mocked(executeWizardCartMutationRequest).mock.calls[0]?.[0]).toMatchObject({
      kind: 'add',
      orderItem: expect.objectContaining({ Qty: 2, SourceOrderItemNetUid: 'source-row-1' }),
      saleNetId: 'sale-1',
    })
    expect(serverSale.Order?.OrderItems?.[0]?.Qty).toBe(2)
    expect(getWizardSplitRecovery()).toBe(null)
  })

  it('settles the durable cart journal when reload evidence confirms a restore committed', async () => {
    const source: WizardSplitRecoverySource = {
      agreementNetId: 'agreement-1',
      origin: 'ordinary',
      saleNetUid: 'sale-1',
      userKey: 'net:user-1',
    }
    const operationId = '22222222-2222-4222-8222-222222222222'
    const splitItem = createWizardSplitOrderItem(sourceRow(5), 2, undefined)
    const beforeRestore: SalesUkraineSale = {
      NetUid: source.saleNetUid,
      Order: { OrderItems: [sourceRow(3)] },
    }
    const mutation = createWizardSplitRestoreMutation(
      source,
      splitItem,
      beforeRestore,
      operationId,
    )
    const trackedItem = {
      ...splitItem,
      RestoreAttempted: true,
      RestoreMutation: mutation,
      RestoreOperationNetUid: operationId,
    }
    const context = getWizardMutationContextKey(source.agreementNetId, source.saleNetUid)
    const scope: SalesPendingMutationScope = {
      context,
      kind: 'cart',
      userKey: source.userKey,
    }

    setWizardSplitOrderItems([trackedItem], source.agreementNetId, source)
    saveSalesPendingMutation(scope, operationId, createPersistedWizardCartMutation({
      context,
      expectation: mutation.expectation,
      fallbackMessage: '',
      localCommit: { kind: 'none' },
      operationId,
      request: mutation.request,
    }))
    vi.mocked(getSaleById).mockResolvedValue({
      NetUid: source.saleNetUid,
      Order: {
        OrderItems: [{ ...sourceRow(5), OperationNetUid: operationId }],
      },
    })

    const result = await restorePersistedWizardSplitRecovery(source.userKey)

    expect(result).toMatchObject({ changed: true, error: null, succeeded: true })
    expect(executeWizardCartMutationRequest).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(scope)).toBe(null)
    expect(getWizardSplitRecovery()).toBe(null)
  })

  it('never restores split items while a linked final sale operation is unresolved', async () => {
    const source: WizardSplitRecoverySource = {
      agreementNetId: 'agreement-1',
      origin: 'ordinary',
      saleNetUid: 'sale-1',
      userKey: 'net:user-1',
    }
    const splitItem = createWizardSplitOrderItem(sourceRow(5), 2, undefined)

    setWizardSplitOrderItems([splitItem], source.agreementNetId, source)
    stageWizardSplitFinalMutation({
      context: 'wizard-final:client:agreement:sale',
      kind: 'create-sale',
      operationId: '11111111-1111-4111-8111-111111111111',
      userKey: source.userKey,
    })

    const result = await restorePersistedWizardSplitRecovery(source.userKey)

    expect(result).toMatchObject({ changed: false, succeeded: false })
    expect(result.error).toEqual(expect.objectContaining({ message: expect.stringContaining('ще не звірена') }))
    expect(getSaleById).not.toHaveBeenCalled()
    expect(executeWizardCartMutationRequest).not.toHaveBeenCalled()
    expect(getWizardSplitRecovery()?.finalMutation).toMatchObject({ kind: 'create-sale' })
    expect(getWizardSplitOrderItems()).toHaveLength(1)
  })

  it('undeletes the original row when restoring a split into a soft-deleted source item', async () => {
    const source: WizardSplitRecoverySource = {
      agreementNetId: 'agreement-1',
      origin: 'ordinary',
      saleNetUid: 'sale-1',
      userKey: 'net:user-1',
    }
    const splitItem = createWizardSplitOrderItem(sourceRow(5), 2, undefined)
    let serverSale: SalesUkraineSale = {
      NetUid: source.saleNetUid,
      Order: { OrderItems: [{ ...sourceRow(3), Deleted: true }] },
    }

    setWizardSplitOrderItems([splitItem], source.agreementNetId, source)
    vi.mocked(getSaleById).mockImplementation(async () => structuredClone(serverSale))
    vi.mocked(executeWizardCartMutationRequest).mockImplementation(async (
      request: WizardCartMutationRequest,
      operationId: string,
    ) => {
      expect(request).toMatchObject({
        kind: 'update',
        orderItem: { Deleted: false, NetUid: 'source-row-1', Qty: 5 },
      })

      if (request.kind === 'update') {
        serverSale = {
          ...serverSale,
          Order: {
            ...serverSale.Order,
            OrderItems: [{ ...request.orderItem, OperationNetUid: operationId }],
          },
        }
      }
    })

    const result = await restorePersistedWizardSplitRecovery(source.userKey)

    expect(result).toMatchObject({ changed: true, error: null, succeeded: true })
    expect(serverSale.Order?.OrderItems?.[0]).toMatchObject({ Deleted: false, Qty: 5 })
    expect(getWizardSplitRecovery()).toBe(null)
  })
})
