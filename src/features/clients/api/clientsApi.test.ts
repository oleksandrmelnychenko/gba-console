import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { Client, ClientSearchParams } from '../types'
import {
  buildClientsSearchFilter,
  exportClientsDocument,
  exportSuppliersDocument,
  getClientCount,
  getClientFilterItems,
  getClients,
  getSupplierCount,
  getSupplierFilterItems,
  getSuppliers,
  switchClientActiveState,
  updateClientOrderExpireDays,
} from './clientsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

type SerializedClientSearchPayload = {
  BooleanFilter: string
  Filter: string
  Limit: number
  Offset: number
  SortDescriptors: unknown[]
  Table: string
  TypeRoleFilter: string
  forReSale: boolean | null
}

function parseClientSearchPayload(value: string): SerializedClientSearchPayload {
  return JSON.parse(value) as SerializedClientSearchPayload
}

describe('buildClientsSearchFilter', () => {
  it('builds the default clients search filter expected by the server', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 10,
      limit: 25,
      value: '  Ivanenko  ',
      active: true,
      forReSale: false,
      typeRoleFilter: 'ClientTypeRole.Id = 3',
    }))

    expect(payload.Table).toBe('Client')
    expect(payload.Offset).toBe(10)
    expect(payload.Limit).toBe(25)
    expect(payload.TypeRoleFilter).toBe('ClientTypeRole.Id = 3')
    expect(payload.SortDescriptors).toEqual([])
    expect(payload.forReSale).toBe(false)
    expect(JSON.parse(payload.BooleanFilter)).toEqual({
      CssClass: 'active_clients',
      Name: 'ShowOnlyActive',
      SQL: 'IsActive',
      Value: true,
    })
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Ivanenko',
      FilterItem: {
        Type: 0,
        SQL: 'RegionCode.Value/Client.FullName/Client.USREOU',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
  })

  it('serializes inactive and unscoped resale filters explicitly', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 20,
      active: false,
      forReSale: null,
    }))

    expect(payload.forReSale).toBeNull()
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: '',
      FilterItem: {
        Type: 0,
        SQL: 'RegionCode.Value/Client.FullName/Client.USREOU',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
    expect(JSON.parse(payload.BooleanFilter)).toEqual({
      CssClass: 'inactive_clients',
      Name: 'ShowOnlyInactive',
      SQL: 'IsActive',
      Value: false,
    })
  })

  it('omits the server search filter for the default unfiltered client list', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 30,
      active: null,
      forReSale: null,
    }))

    expect(payload.Filter).toBe('')
  })

  it('omits the server search filter for whitespace-only default search values', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 30,
      filterSql: 'Client.FullName',
      value: '   ',
    }))

    expect(payload.Filter).toBe('')
  })

  it('passes supplier filter entity type through the server filter item', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 20,
      filterEntityType: 7,
      filterSql: 'Client.FullName',
      value: 'Provider',
    }))

    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Provider',
      FilterItem: {
        Type: 7,
        SQL: 'Client.FullName',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
  })

  it('serializes filter operations and server sort descriptors', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 20,
      filterOperationSql: 'StartsWith',
      filterSql: 'Client.FullName',
      sortDescriptors: [{ Column: 'FullName', Dir: 'desc' }],
      value: 'Acme',
    }))

    expect(payload.SortDescriptors).toEqual([{ Column: 'FullName', Dir: 'desc' }])
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Acme',
      FilterItem: {
        Type: 0,
        SQL: 'Client.FullName',
        FilterOperationItem: {
          SQL: 'StartsWith',
        },
      },
    })
  })
})

