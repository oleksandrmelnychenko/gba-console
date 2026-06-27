import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchReportUsers } from './reportsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('reportsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses bounded targeted lookup for report users', async () => {
    const signal = new AbortController().signal

    apiRequestMock.mockResolvedValueOnce({
      Items: [
        {
          Email: 'ivan@example.com',
          FirstName: 'Ivan',
          LastName: 'Petrenko',
          NetUid: 'user-1',
        },
      ],
    })

    await expect(searchReportUsers({ limit: 30, offset: 5, value: '  ivan  ' }, signal)).resolves.toEqual([
      {
        Email: 'ivan@example.com',
        FirstName: 'Ivan',
        LastName: 'Petrenko',
        Name: 'Ivan Petrenko',
        NetUid: 'user-1',
      },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/usermanagement/profiles/search/lookup', {
      query: {
        limit: 30,
        offset: 5,
        value: 'ivan',
      },
      signal,
    })
  })
})
