import { describe, expect, it } from 'vitest'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  clearWizardMergedSale,
  clearWizardSplitOrderItems,
  getCartItemCount,
  getWizardMergedSale,
  getWizardMergedSaleNetUid,
  getWizardSplitAgreementNetId,
  getWizardSplitOrderItems,
  hasWizardSplitOrderItems,
  isSelfCheckout,
  isWizardMergedSaleMode,
  removeWizardMergedOrderItem,
  setWizardMergedSale,
  setWizardSplitOrderItems,
  subscribeWizardMergedSale,
  subscribeWizardSplitOrderItems,
  upsertWizardMergedOrderItem,
  SELF_CHECKOUT_CLASS,
} from './newSaleWizardState'
import type { SalesUkraineSale, SalesUkraineTransporter } from '../../types'

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

    setWizardSplitOrderItems(items, 'agreement-1')

    expect(getWizardSplitOrderItems()).toBe(items)
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
})

describe('wizard merged sale store', () => {
  it('stores, signals, mutates and clears the merged input sale draft', () => {
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

    upsertWizardMergedOrderItem({ NetUid: 'item-2', Product: { NetUid: 'product-2' }, Qty: 1 })

    expect(getWizardMergedSale()?.orderItems.map((item) => item.NetUid)).toEqual(['item-2', 'item-1'])
    expect(notifications).toBe(2)

    upsertWizardMergedOrderItem({ NetUid: 'item-1', Product: { NetUid: 'product-1' }, Qty: 2 })

    expect(getWizardMergedSale()?.orderItems.find((item) => item.NetUid === 'item-1')?.Qty).toBe(2)
    expect(getWizardMergedSale()?.orderItems).toHaveLength(2)
    expect(notifications).toBe(3)

    removeWizardMergedOrderItem('item-2')

    expect(getWizardMergedSale()?.orderItems.map((item) => item.NetUid)).toEqual(['item-1'])
    expect(notifications).toBe(4)

    clearWizardMergedSale()

    expect(getWizardMergedSale()).toBe(null)
    expect(getWizardMergedSaleNetUid()).toBe(null)
    expect(isWizardMergedSaleMode()).toBe(false)
    expect(notifications).toBe(5)

    clearWizardMergedSale()

    expect(notifications).toBe(5)

    unsubscribe()
  })
})
