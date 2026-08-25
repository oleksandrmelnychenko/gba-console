import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getUnifiedServiceCreateResponsibleUsers,
  getUnifiedServiceEditResponsibleUsers,
  removeMergedService,
  searchDirectSupplyOrderSpecificationOrganizations,
  searchUnifiedServiceCreateSupplyOrganizations,
  searchUnifiedServiceEditSupplyOrganizations,
  updateProtocolStatus,
} from './protocolDetailApi'

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
    expect(apiRequestMock).toHaveBeenCalledWith('/delivery/product/protocol/logistic/update/status', {
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
    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/services/merged/product-delivery-protocol/delete', {
      method: 'POST',
      query: {
        netId: 'service-net-id',
      },
    })
  })

  it('searches supply organizations with a bounded trimmed lookup query', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'organization-1' }])

    await expect(searchUnifiedServiceCreateSupplyOrganizations('  ports  ')).resolves.toEqual([{ NetUid: 'organization-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/product-delivery-protocols/unified-service/create/search', {
      query: {
        limit: 20,
        offset: 0,
        value: 'ports',
      },
    })
  })

  it('loads a bounded initial supply organization list for blank lookup values', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'organization-1' }])

    await expect(searchUnifiedServiceEditSupplyOrganizations('   ')).resolves.toEqual([{ NetUid: 'organization-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/product-delivery-protocols/unified-service/edit/search', {
      query: {
        limit: 20,
        offset: 0,
      },
    })
  })

  it('uses the direct-supply-order specification organization facade', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await expect(searchDirectSupplyOrderSpecificationOrganizations('  spec  ')).resolves.toEqual([])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/direct-supply-order/specification/search', {
      query: {
        limit: 20,
        offset: 0,
        value: 'spec',
      },
    })
  })

  it('uses context-specific responsible-user facades', async () => {
    apiRequestMock.mockResolvedValue([])

    await getUnifiedServiceCreateResponsibleUsers()
    await getUnifiedServiceEditResponsibleUsers()

    expect(apiRequestMock.mock.calls).toEqual([
      ['/usermanagement/profiles/product-delivery-protocols/unified-service/create/responsible-users'],
      ['/usermanagement/profiles/product-delivery-protocols/unified-service/edit/responsible-users'],
    ])
  })
})
