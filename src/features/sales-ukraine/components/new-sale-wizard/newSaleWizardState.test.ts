import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  claimWizardSplitRecoveryOwnership,
  clearAllWizardSplitRecoveries,
  clearWizardSplitFinalMutation,
  clearWizardMergedSale,
  clearWizardSplitOrderItems,
  commitWizardSplitExtraction,
  confirmWizardSplitFinalMutationManuallyCommitted,
  getCartItemCount,
  getWizardMergedSale,
  getWizardMergedSaleNetUid,
  getWizardSplitAgreementNetId,
  getWizardSplitOrderItems,
  getWizardSplitRecovery,
  hasWizardSplitRecoveryOperation,
  hasWizardSplitOrderItems,
  hydrateWizardSplitRecovery,
  isSelfCheckout,
  isWizardShellBusy,
  isWizardMergedSaleMode,
  markWizardSplitExtractionSubmitted,
  markWizardSplitExtractionUnknown,
  markWizardSplitFinalMutationSubmitted,
  replaceWizardMergedOrderItems,
  rollbackWizardSplitExtraction,
  setWizardMergedSale,
  setWizardSplitOrderItems,
  stageWizardSplitExtraction,
  stageWizardSplitFinalMutation,
  subscribeWizardMergedSale,
  subscribeWizardSplitOrderItems,
  SELF_CHECKOUT_CLASS,
  WIZARD_SPLIT_RECOVERY_LEASE_MS,
  WizardSplitRecoveryCorruptionError,
  WizardSplitRecoveryFenceError,
} from './newSaleWizardState'
import type { SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from '../../salesMutationStorageTestHarness'
import type { WizardSplitMutationSnapshot, WizardSplitOrderItem, WizardSplitRecoverySource } from './wizardSplitSale'

const recoverySource: WizardSplitRecoverySource = {
  agreementNetId: 'agreement-1',
  origin: 'ordinary',
  saleNetUid: 'sale-1',
  userKey: 'net:user-1',
}

const splitItem: WizardSplitOrderItem = {
  Deleted: false,
  Id: 0,
  NetUid: '00000000-0000-0000-0000-000000000000',
  Product: { NetUid: 'product-1' },
  Qty: 2,
  TotalAmount: 10,
  TotalAmountEurToUah: 0,
  TotalAmountLocal: 400,
}

const extractionMutation: WizardSplitMutationSnapshot = {
  expectation: { beforeQty: 2, kind: 'row-deleted', rowNetUid: 'row-1' },
  operationId: '11111111-1111-4111-8111-111111111111',
  request: { kind: 'delete', orderItemNetId: 'row-1' },
}

let storageHarness: SalesMutationStorageHarness

beforeEach(() => {
  storageHarness = installSalesMutationStorageHarness()
  clearAllWizardSplitRecoveries()
})
afterEach(() => {
  clearAllWizardSplitRecoveries()
  storageHarness.dispose()
})

describe('new sale wizard state guards', () => {
  it('detects self-checkout transporters by css class', () => {
    expect(isSelfCheckout({ CssClass: SELF_CHECKOUT_CLASS, Id: 7 } as SalesUkraineTransporter)).toBe(true)
    expect(isSelfCheckout({ CssClass: 'other', Id: 7 } as SalesUkraineTransporter)).toBe(false)
    expect(isSelfCheckout(null)).toBe(false)
  })

  it('gates products and review by selected agreement and cart sale', () => {
    expect(canAdvanceToProducts({ agreement: null, agreementNetId: null, clientNetId: 'client-1', sale: null })).toBe(false)
    expect(canAdvanceToProducts({ agreement: null, agreementNetId: 'agreement-1', clientNetId: 'client-1', sale: null })).toBe(true)
    expect(canAdvanceToReview({ agreement: null, agreementNetId: 'agreement-1', clientNetId: 'client-1', sale: {} })).toBe(false)
    expect(canAdvanceToReview({ agreement: null, agreementNetId: 'agreement-1', clientNetId: 'client-1', sale: { NetUid: 'sale-1' } })).toBe(true)
  })

  it('counts cart items defensively', () => {
    expect(getCartItemCount(null)).toBe(0)
    expect(getCartItemCount({ Order: { OrderItems: [{ Id: 1 }, { Id: 2 }] } } as SalesUkraineSale)).toBe(2)
  })

  it('keeps wizard navigation locked while a product mutation is running', () => {
    expect(isWizardShellBusy(false, true, false)).toBe(true)
    expect(isWizardShellBusy(false, false, false)).toBe(false)
  })
})

describe('wizard split order items store', () => {
  it('stores, signals and clears split items', () => {
    clearWizardSplitOrderItems()

    let notifications = 0
    const unsubscribe = subscribeWizardSplitOrderItems(() => {
      notifications += 1
    })

    expect(hasWizardSplitOrderItems()).toBe(false)

    const items = [{ Product: { NetUid: 'product-1' }, Qty: 2, TotalAmount: 10, TotalAmountEurToUah: 0, TotalAmountLocal: 400 }]

    setWizardSplitOrderItems(items, 'agreement-1', recoverySource)

    expect(getWizardSplitOrderItems()).toStrictEqual(items)
    expect(getWizardSplitAgreementNetId()).toBe('agreement-1')
    expect(hasWizardSplitOrderItems()).toBe(true)
    expect(notifications).toBe(1)

    clearWizardSplitOrderItems()

    expect(getWizardSplitOrderItems()).toEqual([])
    expect(getWizardSplitAgreementNetId()).toBe(null)
    expect(hasWizardSplitOrderItems()).toBe(false)
    expect(notifications).toBe(2)

    clearWizardSplitOrderItems()

    expect(notifications).toBe(2)

    unsubscribe()
  })

  it.each(['ordinary', 'merged'] as const)(
    'survives a reload for an %s source sale and clears the durable record exactly once',
    (origin) => {
      const source = { ...recoverySource, origin }

      setWizardSplitOrderItems([splitItem], source.agreementNetId, source)
      hydrateWizardSplitRecovery('net:other-user')

      expect(getWizardSplitOrderItems()).toEqual([])
      expect(hydrateWizardSplitRecovery(source.userKey)).toMatchObject({
        agreementNetId: 'agreement-1',
        items: [expect.objectContaining({ Qty: 2 })],
        origin,
        saleNetUid: 'sale-1',
        userKey: 'net:user-1',
      })
      expect(getWizardSplitOrderItems()).toEqual([splitItem])

      clearWizardSplitOrderItems()
      expect(hydrateWizardSplitRecovery(source.userKey)).toBe(null)

      clearWizardSplitOrderItems()
      expect(hydrateWizardSplitRecovery(source.userKey)).toBe(null)
    },
  )

  it('keeps a pending extraction durable without exposing it to the UI until it commits', () => {
    stageWizardSplitExtraction({
      fallbackItems: [],
      items: [splitItem],
      mutation: extractionMutation,
      source: recoverySource,
    })

    expect(getWizardSplitOrderItems()).toEqual([])
    expect(getWizardSplitRecovery()?.pendingExtraction?.mutation).toEqual(extractionMutation)
    expect(getWizardSplitRecovery()?.pendingExtraction?.phase).toBe('prepared')
    expect(hasWizardSplitRecoveryOperation(extractionMutation.operationId)).toBe(true)

    expect(commitWizardSplitExtraction(extractionMutation.operationId)).toBe(true)
    expect(getWizardSplitOrderItems()).toEqual([splitItem])
    expect(getWizardSplitRecovery()?.pendingExtraction).toBeUndefined()

    stageWizardSplitExtraction({
      fallbackItems: [],
      items: [splitItem],
      mutation: extractionMutation,
      source: recoverySource,
    })

    expect(rollbackWizardSplitExtraction(extractionMutation.operationId)).toBe(true)
    expect(getWizardSplitOrderItems()).toEqual([])
    expect(getWizardSplitRecovery()).toBe(null)
  })

  it('never rolls a split extraction back after its request entered submitted', () => {
    stageWizardSplitExtraction({
      fallbackItems: [],
      items: [splitItem],
      mutation: extractionMutation,
      source: recoverySource,
    })

    expect(markWizardSplitExtractionSubmitted(extractionMutation.operationId)).toBe(true)
    expect(getWizardSplitRecovery()?.pendingExtraction?.phase).toBe('submitted')
    expect(() => rollbackWizardSplitExtraction(extractionMutation.operationId)).toThrow(
      'requires server reconciliation or manual resolution',
    )

    expect(markWizardSplitExtractionUnknown(extractionMutation.operationId)).toBe(true)
    expect(getWizardSplitRecovery()?.pendingExtraction?.phase).toBe('unknown')
    expect(() => rollbackWizardSplitExtraction(extractionMutation.operationId)).toThrow(
      'requires server reconciliation or manual resolution',
    )
    expect(getWizardSplitOrderItems()).toEqual([])
  })

  it('persists the linked final operation across hydration until it is explicitly settled', () => {
    const operationId = '22222222-2222-4222-8222-222222222222'

    setWizardSplitOrderItems([splitItem], recoverySource.agreementNetId, recoverySource)
    expect(stageWizardSplitFinalMutation({
      context: 'wizard-final:client-1:agreement-1:sale-1',
      kind: 'create-sale',
      operationId,
      userKey: recoverySource.userKey,
    })).toBe(true)

    hydrateWizardSplitRecovery('net:other-user')
    expect(hydrateWizardSplitRecovery(recoverySource.userKey)?.finalMutation).toEqual({
      context: 'wizard-final:client-1:agreement-1:sale-1',
      kind: 'create-sale',
      operationId,
      ownerId: expect.stringMatching(/^tab:/),
      ownerUpdatedAt: expect.any(Number),
      phase: 'prepared',
      userKey: recoverySource.userKey,
    })
    expect(markWizardSplitFinalMutationSubmitted(operationId)).toBe(true)
    expect(getWizardSplitRecovery()?.finalMutation?.phase).toBe('submitted')
    expect(() => clearWizardSplitFinalMutation(operationId)).toThrow('without server ledger proof')
    expect(confirmWizardSplitFinalMutationManuallyCommitted(operationId)).toBe(true)
    expect(getWizardSplitRecovery()).toBeNull()
    expect(getWizardSplitOrderItems()).toEqual([])
  })

  it('fails before submission when another tab removes the durable final ownership link', () => {
    const operationId = '23222222-2222-4222-8222-222222222222'

    setWizardSplitOrderItems([splitItem], recoverySource.agreementNetId, recoverySource)
    stageWizardSplitFinalMutation({
      context: 'wizard-final:client-1:agreement-1:sale-1',
      kind: 'create-sale',
      operationId,
      userKey: recoverySource.userKey,
    })
    expect(clearWizardSplitFinalMutation(operationId)).toBe(true)

    expect(() => markWizardSplitFinalMutationSubmitted(operationId)).toThrow('Запит не надіслано')
    expect(getWizardSplitRecovery()?.items).toEqual([splitItem])
  })

  it('retains corruption evidence and fails closed for valid JSON with a malformed legacy registry', () => {
    const legacyKey = 'gba_console:wizard-split-recovery:v1'
    storageHarness.localStorage.setItem(legacyKey, '{}')

    expect(() => hydrateWizardSplitRecovery(recoverySource.userKey)).toThrow(
      WizardSplitRecoveryCorruptionError,
    )
    expect(storageHarness.localStorage.getItem(legacyKey)).toBe('{}')

    const corruptionKeys: string[] = []

    for (let index = 0; index < storageHarness.localStorage.length; index += 1) {
      const key = storageHarness.localStorage.key(index)

      if (key?.startsWith('gba_console:wizard-split-corruption:v1:')) {
        corruptionKeys.push(key)
      }
    }

    expect(corruptionKeys).toHaveLength(1)
    expect(JSON.parse(storageHarness.localStorage.getItem(corruptionKeys[0]) || '{}')).toMatchObject({
      reason: 'Invalid legacy split recovery registry',
      sourceKey: legacyKey,
    })
    storageHarness.localStorage.removeItem(legacyKey)
    expect(() => hydrateWizardSplitRecovery(recoverySource.userKey)).toThrow(
      WizardSplitRecoveryCorruptionError,
    )
    expect(getWizardSplitRecovery()).toBe(null)
    expect(getWizardSplitOrderItems()).toEqual([])
  })

  it('fails closed before a split source request when local storage cannot persist recovery', () => {
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
      expect(() => stageWizardSplitExtraction({
        fallbackItems: [],
        items: [splitItem],
        mutation: extractionMutation,
        source: recoverySource,
      })).toThrow('Зміни рахунку не надіслано')
      expect(getWizardSplitRecovery()).toBe(null)
      expect(getWizardSplitOrderItems()).toEqual([])
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    }
  })

  it('does not overwrite an unresolved recovery with a different source sale', () => {
    setWizardSplitOrderItems([splitItem], recoverySource.agreementNetId, recoverySource)

    expect(() => stageWizardSplitExtraction({
      fallbackItems: [],
      items: [splitItem],
      mutation: extractionMutation,
      source: { ...recoverySource, saleNetUid: 'sale-2' },
    })).toThrow('another source sale')
    expect(getWizardSplitRecovery()).toMatchObject({ saleNetUid: 'sale-1' })
    expect(hydrateWizardSplitRecovery(recoverySource.userKey)).toMatchObject({ saleNetUid: 'sale-1' })
  })

  it('keeps two same-user tab recoveries isolated and clears only the active source', () => {
    const sourceB = {
      ...recoverySource,
      agreementNetId: 'agreement-2',
      saleNetUid: 'sale-2',
    }

    storageHarness.selectTab('tab-a')
    setWizardSplitOrderItems([splitItem], recoverySource.agreementNetId, recoverySource)

    storageHarness.selectTab('tab-b')
    hydrateWizardSplitRecovery('net:other-user')
    setWizardSplitOrderItems([{ ...splitItem, Product: { NetUid: 'product-2' } }], sourceB.agreementNetId, sourceB)
    clearWizardSplitOrderItems()

    storageHarness.selectTab('tab-a')
    expect(hydrateWizardSplitRecovery(recoverySource.userKey)).toMatchObject({
      agreementNetId: recoverySource.agreementNetId,
      saleNetUid: recoverySource.saleNetUid,
    })
    expect(getWizardSplitOrderItems()).toEqual([splitItem])
  })

  it('does not transfer split ownership while its tab lease is live and never deletes on expiry', () => {
    storageHarness.selectTab('tab-a')
    setWizardSplitOrderItems([splitItem], recoverySource.agreementNetId, recoverySource)
    const tabARecovery = getWizardSplitRecovery()!
    const now = tabARecovery.ownerUpdatedAt

    storageHarness.selectTab('tab-b')
    const tabBView = hydrateWizardSplitRecovery(recoverySource.userKey)!

    expect(claimWizardSplitRecoveryOwnership(tabBView, now + WIZARD_SPLIT_RECOVERY_LEASE_MS - 1)).toBe(null)
    expect(hydrateWizardSplitRecovery(recoverySource.userKey)).toMatchObject({
      ownerId: tabARecovery.ownerId,
      saleNetUid: recoverySource.saleNetUid,
    })

    const claimed = claimWizardSplitRecoveryOwnership(
      tabBView,
      now + WIZARD_SPLIT_RECOVERY_LEASE_MS,
    )

    expect(claimed).toMatchObject({ saleNetUid: recoverySource.saleNetUid })
    expect(claimed?.ownerId).not.toBe(tabARecovery.ownerId)
    expect(getWizardSplitOrderItems()).toEqual([splitItem])
  })

  it('fences stale mark and rollback after another tab takes over an expired lease', () => {
    const operationId = '24222222-2222-4222-8222-222222222222'

    storageHarness.selectTab('tab-a')
    setWizardSplitOrderItems([splitItem], recoverySource.agreementNetId, recoverySource)
    stageWizardSplitFinalMutation({
      context: 'wizard-final:client-1:agreement-1:sale-1',
      kind: 'create-sale',
      operationId,
      userKey: recoverySource.userKey,
    })
    const tabARecovery = getWizardSplitRecovery()!

    storageHarness.selectTab('tab-b')
    const tabBRecovery = hydrateWizardSplitRecovery(recoverySource.userKey)!
    expect(claimWizardSplitRecoveryOwnership(
      tabBRecovery,
      tabARecovery.ownerUpdatedAt + WIZARD_SPLIT_RECOVERY_LEASE_MS,
    )).not.toBe(null)

    storageHarness.selectTab('tab-a')
    expect(() => markWizardSplitFinalMutationSubmitted(operationId)).toThrow(WizardSplitRecoveryFenceError)
    expect(() => clearWizardSplitFinalMutation(operationId)).toThrow(WizardSplitRecoveryFenceError)
    expect(hydrateWizardSplitRecovery(recoverySource.userKey)).toBeNull()
  })
})

