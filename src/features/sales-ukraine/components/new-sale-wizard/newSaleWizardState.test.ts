import { describe, expect, it } from 'vitest'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  clearWizardSplitOrderItems,
  getCartItemCount,
  getWizardSplitAgreementNetId,
  getWizardSplitOrderItems,
  hasWizardSplitOrderItems,
  isSelfCheckout,
  setWizardSplitOrderItems,
  subscribeWizardSplitOrderItems,
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
