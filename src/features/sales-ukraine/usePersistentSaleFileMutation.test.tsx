import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  createSaleFileMutationSubmission,
  getLegacySaleFileMutationContext,
  getSaleFileMutationContext,
  getSaleFileMutationJournalContext,
  persistSaleFileMutationSubmission,
  SALE_FILE_MUTATION_INTENTS,
  SALE_FILE_MUTATION_SURFACES,
} from './saleFileMutation'
import {
  persistSaleFileMutationRecord,
  usePersistentSaleFileMutation,
} from './usePersistentSaleFileMutation'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

const saleIdentity = { NetUid: 'sale-1' }
const context = getSaleFileMutationContext(saleIdentity)
const scope: SalesPendingMutationScope = {
  context,
  kind: 'sale-update-file',
  userKey: 'net:user-a',
}
const legacyScope: SalesPendingMutationScope = {
  ...scope,
  context: getLegacySaleFileMutationContext(saleIdentity),
}
const managementOperation = {
  intent: 'save',
  surface: SALE_FILE_MUTATION_SURFACES.management,
} as const

beforeEach(() => {
  clearAllSalesPendingMutations()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
  clearAllSalesPendingMutations()
})

describe('usePersistentSaleFileMutation', () => {
  it('resumes a reloaded file mutation with the same digest, body, and operation key', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const sourceFile = new File(['same bytes'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { Comment: 'frozen', NetUid: 'sale-1' },
      sourceFile,
      operationId,
    )
    saveSalesPendingMutation(
      scope,
      operationId,
      persistSaleFileMutationRecord(submission, managementOperation),
    )
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('response lost', 500, null))
      .mockResolvedValueOnce({ sale: { NetUid: 'sale-1' } })
    const { result } = renderHook(() => usePersistentSaleFileMutation(context))

    await waitFor(() => expect(result.current.blocked).toBe(true))

    const reselected = new File(['same bytes'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })

    await act(async () => {
      await result.current.reconcile(
        'sale-update-file',
        reselected,
        request,
      )
    })

    const pending = loadSalesPendingMutation(scope)

    expect(pending?.payload).toMatchObject({
      hasFile: true,
      intent: 'save',
      kind: 'sale-update-file',
      operationId,
      surface: SALE_FILE_MUTATION_SURFACES.management,
    })
    expect(pending?.payload).not.toHaveProperty('submission')

    await act(async () => {
      await result.current.reconcile(
        'sale-update-file',
        new File(['different bytes'], 'other.pdf', { lastModified: 999, type: 'application/pdf' }),
        request,
      )
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0]).toEqual(submission.payload)
    expect(request.mock.calls[1]?.[0]).toEqual(submission.payload)
    expect(request.mock.calls[0]?.[2]).toEqual({ operationId })
    expect(request.mock.calls[1]?.[2]).toEqual({ operationId })
    expect(request.mock.calls[1]?.[1]).toBe(request.mock.calls[0]?.[1])
    expect(result.current.blocked).toBe(false)
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('keeps a reloaded operation blocked when a different file is selected', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { NetUid: 'sale-1' },
      new File(['expected'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' }),
      operationId,
    )
    saveSalesPendingMutation(
      scope,
      operationId,
      persistSaleFileMutationRecord(submission, managementOperation),
    )
    const request = vi.fn()
    const { result } = renderHook(() => usePersistentSaleFileMutation(context))

    await waitFor(() => expect(result.current.blocked).toBe(true))

    let caught: unknown
    await act(async () => {
      try {
        await result.current.reconcile(
          'sale-update-file',
          new File(['tampered'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' }),
          request,
        )
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain('SHA-256')
    expect(request).not.toHaveBeenCalled()
    expect(result.current.blocked).toBe(true)
  })

  it('replays an intent-less legacy management retry without rewriting its frozen journal', async () => {
    const operationId = '77777777-7777-4777-8777-777777777777'
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { Comment: 'legacy generic save', NetUid: 'sale-1' },
      null,
      operationId,
    )
    saveSalesPendingMutation(
      legacyScope,
      operationId,
      persistSaleFileMutationSubmission(submission),
    )
    const request = vi.fn().mockRejectedValue(new ApiError('response lost', 500, null))
    const { result } = renderHook(() => usePersistentSaleFileMutation(context))

    await waitFor(() => expect(result.current.pendingError).not.toBe(null))

    await act(async () => {
      await result.current.reconcile(
        'sale-update-file',
        null,
        request,
      )
    })

    expect(request).toHaveBeenCalledWith(
      submission.payload,
      null,
      { operationId },
    )
    const retained = loadSalesPendingMutation(legacyScope)?.payload

    expect(retained).toMatchObject({ operationId })
    expect(retained).not.toHaveProperty('intent')
    expect(retained).not.toHaveProperty('surface')
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('fails closed instead of replaying a legacy wizard operation from a management surface', async () => {
    const operationId = '88888888-8888-4888-8888-888888888888'
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { Comment: 'wizard submit', NetUid: 'sale-1' },
      null,
      operationId,
    )
    saveSalesPendingMutation(legacyScope, operationId, {
      ...persistSaleFileMutationSubmission(submission),
      intent: 'submit',
    })
    const request = vi.fn()
    const { result } = renderHook(() => usePersistentSaleFileMutation(context))

    await waitFor(() => expect(result.current.blocked).toBe(true))

    await expect(act(async () => {
      await result.current.reconcile('sale-update-file', null, request)
    })).rejects.toThrow('іншій дії')

    expect(request).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(legacyScope)?.operationId).toBe(operationId)
  })

  it('keeps a blocked file marker until explicit reconciliation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const operationId = '33333333-3333-4333-8333-333333333333'

    saveSalesPendingMutation(
      scope,
      operationId,
      {
        fileMetadata: {
          lastModified: 123,
          name: 'ttn.pdf',
          sha256: 'a'.repeat(64),
          size: 8,
          type: 'application/pdf',
        },
        hasFile: true,
        intent: 'save',
        kind: 'sale-update-file',
        operationId,
        payload: { NetUid: 'sale-1', OperationNetUid: operationId },
        surface: SALE_FILE_MUTATION_SURFACES.management,
      },
      { now: 1_000, ttlMs: 50 },
    )

    const { result } = renderHook(() => usePersistentSaleFileMutation(context))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.blocked).toBe(true)

    act(() => {
      vi.advanceTimersByTime(51)
    })

    expect(result.current.blocked).toBe(true)
    expect(result.current.pendingError).toContain('SHA-256')
  })

  it('does not retain a stale payload when initial persistence fails before sending', async () => {
    const request = vi.fn()
    const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    const values = new Map<string, string>()
    let failNextWrite = true
    const unavailableStorage = {
      clear: vi.fn(() => values.clear()),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => {
        if (failNextWrite) {
          failNextWrite = false
          throw new DOMException('quota exceeded', 'QuotaExceededError')
        }

        values.set(key, value)
      }),
    } satisfies Storage
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: unavailableStorage })
    const { result } = renderHook(() => usePersistentSaleFileMutation(context))
    let caught: unknown

    await act(async () => {
      try {
        await result.current.run('sale-update-file', { NetUid: 'sale-1' }, null, request)
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain('Запит не надіслано')
    expect(request).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.run(
        'sale-update-file',
        { Comment: 'corrected after storage recovery', NetUid: 'sale-1' },
        null,
        request.mockResolvedValue({ sale: { NetUid: 'sale-1' } }),
      )
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[0]).toMatchObject({ Comment: 'corrected after storage recovery' })

    if (descriptor) {
      Object.defineProperty(window, 'sessionStorage', descriptor)
    }
  })

  it('keeps delivery save and invoice conversion in distinct journals', async () => {
    const deliveryIntent = SALE_FILE_MUTATION_INTENTS.deliverySave
    const invoiceIntent = SALE_FILE_MUTATION_INTENTS.invoiceConversion
    const deliveryScope: SalesPendingMutationScope = {
      ...scope,
      context: getSaleFileMutationJournalContext(context, deliveryIntent),
    }
    const invoiceScope: SalesPendingMutationScope = {
      ...scope,
      context: getSaleFileMutationJournalContext(context, invoiceIntent),
    }
    const deliveryRequest = vi.fn().mockRejectedValue(new ApiError('delivery response lost', 500, null))
    const invoiceRequest = vi.fn().mockResolvedValue({ sale: { NetUid: 'sale-1' } })
    const deliveryHook = renderHook(() => usePersistentSaleFileMutation(context, deliveryIntent))
    const invoiceHook = renderHook(() => usePersistentSaleFileMutation(context, invoiceIntent))

    await act(async () => {
      await deliveryHook.result.current.run(
        'sale-update-file',
        { Comment: 'delivery', NetUid: 'sale-1' },
        null,
        deliveryRequest,
      )
    })
    await act(async () => {
      await invoiceHook.result.current.run(
        'sale-update-file',
        { Comment: 'invoice', NetUid: 'sale-1' },
        null,
        invoiceRequest,
      )
    })

    expect(loadSalesPendingMutation(deliveryScope)?.payload).toMatchObject({
      intent: deliveryIntent,
      surface: SALE_FILE_MUTATION_SURFACES.management,
    })
    expect(loadSalesPendingMutation(invoiceScope)).toBe(null)
    expect(deliveryRequest).toHaveBeenCalledTimes(1)
    expect(invoiceRequest).toHaveBeenCalledTimes(1)
  })

  it('settles a marked pre-ledger rejection and immediately allows corrected data under a new key', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('invalid sale', 400, { MutationLedgerState: 'not-entered' }))
      .mockResolvedValueOnce({ sale: { NetUid: 'sale-1' } })
    const { result } = renderHook(() => usePersistentSaleFileMutation(context))

    await act(async () => {
      await result.current.run(
        'sale-update-file',
        { Comment: 'invalid', NetUid: 'sale-1' },
        null,
        request,
      )
    })

    expect(loadSalesPendingMutation(scope)).toBe(null)
    expect(request).toHaveBeenCalledTimes(1)
    expect(result.current.reconciliationRequired).toBe(false)

    await act(async () => {
      await result.current.run(
        'sale-update-file',
        { Comment: 'corrected', NetUid: 'sale-1' },
        null,
        request,
      )
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0]).toMatchObject({ Comment: 'invalid' })
    expect(request.mock.calls[1]?.[0]).toMatchObject({ Comment: 'corrected' })
    expect(request.mock.calls[1]?.[2].operationId).not.toBe(request.mock.calls[0]?.[2].operationId)
  })
})
