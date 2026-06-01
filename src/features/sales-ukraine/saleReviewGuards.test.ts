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

  it('requires delivery data for non-self-checkout sales', () => {
    expect(getSaleReviewIssues({ Transporter: { Id: 2 } } as SalesUkraineSale)).toEqual([
      'recipient',
      'recipientPhone',
      'deliveryAddress',
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
})
