import { describe, expect, it } from 'vitest'
import { createEcommerceOrderNotification } from './ecommerceOrderNotification'

describe('createEcommerceOrderNotification', () => {
  it('maps a new ecommerce sale into a navigable notification', () => {
    const notification = createEcommerceOrderNotification({
      Sale: {
        ClientAgreement: {
          Agreement: { Currency: { Code: 'UAH' } },
          Client: { FullName: 'Shop Client' },
        },
        Created: '2026-07-31T08:15:00Z',
        NetUid: 'A2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
        Order: {
          OrderItems: [{}, {}, {}],
          OrderSource: 0,
        },
        SaleNumber: { Value: 'Ін00001234' },
        TotalAmountLocal: 9090,
      },
    })

    expect(notification).toEqual({
      createdAt: '2026-07-31T08:15:00.000Z',
      entityNetUid: 'A2AB51BE-BC27-4EF3-977D-B0EF1B9B731C',
      id: 'ecommerce-order:a2ab51be-bc27-4ef3-977d-b0ef1b9b731c',
      kind: 'ecommerce-order',
      message: 'Ін00001234 · Shop Client · 9\u00a0090,00 UAH · 3 поз.',
      route: '/sales-online-shop',
      title: 'Нове замовлення з інтернет-магазину',
    })
  })

  it('ignores sales created outside the ecommerce channel', () => {
    expect(createEcommerceOrderNotification({
      Sale: {
        NetUid: 'sale-1',
        Order: { OrderSource: 1 },
      },
    })).toBeNull()
  })

  it('falls back to hydrated order items when the ignored server total is zero', () => {
    const notification = createEcommerceOrderNotification({
      Sale: {
        NetUid: 'sale-1',
        Order: {
          OrderItems: [{}, {}],
          OrderSource: 0,
        },
        TotalPositions: 0,
      },
    })

    expect(notification?.message).toBe('2 поз.')
  })

  it('ignores malformed ecommerce events without a sale identifier', () => {
    expect(createEcommerceOrderNotification({
      Sale: { Order: { OrderSource: 'Shop' } },
    })).toBeNull()
  })
})
