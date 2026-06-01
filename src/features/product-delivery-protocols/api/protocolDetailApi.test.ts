import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { removeMergedService, updateProtocolStatus } from './protocolDetailApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('product delivery protocol detail API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('updates protocol status with net id in query params', async () => {
    const protocol = { NetUid: 'protocol-net-id' }
    apiRequestMock.mockResolvedValueOnce(protocol)

    await expect(updateProtocolStatus('protocol-net-id')).resolves.toEqual(protocol)
    expect(apiRequestMock).toHaveBeenCalledWith('/delivery/product/protocol/update/status', {
      method: 'POST',
      query: {
        netId: 'protocol-net-id',
      },
    })
  })

  it('removes a merged service with service net id as netId query param', async () => {
    const protocol = { NetUid: 'protocol-net-id' }
    apiRequestMock.mockResolvedValueOnce(protocol)

    await expect(removeMergedService('service-net-id')).resolves.toEqual(protocol)
    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/services/merged/remove/before/calculated/gross/price', {
      method: 'POST',
      query: {
        netId: 'service-net-id',
      },
    })
  })
})
