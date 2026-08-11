import { describe, expect, it } from 'vitest'
import type { ShoppingCartReserveItem } from './types'
import {
  formatExchangeRate,
  getCartLocalCurrencyCode,
  getCartUahAmount,
  getOrderItemAmount,
  getOrderItemAmountCurrency,
} from './utils'

describe('shopping cart reserve currency presentation', () => {
  it('uses the agreement currency returned by the API without pretending missing data is UAH', () => {
    expect(getCartLocalCurrencyCode(cart('eur'))).toBe('EUR')
    expect(getCartLocalCurrencyCode({})).toBe('—')
  })

  it('shows the explicit UAH total and live UAH conversion for an EUR agreement', () => {
    const item = {
      TotalAmount: 10,
      TotalAmountEurToUah: 519.5,
      TotalAmountLocal: 10,
    }

    expect(getCartUahAmount({ TotalAmountEurToUah: 519.5 })).toBe(519.5)
    expect(getCartUahAmount({ TotalLocalAmount: 519.5 })).toBeNull()
    expect(getOrderItemAmount(item, 'EUR')).toBe(519.5)
    expect(getOrderItemAmountCurrency('EUR')).toBe('UAH')
    expect(formatExchangeRate(51.95)).toBe('51,9500')
  })

  it('keeps EUR as the complementary amount for a UAH agreement', () => {
    const item = {
      TotalAmount: 10,
      TotalAmountEurToUah: 519.5,
      TotalAmountLocal: 519.5,
    }

    expect(getOrderItemAmount(item, 'UAH')).toBe(10)
    expect(getOrderItemAmountCurrency('UAH')).toBe('EUR')
  })
})

function cart(currencyCode: string): ShoppingCartReserveItem {
  return {
    ClientAgreement: {
      Agreement: {
        Currency: { Code: currencyCode },
      },
    },
  }
}
