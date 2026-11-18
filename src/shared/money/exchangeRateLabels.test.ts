import { describe, expect, it } from 'vitest'
import { formatCommercialRate, getSaleCommercialRate, getSaleDraftCommercialRate } from './exchangeRateLabels'

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

describe('getSaleDraftCommercialRate', () => {
  const uahDraft = {
    BaseLifeCycleStatus: { SaleLifeCycleType: 0 },
    ClientAgreement: { Agreement: { Currency: { Code: 'UAH' } } },
    Order: { OrderItems: [{ ExchangeRateAmount: 0, TotalAmount: 15.63, TotalAmountLocal: 799.9434 }] },
  }

  it('reads the current commercial rate of a draft from its line amounts (the draft lines carry rate 0)', () => {
    expect(getSaleCommercialRate(uahDraft)).toBeNull()
    expect(getSaleDraftCommercialRate(uahDraft)).toEqual({ pair: 'EUR → UAH', rate: 51.18 })
  })

  it('shows nothing for an invoice, an EUR draft or a draft without a priced line', () => {
    expect(getSaleDraftCommercialRate({ ...uahDraft, BaseLifeCycleStatus: { SaleLifeCycleType: 1 } })).toBeNull()
    expect(getSaleDraftCommercialRate({ ...uahDraft, ClientAgreement: { Agreement: { Currency: { Code: 'EUR' } } } })).toBeNull()
    expect(getSaleDraftCommercialRate({ ...uahDraft, Order: { OrderItems: [{ TotalAmount: 0, TotalAmountLocal: 0 }] } })).toBeNull()
  })
})
