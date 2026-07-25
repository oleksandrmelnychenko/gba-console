import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getPredictionByClient,
  getSalesForecast,
  SalesForecastContractError,
} from './salesPredictionApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const CLIENT_NET_ID = '7845841e-0678-4364-a346-2ce21c7378ab'

function unavailable(status = 'not_requested') {
  return {
    status,
    month_count: 0,
    non_zero_month_count: 0,
    total_eur: 0,
    sufficient: false,
  }
}

function canonicalClientForecast() {
  return {
    ByClient: [
      { SaleAmount: 10.01, MonthNameUK: 'Сер 2026' },
      { SaleAmount: 20.02, MonthNameUK: 'Вер 2026' },
    ],
    ByProduct: [],
    ByClientAndProduct: [],
    meta: {
      status: 'ready',
      as_of: '2026-07-25',
      requested_as_of: '2026-07-25',
      source_history_start: '2025-01-01',
      effective_start: '2025-01-01',
      history_complete: true,
      horizon_months: 2,
      currency: 'EUR',
      model_version: 'forecast-v1',
      source_fingerprint: 'source-epoch',
      requested: {
        client_net_id: CLIENT_NET_ID,
        product_net_id: null,
      },
      resolved: {
        client_id: 42,
        client_net_id: CLIENT_NET_ID,
        product_id: null,
        product_net_id: null,
      },
      identity: {
        client: 'resolved',
        product: 'not_requested',
      },
      history_window_months: 24,
      minimum_non_zero_months: 3,
      history: {
        ByClient: {
          status: 'sufficient',
          month_count: 12,
          non_zero_month_count: 8,
          total_eur: 1234.56,
          sufficient: true,
        },
        ByProduct: unavailable(),
        ByClientAndProduct: unavailable(),
      },
    },
  }
}

describe('salesPredictionApi canonical AI contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('keeps the full proof metadata and forwards the deterministic date/cache query', async () => {
    apiRequestMock.mockResolvedValueOnce(canonicalClientForecast())

    await expect(getSalesForecast(CLIENT_NET_ID, undefined, {
      asOfDate: '2026-07-25',
      months: 2,
      useCache: false,
    })).resolves.toMatchObject({
      ByClient: [
        { SaleAmount: 10.01, MonthNameUK: 'Сер 2026' },
        { SaleAmount: 20.02, MonthNameUK: 'Вер 2026' },
      ],
      meta: {
        as_of: '2026-07-25',
        requested_as_of: '2026-07-25',
        source_history_start: '2025-01-01',
        effective_start: '2025-01-01',
        history_complete: true,
        horizon_months: 2,
        history: {
          ByClient: {
            month_count: 12,
            non_zero_month_count: 8,
            total_eur: 1234.56,
            sufficient: true,
          },
        },
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/prediction/get', {
      query: {
        clientNetId: CLIENT_NET_ID,
        productNetId: undefined,
        months: 2,
        asOfDate: '2026-07-25',
        useCache: false,
      },
    })
  })

  it('keeps the legacy AbortSignal call shape while validating the canonical response', async () => {
    const controller = new AbortController()
    apiRequestMock.mockResolvedValueOnce(canonicalClientForecast())

    await expect(getPredictionByClient(CLIENT_NET_ID, controller.signal)).resolves.toEqual([
      { SaleAmount: 10.01, MonthNameUK: 'Сер 2026' },
      { SaleAmount: 20.02, MonthNameUK: 'Вер 2026' },
    ])
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/prediction/get', {
      query: {
        clientNetId: CLIENT_NET_ID,
        productNetId: undefined,
        months: undefined,
        asOfDate: undefined,
        useCache: undefined,
      },
      signal: controller.signal,
    })
  })

  it('fails closed on identity drift, fractional cents, or inconsistent history proofs', async () => {
    const identityDrift = canonicalClientForecast()
    identityDrift.meta.requested.client_net_id = '11111111-1111-1111-1111-111111111111'
    apiRequestMock.mockResolvedValueOnce(identityDrift)

    await expect(getPredictionByClient(CLIENT_NET_ID)).rejects.toBeInstanceOf(SalesForecastContractError)

    const fractionalCent = canonicalClientForecast()
    fractionalCent.ByClient[0].SaleAmount = 10.001
    apiRequestMock.mockResolvedValueOnce(fractionalCent)

    await expect(getPredictionByClient(CLIENT_NET_ID)).rejects.toBeInstanceOf(SalesForecastContractError)

    const wrongHistory = canonicalClientForecast()
    wrongHistory.meta.history.ByClient.non_zero_month_count = 0
    apiRequestMock.mockResolvedValueOnce(wrongHistory)

    await expect(getPredictionByClient(CLIENT_NET_ID)).rejects.toBeInstanceOf(SalesForecastContractError)
  })
})
