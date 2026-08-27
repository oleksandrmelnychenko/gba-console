import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { IncompleteSale, RetailCartItem, RetailClient, RetailSale } from '../onlineShopTypes'
import {
  getIncompleteSaleByNetUid,
  getIncompleteSales,
  getOnlineShopClientsPage,
  getRetailClientCart,
  getRetailClientSales,
  getRetailClients,
  getRetailClientsPage,
  searchRetailClients,
  searchRetailClientsPage,
  searchOnlineShopClientsPage,
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

  it('loads the online-shop client registry through its page-scoped endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Collection: [], TotalQty: 0 })

    await expect(getOnlineShopClientsPage({ limit: 20, offset: 40 })).resolves.toEqual({
      Items: [],
      Total: 0,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/online-shop/all', {
      query: { limit: 20, offset: 40 },
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

  it('searches the online-shop registry through its page-scoped endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Collection: [], TotalQty: 0 })

    await expect(searchOnlineShopClientsPage('  Search  ', { limit: 20, offset: 20 })).resolves.toEqual({
      Items: [],
      Total: 0,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/retail/clients/online-shop/sales/filtered', {
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
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/misplaced/online-shop/get/all', {
      query: {
        number: '123',
        from: '2026-05-01',
        to: '2026-05-27',
        isAccepted: false,
      },
    })
  })

  it('updates an incomplete sale with the full entity body', async () => {
    const incompleteSale: IncompleteSale = {
      NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      MisplacedSaleStatus: 1,
    }
    const operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    apiRequestMock.mockResolvedValueOnce([incompleteSale])

    await expect(updateIncompleteSale(incompleteSale, { operationId })).resolves.toEqual([incompleteSale])
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/misplaced/online-shop/assign-to-self', {
      method: 'POST',
      body: {
        MisplacedSaleStatus: 1,
        NetUid: incompleteSale.NetUid,
      },
      headers: { 'Idempotency-Key': operationId },
      signal: undefined,
    })
  })

  it('marks an incomplete sale completed through the dedicated permission endpoint', async () => {
    const incompleteSale: IncompleteSale = {
      NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      MisplacedSaleStatus: 2,
    }
    const operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    apiRequestMock.mockResolvedValueOnce([incompleteSale])

    await expect(updateIncompleteSale(incompleteSale, { operationId })).resolves.toEqual([incompleteSale])
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/misplaced/online-shop/mark-completed', {
      method: 'POST',
      body: {
        MisplacedSaleStatus: 2,
        NetUid: incompleteSale.NetUid,
      },
      headers: { 'Idempotency-Key': operationId },
      signal: undefined,
    })
  })

  it('rejects a status without a business transition before the API call', async () => {
    await expect(updateIncompleteSale(
      { NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', MisplacedSaleStatus: 0 },
      { operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    )).rejects.toThrow('Некоректний статус незавершеного продажу')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('rejects a misplaced update without a persisted identity before the API call', async () => {
    await expect(updateIncompleteSale(
      { NetUid: '00000000-0000-0000-0000-000000000000', MisplacedSaleStatus: 1 },
      { operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    )).rejects.toThrow('Не вдалося визначити незавершений продаж')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
