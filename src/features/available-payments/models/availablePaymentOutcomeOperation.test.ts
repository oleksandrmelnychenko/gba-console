import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { createAvailablePaymentOutcomeOperation } from './availablePaymentOutcomeOperation'
import type { AvailablePaymentOutcomeRequest } from '../types'

describe('available payment outcome operation', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses the submission id for an exact retry and resets only after success', async () => {
    const firstOperationId = '11111111-1111-4111-8111-111111111111'
    const secondOperationId = '22222222-2222-4222-8222-222222222222'
    const createOperationId = vi.fn()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId)
    const operation = createAvailablePaymentOutcomeOperation(createOperationId)
    const request = createRequest(100)

    const firstAttempt = await operation.getOrCreate(request)
    const retryAttempt = await operation.getOrCreate(request)

    expect(firstAttempt).toBe(firstOperationId)
    expect(retryAttempt).toBe(firstOperationId)
    expect(createOperationId).toHaveBeenCalledTimes(1)

    operation.complete(firstAttempt)

    await expect(operation.getOrCreate(request)).resolves.toBe(secondOperationId)
    expect(createOperationId).toHaveBeenCalledTimes(2)
  })

  it('blocks a changed financial payload after an unknown outcome', async () => {
    const operation = createAvailablePaymentOutcomeOperation(
      () => '11111111-1111-4111-8111-111111111111',
    )
    const request = createRequest(100)
    const operationId = await operation.getOrCreate(request)

    operation.handleFailure(operationId, new ApiError('response lost', 503, null))

    expect(operation.hasPending()).toBe(true)
    await expect(operation.getOrCreate(createRequest(101)))
      .rejects.toThrow('A pending outcome-payment submission can only be retried without changes')
    await expect(operation.getOrCreate(request)).resolves.toBe(operationId)
  })

  it('blocks replacing an attachment after an unknown outcome', async () => {
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

    await operation.getOrCreate(request)

    await expect(operation.getOrCreate(createRequest(100, [replacementFile])))
      .rejects.toThrow('A pending outcome-payment submission can only be retried without changes')
  })

  it('restores the same operation after reload for a byte-identical reselected file', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const originalFile = new File(['proof'], 'proof.pdf', {
      lastModified: 1,
      type: 'application/pdf',
    })
    const first = createAvailablePaymentOutcomeOperation(() => operationId)

    await expect(first.getOrCreate(createRequest(100, [originalFile])))
      .resolves.toBe(operationId)

    const persisted = sessionStorage.getItem(
      'gba:available-payment-outcome-operation:v1:anonymous',
    ) || ''
    expect(persisted).toContain(operationId)
    expect(persisted).not.toContain('Оплата постачальнику')
    expect(persisted).not.toContain('proof.pdf')

    const restored = createAvailablePaymentOutcomeOperation(
      () => '22222222-2222-4222-8222-222222222222',
    )
    const reselectedFile = new File(['proof'], 'proof.pdf', {
      lastModified: 1,
      type: 'application/pdf',
    })

    expect(restored.hasPending()).toBe(true)
    await expect(restored.getOrCreate(createRequest(100, [reselectedFile])))
      .resolves.toBe(operationId)
    restored.complete(operationId)
    expect(sessionStorage.length).toBe(0)
  })

  it('allows a corrected submission when the server proves the ledger was not entered', async () => {
    const firstOperationId = '11111111-1111-4111-8111-111111111111'
    const secondOperationId = '22222222-2222-4222-8222-222222222222'
    const createOperationId = vi.fn()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId)
    const operation = createAvailablePaymentOutcomeOperation(createOperationId)
    const operationId = await operation.getOrCreate(createRequest(100))

    operation.handleFailure(
      operationId,
      new ApiError('validation failed', 400, null, {
        'X-Mutation-Ledger-State': 'not-entered',
      }),
    )

    expect(operation.hasPending()).toBe(false)
    await expect(operation.getOrCreate(createRequest(101)))
      .resolves.toBe(secondOperationId)
  })

  it('settles a persisted unknown outcome after the server confirms completion', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const first = createAvailablePaymentOutcomeOperation(
      () => operationId,
    )
    await first.getOrCreate(createRequest(100))

    const getStatus = vi.fn().mockResolvedValue({
      OperationKind: 'outcome-payment:add-supplies',
      OperationNetUid: operationId,
      State: 'completed',
    })
    const restored = createAvailablePaymentOutcomeOperation(
      () => '22222222-2222-4222-8222-222222222222',
      getStatus,
    )

    await expect(restored.reconcile())
      .resolves.toBe('completed')
    expect(getStatus).toHaveBeenCalledWith(operationId)
    expect(restored.hasPending()).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })

  it('keeps the operation key when the ledger is not yet visible', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const operation = createAvailablePaymentOutcomeOperation(
      () => operationId,
      vi.fn().mockResolvedValue(null),
    )
    const request = createRequest(100)
    await operation.getOrCreate(request)

    await expect(operation.reconcile())
      .resolves.toBe('missing')
    expect(operation.hasPending()).toBe(true)
    await expect(operation.getOrCreate(request))
      .resolves.toBe(operationId)
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
