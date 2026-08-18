import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createOutcomeOrderFromSad,
  createOutcomeOrderFromTaxFree,
} from './documentOutcomePaymentApi'
import type { OutcomePaymentOrder } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('documentOutcomePaymentApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts a SAD outcome order with the organization-client agreement contract intact', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const order: OutcomePaymentOrder = {
      Amount: 100,
      FromDate: '2026-07-24T00:00:00.000Z',
      Organization: { Id: 1 },
      OrganizationClientAgreement: { Id: 22, OrganizationClientId: 33 },
      PaymentCurrencyRegister: { Id: 44 },
      PaymentMovementOperation: {
        PaymentMovement: { Id: 55 },
      },
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'outcome-1' })

    await createOutcomeOrderFromSad('sad-1', order, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/new/sad', {
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: {
        sadNetId: 'sad-1',
      },
      body: order,
    })
  })

  it('posts a Tax Free outcome order with a client agreement', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'
    const order: OutcomePaymentOrder = {
      Amount: 100,
      ClientAgreement: { Id: 12 },
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'outcome-2' })

    await createOutcomeOrderFromTaxFree(
      'tax-free-1',
      order,
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/tax-free-documents/new', {
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: {
        taxFreeNetId: 'tax-free-1',
      },
      body: order,
    })
  })
})
