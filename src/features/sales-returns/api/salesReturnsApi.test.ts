import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  cancelSaleReturn,
  createSaleReturn,
  getSalesForReturn,
  getSalesForReturnLimit,
  getReturnStorages,
  isSalesForReturnResultTruncated,
  searchSalesReturnClients,
} from './salesReturnsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const operationId = '11111111-1111-4111-8111-111111111111'

describe('sales returns API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests return storages by order item, organization, and selected reason', async () => {
    const storages = [{ Id: 1, Name: 'Склад' }]

    apiRequestMock.mockResolvedValueOnce({ Items: storages })

    await expect(
      getReturnStorages({
        orderItemNetId: 'order-item-1',
        organizationNetId: 'organization-1',
        status: 6,
      }),
    ).resolves.toEqual(storages)

    expect(apiRequestMock).toHaveBeenCalledWith('/storages/all/returns/filtered', {
      query: {
        orderItemNetId: 'order-item-1',
        organizationNetId: 'organization-1',
        status: 6,
      },
    })
  })

  it('exposes the exact child card returned inside a matching client group', async () => {
    const child = {
      Id: 561624,
      NetUid: '2d988902-a4b9-486a-9557-6d42c5751c3e',
      FullName: 'АФ-ТРАНС СЕРВІС',
      RegionCode: { Value: 'CE02501' },
    }
    const root = {
      Id: 561622,
      NetUid: 'de20e045-562c-43a1-8e20-b4d4c1c8d81d',
      FullName: 'АФ-ТРАНС',
      RegionCode: { Value: 'CE02500' },
      SubClients: [
        { Id: 1, SubClient: child },
        { Id: 2, SubClient: child },
      ],
    }

    apiRequestMock.mockResolvedValueOnce([root])

    await expect(searchSalesReturnClients(' CE02501 ')).resolves.toEqual([root, child])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/sales-returns/search', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
        limit: 20,
        offset: 0,
        value: 'CE02501',
      },
    })
  })

  it('sends the selected final day as the inclusive end of the return sale search', async () => {
    const sales = [{ NetUid: 'sale-1' }]

    apiRequestMock.mockResolvedValueOnce({ Items: sales })

    await expect(
      getSalesForReturn({
        clientNetId: 'client-1',
        from: '2021-09-30',
        organizationNetId: 'organization-1',
        to: '2026-09-29',
        value: ' 3021-C ',
      }),
    ).resolves.toEqual(sales)

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/all/returns/search', {
      query: {
        includeUnavailable: true,
        from: '2021-09-30T00:00:00.000',
        limit: 50,
        netId: 'client-1',
        organizationNetId: 'organization-1',
        to: '2026-09-29T23:59:59.999',
        value: '3021-C',
      },
    })
  })

  it('flags a return sale search that reached its server limit so older sales are not silently hidden', () => {
    expect(getSalesForReturnLimit({ value: ' 3021-C ' })).toBe(50)
    expect(getSalesForReturnLimit({ clientNetId: 'client-1' })).toBe(20)
    expect(getSalesForReturnLimit({ organizationNetId: 'organization-1', value: '  ' })).toBe(20)
    expect(getSalesForReturnLimit({})).toBe(10)

    expect(isSalesForReturnResultTruncated({ value: '3021-C' }, 50)).toBe(true)
    expect(isSalesForReturnResultTruncated({ value: '3021-C' }, 49)).toBe(false)
    expect(isSalesForReturnResultTruncated({ clientNetId: 'client-1' }, 20)).toBe(true)
    expect(isSalesForReturnResultTruncated({}, 0)).toBe(false)
  })

  it('does not enqueue a broad sale search for an incomplete product code', async () => {
    await expect(
      getSalesForReturn({
        from: '2021-08-08',
        to: '2026-08-08',
        value: 'ISS',
      }),
    ).resolves.toEqual([])

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('forwards cancellation for a superseded product search', async () => {
    const controller = new AbortController()

    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await getSalesForReturn(
      {
        from: '2021-08-08',
        to: '2026-08-08',
        value: 'ISS20081B',
      },
      controller.signal,
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/all/returns/search', {
      query: {
        includeUnavailable: true,
        from: '2021-08-08T00:00:00.000',
        limit: 50,
        netId: '',
        organizationNetId: '',
        to: '2026-08-08T23:59:59.999',
        value: 'ISS20081B',
      },
      signal: controller.signal,
    })
  })

  it('keeps the automatic unfiltered return search small', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await expect(
      getSalesForReturn({
        from: '2021-08-08',
        to: '2026-08-08',
      }),
    ).resolves.toEqual([])

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/all/returns/search', {
      query: {
        includeUnavailable: true,
        from: '2021-08-08T00:00:00.000',
        limit: 10,
        netId: '',
        organizationNetId: '',
        to: '2026-08-08T23:59:59.999',
        value: '',
      },
    })
  })

  it('sends the durable operation key when creating a sale return', async () => {
    const payload = {
      Client: { Id: 10 },
      SaleReturnItems: [],
    }

    apiRequestMock.mockResolvedValueOnce({ Id: 42 })

    await createSaleReturn(payload, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/returns/new', {
      body: payload,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it('sends the durable operation key when canceling a return', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'return-1' })

    await cancelSaleReturn('return-1', { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/returns/cancel', {
      headers: { 'Idempotency-Key': operationId },
      method: 'PUT',
      query: { netId: 'return-1' },
    })
  })
})
