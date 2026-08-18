import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  complete: vi.fn(),
  handleFailure: vi.fn(),
  prepare: vi.fn(),
}))

vi.mock('../../../shared/api/apiClient', () => ({
  ApiError: class ApiError extends Error {
    readonly status: number
    readonly body: unknown

    constructor(
      message: string,
      status: number,
      body: unknown,
    ) {
      super(message)
      this.status = status
      this.body = body
    }
  },
  apiRequest: mocks.apiRequest,
}))

vi.mock('./currencyMutationOperation', () => ({
  currencyCreateOperation: {
    complete: mocks.complete,
    handleFailure: mocks.handleFailure,
    prepare: mocks.prepare,
  },
}))

import {
  createClientResourceCurrency,
  deleteClientResourceCurrency,
  updateClientResourceCurrency,
} from './clientResourcesApi'

describe('client resource currency API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prepare.mockResolvedValue({
      operationId: '11111111-1111-4111-8111-111111111111',
      storageKey: 'currency-operation',
    })
    mocks.apiRequest.mockResolvedValue({
      Body: {
        Code: 'EUR',
        Name: 'Euro',
      },
    })
  })

  it('creates with a stable idempotency key', async () => {
    const currency = {
      Code: 'EUR',
      Name: 'Euro',
    }

    await createClientResourceCurrency(currency)

    expect(mocks.prepare).toHaveBeenCalledWith(currency)
    expect(mocks.apiRequest).toHaveBeenCalledWith('/currencies/client-resources/new', {
      body: currency,
      headers: {
        'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
      },
      method: 'POST',
    })
    expect(mocks.complete).toHaveBeenCalledTimes(1)
    expect(mocks.handleFailure).not.toHaveBeenCalled()
  })

  it('uses PUT for update and DELETE for archive', async () => {
    const currency = {
      Code: 'EUR',
      Name: 'Euro',
      NetUid: 'currency-net-uid',
    }

    await updateClientResourceCurrency(currency)
    await deleteClientResourceCurrency('currency-net-uid')

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      '/currencies/client-resources/update',
      {
        body: currency,
        method: 'PUT',
      },
    )
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      '/currencies/client-resources/delete',
      {
        method: 'DELETE',
        query: {
          netId: 'currency-net-uid',
        },
      },
    )
  })
})
