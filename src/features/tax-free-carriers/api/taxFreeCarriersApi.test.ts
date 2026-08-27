import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createTaxFreeCarrier,
  deleteTaxFreeCarrier,
  exportTaxFreeCarriersDocument,
  getTaxFreeCarrier,
  getTaxFreeCarriers,
  searchTaxFreeCarriers,
  updateTaxFreeCarrier,
} from './taxFreeCarriersApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('taxFreeCarriersApi scoped routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({ NetUid: 'carrier-1' })
  })

  it('uses page-scoped registry and search routes', async () => {
    await getTaxFreeCarriers()
    await searchTaxFreeCarriers('Коваль')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/carriers/statham/registry')
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/carriers/statham/registry/search', {
      query: { value: 'Коваль' },
    })
  })

  it('uses independent details, create, edit and delete routes', async () => {
    const payload = { LastName: 'Коваль' }

    await getTaxFreeCarrier('carrier-1')
    await createTaxFreeCarrier(payload)
    await updateTaxFreeCarrier({ ...payload, NetUid: 'carrier-1' })
    await deleteTaxFreeCarrier('carrier-1')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/carriers/statham/details', {
      query: { netId: 'carrier-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/carriers/statham/create', {
      body: payload,
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/supplies/ukraine/carriers/statham/edit', {
      body: { ...payload, NetUid: 'carrier-1' },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/supplies/ukraine/carriers/statham/remove', {
      method: 'DELETE',
      query: { netId: 'carrier-1' },
    })
  })

  it('uses the independent document export route', async () => {
    const columns = [{ ColumnName: 'LastName', Number: 1, TableName: 'Statham', Translate: 'Прізвище' }]

    await exportTaxFreeCarriersDocument(columns)

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/carriers/statham/document/export', {
      body: columns,
      method: 'POST',
    })
  })
})
