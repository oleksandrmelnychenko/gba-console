import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { TypeOfClientAgreement, TypeOfCurrencyOfAgreement } from '../types'
import { exportDebtorsDocument, getFilteredDebtors } from './salesDebtorsApi'
import { agingFixture } from '../model/debtorAging.testData'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('salesDebtorsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('preserves nested aging and null days instead of inventing a complete overdue total', async () => {
    const Aging = agingFixture({ KnownOverdueCount: 1, KnownOverdueEuro: 4, UnknownDateDebtCount: 1, UnknownDateDebtEuro: null, HasCompleteAging: false, MaxKnownDaysPastDue: 3 })
    apiRequestMock.mockResolvedValueOnce({ Aging, DueCutoffBusinessDay: '2026-10-27T00:00:00', TotalMissedDays: null, TotalOverdueDebtorsValue: null, ClientInDebtors: [{ Aging, MissedDays: null, OverdueDebtEuro: null }] })
    const result = await getFilteredDebtors({ days: 3, limit: 20, offset: 0, typeAgreement: 0, typeCurrency: 0, userNetId: null, organizationNetId: null })
    expect(result.Aging).toEqual(Aging)
    expect(result.DueCutoffBusinessDay).toBe('2026-10-27T00:00:00')
    expect(result.TotalMissedDays).toBeNull()
    expect(result.TotalOverdueDebtorsValue).toBeNull()
    expect(result.ClientInDebtors[0].MissedDays).toBeNull()
  })

  it('exports debtors with the same days filter as the grid', async () => {
    apiRequestMock.mockResolvedValueOnce({ DocumentURL: 'https://example.test/debtors.xlsx' })

    await exportDebtorsDocument({
      days: 7,
      organizationNetId: 'organization-1',
      typeAgreement: TypeOfClientAgreement.All,
      typeCurrency: TypeOfCurrencyOfAgreement.EUR,
      userNetId: 'manager-1',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/debtors/document/export', {
      query: {
        days: 7,
        organizationNetId: 'organization-1',
        typeAgreement: TypeOfClientAgreement.All,
        typeCurrency: TypeOfCurrencyOfAgreement.EUR,
        userNetId: 'manager-1',
      },
    })
  })
  it('keeps unknown summary and row valuations distinct from zero across API decoding', async () => {
    const row = { RemainderDebtEuro: null, CreditBalanceEuro: null, CurrencyDebts: [{ CurrencyCode: 'UAH', RemainderDebt: 100 }] }
    apiRequestMock.mockResolvedValueOnce(JSON.stringify({
      ClientInDebtors: [row], TotalRemainderDebtorsValue: null, TotalOverdueDebtorsValue: 0,
      TotalCreditBalanceEuro: null, UnknownEuroDebtCount: 1,
    }))
    const result = await getFilteredDebtors({ days: 3, limit: 20, offset: 0, typeAgreement: 0, typeCurrency: 0, userNetId: null, organizationNetId: null })
    expect(result.TotalRemainderDebtorsValue).toBeNull()
    expect(result.TotalOverdueDebtorsValue).toBe(0)
    expect(result.TotalCreditBalanceEuro).toBeNull()
    expect(result.UnknownEuroDebtCount).toBe(1)
    expect(result.ClientInDebtors).toEqual([row])
  })

  it('retains the legacy empty summary defaults for absent properties', async () => {
    apiRequestMock.mockResolvedValueOnce({ ClientInDebtors: [] })
    const result = await getFilteredDebtors({ days: 3, limit: 20, offset: 0, typeAgreement: 0, typeCurrency: 0, userNetId: null, organizationNetId: null })
    expect(result.TotalRemainderDebtorsValue).toBe(0)
    expect(result.TotalCreditBalanceEuro).toBeUndefined()
  })

})
