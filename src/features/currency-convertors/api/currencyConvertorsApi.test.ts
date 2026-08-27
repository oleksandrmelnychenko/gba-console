import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createCurrencyTrader,
  deleteCurrencyTrader,
  getAllCurrencyTraders,
  getCurrencyTrader,
  getCurrencyTraderExchangeRates,
  updateCurrencyTrader,
} from './currencyConvertorsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('currency convertors permission-scoped API', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('uses scoped read boundaries', async () => {
    apiRequestMock.mockResolvedValue([])
    await getAllCurrencyTraders()
    await getCurrencyTrader('trader-1')
    await getCurrencyTraderExchangeRates({ from: '2026-08-01', netId: 'trader-1', to: '2026-08-17' })
    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/currencies/traders/accounting/all',
      '/currencies/traders/accounting/get',
      '/currencies/traders/accounting/exchangerates/get/filtered',
    ])
  })

  it('uses separate create, edit and delete boundaries', async () => {
    apiRequestMock.mockResolvedValue({})
    await createCurrencyTrader({} as never)
    await updateCurrencyTrader({} as never)
    await deleteCurrencyTrader('trader-1')
    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/currencies/traders/accounting/new',
      '/currencies/traders/accounting/update',
      '/currencies/traders/accounting/delete',
    ])
  })
})
