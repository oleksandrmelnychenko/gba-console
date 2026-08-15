import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSupplyOrderUkraineById, saveDynamicPlacementRow } from './orderPlacementsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('orderPlacementsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('deep-normalizes dynamic placement arrays', async () => {
    apiRequestMock.mockResolvedValueOnce({
      NetUid: 'order-1',
      DynamicProductPlacementColumns: [
        { Id: 1 },
        {
          Id: 2,
          DynamicProductPlacementRows: [
            { Id: 10 },
            { Id: 11, DynamicProductPlacements: [{ Id: 100 }] },
          ],
        },
      ],
    })

    await expect(getSupplyOrderUkraineById('order-1')).resolves.toEqual({
      NetUid: 'order-1',
      SupplyOrderUkraineItems: [],
      DynamicProductPlacementColumns: [
        { Id: 1, DynamicProductPlacementRows: [] },
        {
          Id: 2,
          DynamicProductPlacementRows: [
            { Id: 10, DynamicProductPlacements: [] },
            { Id: 11, DynamicProductPlacements: [{ Id: 100 }] },
          ],
        },
      ],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/get', {
      query: { netId: 'order-1' },
    })
  })

  it('persists edited addresses through the dedicated row update endpoint', async () => {
    const row = {
      Id: 31,
      Qty: 4,
      SupplyOrderUkraineItemId: 11,
      DynamicProductPlacementColumnId: 21,
      DynamicProductPlacements: [{
        Id: 41,
        Qty: 4,
        StorageNumber: 'STOR',
        RowNumber: 'ROW',
        CellNumber: 'CELL',
        IsApplied: false,
      }],
    }
    apiRequestMock.mockResolvedValueOnce(row)

    await expect(saveDynamicPlacementRow(row)).resolves.toEqual(row)
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/supplies/ukraine/order/placements/dynamic/rows/update',
      { method: 'POST', body: row },
    )
  })

  it('creates a new placement row through the dedicated row create endpoint', async () => {
    const row = {
      Qty: 3,
      SupplyOrderUkraineItemId: 12,
      DynamicProductPlacementColumnId: 22,
      DynamicProductPlacements: [{
        Qty: 3,
        StorageNumber: 'S2',
        RowNumber: 'R2',
        CellNumber: 'C2',
        IsApplied: false,
      }],
    }
    apiRequestMock.mockResolvedValueOnce({ ...row, Id: 32 })

    await expect(saveDynamicPlacementRow(row)).resolves.toMatchObject({ Id: 32, ...row })
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/supplies/ukraine/order/placements/dynamic/rows/new',
      { method: 'POST', body: row },
    )
  })
})
