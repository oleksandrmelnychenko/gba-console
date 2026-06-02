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

  it('requires a delivery address and mobile phone once carrier and recipient are chosen', () => {
    const transporter = { Id: 2 } as SalesUkraineTransporter
    const recipient = { Id: 5 }

    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, recipient, transporter })).toBe('Оберіть адресу доставки')
    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, address: { Id: 9 }, recipient, transporter })).toBe(
      'Вкажіть мобільний телефон отримувача',
    )
    expect(getReviewError({ ...NEW_SALE_REVIEW_INITIAL, address: { Id: 9 }, mobilePhone: '380501112233', recipient, transporter })).toBeNull()
  })

  it('requires COD amount and own-TTN number when those options are enabled', () => {
    const transporter = { Id: 2 } as SalesUkraineTransporter
    const base = { ...NEW_SALE_REVIEW_INITIAL, address: { Id: 9 }, mobilePhone: '380501112233', recipient: { Id: 5 }, transporter }

    expect(getReviewError({ ...base, codAmount: '', isCashOnDelivery: true })).toBe('Вкажіть суму накладеного платежу')
    expect(getReviewError({ ...base, codAmount: 100, isCashOnDelivery: true })).toBeNull()
    expect(getReviewError({ ...base, hasOwnTtn: true, ttnNumber: '' })).toBe('Вкажіть номер ТТН')
    expect(getReviewError({ ...base, hasOwnTtn: true, ttnNumber: '204500112233' })).toBeNull()
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
