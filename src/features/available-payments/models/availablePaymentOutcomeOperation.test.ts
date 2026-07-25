import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { createAvailablePaymentOutcomeOperation } from './availablePaymentOutcomeOperation'
import type { AvailablePaymentOutcomeRequest } from '../types'

describe('available payment outcome operation', () => {
  it('reuses the submission id for an exact retry and resets only after success', () => {
    const firstOperationId = '11111111-1111-4111-8111-111111111111'
    const secondOperationId = '22222222-2222-4222-8222-222222222222'
    const createOperationId = vi.fn()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId)
    const operation = createAvailablePaymentOutcomeOperation(createOperationId)
    const request = createRequest(100)

    const firstAttempt = operation.getOrCreate(request)
    const retryAttempt = operation.getOrCreate(request)

    expect(firstAttempt).toBe(firstOperationId)
    expect(retryAttempt).toBe(firstOperationId)
    expect(createOperationId).toHaveBeenCalledTimes(1)

    operation.complete(firstAttempt)

    expect(operation.getOrCreate(request)).toBe(secondOperationId)
    expect(createOperationId).toHaveBeenCalledTimes(2)
  })

  it('blocks a changed financial payload after an unknown outcome', () => {
    const operation = createAvailablePaymentOutcomeOperation(
      () => '11111111-1111-4111-8111-111111111111',
    )
    const request = createRequest(100)
    const operationId = operation.getOrCreate(request)

    operation.handleFailure(operationId, new ApiError('response lost', 503, null))

    expect(operation.hasPending()).toBe(true)
    expect(() => operation.getOrCreate(createRequest(101)))
      .toThrow('A pending outcome-payment submission can only be retried without changes')
    expect(operation.getOrCreate(request)).toBe(operationId)
  })

  it('blocks replacing an attachment after an unknown outcome', () => {
    const operation = createAvailablePaymentOutcomeOperation(
      () => '11111111-1111-4111-8111-111111111111',
    )
    const firstFile = new File(['first'], 'proof.pdf', {
      lastModified: 1,
      type: 'application/pdf',
    })
    const replacementFile = new File(['other'], 'proof.pdf', {
      lastModified: 1,
      type: 'application/pdf',
    })
    const request = createRequest(100, [firstFile])

    operation.getOrCreate(request)

    expect(() => operation.getOrCreate(createRequest(100, [replacementFile])))
      .toThrow('A pending outcome-payment submission can only be retried without changes')
  })

  it('allows a corrected submission when the server proves the ledger was not entered', () => {
    const firstOperationId = '11111111-1111-4111-8111-111111111111'
    const secondOperationId = '22222222-2222-4222-8222-222222222222'
    const createOperationId = vi.fn()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId)
    const operation = createAvailablePaymentOutcomeOperation(createOperationId)
    const operationId = operation.getOrCreate(createRequest(100))

    operation.handleFailure(
      operationId,
      new ApiError('validation failed', 400, null, {
        'X-Mutation-Ledger-State': 'not-entered',
      }),
    )

    expect(operation.hasPending()).toBe(false)
    expect(operation.getOrCreate(createRequest(101))).toBe(secondOperationId)
  })
})

function createRequest(
  amount: number,
  documents: File[] = [],
): AvailablePaymentOutcomeRequest {
  return {
    amount,
    comment: '',
    customNumber: '',
    documents,
    exchangeRate: 1,
    fromDate: '2026-07-25T12:00:00',
    isAccounting: false,
    isManagementAccounting: true,
    models: [
      {
        id: 'task-42',
        task: {
          Id: 42,
          NetUid: '6b705f30-89a3-4c57-b74c-908082528865',
        },
      } as AvailablePaymentOutcomeRequest['models'][number],
    ],
    organization: {
      Id: 1,
      NetUid: 'b44a30f7-8eb4-47eb-9f14-7681bf9d2a59',
    },
    paymentPurpose: 'Оплата постачальнику',
    selectedCurrencyRegister: {
      Id: 2,
      NetUid: '16827ea0-857a-486f-8342-35eb0b4f452a',
    },
    selectedMovement: {
      Id: 3,
      NetUid: 'f7146ce8-d23b-4446-9539-ae46778e6897',
    },
    selectedRegister: {
      Id: 4,
      NetUid: 'ecb54ec1-14eb-40ed-97b4-32ed44ef00b3',
    },
  }
}
