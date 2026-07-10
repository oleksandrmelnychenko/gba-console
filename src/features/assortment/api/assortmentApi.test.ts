import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getProductAnalytics } from './assortmentApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

beforeEach(() => {
  apiRequestMock.mockReset()
})

describe('assortment product analytics API', () => {
  it('requests the monthly analytics contract with product id, period, and cancellation signal', async () => {
    const controller = new AbortController()
    const response = { product_id: 42, sales_series: [] }
    apiRequestMock.mockResolvedValueOnce(response)

    await expect(getProductAnalytics(42, '2026-07-10', 12, controller.signal)).resolves.toBe(response)
    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/product/42/analytics', {
      query: { asOfDate: '2026-07-10', months: 12 },
      signal: controller.signal,
    })
  })
})
