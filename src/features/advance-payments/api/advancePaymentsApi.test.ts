import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createAdvancePayment,
  getAdvancePayment,
  getAdvancePayments,
  updateAdvancePayment,
} from './advancePaymentsApi'
import type { AdvancePaymentMutationPayload } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('advancePaymentsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('expands date filters to full-day date-time query values', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getAdvancePayments({
      from: '2026-06-01',
      limit: 40,
      offset: 20,
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/advance/all', {
      query: {
        from: expect.stringContaining('2026-06-01T00:00:00.000'),
        limit: 40,
        offset: 20,
        to: expect.stringContaining('2026-06-08T23:59:59.999'),
      },
    })
  })

  it.each([
    [{ taxFreeNetId: 'tax-free-1' }, { taxFreeNetId: 'tax-free-1' }],
    [{ sadNetId: 'sad-1' }, { sadNetId: 'sad-1' }],
  ] as const)('creates an advance payment with exactly one source query', async (source, expectedQuery) => {
    const payload = createMutationPayload()
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'advance-1' })

    await expect(createAdvancePayment(source, payload)).resolves.toEqual({ NetUid: 'advance-1' })
    expect(apiRequestMock).toHaveBeenCalledWith('/payments/advance/new', {
      method: 'POST',
      query: expectedQuery,
      body: payload,
    })
  })

  it('gets and updates an advance payment using the hardened endpoints', async () => {
    const payload = {
      ...createMutationPayload(),
      NetUid: 'advance-1',
    }
    apiRequestMock
      .mockResolvedValueOnce({ NetUid: 'advance-1' })
      .mockResolvedValueOnce({ ...payload, Amount: 120 })

    await expect(getAdvancePayment('advance-1')).resolves.toEqual({ NetUid: 'advance-1' })
    await expect(updateAdvancePayment(payload)).resolves.toEqual({ ...payload, Amount: 120 })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/payments/advance/get', {
      query: {
        netId: 'advance-1',
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/payments/advance/update', {
      method: 'POST',
      body: payload,
    })
  })
})

function createMutationPayload(): AdvancePaymentMutationPayload {
  return {
    Amount: 100,
    ClientAgreement: { Id: 10 },
    Comment: 'Аванс',
    FromDate: '2026-07-24T00:00:00.000Z',
    Organization: { Id: 1 },
    VatAmount: 20,
    VatPercent: 20,
  }
}
