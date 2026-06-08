import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getDocumentVerification } from './documentVerificationApi'
import { getWarehouseUkraineOrders } from './ordersApi'
import { getAllShipmentLists } from './shipmentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('warehouse Ukraine migrated gap request contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('passes placed state and legacy non-placed filter to the orders endpoint', async () => {
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
        nonPlaced: false,
        offset: 0,
        placed: true,
      },
    })
  })

  it('keeps the old default non-placed orders filter when placed is false', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], TotalRowsQty: 0 })

    await getWarehouseUkraineOrders({
      from: '2026-06-01T00:00:00',
      to: '2026-06-08T00:00:00',
      limit: 20,
      offset: 0,
      placed: false,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/all/filtered', {
      query: {
        from: '2026-06-01T00:00:00',
        to: '2026-06-08T00:00:00',
        limit: 20,
        nonPlaced: true,
        offset: 0,
        placed: false,
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

  it('omits transporter net id when all transporters are selected', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getAllShipmentLists({
      from: '2026-06-01',
      to: '2026-06-08',
      limit: 20,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/all/filtered', {
      query: {
        from: '2026-06-01',
        to: '2026-06-08',
        limit: 20,
      },
    })
  })
})
