import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient'
import {
  executeSadMutation,
  SAD_IDEMPOTENCY_HEADER,
  SAD_LEDGER_STATE_HEADER,
} from './sadMutationOperation'

const OWNER =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('sadMutationOperation', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'gba_console_session',
      JSON.stringify({ userNetUid: OWNER }),
    )
  })

  it('replays an unknown outcome with the same operation id', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(
        new Error('connection closed after commit'),
      )
      .mockResolvedValueOnce({ Id: 42 })
    const sad = {
      Comment: 'immutable',
      Id: 0,
      SadItems: [{ Qty: 2 }],
    }

    await expect(executeSadMutation({
      request,
      sad,
    })).rejects.toThrow('connection closed')
    const firstOperationId = readOperationId(
      request.mock.calls[0]?.[1]?.headers,
    )

    await expect(executeSadMutation({
      request,
      sad: structuredClone(sad),
    })).resolves.toEqual({ Id: 42 })
    const replayOperationId = readOperationId(
      request.mock.calls[1]?.[1]?.headers,
    )

    expect(replayOperationId).toBe(firstOperationId)
    expect(localStorageKeys()).toEqual([
      'gba_console_session',
    ])
  })

  it('blocks a different create while an unknown outcome is pending', async () => {
    const request = vi.fn().mockRejectedValue(
      new Error('unknown outcome'),
    )

    await expect(executeSadMutation({
      request,
      sad: {
        Comment: 'first',
        Id: 0,
      },
    })).rejects.toThrow('unknown outcome')

    await expect(executeSadMutation({
      request,
      sad: {
        Comment: 'second',
        Id: 0,
      },
    })).rejects.toThrow(
      'unknown outcome is pending',
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('clears a rolled-back operation before a different retry', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(
        new ApiError(
          'validation failed',
          400,
          null,
          {
            [SAD_LEDGER_STATE_HEADER]:
              'rolled-back',
          },
        ),
      )
      .mockResolvedValueOnce({ Id: 43 })

    await expect(executeSadMutation({
      request,
      sad: {
        Comment: 'invalid',
        Id: 0,
      },
    })).rejects.toBeInstanceOf(ApiError)
    const firstOperationId = readOperationId(
      request.mock.calls[0]?.[1]?.headers,
    )

    await executeSadMutation({
      request,
      sad: {
        Comment: 'corrected',
        Id: 0,
      },
    })
    const secondOperationId = readOperationId(
      request.mock.calls[1]?.[1]?.headers,
    )

    expect(secondOperationId).not.toBe(firstOperationId)
  })

  it('does not attach a create key to an existing SAD update', async () => {
    const request = vi.fn().mockResolvedValue({
      Id: 7,
    })

    await executeSadMutation({
      request,
      sad: {
        Comment: 'update',
        Id: 7,
      },
    })

    expect(request).toHaveBeenCalledWith(
      {
        Comment: 'update',
        Id: 7,
      },
      {
        isCreate: false,
      },
    )
  })
})

function readOperationId(
  headers: HeadersInit | undefined,
): string | null {
  return new Headers(headers).get(
    SAD_IDEMPOTENCY_HEADER,
  )
}

function localStorageKeys(): string[] {
  return Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index),
  )
    .filter((key): key is string => Boolean(key))
    .sort()
}
