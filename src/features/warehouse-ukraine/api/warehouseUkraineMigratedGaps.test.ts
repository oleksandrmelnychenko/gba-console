import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getDocumentVerification } from './documentVerificationApi'
import { getWarehouseUkraineOrders } from './ordersApi'
import { ALL_TRANSPORTERS_NET_ID, getAllShipmentLists } from './shipmentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('warehouse Ukraine migrated gap request contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('passes explicit placed state to the orders endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], TotalRowsQty: 0 })

    await getWarehouseUkraineOrders({
      from: '2026-06-01T00:00:00',
      to: '2026-06-08T00:00:00',
      limit: 20,
      offset: 0,
      placed: true,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/all/filtered', {
      query: {
        from: '2026-06-01T00:00:00',
        to: '2026-06-08T00:00:00',
        limit: 20,
        offset: 0,
        placed: true,
      },
    })
  })

  it('keeps all selected verification storages in repeated storageId query values', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], TotalRowsQty: 0 })

    await getDocumentVerification({
      from: 'Mon Jun 01 2026',
      to: 'Mon Jun 08 2026',
      limit: 50,
      offset: 10,
      storageIds: [1, 3, 5],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/history/order/item/get/verification', {
      query: {
        from: 'Mon Jun 01 2026',
        to: 'Mon Jun 08 2026',
        limit: 50,
        offset: 10,
        storageId: [1, 3, 5],
      },
    })
  })

  it('sends the empty GUID sentinel when all transporters are selected', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getAllShipmentLists({
      from: '2026-06-01',
      to: '2026-06-08',
      limit: 20,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/all/filtered', {
      query: {
        netId: ALL_TRANSPORTERS_NET_ID,
        from: '2026-06-01',
        to: '2026-06-08',
        limit: 20,
      },
    })
  })
})
