import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { Client } from '../types'
import { createClient, deleteClient, getClientById, updateClient } from './clientFormApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('client form API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('gets a client by net id', async () => {
    const client: Client = { NetUid: 'client-net-id', FullName: 'Client' }
    apiRequestMock.mockResolvedValueOnce(client)

    await expect(getClientById('client-net-id')).resolves.toEqual(client)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get', {
      query: {
        netId: 'client-net-id',
      },
    })
  })

  it('creates a client with parent id query and full body payload', async () => {
    const client: Client = { FullName: 'Client', ClientInRole: { ClientTypeRole: { Id: 1 } } }
    const createdClient: Client = { ...client, NetUid: 'created-client' }
    apiRequestMock.mockResolvedValueOnce(createdClient)

    await expect(createClient(client, 'parent-net-id')).resolves.toEqual(createdClient)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/new', {
      method: 'POST',
      query: {
        parentId: 'parent-net-id',
      },
      body: client,
    })
  })

  it('creates a root client without a parent id query value', async () => {
    const client: Client = { FullName: 'Client' }
    apiRequestMock.mockResolvedValueOnce(client)

    await expect(createClient(client)).resolves.toEqual(client)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/new', {
      method: 'POST',
      query: {
        parentId: undefined,
      },
      body: client,
    })
  })

  it('updates a client with the full body payload', async () => {
    const client: Client = { NetUid: 'client-net-id', FullName: 'Client' }
    apiRequestMock.mockResolvedValueOnce(client)

    await expect(updateClient(client)).resolves.toEqual(client)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/update', {
      method: 'POST',
      body: client,
    })
  })

  it('deletes a client by net id', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await deleteClient('client-net-id')
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/delete', {
      method: 'DELETE',
      query: {
        netId: 'client-net-id',
      },
    })
  })
})
