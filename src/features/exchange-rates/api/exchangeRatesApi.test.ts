import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getExchangeRateHistory, updateExchangeRates } from './exchangeRatesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('exchangeRatesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads history by rate net UID and selected date range', async () => {
    const from = new Date('2026-06-30T00:00:00')
    const to = new Date('2026-07-30T23:59:59')
    const history = [{ Amount: 44.5, Code: 'USD', Created: '2026-07-29T00:00:00' }]
    apiRequestMock.mockResolvedValueOnce([{ ExchangeRateHistories: history }])

    await expect(
      getExchangeRateHistory({
        endpoint: '/exchangerates/history/specific',
        from,
        historyKey: 'ExchangeRateHistories',
        limit: 20,
        netUid: '10540941-519c-4186-9aa3-c9e969d66431',
        offset: 0,
        to,
      }),
    ).resolves.toEqual(history)

    expect(apiRequestMock).toHaveBeenCalledWith('/exchangerates/history/specific', {
      query: {
        from,
        limit: 20,
        netIds: ['10540941-519c-4186-9aa3-c9e969d66431'],
        offset: 0,
        to,
      },
    })
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

  it('updates commercial rates one by one through the commercial endpoint', async () => {
    apiRequestMock.mockResolvedValue(null)

    await updateExchangeRates('single-commercial', [
      { Amount: 45.1, Code: 'USD', Culture: 'uk', NetUid: 'uah-usd' },
      { Amount: 51.4, Code: 'EUR', Culture: 'uk', NetUid: 'uah-eur' },
    ])

    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/exchangerates/update', {
      method: 'POST',
      body: { Amount: 45.1, Code: 'USD', Culture: 'uk', NetUid: 'uah-usd' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/exchangerates/update', {
      method: 'POST',
      body: { Amount: 51.4, Code: 'EUR', Culture: 'uk', NetUid: 'uah-eur' },
    })
  })
})
