import { describe, expect, it } from 'vitest'
import { getSupplyOrganizationBalance } from './supplierOrganizationTableModel'

describe('getSupplyOrganizationBalance', () => {
  it('shows a UAH agreement balance in UAH, positive when we owe the supplier', () => {
    expect(getSupplyOrganizationBalance({
      SupplyOrganizationAgreements: [{ CurrentAmount: -1434.56, Currency: { Code: 'UAH' } }],
      TotalAgreementsCurrentEuroAmount: 28.02,
    })).toEqual({ amount: 1434.56, currency: 'UAH', isEuroEquivalent: false })
  })

  it('sums agreements of one currency', () => {
    expect(getSupplyOrganizationBalance({
      SupplyOrganizationAgreements: [
        { CurrentAmount: -100, Currency: { Code: 'UAH' } },
        { CurrentAmount: 40.5, Currency: { Code: 'UAH' } },
      ],
    }).amount).toBe(59.5)
  })

  it('falls back to the EUR equivalent, labelled EUR, for agreements in several currencies', () => {
    expect(getSupplyOrganizationBalance({
      SupplyOrganizationAgreements: [
        { CurrentAmount: -100, Currency: { Code: 'UAH' } },
        { CurrentAmount: -10, Currency: { Code: 'EUR' } },
      ],
      TotalAgreementsCurrentEuroAmount: 11.95,
    })).toEqual({ amount: 11.95, currency: 'EUR', isEuroEquivalent: true })
  })
})
