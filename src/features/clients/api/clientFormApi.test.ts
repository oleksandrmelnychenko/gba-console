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

  it('strips unchanged product group discounts from client save payloads', async () => {
    const client: Client = {
      NetUid: 'client-net-id',
      ClientAgreements: [
        {
          Agreement: { NetUid: 'agreement-1' },
          ProductGroupDiscounts: [
            {
              DiscountRate: 5,
              ProductGroup: { Id: 10, Name: 'Root' },
              ProductGroupId: 10,
              SubProductGroupDiscounts: [
                {
                  DiscountRate: 3,
                  ProductGroup: { Id: 11, Name: 'Child' },
                  ProductGroupId: 11,
                },
              ],
            },
          ],
        },
      ],
    }
    apiRequestMock.mockResolvedValueOnce(client)

    await updateClient(client)

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/update', {
      method: 'POST',
      body: {
        NetUid: 'client-net-id',
        ClientAgreements: [{ Agreement: { NetUid: 'agreement-1' } }],
      },
    })
  })

  it('keeps only marked compact discount changes in client save payloads', async () => {
    const client: Client = {
      NetUid: 'client-net-id',
      ClientAgreements: [
        {
          Agreement: { NetUid: 'agreement-1' },
          ProductGroupDiscounts: [
            {
              DiscountRate: 12,
              IsActive: true,
              IsSelected: true,
              ProductGroup: { Id: 10, Name: 'Root', SubProductGroups: [{ Id: 99 }] },
              ProductGroupId: 10,
              SubProductGroupDiscounts: [{ DiscountRate: 7, ProductGroupId: 11 }],
            },
          ],
          __ProductGroupDiscountsChanged: true,
        },
      ],
    }
    apiRequestMock.mockResolvedValueOnce(client)

    await updateClient(client)

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/update', {
      method: 'POST',
      body: {
        NetUid: 'client-net-id',
        ClientAgreements: [
          {
            Agreement: { NetUid: 'agreement-1' },
            ProductGroupDiscounts: [
              {
                DiscountRate: 12,
                IsActive: true,
                IsSelected: undefined,
                ProductGroup: { FullName: undefined, Id: 10, Name: 'Root', NetUid: undefined },
                ProductGroupId: 10,
                SubProductGroupDiscounts: [],
              },
            ],
          },
        ],
      },
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
