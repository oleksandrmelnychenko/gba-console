import { describe, expect, it } from 'vitest'
import { buildPaymentPayload } from './paymentPayload'
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
