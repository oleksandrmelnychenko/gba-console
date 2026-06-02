import { describe, expect, it } from 'vitest'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  getCartItemCount,
  getReviewError,
  isSelfCheckout,
  NEW_SALE_REVIEW_INITIAL,
  SELF_CHECKOUT_CLASS,
} from './newSaleWizardState'
import type { SalesUkraineSale, SalesUkraineTransporter } from '../../types'

describe('new sale wizard state guards', () => {
  it('allows self-checkout review without carrier recipient details', () => {
    const transporter = { CssClass: SELF_CHECKOUT_CLASS, Id: 7 } as SalesUkraineTransporter

    expect(isSelfCheckout(transporter)).toBe(true)
    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, transporter })).toBeNull()
  })

  it('requires transporter and recipient for delivery review', () => {
    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, transporter: null })).toBe('Оберіть перевізника')
    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, transporter: { Id: 2 } as SalesUkraineTransporter })).toBe('Оберіть отримувача')
  })

  it('requires a delivery address once carrier and recipient are chosen', () => {
    const transporter = { Id: 2 } as SalesUkraineTransporter

    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, recipient: { Id: 5 }, transporter })).toBe('Оберіть адресу доставки')
    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, address: { Id: 9 }, recipient: { Id: 5 }, transporter })).toBeNull()
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
