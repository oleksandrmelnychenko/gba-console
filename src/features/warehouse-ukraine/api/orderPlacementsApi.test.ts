import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createProductIncomeFromDynamicPlacements,
  getSupplyOrderUkraineById,
  saveDynamicPlacementRow,
  updateSupplyOrderUkraine,
  updateSupplyOrderUkraineForReconciliation,
} from './orderPlacementsApi'

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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/warehouse-ukraine/placement', {
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
      '/supplies/ukraine/order/placements/dynamic/rows/warehouse-ukraine/update',
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
      '/supplies/ukraine/order/placements/dynamic/rows/warehouse-ukraine/new',
      { method: 'POST', body: row },
    )
  })

  it('separates placement save from reconciliation mutations', async () => {
    const order = { NetUid: 'order-1', SupplyOrderUkraineItems: [], DynamicProductPlacementColumns: [] }
    apiRequestMock.mockResolvedValue(order)

    await updateSupplyOrderUkraine(order)
    await updateSupplyOrderUkraineForReconciliation(order)

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/order/warehouse-ukraine/placement/save', {
      body: order,
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/order/warehouse-ukraine/placement/reconciliation', {
      body: order,
      method: 'POST',
    })
  })

  it('routes full post and capitalization through independent permission boundaries', async () => {
    const baseOrder = { NetUid: 'order-1', SupplyOrderUkraineItems: [], DynamicProductPlacementColumns: [] }
    apiRequestMock.mockResolvedValue(baseOrder)

    await createProductIncomeFromDynamicPlacements({ ...baseOrder, IsPlaced: true }, '2026-08-18', 'storage-1')
    await createProductIncomeFromDynamicPlacements({ ...baseOrder, IsPlaced: false }, '2026-08-18', 'storage-1')

    expect(apiRequestMock.mock.calls[0]?.[0]).toBe('/products/incomes/warehouse-ukraine/dynamic/post')
    expect(apiRequestMock.mock.calls[1]?.[0]).toBe('/products/incomes/warehouse-ukraine/dynamic/capitalize')
  })
})
