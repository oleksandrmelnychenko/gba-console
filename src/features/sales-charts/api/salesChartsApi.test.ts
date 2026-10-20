import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchSalesClients } from './salesChartsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sales charts client search', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('searches real clients through the sales-charts facade', async () => {
    apiRequestMock.mockResolvedValueOnce([
      { FullName: 'ТОВ "АГРО"', NetUid: 'client-1' },
    ])

    await expect(searchSalesClients(' тов ')).resolves.toEqual([
      { FullName: 'ТОВ "АГРО"', NetUid: 'client-1' },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/sales-charts/search', {
      query: { limit: 50, offset: 0, value: 'тов' },
    })
  })
})
