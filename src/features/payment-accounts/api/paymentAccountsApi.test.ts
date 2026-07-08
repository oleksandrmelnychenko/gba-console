import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { calculatePaymentAccountExchange, getPaymentAccountCurrencyTraders } from './paymentAccountsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('paymentAccountsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads exchange traders for a payment currency register', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        {
          CurrencyTraderExchangeRates: [{ CurrencyName: 'EUR', ExchangeRate: 42.5 }],
          FirstName: 'Trader',
          NetUid: 'trader-1',
        },
      ],
    })

    await expect(getPaymentAccountCurrencyTraders('currency-register-1')).resolves.toEqual([
      {
        CurrencyTraderExchangeRates: [{ CurrencyName: 'EUR', ExchangeRate: 42.5 }],
        FirstName: 'Trader',
        NetUid: 'trader-1',
      },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/currencies/traders/find/currency', {
      query: {
        netId: 'currency-register-1',
      },
    })
  })

  it('delegates currency exchange calculation to the backend', async () => {
    apiRequestMock.mockResolvedValueOnce({ Amount: 4250 })

    await expect(calculatePaymentAccountExchange({
      amount: 100,
      currencyCode: 'EUR',
      exchangeRate: 42.5,
    })).resolves.toBe(4250)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/registers/exchanges/calculate', {
      query: {
        amount: 100,
        currencyCode: 'EUR',
        exchangeRate: 42.5,
      },
    })
  })
})
