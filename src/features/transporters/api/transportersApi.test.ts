import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  archiveTransporter,
  createTransporter,
  getTransportersByType,
  getTransporterTypes,
  updateTransporter,
} from './transportersApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('./transporterMutationOperation', () => ({
  transporterCreateOperation: {
    complete: vi.fn(),
    handleFailure: vi.fn(),
    prepare: vi.fn().mockResolvedValue({ operationId: 'operation-1' }),
  },
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('transportersApi canonical routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses the page-scoped type and registry reads', async () => {
    apiRequestMock.mockResolvedValueOnce([])
    apiRequestMock.mockResolvedValueOnce([])

    await getTransporterTypes()
    await getTransportersByType('type-1')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/transporters/types/registry')
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/transporters/registry', {
      query: { netId: 'type-1' },
    })
  })

  it('uses three independent scoped mutation routes', async () => {
    apiRequestMock.mockResolvedValue({})
    const createBody = new FormData()
    const editBody = new FormData()

    await createTransporter(createBody)
    await updateTransporter(editBody)
    await archiveTransporter('transporter-1')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/transporters/create', {
      body: createBody,
      headers: { 'Idempotency-Key': 'operation-1' },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/transporters/edit', {
      body: editBody,
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/transporters/archive', {
      method: 'DELETE',
      query: { netId: 'transporter-1' },
    })
  })
})
