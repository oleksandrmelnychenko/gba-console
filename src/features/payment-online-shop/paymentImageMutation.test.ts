import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  classifyRetailPaymentImageMutationFailure,
  ensurePaymentImageReplayFileMatches,
  getRetailPaymentImageConcurrencyCode,
  isDefinitiveRetailPaymentImageConcurrencyConflict,
  isRetailPaymentImageConcurrencyConflict,
  PaymentImageReplayFileMismatchError,
  RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT,
  RETAIL_PAYMENT_STATUS_VERSION_CONFLICT,
} from './paymentImageMutation'

describe('paymentImageMutation', () => {
  it('classifies a concurrency conflict as definitive and reloadable', () => {
    const conflict = new ApiError(
      'conflict',
      409,
      { ErrorCode: RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT },
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
    expect(getRetailPaymentImageConcurrencyCode(conflict)).toBe(
      RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT,
    )
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

  it('does not treat an unrelated 409 as a reloadable version conflict', () => {
    const conflict = new ApiError(
      'conflict',
      409,
      null,
    )

    expect(
      isRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(false)
    expect(
      isDefinitiveRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(false)
  })

  it('distinguishes a parent payment status conflict', () => {
    const conflict = new ApiError(
      'status changed',
      409,
      { ErrorCode: RETAIL_PAYMENT_STATUS_VERSION_CONFLICT },
      { 'X-Mutation-Ledger-State': 'rolled-back' },
    )

    expect(getRetailPaymentImageConcurrencyCode(conflict)).toBe(
      RETAIL_PAYMENT_STATUS_VERSION_CONFLICT,
    )
    expect(
      isDefinitiveRetailPaymentImageConcurrencyConflict(conflict),
    ).toBe(true)
  })

  it('supports the old safe message only during a rolling deployment', () => {
    const conflict = new ApiError(
      'The payment image item changed. Reload it before retrying.',
      409,
      null,
      { 'X-Mutation-Ledger-State': 'not-entered' },
    )

    expect(getRetailPaymentImageConcurrencyCode(conflict)).toBe(
      RETAIL_PAYMENT_IMAGE_ITEM_VERSION_CONFLICT,
    )
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
