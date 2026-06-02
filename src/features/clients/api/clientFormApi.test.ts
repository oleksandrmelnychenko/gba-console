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

  it('removes read-only and recursive client graph fields from save payloads', async () => {
    const client: Client = {
      NetUid: 'client-net-id',
      FullName: 'Client',
      ClientContractDocuments: [{ NetUid: 'document-1', FileName: 'contract.pdf' }],
      ClientInDebts: [{ NetUid: 'debt-1', Debt: { Name: 'Debt' } }],
      SubClients: [{ NetUid: 'sub-link-1', SubClient: { NetUid: 'sub-client-1' } }],
      RootClients: [{ NetUid: 'root-link-1', RootClient: { NetUid: 'root-client-1' } }],
      RootClient: { NetUid: 'root-client-1' },
      TotalCurrentAmount: 2500,
      IsClientExpanded: true,
      IsSelected: true,
      ClientAgreements: [
        {
          NetUid: 'client-agreement-1',
          Client: { NetUid: 'nested-client', SubClients: [{ NetUid: 'nested-sub-link' }] },
          Agreement: {
            NetUid: 'agreement-1',
            Name: 'Agreement',
            ClientAgreements: [{ NetUid: 'recursive-client-agreement' }],
            ClientInDebts: [{ NetUid: 'recursive-debt' }],
            IsSelected: true,
            Currency: { Code: 'EUR', Id: 1, IsSelected: true, Name: 'Euro' },
            Organization: {
              Id: 2,
              Name: 'Organization',
              Manager: 'Manager',
              VatRate: { Id: 20, NetUid: 'vat-20', Value: 20 },
            },
            Pricing: {
              BasePricing: {
                BasePricing: { Id: 99, Name: 'Nested base' },
                Id: 4,
                Name: 'Base',
              },
              Id: 3,
              Name: 'Retail',
            },
            ProviderPricing: {
              Currency: { Code: 'EUR', Id: 1, IsSelected: true, Name: 'Euro' },
              Id: 5,
              Name: 'Provider pricing',
              Pricing: { BasePricing: { Id: 7, Name: 'Provider base' }, Id: 6, Name: 'Purchase' },
            },
            PromotionalPricing: { BasePricing: { Id: 9, Name: 'Promo base' }, Id: 8, Name: 'Promo' },
          },
        },
      ],
    }
    apiRequestMock.mockResolvedValueOnce(client)

    await updateClient(client)

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as Client
    expect(body).toMatchObject({
      FullName: 'Client',
      NetUid: 'client-net-id',
    })
    expect(body).not.toHaveProperty('ClientContractDocuments')
    expect(body).not.toHaveProperty('ClientInDebts')
    expect(body).not.toHaveProperty('SubClients')
    expect(body).not.toHaveProperty('RootClients')
    expect(body).not.toHaveProperty('RootClient')
    expect(body).not.toHaveProperty('TotalCurrentAmount')
    expect(body).not.toHaveProperty('IsClientExpanded')
    expect(body).not.toHaveProperty('IsSelected')

    const savedClientAgreement = body.ClientAgreements?.[0]
    expect(savedClientAgreement).toMatchObject({ NetUid: 'client-agreement-1' })
    expect(savedClientAgreement).not.toHaveProperty('Client')
    expect(savedClientAgreement?.Agreement).toMatchObject({
      Currency: { Code: 'EUR', Id: 1, Name: 'Euro' },
      Name: 'Agreement',
      NetUid: 'agreement-1',
      Organization: {
        Id: 2,
        Name: 'Organization',
        VatRate: { Id: 20, NetUid: 'vat-20', Value: 20 },
      },
      Pricing: {
        BasePricing: { Id: 4, Name: 'Base' },
        Id: 3,
        Name: 'Retail',
      },
      ProviderPricing: {
        Currency: { Code: 'EUR', Id: 1, Name: 'Euro' },
        Id: 5,
        Name: 'Provider pricing',
        Pricing: { BasePricing: { Id: 7, Name: 'Provider base' }, Id: 6, Name: 'Purchase' },
      },
      PromotionalPricing: { BasePricing: { Id: 9, Name: 'Promo base' }, Id: 8, Name: 'Promo' },
    })
    expect(savedClientAgreement?.Agreement).not.toHaveProperty('ClientAgreements')
    expect(savedClientAgreement?.Agreement).not.toHaveProperty('ClientInDebts')
    expect(savedClientAgreement?.Agreement).not.toHaveProperty('IsSelected')
    expect(savedClientAgreement?.Agreement?.Currency).not.toHaveProperty('IsSelected')
    expect(savedClientAgreement?.Agreement?.Organization).not.toHaveProperty('Manager')
    expect(savedClientAgreement?.Agreement?.Pricing?.BasePricing).not.toHaveProperty('BasePricing')
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
