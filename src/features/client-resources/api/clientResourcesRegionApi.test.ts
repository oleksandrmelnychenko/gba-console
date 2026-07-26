import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createClientResourceRegion,
  createClientResourceRegionCode,
  deleteClientResourceRegion,
  deleteClientResourceRegionCode,
  updateClientResourceRegion,
  updateClientResourceRegionCode,
} from './clientResourcesApi'
import {
  regionCodeCreateOperation,
  regionCreateOperation,
} from './referenceCreateOperation'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('./referenceCreateOperation', () => ({
  regionCreateOperation: {
    complete: vi.fn(),
    handleFailure: vi.fn(),
    prepare: vi.fn(),
  },
  regionCodeCreateOperation: {
    complete: vi.fn(),
    handleFailure: vi.fn(),
    prepare: vi.fn(),
  },
}))

const mockedApiRequest = vi.mocked(apiRequest)
const mockedRegionOperation =
  vi.mocked(regionCreateOperation)
const mockedCodeOperation =
  vi.mocked(regionCodeCreateOperation)

describe('client resources region API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApiRequest.mockResolvedValue({})
    mockedRegionOperation.prepare.mockResolvedValue({
      operationId: '11111111-1111-4111-8111-111111111111',
      storageKey: 'region',
    })
    mockedCodeOperation.prepare.mockResolvedValue({
      operationId: '22222222-2222-4222-8222-222222222222',
      storageKey: 'region-code',
    })
  })

  it('sends stable operation identities for both creates', async () => {
    await createClientResourceRegion({ Name: '01' })
    await createClientResourceRegionCode({
      RegionId: 10,
      Value: '0100001',
    })

    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      1,
      '/regions/new',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Idempotency-Key':
            '11111111-1111-4111-8111-111111111111',
        },
      }),
    )
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      2,
      '/regions/codes/new',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Idempotency-Key':
            '22222222-2222-4222-8222-222222222222',
        },
      }),
    )
    expect(mockedRegionOperation.complete).toHaveBeenCalledOnce()
    expect(mockedCodeOperation.complete).toHaveBeenCalledOnce()
  })

  it('uses PUT for updates', async () => {
    await updateClientResourceRegion({
      NetUid: 'region',
      Name: '01',
    })
    await updateClientResourceRegionCode({
      NetUid: 'code',
      RegionId: 10,
      Value: '0100001',
    })

    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      1,
      '/regions/update',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      2,
      '/regions/codes/update',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('sends concurrency tokens for DELETE mutations', async () => {
    const expectedUpdated = '2026-07-26T12:00:00.0000000Z'

    await deleteClientResourceRegion({
      NetUid: 'region',
      Updated: expectedUpdated,
    })
    await deleteClientResourceRegionCode({
      NetUid: 'code',
      Updated: expectedUpdated,
    })

    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      1,
      '/regions/delete',
      {
        method: 'DELETE',
        query: {
          netId: 'region',
          expectedUpdated,
        },
      },
    )
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      2,
      '/regions/codes/delete',
      {
        method: 'DELETE',
        query: {
          netId: 'code',
          expectedUpdated,
        },
      },
    )
  })
})
