import { describe, expect, it } from 'vitest'
import { buildConsumableOrderPaymentLinks, buildPaymentPayload } from './paymentPayload'
import type { ConsumablesOrder, Organization, PaymentCurrencyRegister, PaymentMovement, PaymentRegister } from './types'

const basePaymentInput = {
  comment: '',
  date: '2026-06-08',
  selectedCurrencyRegister: { NetUid: 'currency-register' } as PaymentCurrencyRegister,
  selectedMovement: { NetUid: 'movement', OperationName: 'Оплата' } as PaymentMovement,
  selectedOrganization: { NetUid: 'organization', Name: 'ТОВ А' } as Organization,
  selectedRegister: { NetUid: 'register', Name: 'Каса' } as PaymentRegister,
  time: '10:00',
}

describe('consumable order payment payload', () => {
  it('does not close an order when the new payment only partially covers the remainder', () => {
    const order = createOrder({ TotalAmount: 100, TotalPaidAmount: 20 })

    const payload = buildPaymentPayload({
      ...basePaymentInput,
      amount: 40,
      order,
    })

    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.IsPayed).toBe(false)
  })

  it('closes an order when the new payment covers the full remainder', () => {
    const order = createOrder({ TotalAmount: 100, TotalPaidAmount: 20 })

    const payload = buildPaymentPayload({
      ...basePaymentInput,
      amount: 80,
      order,
    })

    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.IsPayed).toBe(true)
  })

  it('passes supplier and agreement from the order to the payment order', () => {
    const supplier = { NetUid: 'supplier-1', Name: 'Supplier' }
    const agreement = { NetUid: 'agreement-1', Name: 'Main agreement', SupplyOrganization: supplier }
    const order = createOrder({
      ConsumableProductOrganization: supplier,
      SupplyOrganizationAgreement: agreement,
      TotalAmount: 100,
      TotalPaidAmount: 0,
    })

    const payload = buildPaymentPayload({
      ...basePaymentInput,
      amount: 100,
      order,
    })

    expect(payload.ConsumableProductOrganization).toBe(supplier)
    expect(payload.SupplyOrganizationAgreement).toBe(agreement)
  })

  it('closes only consumable orders covered by a multi-order payment amount', () => {
    const firstOrder = createOrder({ NetUid: 'order-1', TotalAmount: 100, TotalPaidAmount: 20 })
    const secondOrder = createOrder({ NetUid: 'order-2', TotalAmount: 90, TotalPaidAmount: 0 })

    const links = buildConsumableOrderPaymentLinks([firstOrder, secondOrder], 100)

    expect(links?.[0]?.ConsumablesOrder?.IsPayed).toBe(true)
    expect(links?.[1]?.ConsumablesOrder?.IsPayed).toBe(false)
  })
})

function createOrder(patch: ConsumablesOrder): ConsumablesOrder {
  return {
    ConsumablesOrderItems: [
      {
        TotalPriceWithVAT: 100,
      },
    ],
    ...patch,
  }
}
