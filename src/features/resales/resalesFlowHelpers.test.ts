import { describe, expect, it } from 'vitest'
import {
  buildAvailabilityPayload,
  buildResalesDateQuery,
  canProcessAvailabilityRows,
  getDateRangeError,
  getProcessFromStorageId,
  mapAvailabilityToItemModel,
  rowsShareSingleStorage,
} from './resalesFlowHelpers'
import type { CreatedResaleAvailabilityWithTotals, GroupingResaleAvailability } from './types'

function availability(ProductId: number, FromStorageId?: number): GroupingResaleAvailability {
  return {
    FromStorageId,
    ProductId,
    ProductName: `Product ${ProductId}`,
    Qty: 1,
    SalePrice: 10,
    TotalSalePrice: 10,
  }
}

describe('resales flow helpers', () => {
  it('serializes list dates as local day boundaries without UTC shifting', () => {
    expect(buildResalesDateQuery('2026-06-01', '2026-06-08')).toEqual({
      from: '2026-06-01T00:00:00.000',
      to: '2026-06-08T23:59:59.999',
    })
  })

  it('preserves selected datetime-local precision for availability filters', () => {
    expect(buildAvailabilityPayload({
      amount: 100,
      extraChargePercent: 5,
      from: '2026-06-01T09:30',
      infelicity: 1,
      productGroupIds: ['10'],
      search: 'abc',
      specificationCodes: ['SPEC'],
      storageIds: ['20'],
      to: '2026-06-02T17:45',
    })).toMatchObject({
      From: '2026-06-01T09:30:00',
      To: '2026-06-02T17:45:00',
    })
  })

  it('requires storage id for manual processing rows', () => {
    expect(canProcessAvailabilityRows([availability(1, 10), availability(2)])).toBe(false)
  })

  it('blocks manual processing when selected rows span more than one storage', () => {
    expect(rowsShareSingleStorage([availability(1, 10), availability(2, 20)])).toBe(false)
    expect(rowsShareSingleStorage([availability(1, 10), availability(2, 10)])).toBe(true)
    expect(rowsShareSingleStorage([])).toBe(false)
  })

  it('preserves per-row storage ids for a single-storage selection', () => {
    const rows = [availability(1, 10), availability(2, 10)]

    expect(canProcessAvailabilityRows(rows) && rowsShareSingleStorage(rows)).toBe(true)
    expect(rows.map(mapAvailabilityToItemModel).map((item) => item.FromStorageId)).toEqual([10, 10])
  })

  it('uses result storage first and falls back to selected rows for the process drawer', () => {
    const processData: CreatedResaleAvailabilityWithTotals = {
      ReSaleAvailabilityItemModels: [
        mapAvailabilityToItemModel(availability(1, 30)),
      ],
    }

    expect(getProcessFromStorageId(processData, [availability(2, 20)])).toBe(30)
    expect(getProcessFromStorageId(null, [availability(2, 20)])).toBe(20)
  })

  it('validates real calendar dates and datetime ranges', () => {
    expect(getDateRangeError('2026-02-31', '2026-03-01')).toBe('Оберіть коректний діапазон дат')
    expect(getDateRangeError('2026-06-02T10:00', '2026-06-02T09:59')).toBe('Дата “Від” не може бути більшою за дату “До”')
    expect(getDateRangeError('2026-06-02T09:00', '2026-06-02T09:59')).toBeNull()
  })
})
