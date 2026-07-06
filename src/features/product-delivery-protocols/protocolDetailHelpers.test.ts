import { describe, expect, it } from 'vitest'
import type { SupplyInvoice } from './detailTypes'
import { getInvoiceCurrencyCode, getInvoiceTotalNetPrice } from './components/protocolDetailHelpers'

describe('protocolDetailHelpers', () => {
  it('uses direct invoice total when available', () => {
    expect(getInvoiceTotalNetPrice({ TotalNetPrice: 3390 })).toBe(3390)
  })

  it('falls back to alternative amount fields', () => {
    expect(getInvoiceTotalNetPrice({ NetPrice: 1200 })).toBe(1200)
    expect(getInvoiceTotalNetPrice({ TotalAmount: '1 234,56' } as SupplyInvoice & { TotalAmount: string })).toBe(1234.56)
  })

  it('sums merged invoices when the parent has no own total', () => {
    expect(
      getInvoiceTotalNetPrice({
        MergedSupplyInvoices: [
          { TotalNetPrice: 1000 },
          { NetPrice: 250 },
        ],
      }),
    ).toBe(1250)
  })

  it('resolves currency from invoice agreement, order agreement, or merged invoices', () => {
    expect(
      getInvoiceCurrencyCode({
        SupplyOrganizationAgreement: { Currency: { Code: 'EUR' } },
      }),
    ).toBe('EUR')

    expect(
      getInvoiceCurrencyCode({
        SupplyOrder: { ClientAgreement: { Agreement: { Currency: { Code: 'UAH' } } } },
      }),
    ).toBe('UAH')

    expect(
      getInvoiceCurrencyCode({
        MergedSupplyInvoices: [
          { SupplyOrganizationAgreement: { Currency: { Code: 'PLN' } } },
        ],
      }),
    ).toBe('PLN')
  })
})
