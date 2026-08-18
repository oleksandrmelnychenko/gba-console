import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAccountableExpenses, searchAccountableExpenses } from './accountableExpensesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('accountableExpensesApi permission boundary', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({ Items: [] })
  })

  it('uses the accountable-expenses scoped route for list and search', async () => {
    const params = {
      from: '2026-08-01',
      limit: 25,
      offset: 0,
      to: '2026-08-18',
    }

    await getAccountableExpenses(params)
    await searchAccountableExpenses('service', params)

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/consumables/orders/accounting/services/all',
      '/consumables/orders/accounting/services/all',
    ])
  })
})