describe('wizard merged sale store', () => {
  it('keeps distinct persisted rows for the same product', () => {
    clearWizardMergedSale()
    setWizardMergedSale({
      netUid: 'sale-1',
      orderItems: [
        {
          IsFromReSale: false,
          NetUid: 'item-regular',
          OneTimeDiscount: 5,
          Product: { NetUid: 'product-1' },
          SourceOrderItemNetUid: 'source-regular',
        },
        {
          IsFromReSale: true,
          NetUid: 'item-resale',
          OneTimeDiscount: 7,
          Product: { NetUid: 'product-1' },
          SourceOrderItemNetUid: 'source-resale',
        },
      ],
      unionSale: null,
    })

    expect(getWizardMergedSale()?.orderItems.map((item) => item.NetUid)).toEqual(['item-regular', 'item-resale'])

    clearWizardMergedSale()
  })

  it('stores, signals and clears the merged input sale draft', () => {
    clearWizardMergedSale()

    let notifications = 0
    const unsubscribe = subscribeWizardMergedSale(() => {
      notifications += 1
    })

    expect(isWizardMergedSaleMode()).toBe(false)
    expect(getWizardMergedSale()).toBe(null)
    expect(getWizardMergedSaleNetUid()).toBe(null)

    setWizardMergedSale({
      netUid: 'sale-1',
      orderItems: [{ NetUid: 'item-1', Product: { NetUid: 'product-1' }, Qty: 5 }],
      unionSale: { NetUid: 'union-1' },
    })

    expect(getWizardMergedSaleNetUid()).toBe('sale-1')
    expect(isWizardMergedSaleMode()).toBe(true)
    expect(getWizardMergedSale()?.unionSale?.NetUid).toBe('union-1')
    expect(notifications).toBe(1)

    clearWizardMergedSale()

    expect(getWizardMergedSale()).toBe(null)
    expect(getWizardMergedSaleNetUid()).toBe(null)
    expect(isWizardMergedSaleMode()).toBe(false)
    expect(notifications).toBe(2)

    clearWizardMergedSale()

    expect(notifications).toBe(2)

    unsubscribe()
  })

  it('replaces the complete merged cart from the matching fresh server snapshot', () => {
    clearWizardMergedSale()
    setWizardMergedSale({
      netUid: 'sale-1',
      orderItems: [{ NetUid: 'stale-item', Product: { NetUid: 'product-1' }, Qty: 99 }],
      unionSale: null,
    })

    const freshItems = [
      { NetUid: 'normal-item', IsFromReSale: false, Product: { NetUid: 'product-1' }, Qty: 2 },
      { NetUid: 'resale-item', IsFromReSale: true, Product: { NetUid: 'product-1' }, Qty: 1 },
    ]

    expect(replaceWizardMergedOrderItems('sale-1', freshItems)).toBe(true)
    expect(getWizardMergedSale()?.orderItems).toEqual(freshItems)
    expect(replaceWizardMergedOrderItems('other-sale', [{ NetUid: 'wrong-context' }])).toBe(false)
    expect(getWizardMergedSale()?.orderItems).toEqual(freshItems)

    clearWizardMergedSale()
  })
})
