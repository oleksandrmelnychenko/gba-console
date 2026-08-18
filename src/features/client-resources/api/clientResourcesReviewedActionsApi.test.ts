import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  complete: vi.fn(),
  handleFailure: vi.fn(),
  prepare: vi.fn(),
}))

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: mocks.apiRequest,
}))

vi.mock('../../transporters/api/transporterMutationOperation', () => ({
  transporterCreateOperation: {
    complete: mocks.complete,
    handleFailure: mocks.handleFailure,
    prepare: mocks.prepare,
  },
}))

import {
  createClientResourceTransporter,
  createClientResourceVatRate,
  deleteClientResourceTransporter,
  getClientResourceTransporters,
  getClientResourceTransporterTypes,
  getClientResourceVatRates,
  updateClientResourceTransporter,
} from './clientResourcesApi'

describe('human-reviewed client resource action API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiRequest.mockResolvedValue({ Body: [] })
    mocks.prepare.mockResolvedValue({
      operationId: '11111111-1111-4111-8111-111111111111',
      storageKey: 'transporter-create',
    })
  })

  it('uses page-scoped lookup routes', async () => {
    await getClientResourceTransporterTypes()
    await getClientResourceVatRates()
    await getClientResourceTransporters('type-net-id')

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      '/transporters/types/client-resources/all',
    )
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      '/vat/rates/client-resources/all',
    )
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      3,
      '/transporters/client-resources/all/type',
      { query: { netId: 'type-net-id' } },
    )
  })

  it('uses distinct VAT and transporter mutation routes', async () => {
    const createPayload = new FormData()
    const updatePayload = new FormData()

    await createClientResourceVatRate(20)
    await createClientResourceTransporter(createPayload)
    await updateClientResourceTransporter(updatePayload)
    await deleteClientResourceTransporter('transporter-net-id')

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      '/vat/rates/client-resources/create',
      { body: { Value: 20 }, method: 'POST' },
    )
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      '/transporters/client-resources/create',
      {
        body: createPayload,
        headers: {
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
        },
        method: 'POST',
      },
    )
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      3,
      '/transporters/client-resources/update',
      { body: updatePayload, method: 'POST' },
    )
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      4,
      '/transporters/client-resources/remove',
      { method: 'DELETE', query: { netId: 'transporter-net-id' } },
    )
  })
})
