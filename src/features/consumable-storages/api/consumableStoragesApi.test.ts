import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createConsumableStorage,
  deleteConsumableStorage,
  getConsumableStorage,
  getConsumableStorages,
  searchConsumableStorages,
  updateConsumableStorage,
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
})