describe('clients API query contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests clients through the search endpoint with a serialized filter', async () => {
    const client: Client = { NetUid: 'client-1', FullName: 'Ivanenko' }
    const params: ClientSearchParams = {
      offset: 0,
      limit: 20,
      value: 'Ivanenko',
      active: null,
      forReSale: null,
    }

    apiRequestMock.mockResolvedValueOnce({ Items: [client] })

    await expect(getClients(params)).resolves.toEqual([client])
    expect(apiRequestMock).toHaveBeenCalledWith('/search/by/query', {
      query: {
        filter: buildClientsSearchFilter(params),
      },
    })
  })

  it('requests suppliers through the targeted suppliers endpoint', async () => {
    const supplier: Client = { NetUid: 'supplier-1', FullName: 'Provider' }
    const params: ClientSearchParams = {
      offset: 0,
      limit: 20,
      value: 'Provider',
      active: null,
      forReSale: null,
      filterSql: 'RegionCode.Value/Client.FullName',
      typeRoleFilter: '7',
    }

    apiRequestMock.mockResolvedValueOnce([supplier])

    await expect(getSuppliers(params)).resolves.toEqual([supplier])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/suppliers/all/filtered', {
      query: {
        active: null,
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: '7',
        value: 'Provider',
      },
    })
  })

  it('requests the clients export document with the search filter query', async () => {
    const params: ClientSearchParams = {
      offset: 40,
      limit: 20,
      value: 'Kyiv',
      active: true,
      forReSale: true,
    }
    const document = { PdfDocumentURL: '/exports/clients.pdf' }

    apiRequestMock.mockResolvedValueOnce(document)

    await expect(exportClientsDocument(params)).resolves.toEqual(document)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/document', {
      query: {
        filter: buildClientsSearchFilter(params),
      },
    })
  })

  it('requests supplier export with the same filtered document contract as the table', async () => {
    const params: ClientSearchParams = {
      active: true,
      filterEntityType: 7,
      filterSql: 'Client.FullName',
      limit: 100,
      offset: 0,
      typeRoleFilter: '3',
      value: 'Provider',
    }
    const document = { DocumentURL: '/exports/suppliers.xlsx' }

    apiRequestMock.mockResolvedValueOnce(document)

    await expect(exportSuppliersDocument(params)).resolves.toEqual(document)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/document', {
      query: {
        filter: buildClientsSearchFilter(params),
      },
    })
  })

  it('requests the default buyer clients count and normalizes string totals', async () => {
    apiRequestMock.mockResolvedValueOnce('42')

    await expect(getClientCount()).resolves.toBe(42)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/total', {
      query: {
        type: 0,
      },
    })
  })

  it('loads dynamic client filter items through the source endpoint', async () => {
    const filterItems = [{ SQL: 'Client.FullName', Name: 'Повна назва' }]

    apiRequestMock.mockResolvedValueOnce(filterItems)

    await expect(getClientFilterItems()).resolves.toEqual(filterItems)
    expect(apiRequestMock).toHaveBeenCalledWith('/filteritems/all', {
      query: {
        type: 0,
      },
    })
  })

  it('loads dynamic supplier filter items through the source endpoint', async () => {
    const filterItems = [{ SQL: 'Client.FullName', Name: 'Постачальник' }]

    apiRequestMock.mockResolvedValueOnce({ Items: filterItems })

    await expect(getSupplierFilterItems()).resolves.toEqual(filterItems)
    expect(apiRequestMock).toHaveBeenCalledWith('/filteritems/all', {
      query: {
        type: 7,
      },
    })
  })

  it('requests the provider supplier count', async () => {
    apiRequestMock.mockResolvedValueOnce({ Count: '7' })

    await expect(getSupplierCount()).resolves.toBe(7)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/total', {
      query: {
        type: 1,
      },
    })
  })

  it('passes the client net id when toggling active state', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await switchClientActiveState('client-net-id')

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/switch/active', {
      query: {
        netId: 'client-net-id',
      },
    })
  })

  it('posts order expiration updates with query params and an empty body', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await updateClientOrderExpireDays('client-net-id', 14)

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/update/order/expire', {
      method: 'POST',
      query: {
        clientNetId: 'client-net-id',
        days: 14,
      },
      body: {},
    })
  })
})
