import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { IncompleteSale, RetailCartItem, RetailClient, RetailSale } from '../onlineShopTypes'
import {
  getIncompleteSaleByNetUid,
  getIncompleteSales,
  getRetailClientCart,
  getRetailClientSales,
  getRetailClients,
  getRetailClientsPage,
  searchRetailClients,
  searchRetailClientsPage,
  updateIncompleteSale,
} from './onlineShopClientsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('online-shop clients API query contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads retail clients from the source endpoint', async () => {
    const clients: RetailClient[] = [{ NetUid: 'retail-client', FullName: 'Retail Client' }]

    apiRequestMock.mockResolvedValueOnce(clients)

    await expect(getRetailClients()).resolves.toEqual(clients)
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/all')
  })

  it('loads a paged retail client list from the source endpoint', async () => {
    const clients: RetailClient[] = [{ NetUid: 'retail-client', FullName: 'Retail Client' }]

    apiRequestMock.mockResolvedValueOnce({ Collection: clients, TotalQty: 42 })

    await expect(getRetailClientsPage({ limit: 20, offset: 40 })).resolves.toEqual({
      Items: clients,
      Total: 42,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/all', {
      query: {
        limit: 20,
        offset: 40,
      },
    })
  })

  it('searches retail clients with the source value query parameter', async () => {
    const clients: RetailClient[] = [{ NetUid: 'searched-client', FullName: 'Search Client' }]

    apiRequestMock.mockResolvedValueOnce({ Items: clients })

    await expect(searchRetailClients('  Search  ')).resolves.toEqual(clients)
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/sales/filtered', {
      query: {
        value: 'Search',
      },
    })
  })

  it('searches retail clients with paged source parameters', async () => {
    const clients: RetailClient[] = [{ NetUid: 'searched-client', FullName: 'Search Client' }]

    apiRequestMock.mockResolvedValueOnce({ Collection: clients, TotalQty: '7' })

    await expect(searchRetailClientsPage('  Search  ', { limit: 20, offset: 20 })).resolves.toEqual({
      Items: clients,
      Total: 7,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/sales/filtered', {
      query: {
        value: 'Search',
        limit: 20,
        offset: 20,
        paged: true,
      },
    })
  })

  it('loads a retail client cart by net id and parses the double-encoded cart body', async () => {
    const cart: RetailCartItem[] = [{ NetUid: 'cart-line', Quantity: 2 }]

    apiRequestMock.mockResolvedValueOnce(JSON.stringify(cart))

    await expect(getRetailClientCart('retail-client')).resolves.toEqual(cart)
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/cart', {
      query: {
        netId: 'retail-client',
      },
    })
  })

  it('loads retail client sales by net id', async () => {
    const sales: RetailSale[] = [{ NetUid: 'sale-net-id', Order: { OrderSource: 0 } }]

    apiRequestMock.mockResolvedValueOnce(sales)

    await expect(getRetailClientSales('retail-client')).resolves.toEqual(sales)
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/sales', {
      query: {
        netId: 'retail-client',
      },
    })
  })

  it('loads a single incomplete sale by sale net id', async () => {
    const incompleteSale: IncompleteSale = { NetUid: 'incomplete-sale', OrderItems: [] }

    apiRequestMock.mockResolvedValueOnce(incompleteSale)

    await expect(getIncompleteSaleByNetUid('sale-net-id')).resolves.toEqual(incompleteSale)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/misplaced/get', {
      query: {
        netId: 'sale-net-id',
      },
    })
  })

  it('loads incomplete sales with source filter parameters', async () => {
    const incompleteSales: IncompleteSale[] = [{ NetUid: 'incomplete-sale' }]

    apiRequestMock.mockResolvedValueOnce(incompleteSales)

    await expect(getIncompleteSales({
      from: '2026-05-01',
      isAccepted: false,
      number: '  123  ',
      to: '2026-05-27',
    })).resolves.toEqual(incompleteSales)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/misplaced/get/all', {
      query: {
        number: '123',
        from: '2026-05-01',
        to: '2026-05-27T23:59:59',
        isAccepted: false,
      },
    })
  })

  it('updates an incomplete sale with the full entity body', async () => {
    const incompleteSale: IncompleteSale = { NetUid: 'incomplete-sale' }

    apiRequestMock.mockResolvedValueOnce([incompleteSale])

    await expect(updateIncompleteSale(incompleteSale)).resolves.toEqual([incompleteSale])
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/misplaced/update', {
      method: 'POST',
      body: incompleteSale,
    })
  })
})
