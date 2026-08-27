import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createProtocol,
  exportProtocolsDocument,
  getProtocolForLogisticPath,
  getProtocolForProductIncome,
  getProtocolForSpecification,
  getProtocols,
} from './productDeliveryProtocolsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('product delivery protocol permission-scoped API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads the registry only through the page-scoped route', async () => {
    apiRequestMock.mockResolvedValueOnce({ DeliveryProductProtocols: [], TotalQty: 0 })

    await getProtocols({ from: '', limit: 20, offset: 0, organization: '', supplier: '', to: '' })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/delivery/product/protocol/registry/all',
      expect.objectContaining({ query: expect.objectContaining({ limit: 20, offset: 0 }) }),
    )
  })

  it.each([
    ['specification', getProtocolForSpecification],
    ['logistic', getProtocolForLogisticPath],
    ['income', getProtocolForProductIncome],
  ])('uses the dedicated %s read boundary', async (scope, loader) => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'protocol-1' })

    await loader('protocol-1')

    expect(apiRequestMock).toHaveBeenCalledWith(
      `/delivery/product/protocol/${scope}/get`,
      { query: { netId: 'protocol-1' } },
    )
  })

  it('creates and exports through separate permission-scoped routes', async () => {
    apiRequestMock.mockResolvedValue({})

    await createProtocol({} as never)
    await exportProtocolsDocument('', '', [])

    expect(apiRequestMock.mock.calls[0]?.[0]).toBe('/delivery/product/protocol/registry/new')
    expect(apiRequestMock.mock.calls[1]?.[0]).toBe('/delivery/product/protocol/registry/print/documents')
  })
})
