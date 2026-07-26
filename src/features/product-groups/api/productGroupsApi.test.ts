import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createProductGroup,
} from './productGroupsApi'
import {
  ProductGroupCreateOperationStorageError,
  ProductGroupCreateRetryConflictError,
} from './productGroupCreateOperation'
import type { ProductGroup } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productGroupsApi create retry safety', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gba_console_session',
      JSON.stringify({
        userNetUid:
          '11111111-1111-4111-8111-111111111111',
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends one stable operation id in the header and query', async () => {
    apiRequestMock.mockResolvedValueOnce(createPayload())

    await createProductGroup(createPayload())

    const [, request] = apiRequestMock.mock.calls[0]
    const operationNetUid = new Headers(request?.headers)
      .get('Idempotency-Key')

    expect(operationNetUid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(request).toEqual(expect.objectContaining({
      method: 'POST',
      query: {
        operationNetUid,
      },
      body: expect.objectContaining({
        IsActive: true,
      }),
    }))
    expect(getPendingKeys()).toHaveLength(0)
  })

  it('reuses the operation id after an unknown outcome', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        Object.assign(
          new Error('timeout'),
          { status: 504 },
        ),
      )
      .mockResolvedValueOnce(createPayload())

    await expect(
      createProductGroup(createPayload()),
    ).rejects.toThrow('timeout')
    await createProductGroup(createPayload())

    expect(getOperationId(0)).toBe(getOperationId(1))
    expect(getPendingKeys()).toHaveLength(0)
  })

  it('fails closed when the request changes after an unknown outcome', async () => {
    apiRequestMock.mockRejectedValueOnce(
      Object.assign(
        new Error('network'),
        { status: 0 },
      ),
    )

    await expect(
      createProductGroup(createPayload()),
    ).rejects.toThrow('network')
    await expect(
      createProductGroup({
        ...createPayload(),
        Name: 'Changed',
      }),
    ).rejects.toBeInstanceOf(
      ProductGroupCreateRetryConflictError,
    )

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(getPendingKeys()).toHaveLength(1)
  })

  it('clears a definitive client failure before a new attempt', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        Object.assign(
          new Error('invalid'),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(createPayload())

    await expect(
      createProductGroup(createPayload()),
    ).rejects.toThrow('invalid')
    await createProductGroup({
      ...createPayload(),
      Name: 'Another group',
    })

    expect(getOperationId(0)).not.toBe(getOperationId(1))
    expect(getPendingKeys()).toHaveLength(0)
  })

  it('retains the operation when a client error reports an unknown outcome', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        Object.assign(
          new Error('unknown'),
          {
            status: 409,
            headers: {
              'X-ProductGroup-Create-Ledger-State': 'unknown',
            },
          },
        ),
      )
      .mockResolvedValueOnce(createPayload())

    await expect(
      createProductGroup(createPayload()),
    ).rejects.toThrow('unknown')
    await createProductGroup(createPayload())

    expect(getOperationId(0)).toBe(getOperationId(1))
    expect(getPendingKeys()).toHaveLength(0)
  })

  it('retains the operation after an HTTP request timeout', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        Object.assign(
          new Error('request timeout'),
          { status: 408 },
        ),
      )
      .mockResolvedValueOnce(createPayload())

    await expect(
      createProductGroup(createPayload()),
    ).rejects.toThrow('request timeout')
    await createProductGroup(createPayload())

    expect(getOperationId(0)).toBe(getOperationId(1))
  })

  it('fails closed when no secure operation-id source is available', async () => {
    vi.stubGlobal('crypto', undefined)

    await expect(
      createProductGroup(createPayload()),
    ).rejects.toBeInstanceOf(
      ProductGroupCreateOperationStorageError,
    )

    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(getPendingKeys()).toHaveLength(0)
  })

  it('treats relation ordering as the same request', async () => {
    const first = createPayload()
    first.RootProductGroups = [
      rootRelation(22),
      rootRelation(11),
    ]
    const retry = createPayload()
    retry.RootProductGroups = [
      rootRelation(11),
      rootRelation(22),
    ]
    apiRequestMock
      .mockRejectedValueOnce(
        Object.assign(
          new Error('timeout'),
          { status: 504 },
        ),
      )
      .mockResolvedValueOnce(retry)

    await expect(
      createProductGroup(first),
    ).rejects.toThrow('timeout')
    await createProductGroup(retry)

    expect(getOperationId(0)).toBe(getOperationId(1))
  })
})

function createPayload(): ProductGroup {
  return {
    Description: 'Brake parts',
    FullName: 'Brake system',
    Name: 'Brakes',
    RootProductGroups: [],
    SubProductGroups: [],
  }
}

function rootRelation(id: number) {
  return {
    RootProductGroup: {
      Id: id,
      NetUid: `${String(id).padStart(8, '0')}-2222-4222-8222-222222222222`,
    },
    RootProductGroupId: id,
  }
}

function getOperationId(callIndex: number): string | null {
  return new Headers(
    apiRequestMock.mock.calls[callIndex][1]?.headers,
  ).get('Idempotency-Key')
}

function getPendingKeys(): string[] {
  return Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index) || '',
  ).filter((key) =>
    key.startsWith('gba:product-groups:create:v1:'),
  )
}
