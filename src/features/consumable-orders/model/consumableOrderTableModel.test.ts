import { describe, expect, it } from 'vitest'
import type { ConsumablesOrder } from '../types'
import {
  buildConsumableOrderRows,
  deduplicateConsumableOrdersByIdentity,
  getActiveConsumableOrderItems,
  getActiveOutcomePaymentLinks,
  getConsumableOrderSupplierCellText,
  isSameDisplayText,
} from './consumableOrderTableModel'

describe('consumableOrderTableModel', () => {
  it('maps an active order without changing the legacy amount gate', () => {
    const order = consumableOrder({
      NetUid: 'order-1',
      TotalAmount: 120,
      TotalAmountWithoutVAT: 100,
      ConsumableProductOrganization: { Name: 'Постачальник' },
      ConsumablesOrderItems: [
        { NetUid: 'item-active' },
        { NetUid: 'item-deleted', Deleted: true },
      ],
      SupplyOrganizationAgreement: {
        Currency: { Code: 'UAH' },
        Organization: { Name: 'Організація' },
      },
    })

    expect(buildConsumableOrderRows([order])[0]).toMatchObject({
      amount: 120,
      currency: 'UAH',
      id: 'order-1',
      itemCount: 1,
      organization: 'Організація',
      serviceOrganization: 'Постачальник',
      totalAmountWithoutVat: 100,
    })
  })

  it('keeps the legacy zero amount and blank currency without a product organization', () => {
    const order = consumableOrder({
      Id: 7,
      TotalAmount: 120,
      SupplyOrganizationAgreement: { Currency: { Code: 'EUR' } },
    })

    expect(buildConsumableOrderRows([order])[0]).toMatchObject({
      amount: 0,
      currency: undefined,
      id: '7',
    })
  })

  it('removes only repeated canonical identities', () => {
    const first = consumableOrder({ NetUid: ' Order-1 ', Number: 'INV-1' })
    const repeatedNetUid = consumableOrder({ NetUid: 'order-1', Number: 'INV-2' })
    const firstNumericId = consumableOrder({ Id: 4, Number: 'INV-1' })
    const repeatedNumericId = consumableOrder({ Id: 4, Number: 'INV-2' })
    const sameNumberDifferentIdentity = consumableOrder({ NetUid: 'order-2', Number: 'INV-1' })
    const idLessFirst = consumableOrder({ Number: 'INV-1' })
    const idLessSecond = consumableOrder({ Number: 'INV-1' })

    expect(deduplicateConsumableOrdersByIdentity([
      first,
      repeatedNetUid,
      firstNumericId,
      repeatedNumericId,
      sameNumberDifferentIdentity,
      idLessFirst,
      idLessSecond,
    ])).toEqual([
      first,
      firstNumericId,
      sameNumberDifferentIdentity,
      idLessFirst,
      idLessSecond,
    ])
  })

  it('does not repeat the organization when it equals the supplier', () => {
    const [row] = buildConsumableOrderRows([
      consumableOrder({
        ConsumableProductOrganization: { Name: 'ТОВ Фенікс' },
        SupplyOrganizationAgreement: {
          Name: 'Основний договір',
          Organization: { Name: 'ТОВ Фенікс' },
        },
      }),
    ])

    expect(getConsumableOrderSupplierCellText(row)).toEqual({
      primary: 'ТОВ Фенікс',
      secondary: 'Основний договір',
    })
    expect(isSameDisplayText('  ТОВ   ФЕНІКС ', 'тов фенікс')).toBe(true)
  })

  it('filters soft-deleted items and payment links', () => {
    const activeItem = { NetUid: 'item-active' }
    const activeLink = { NetUid: 'link-active', OutcomePaymentOrder: { NetUid: 'payment-active' } }
    const order = consumableOrder({
      ConsumablesOrderItems: [activeItem, { NetUid: 'item-deleted', Deleted: true }],
      OutcomePaymentOrderConsumablesOrders: [
        activeLink,
        { NetUid: 'link-deleted', Deleted: true },
        { NetUid: 'payment-deleted', OutcomePaymentOrder: { NetUid: 'payment-2', Deleted: true } },
      ],
    })

    expect(getActiveConsumableOrderItems(order)).toEqual([activeItem])
    expect(getActiveOutcomePaymentLinks(order)).toEqual([activeLink])
  })
})

function consumableOrder(overrides: ConsumablesOrder): ConsumablesOrder {
  return overrides
}
