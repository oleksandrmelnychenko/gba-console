import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createOrganizationClient,
  deleteOrganizationClient,
  getOrganizationClient,
  getOrganizationClients,
  updateOrganizationClient,
} from './organizationClientsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('organizationClientsApi canonical routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses page-scoped registry and search reads', async () => {
    apiRequestMock.mockResolvedValue([])

    await getOrganizationClients()
    await getOrganizationClients(' Acme ')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/clients/organizations/registry', undefined)
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/clients/organizations/registry/search', {
      query: { value: 'Acme' },
    })
  })

  it('uses independent details, create, edit, and delete routes', async () => {
    const client = { FullName: 'Acme', NetUid: 'organization-1' }
    apiRequestMock.mockResolvedValue(client)

    await getOrganizationClient('organization-1')
    await createOrganizationClient(client)
    await updateOrganizationClient(client)
    await deleteOrganizationClient('organization-1')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/clients/organizations/details', {
      query: { netId: 'organization-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/clients/organizations/create', {
      body: client,
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/clients/organizations/edit', {
      body: client,
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/clients/organizations/remove', {
      method: 'DELETE',
      query: { netId: 'organization-1' },
    })
  })
})
