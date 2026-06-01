import { describe, expect, it } from 'vitest'
import { getSaleReviewIssues } from './saleReviewGuards'
import type { SalesUkraineSale } from './types'

describe('getSaleReviewIssues', () => {
  it('allows a delivery sale with carrier, recipient, address, phone, and COD amount', () => {
    expect(
      getSaleReviewIssues({
        CashOnDeliveryAmount: 100,
        DeliveryRecipient: { FullName: 'Buyer', Id: 7, MobilePhone: '+380501112233' },
        DeliveryRecipientAddress: { City: 'Kyiv', Department: '1' },
        IsCashOnDelivery: true,
        Transporter: { Id: 2, Name: 'Nova Poshta' },
      }),
    ).toEqual([])
  })

  it('requires recipient data for non-self-checkout sales but does not block on missing address', () => {
    expect(getSaleReviewIssues({ Transporter: { Id: 2 } } as SalesUkraineSale)).toEqual([
      'recipient',
      'recipientPhone',
    ])
  })

  it('does not require recipient delivery fields for self-checkout transporter', () => {
    expect(getSaleReviewIssues({ Transporter: { CssClass: 'self_checkout_item_class', Id: 3 } })).toEqual([])
  })

  it('blocks missing transporter, invalid COD amount, and empty own TTN number', () => {
    expect(
      getSaleReviewIssues({
        CashOnDeliveryAmount: 0,
        CustomersOwnTtn: { Number: ' ' },
        DeliveryRecipient: { FullName: 'Buyer', MobilePhone: '+380501112233' },
        DeliveryRecipientAddress: { Value: 'Warehouse 1' },
        IsCashOnDelivery: true,
      }),
    ).toEqual(['transporter', 'cashOnDeliveryAmount', 'ownTtnNumber'])
  })

  it('requires loaded retail payment status for retail-client sales', () => {
    const sale: SalesUkraineSale = {
      RetailClient: { Id: 11 },
      Transporter: { CssClass: 'self_checkout_item_class', Id: 3 },
    }

    expect(getSaleReviewIssues(sale)).toEqual(['retailPaymentStatus'])
    expect(getSaleReviewIssues(sale, { isRetailPaymentLoading: true, retailPaymentStatus: { Amount: 100, Id: 1 } })).toEqual([
      'retailPaymentStatus',
    ])
  })

  it('blocks retail-client sales when payment status amount is not positive', () => {
    expect(
      getSaleReviewIssues(
        {
          RetailClient: { Id: 11 },
          Transporter: { CssClass: 'self_checkout_item_class', Id: 3 },
        },
        { retailPaymentStatus: { Amount: 0, Id: 5 } },
      ),
    ).toEqual(['retailPaymentAmount'])
  })

  it('allows retail-client sales when payment status amount is positive', () => {
    expect(
      getSaleReviewIssues(
        {
          RetailClient: { Id: 11 },
          Transporter: { CssClass: 'self_checkout_item_class', Id: 3 },
        },
        { retailPaymentStatus: { Amount: 100, Id: 5 } },
      ),
    ).toEqual([])
  })
})
