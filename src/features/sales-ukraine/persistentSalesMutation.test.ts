import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPersistentSalesMutationScope,
  runPersistentSalesMutation,
  SalesPendingMutationRecoveredError,
} from './persistentSalesMutation'
import { saveSalesPendingMutation } from './pendingSalesMutationRegistry'

const operationIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]

vi.mock(
  './components/new-sale-wizard/wizardMutationOperation',
  () => ({
    createWizardOperationId: vi.fn(() => operationIds.shift()),
  }),
)

describe('persistentSalesMutation', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    operationIds.splice(
      0,
      operationIds.length,
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    )
  })

  it('reuses the same payload and operation after an unknown outcome', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce('ok')
    const args = {
      context: 'return:create',
      kind: 'sale-return-create' as const,
      payload: { ClientId: 7, Qty: 2 },
      request,
      userKey: 'net:user-1',
    }

    await expect(runPersistentSalesMutation(args)).rejects.toThrow('network')
    await expect(runPersistentSalesMutation(args)).resolves.toBe('ok')

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0][1].operationId).toBe(
      request.mock.calls[1][1].operationId,
    )
    expect(request.mock.calls[1][0]).toEqual(args.payload)
  })

  it('recovers the prior payload before allowing a changed mutation', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce('recovered')
      .mockResolvedValueOnce('current')

    await expect(
      runPersistentSalesMutation({
        context: 'return:create',
        kind: 'sale-return-create',
        payload: { ClientId: 7, Qty: 2 },
        request,
        userKey: 'net:user-1',
      }),
    ).rejects.toThrow('network')

    await expect(
      runPersistentSalesMutation({
        context: 'return:create',
        kind: 'sale-return-create',
        payload: { ClientId: 7, Qty: 3 },
        request,
        userKey: 'net:user-1',
      }),
    ).rejects.toBeInstanceOf(SalesPendingMutationRecoveredError)

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1][0]).toEqual({
      ClientId: 7,
      Qty: 2,
    })
    expect(request.mock.calls[1][1].operationId).toBe(
      request.mock.calls[0][1].operationId,
    )

    await expect(
      runPersistentSalesMutation({
        context: 'return:create',
        kind: 'sale-return-create',
        payload: { ClientId: 7, Qty: 3 },
        request,
        userKey: 'net:user-1',
      }),
    ).resolves.toBe('current')

    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls[2][1].operationId).not.toBe(
      request.mock.calls[0][1].operationId,
    )
  })

  it('replaces a never-submitted prepared payload with the current request', async () => {
    const oldOperationId =
      '33333333-3333-4333-8333-333333333333'
    const scope = createPersistentSalesMutationScope(
      'sale-return-create',
      'return:create',
      'net:user-1',
    )
    saveSalesPendingMutation(scope, oldOperationId, {
      context: scope.context,
      kind: 'sale-return-create',
      operationId: oldOperationId,
      payload: { ClientId: 7, Qty: 2 },
      version: 1,
    })
    const request = vi.fn().mockResolvedValue('current')

    await expect(
      runPersistentSalesMutation({
        context: 'return:create',
        kind: 'sale-return-create',
        payload: { ClientId: 7, Qty: 3 },
        request,
        userKey: 'net:user-1',
      }),
    ).resolves.toBe('current')

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toEqual({
      ClientId: 7,
      Qty: 3,
    })
    expect(request.mock.calls[0][1].operationId).not.toBe(
      oldOperationId,
    )
  })

  it('uses a new operation after a definitive pre-ledger rejection', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('rejected'))
      .mockResolvedValueOnce('ok')
    const args = {
      classifyFailure: () => 'definitive-failure' as const,
      context: 'return:create',
      kind: 'sale-return-create' as const,
      payload: { ClientId: 7, Qty: 2 },
      request,
      userKey: 'net:user-1',
    }

    await expect(runPersistentSalesMutation(args)).rejects.toThrow(
      'rejected',
    )
    await expect(runPersistentSalesMutation(args)).resolves.toBe('ok')

    expect(request.mock.calls[0][1].operationId).not.toBe(
      request.mock.calls[1][1].operationId,
    )
  })
})
