import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import {
  advanceWizardCreateSaleSession,
  createWizardCreateSaleSubmission,
  reconcileWizardCreateSale,
  submitWizardCreateSale,
} from './wizardCreateSaleSubmit'

describe('wizard create-sale submission', () => {
  it('uses the canonical body marker and the same operation key in request options', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const createSale = vi.fn().mockResolvedValue({ message: null, sale: { NetUid: 'created-sale' } })
    const submission = createWizardCreateSaleSubmission(
      { NetUid: '00000000-0000-0000-0000-000000000000' },
      operationId,
    )

    await expect(submitWizardCreateSale(submission, createSale)).resolves.toMatchObject({
      status: 'acknowledged',
    })
    expect(createSale).toHaveBeenCalledWith(
      {
        NetUid: '00000000-0000-0000-0000-000000000000',
        OperationNetUid: operationId,
      },
      { operationId },
    )
  })

  it('reconciles a lost response with the same immutable body and key without creating a duplicate', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'
    const originalPayload = {
      Comment: 'original payload',
      NetUid: '00000000-0000-0000-0000-000000000000',
      Order: { OrderItems: [{ NetUid: 'source-row', Qty: 2 }] },
    }
    const submission = createWizardCreateSaleSubmission(originalPayload, operationId)
    const ledger = new Map<string, { message: string; sale: { NetUid: string } }>()
    let createdCount = 0
    let loseFirstResponse = true
    const createSale = vi.fn(async (_body, operation) => {
      const existing = ledger.get(operation.operationId)

      if (existing) {
        return existing
      }

      createdCount += 1
      const result = { message: 'replayed', sale: { NetUid: 'created-sale' } }
      ledger.set(operation.operationId, result)

      if (loseFirstResponse) {
        loseFirstResponse = false
        throw new ApiError('timeout after commit', 500, null)
      }

      return result
    })

    await expect(submitWizardCreateSale(submission, createSale)).resolves.toMatchObject({
      status: 'pending-reconciliation',
    })
    originalPayload.Comment = 'user edited after timeout'
    originalPayload.Order.OrderItems[0]!.Qty = 99
    await expect(reconcileWizardCreateSale(submission, createSale)).resolves.toEqual({
      result: { message: 'replayed', sale: { NetUid: 'created-sale' } },
      status: 'reconciled',
    })
    expect(createdCount).toBe(1)
    expect(createSale).toHaveBeenCalledTimes(2)
    expect(createSale.mock.calls[1]).toEqual(createSale.mock.calls[0])
    expect(createSale.mock.calls[1]?.[0]).toBe(submission.payload)
    expect(createSale.mock.calls[1]?.[0]).toMatchObject({
      Comment: 'original payload',
      OperationNetUid: operationId,
      Order: { OrderItems: [{ NetUid: 'source-row', Qty: 2 }] },
    })
    expect(Object.isFrozen(submission.payload)).toBe(true)
    expect(Object.isFrozen(submission.payload.Order?.OrderItems)).toBe(true)
  })

  it('returns a marked pre-ledger backend validation rejection as definitive', async () => {
    const error = new ApiError(
      'Invalid split source',
      400,
      { MutationLedgerState: 'not-entered' },
    )
    const submission = createWizardCreateSaleSubmission(
      { NetUid: '00000000-0000-0000-0000-000000000000' },
      '33333333-3333-4333-8333-333333333333',
    )

    await expect(submitWizardCreateSale(submission, vi.fn().mockRejectedValue(error))).resolves.toEqual({
      error,
      status: 'definitive-failure',
    })
  })

  it('settles a pending session on a marked pre-ledger retry and accepts corrected data under a new key', async () => {
    const firstOperationId = '44444444-4444-4444-8444-444444444444'
    const nextOperationId = '55555555-5555-4555-8555-555555555555'
    const payload = {
      Comment: 'before correction',
      NetUid: '00000000-0000-0000-0000-000000000000',
    }
    const createSale = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('response lost', 500, null))
      .mockRejectedValueOnce(new ApiError(
        'split source is no longer valid',
        400,
        { MutationLedgerState: 'not-entered' },
      ))
      .mockResolvedValueOnce({ message: 'created', sale: { NetUid: 'new-sale' } })

    const first = await advanceWizardCreateSaleSession({
      createOperationId: () => firstOperationId,
      createSale,
      payload,
    })

    if (first.status !== 'pending-reconciliation') {
      throw new Error(`Expected pending reconciliation, received ${first.status}`)
    }

    payload.Comment = 'corrected payload'
    const retry = await advanceWizardCreateSaleSession({
      createSale,
      submission: first.submission,
    })

    expect(retry).toEqual({
      error: expect.any(ApiError),
      status: 'definitive-failure',
      submission: null,
    })

    const corrected = await advanceWizardCreateSaleSession({
      createOperationId: () => nextOperationId,
      createSale,
      payload,
    })

    expect(corrected).toEqual({
      result: { message: 'created', sale: { NetUid: 'new-sale' } },
      status: 'acknowledged',
      submission: null,
    })
    expect(createSale.mock.calls.map((call) => call[1]?.operationId)).toEqual([
      firstOperationId,
      firstOperationId,
      nextOperationId,
    ])
    expect(createSale.mock.calls.map((call) => call[0]?.Comment)).toEqual([
      'before correction',
      'before correction',
      'corrected payload',
    ])
    expect(createSale.mock.calls[1]?.[0]).toBe(createSale.mock.calls[0]?.[0])
    expect(createSale.mock.calls[2]?.[0]).not.toBe(createSale.mock.calls[0]?.[0])
  })
})
