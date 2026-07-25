import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  classifyRetailPaymentImageMutationFailure,
  ensurePaymentImageReplayFileMatches,
  isDefinitiveRetailPaymentImageConcurrencyConflict,
  isRetailPaymentImageConcurrencyConflict,
  PaymentImageReplayFileMismatchError,
} from './paymentImageMutation'

describe('paymentImageMutation', () => {
  it('classifies a concurrency conflict as definitive and reloadable', () => {
    const conflict = new ApiError(
      'conflict',
      409,
      null,
      { 'X-Mutation-Ledger-State': 'not-entered' },
    )

    expect(
      classifyRetailPaymentImageMutationFailure(conflict),
    ).toBe('definitive-failure')
    expect(
      isRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(true)
    expect(
      isDefinitiveRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(true)
  })

  it('keeps infrastructure failures pending reconciliation', () => {
    const unavailable = new ApiError(
      'unavailable',
      503,
      null,
    )

    expect(
      classifyRetailPaymentImageMutationFailure(unavailable),
    ).toBe('pending-reconciliation')
    expect(
      isRetailPaymentImageConcurrencyConflict(unavailable),
    ).toBe(false)
  })

  it('keeps request timeouts pending when the server did not prove rollback', () => {
    const timeout = new ApiError(
      'timeout',
      408,
      null,
    )

    expect(
      classifyRetailPaymentImageMutationFailure(timeout),
    ).toBe('pending-reconciliation')
  })

  it('keeps an unproven 409 open for reconciliation', () => {
    const conflict = new ApiError(
      'conflict',
      409,
      null,
    )

    expect(
      isRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(true)
    expect(
      isDefinitiveRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(false)
  })

  it('allows replay only with the same file bytes and extension', () => {
    const persisted = {
      lastModified: 1,
      name: 'payment.JPG',
      sha256: 'abc',
      size: 42,
      type: 'image/jpeg',
    }

    expect(() =>
      ensurePaymentImageReplayFileMatches(persisted, {
        ...persisted,
        lastModified: 2,
        name: 'renamed.jpg',
      }),
    ).not.toThrow()

    expect(() =>
      ensurePaymentImageReplayFileMatches(persisted, {
        ...persisted,
        name: 'payment.png',
      }),
    ).toThrow(PaymentImageReplayFileMismatchError)

    expect(() =>
      ensurePaymentImageReplayFileMatches(persisted, {
        ...persisted,
        sha256: 'different',
      }),
    ).toThrow(PaymentImageReplayFileMismatchError)
  })
})
