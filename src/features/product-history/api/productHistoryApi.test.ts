import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportProductHistory, getProductHistory } from './productHistoryApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('product history API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads product history with an explicit bounded date range', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await expect(
      getProductHistory(
        {
          from: '2026-06-24T00:00:00.000',
          limit: 20,
          offset: 0,
          storageIds: [2221, 2196],
          to: '2026-06-24T23:59:59.999',
          value: ' SEM9401 ',
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ Items: [], Total: undefined })

    expect(apiRequestMock).toHaveBeenCalledWith('/history/order/item/get', {
      query: {
        from: '2026-06-24T00:00:00.000',
        limit: 20,
        offset: 0,
        storageIds: '2221,2196',
        to: '2026-06-24T23:59:59.999',
        value: 'SEM9401',
      },
      signal: expect.any(AbortSignal),
    })
  })

  it('exports product history with the same bounded date range contract', async () => {
    apiRequestMock.mockResolvedValueOnce({ DocumentURL: '/report.xlsx' })

    await expect(
      exportProductHistory({
        from: '2026-06-24T00:00:00.000',
        limit: 20,
        offset: 0,
        storageIds: [2221],
        to: '2026-06-24T23:59:59.999',
        value: '',
      }),
    ).resolves.toEqual({ DocumentURL: '/report.xlsx', PdfDocumentURL: '' })

    expect(apiRequestMock).toHaveBeenCalledWith('/history/order/item/document/create/export', {
      query: {
        from: '2026-06-24T00:00:00.000',
        limit: 20,
        offset: 0,
        storageIds: '2221',
        to: '2026-06-24T23:59:59.999',
        value: '',
      },
    })
  })
})
