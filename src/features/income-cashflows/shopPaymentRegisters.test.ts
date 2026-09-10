import { describe, expect, it } from 'vitest'
import { isSelectedShopPaymentRegister } from './shopPaymentRegisters'
import { PaymentRegisterType, type PaymentRegister } from './types'

const selected: PaymentRegister = {
  Id: 1, IsForRetail: true, IsSelected: true, Type: PaymentRegisterType.Card, Deleted: false,
}

describe('shop payment register configuration scope', () => {
  it('allows the selected retail card independently of the ordinary IsActive flag', () => {
    expect(isSelectedShopPaymentRegister({ ...selected, IsActive: false } as PaymentRegister)).toBe(true)
  })

  it.each<Partial<PaymentRegister>>([
    { IsForRetail: false }, { IsForRetail: undefined },
    { IsSelected: false }, { IsSelected: undefined },
    { Deleted: true }, { Type: PaymentRegisterType.Cash },
    { Type: PaymentRegisterType.Bank }, { Type: undefined },
  ])('excludes an account outside the configured shop scope: %j', (change) => {
    expect(isSelectedShopPaymentRegister({ ...selected, ...change })).toBe(false)
  })
})
