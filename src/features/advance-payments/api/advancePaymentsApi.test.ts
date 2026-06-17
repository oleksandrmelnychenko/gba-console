import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAdvancePayments } from './advancePaymentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('advancePaymentsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('expands date filters to full-day date-time query values', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getAdvancePayments({
      from: '2026-06-01',
      limit: 40,
      offset: 20,
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/advance/all', {
      query: {
        from: expect.stringContaining('2026-06-01T00:00:00.000'),
        limit: 40,
        offset: 20,
        to: expect.stringContaining('2026-06-08T23:59:59.999'),
      },
    })
  })
})
