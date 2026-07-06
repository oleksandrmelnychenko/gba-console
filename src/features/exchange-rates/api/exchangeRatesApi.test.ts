import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { updateExchangeRates } from './exchangeRatesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('exchangeRatesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('updates UAH government rates as a batch', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await updateExchangeRates('batch-government', [
      { Amount: 41.25, Code: 'USD', Culture: 'uk', NetUid: 'gov-uah-usd' },
      { Amount: 48.1, Code: 'EUR', Culture: 'uk', NetUid: 'gov-uah-eur' },
    ])

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(apiRequestMock).toHaveBeenCalledWith('/exchangerates/gov/update', {
      method: 'POST',
      body: [
        { Amount: 41.25, Code: 'USD', Culture: 'uk', NetUid: 'gov-uah-usd' },
        { Amount: 48.1, Code: 'EUR', Culture: 'uk', NetUid: 'gov-uah-eur' },
      ],
    })
  })

  it('updates PLN government rates one by one through the government endpoint', async () => {
    apiRequestMock.mockResolvedValue(null)

    await updateExchangeRates('single-government', [
      { Amount: 3.82, Code: 'USD', Culture: 'pl', NetUid: 'gov-pln-usd' },
      { Amount: 4.48, Code: 'EUR', Culture: 'pl', NetUid: 'gov-pln-eur' },
    ])

    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/exchangerates/gov/update', {
      method: 'POST',
      body: { Amount: 3.82, Code: 'USD', Culture: 'pl', NetUid: 'gov-pln-usd' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/exchangerates/gov/update', {
      method: 'POST',
      body: { Amount: 4.48, Code: 'EUR', Culture: 'pl', NetUid: 'gov-pln-eur' },
    })
  })
})
