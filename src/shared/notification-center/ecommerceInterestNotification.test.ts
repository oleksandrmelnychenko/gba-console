import { describe, expect, it } from 'vitest'
import { createEcommerceInterestNotification } from './ecommerceInterestNotification'

describe('createEcommerceInterestNotification', () => {
  it('maps a committed storefront preorder into the interest screen', () => {
    expect(createEcommerceInterestNotification({
      Client: { FullName: 'Уляна тест' },
      Created: '2026-07-31T09:30:00Z',
      NetUid: 'B2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
      Product: {
        NameUA: 'Амортизатор кабіни',
        VendorCode: 'SEM123',
      },
      Qty: 2,
    })).toEqual({
      createdAt: '2026-07-31T09:30:00.000Z',
      entityNetUid: 'B2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
      id: 'ecommerce-interest:b2ab51be-bc27-4ef3-977d-b0ef1b9b731c',
      kind: 'ecommerce-interest',
      message: 'SEM123 · Уляна тест · Амортизатор кабіни · 2 шт.',
      route: '/sales/ukraine/interest',
      title: 'Нова зацікавленість з інтернет-магазину',
    })
  })

  it('ignores a malformed event without a persisted identifier', () => {
    expect(createEcommerceInterestNotification({ Qty: 1 })).toBeNull()
  })
})
