import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  advanceSaleJsonMutationSession,
  createSaleJsonMutationSubmission,
} from './saleJsonMutation'

describe('sale JSON mutation idempotency', () => {
  it.each([
    'sale-comment',
    'sale-discount',
    'sale-recipient',
    'sale-recipient-address',
    'sale-shift-current',
    'sale-switch',
    'sale-update',
  ] as const)(
    'replays %s with the same key and byte-identical frozen body after a lost response',
    async (kind) => {
      const operationId = '11111111-1111-4111-8111-111111111111'
      const original = { Comment: 'before timeout', NetUid: 'sale-1' }
      const submission = createSaleJsonMutationSubmission(kind, original, operationId)
      const bodies: string[] = []
      const keys: string[] = []
      const request = vi
        .fn()
        .mockImplementationOnce(async (payload, operation) => {
          bodies.push(JSON.stringify(payload))
          keys.push(operation.operationId)
          throw new ApiError('response lost', 500, null)
        })
        .mockImplementationOnce(async (payload, operation) => {
          bodies.push(JSON.stringify(payload))
          keys.push(operation.operationId)

          return { NetUid: 'sale-1' }
        })

      const first = await advanceSaleJsonMutationSession({ request, submission })
      original.Comment = 'edited after timeout'
      const retry = await advanceSaleJsonMutationSession({ request, submission, wasPending: true })

      expect(first.status).toBe('pending-reconciliation')
      expect(retry.status).toBe('replayed')
      expect(keys).toEqual([operationId, operationId])
      expect(bodies[1]).toBe(bodies[0])
      expect(bodies[0]).toContain('before timeout')
      expect(bodies[0]).not.toContain('edited after timeout')
    },
  )

  it('settles a marked pre-ledger validation rejection so corrected data can use a new key', async () => {
    const firstKey = '22222222-2222-4222-8222-222222222222'
    const secondKey = '33333333-3333-4333-8333-333333333333'
    const pending = createSaleJsonMutationSubmission('sale-discount', { Comment: 'old' }, firstKey)
    const corrected = createSaleJsonMutationSubmission('sale-discount', { Comment: 'corrected' }, secondKey)
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('timeout', 500, null))
      .mockRejectedValueOnce(new ApiError('validation', 400, { MutationLedgerState: 'not-entered' }))
      .mockResolvedValueOnce({ NetUid: 'sale-1' })

    const unknown = await advanceSaleJsonMutationSession({ request, submission: pending })
    const definitive = await advanceSaleJsonMutationSession({ request, submission: pending, wasPending: true })
    const next = await advanceSaleJsonMutationSession({ request, submission: corrected })

    expect(unknown.status).toBe('pending-reconciliation')
    expect(definitive).toEqual({
      error: expect.any(ApiError),
      status: 'definitive-failure',
      submission: null,
    })
    expect(next.status).toBe('acknowledged')
    expect(request.mock.calls.map((call) => call[1]?.operationId)).toEqual([firstKey, firstKey, secondKey])
  })

  it.each([
    ['network failure', new ApiError('offline', 0, null)],
    ['server failure', new ApiError('unavailable', 503, null)],
    ['HTTP timeout', new ApiError('timeout', 408, null)],
    ['transport timeout', new DOMException('timeout', 'TimeoutError')],
  ])('keeps %s pending for exact reconciliation', async (_label, error) => {
    const submission = createSaleJsonMutationSubmission(
      'sale-comment',
      { Comment: 'frozen' },
      '44444444-4444-4444-8444-444444444444',
    )
    const result = await advanceSaleJsonMutationSession({
      request: vi.fn().mockRejectedValue(error),
      submission,
    })

    expect(result).toEqual({
      error,
      status: 'pending-reconciliation',
      submission,
    })
  })
})
