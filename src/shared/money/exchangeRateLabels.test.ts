import { describe, expect, it } from 'vitest'
import { formatCommercialRate, getSaleCommercialRate } from './exchangeRateLabels'

describe('getSaleCommercialRate', () => {
  it('names the commercial EUR rate a USD sale was priced at', () => {
    const sale = { ClientAgreement: { Agreement: { Currency: { Code: 'USD' } } }, Order: { OrderItems: [{ ExchangeRateAmount: 1.1082 }] } }
    expect(getSaleCommercialRate(sale)).toEqual({ pair: 'EUR → USD', rate: 1.1082 })
    expect(formatCommercialRate(1.1082)).toBe('1,1082')
  })

  it('shows nothing for an EUR agreement or a sale without a priced line', () => {
    expect(getSaleCommercialRate({ ClientAgreement: { Agreement: { Currency: { Code: 'EUR' } } }, Order: { OrderItems: [{ ExchangeRateAmount: 1 }] } })).toBeNull()
    expect(getSaleCommercialRate({ ClientAgreement: { Agreement: { Currency: { Code: 'UAH' } } }, Order: { OrderItems: [{ ExchangeRateAmount: 0 }] } })).toBeNull()
  })
})
