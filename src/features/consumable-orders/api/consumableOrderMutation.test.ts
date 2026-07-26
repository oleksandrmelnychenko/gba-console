import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import {
  CONSUMABLE_ORDER_LEDGER_STATE_HEADER,
  CONSUMABLE_ORDER_OWNER_HEADER,
  ConsumableOrderPendingMutationRecoveredError,
  clearPendingConsumableOrderMutation,
  executeConsumableOrderMutation,
} from './consumableOrderMutation'
import type { ConsumablesOrder } from '../types'

const FIRST_OPERATION_ID = '11111111-1111-4111-8111-111111111111'
const SECOND_OPERATION_ID = '22222222-2222-4222-8222-222222222222'

describe('consumable order mutation operation', () => {
  beforeEach(() => {
    clearPendingConsumableOrderMutation(FIRST_OPERATION_ID)
    clearPendingConsumableOrderMutation(SECOND_OPERATION_ID)
    sessionStorage.clear()
    localStorage.clear()
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }))
  })

  it('reuses the operation key and immutable FormData after an unknown outcome', async () => {
    const identity = {}
    const order = createOrder()
    const file = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })
    const requests: Array<{
      body: FormData
      headers: HeadersInit
      operationId: string
    }> = []
    const request = vi.fn(async (context: {
      body: FormData
      headers: HeadersInit
      operationId: string
    }) => {
      requests.push(context)
      if (requests.length === 1) {
        throw new ApiError('unknown', 504, null)
      }
      return { Id: 10 }
    })

    await expect(executeConsumableOrderMutation({
      documents: [file],
      kind: 'add',
      operation: { identity, operationId: FIRST_OPERATION_ID },
      order,
      request,
    })).rejects.toBeInstanceOf(ApiError)
    expect(
      sessionStorage.getItem('gba:consumable-order-mutations:v1'),
    ).toContain(FIRST_OPERATION_ID)

    const result = await executeConsumableOrderMutation({
      documents: [new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })],
      kind: 'add',
      operation: { identity },
      order: structuredClone(order),
      request,
    })

    expect(result).toEqual({ Id: 10 })
    expect(requests).toHaveLength(2)
    expect(requests.map(({ operationId }) => operationId)).toEqual([
      FIRST_OPERATION_ID,
      FIRST_OPERATION_ID,
    ])
    expect(requests.map(({ headers }) => new Headers(headers).get(
      CONSUMABLE_ORDER_OWNER_HEADER,
    ))).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ])
    expect(requests.map(({ body }) => String(body.get('order')))).toEqual([
      String(requests[0].body.get('order')),
      String(requests[0].body.get('order')),
    ])
    expect(await (requests[1].body.get('documents') as File).text()).toBe('invoice')
    expect(sessionStorage.length).toBe(0)
  })

  it.each(['not-entered', 'rolled-back'])(
    'clears a pending key only after a server-proven %s failure',
    async (ledgerState) => {
      const identity = {}
      const operationIds: string[] = []
      const request = vi.fn(async (context: { operationId: string }) => {
        operationIds.push(context.operationId)
        if (operationIds.length === 1) {
          throw new ApiError('definitive', 409, null, {
            [CONSUMABLE_ORDER_LEDGER_STATE_HEADER]: ledgerState,
          })
        }
        return { Id: 10 }
      })

      await expect(executeConsumableOrderMutation({
        documents: [],
        kind: 'update',
        operation: { identity, operationId: FIRST_OPERATION_ID },
        order: createOrder(),
        request,
      })).rejects.toBeInstanceOf(ApiError)

      await executeConsumableOrderMutation({
        documents: [],
        kind: 'update',
        operation: { identity, operationId: SECOND_OPERATION_ID },
        order: { ...createOrder(), Comment: 'changed after rollback' },
        request,
      })

      expect(operationIds).toEqual([FIRST_OPERATION_ID, SECOND_OPERATION_ID])
    },
  )

  it('recovers an unmarked prior request before allowing a changed payload', async () => {
    const identity = {}
    const request = vi.fn()
      .mockRejectedValueOnce(new ApiError('unmarked conflict', 409, null))
      .mockResolvedValueOnce({ Id: 9 })
      .mockResolvedValueOnce({ Id: 10 })

    await expect(executeConsumableOrderMutation({
      documents: [],
      kind: 'update',
      operation: { identity, operationId: FIRST_OPERATION_ID },
      order: createOrder(),
      request,
    })).rejects.toBeInstanceOf(ApiError)

    await expect(executeConsumableOrderMutation({
      documents: [],
      kind: 'update',
      operation: { identity },
      order: { ...createOrder(), Comment: 'changed' },
      request,
    })).rejects.toBeInstanceOf(ConsumableOrderPendingMutationRecoveredError)

    const recoveredPayload = JSON.parse(
      String((request.mock.calls[1][0] as { body: FormData }).body.get('order')),
    ) as ConsumablesOrder
    expect(recoveredPayload.Comment).toBe('immutable')

    await expect(executeConsumableOrderMutation({
      documents: [],
      kind: 'update',
      operation: { identity, operationId: SECOND_OPERATION_ID },
      order: { ...createOrder(), Comment: 'changed' },
      request,
    })).resolves.toEqual({ Id: 10 })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('rejects reuse of one key by a different user and payload', async () => {
    const request = vi.fn().mockRejectedValue(
      new ApiError('unknown', 504, null),
    )

    await expect(executeConsumableOrderMutation({
      documents: [],
      kind: 'update',
      operation: { operationId: FIRST_OPERATION_ID },
      order: createOrder(),
      request,
    })).rejects.toBeInstanceOf(ApiError)

    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }))

    await expect(executeConsumableOrderMutation({
      documents: [],
      kind: 'update',
      operation: { operationId: FIRST_OPERATION_ID },
      order: { ...createOrder(), Comment: 'other owner' },
      request,
    })).rejects.toThrow('different immutable payload or owner')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('shares one request for concurrent identical submissions', async () => {
    let resolveRequest!: (value: { Id: number }) => void
    const response = new Promise<{ Id: number }>((resolve) => {
      resolveRequest = resolve
    })
    const request = vi.fn(() => response)
    const identity = {}
    const options = {
      documents: [] as File[],
      kind: 'add' as const,
      operation: { identity, operationId: FIRST_OPERATION_ID },
      order: createOrder(),
      request,
    }

    const first = executeConsumableOrderMutation(options)
    const second = executeConsumableOrderMutation(options)
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    resolveRequest({ Id: 10 })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { Id: 10 },
      { Id: 10 },
    ])
  })

  it('rejects duplicate and unsupported files before issuing a request', async () => {
    const request = vi.fn()
    const duplicateFiles = [
      new File(['one'], 'invoice.pdf', { type: 'application/pdf' }),
      new File(['two'], 'INVOICE.PDF', { type: 'application/pdf' }),
    ]

    await expect(executeConsumableOrderMutation({
      documents: duplicateFiles,
      kind: 'add',
      order: createOrder(),
      request,
    })).rejects.toThrow('filenames must be unique')
    await expect(executeConsumableOrderMutation({
      documents: [new File(['script'], 'invoice.exe')],
      kind: 'add',
      order: createOrder(),
      request,
    })).rejects.toThrow('extension is not allowed')
    expect(request).not.toHaveBeenCalled()
  })
})

function createOrder(): ConsumablesOrder {
  return {
    Id: 9,
    NetUid: '99999999-9999-4999-8999-999999999999',
    Comment: 'immutable',
  }
}
