import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getClientResourceStorages } from './clientResourcesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('client resources lookup routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads storages through the client-resources page scope', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await getClientResourceStorages()

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/storages/client-resources/page/all',
    )
  })
})
