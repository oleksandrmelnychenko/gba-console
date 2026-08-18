import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createConsumableStorage,
  createDeprecatedConsumableOrder,
  deleteConsumableStorage,
  deleteDeprecatedConsumableOrder,
  getDeprecatedConsumableOrders,
  getConsumableStorage,
  getConsumableStorages,
  searchConsumableStorages,
  updateConsumableStorage,
  updateDeprecatedConsumableOrder,
} from './consumableStoragesApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('consumable-storages canonical routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('uses page-scoped reads and independent mutation routes', async () => {
    await getConsumableStorages()
    await searchConsumableStorages('office')
    await getConsumableStorage('storage-1')
    await createConsumableStorage({} as never)
    await updateConsumableStorage({} as never)
    await deleteConsumableStorage('storage-1')

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/consumables/storages/accounting/all',
      '/consumables/storages/accounting/search',
      '/consumables/storages/accounting/get',
      '/consumables/storages/accounting/new',
      '/consumables/storages/accounting/update',
      '/consumables/storages/accounting/delete',
    ])
  })

  it('uses premise-scoped read and independent write-off mutation routes', async () => {
    await getDeprecatedConsumableOrders({
      from: '2026-08-01',
      storageNetId: 'storage-1',
      to: '2026-08-18',
    })
    await createDeprecatedConsumableOrder({} as never, true)
    await updateDeprecatedConsumableOrder({} as never, false)
    await deleteDeprecatedConsumableOrder('write-off-1')

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/consumables/orders/depreciated/accounting/all/filtered',
      '/consumables/orders/depreciated/accounting/new',
      '/consumables/orders/depreciated/accounting/update',
      '/consumables/orders/depreciated/accounting/delete',
    ])
  })
})
