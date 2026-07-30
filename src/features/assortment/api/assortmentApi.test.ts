import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getAssortmentHealth,
  getProductAnalytics,
  ProductIntelligenceContractError,
} from './assortmentApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

beforeEach(() => {
  apiRequestMock.mockReset()
})

describe('assortment product analytics API', () => {
  it('omits the region window when no region filter is selected', async () => {
    apiRequestMock.mockResolvedValueOnce(historyResponse())

    await getAssortmentHealth({ regionWindowDays: 365 })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/assortment/health', {
      query: expect.objectContaining({
        regionId: undefined,
        regionWindowDays: undefined,
      }),
      signal: undefined,
    })
  })

  it('sends the region window together with a selected region', async () => {
    apiRequestMock.mockResolvedValueOnce(historyResponse())

    await getAssortmentHealth({ regionId: 7, regionWindowDays: 365 })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/assortment/health', {
      query: expect.objectContaining({
        regionId: 7,
        regionWindowDays: 365,
      }),
      signal: undefined,
    })
  })

  it('requests the monthly analytics contract with product id, period, and cancellation signal', async () => {
    const controller = new AbortController()
    const response = analyticsResponse()
    apiRequestMock.mockResolvedValueOnce(response)

    await expect(getProductAnalytics(42, '2026-07-10', 12, controller.signal)).resolves.toBe(response)
    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/product/42/analytics', {
      query: { asOfDate: '2026-07-10', months: 12 },
      signal: controller.signal,
    })
  })

  it('fails closed when analytics claims an inconsistent effective window', async () => {
    const response = analyticsResponse()
    response.window.effective_days = 342
    apiRequestMock.mockResolvedValueOnce(response)

    await expect(getProductAnalytics(42, '2026-07-10', 12)).rejects.toBeInstanceOf(
      ProductIntelligenceContractError,
    )
  })
})

function historyResponse() {
  return {
    as_of: '2026-07-10',
    source_history_start: '2025-01-01',
    requested_start: '2025-07-10',
    effective_start: '2025-07-10',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    history_windows: {
      portfolio: {
        source_history_start: '2025-01-01',
        requested_start: '2025-07-10',
        effective_start: '2025-07-10',
        effective_days: 365,
        history_complete: true,
      },
    },
  }
}

function analyticsResponse() {
  return {
    as_of: '2026-07-10',
    source_history_start: '2025-01-01',
    requested_start: '2025-08-01',
    effective_start: '2025-08-01',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    product_id: 42,
    sales_series: [],
    data_quality: {
      source_history_start: '2025-01-01',
      requested_start: '2025-08-01',
      effective_start: '2025-08-01',
      history_complete: true,
      zero_fill_begins_at: '2025-08-01',
    },
    window: {
      source_history_start: '2025-01-01',
      requested_start: '2025-08-01',
      effective_start: '2025-08-01',
      effective_days: 343,
      history_complete: true,
    },
  }
}
