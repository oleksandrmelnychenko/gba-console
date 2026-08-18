import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSaleStatisticBySaleId, getSalesByClient } from './clientSalesApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('client sales permission facade contracts', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('loads the card registry through sale.view', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getSalesByClient({
      netId: 'client-1',
      from: '2026-08-01',
      to: '2026-08-18',
    })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/sales/ukraine/client-card/registry',
      {
        query: {
          from: '2026-08-01',
          netId: 'client-1',
          to: '2026-08-18',
        },
      },
    )
  })

  it('loads movement history through sale.view_audit', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'statistic-1' })

    await getSaleStatisticBySaleId('sale-1')

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/sales/ukraine/audit',
      { query: { netId: 'sale-1' } },
    )
  })
})
