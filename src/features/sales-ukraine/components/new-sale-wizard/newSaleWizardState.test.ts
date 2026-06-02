import { describe, expect, it } from 'vitest'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  getCartItemCount,
  getReviewError,
  isSelfCheckout,
  SELF_CHECKOUT_CLASS,
} from './newSaleWizardState'
import type { SalesUkraineSale, SalesUkraineTransporter } from '../../types'

describe('new sale wizard state guards', () => {
  it('allows self-checkout review without carrier recipient details', () => {
    const transporter = { CssClass: SELF_CHECKOUT_CLASS, Id: 7 } as SalesUkraineTransporter

    expect(isSelfCheckout(transporter)).toBe(true)
    expect(getReviewError({ address: null, comment: '', recipient: null, transporter })).toBeNull()
  })

  it('requires transporter and recipient for delivery review', () => {
    expect(getReviewError({ address: null, comment: '', recipient: null, transporter: null })).toBe('Оберіть перевізника')
    expect(getReviewError({ address: null, comment: '', recipient: null, transporter: { Id: 2 } as SalesUkraineTransporter })).toBe(
      'Оберіть отримувача',
    )
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
