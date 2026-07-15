import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import {
  SALES_MUTATION_LEDGER_NOT_ENTERED,
  SALES_MUTATION_LEDGER_STATE_HEADER,
} from '../salesMutationOperation'
import { createSale, updateSaleFromData } from './salesUkraineApi'

describe('createSale operation contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the same canonical OperationNetUid in the JSON body and Idempotency-Key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{"Body":{"NetUid":"created-sale"}}'),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createSale(
        { NetUid: '00000000-0000-0000-0000-000000000000' },
        { operationId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' },
      ),
    ).resolves.toEqual({ message: null, sale: { NetUid: 'created-sale' } })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(init.body as string) as { OperationNetUid?: string }
    const headers = new Headers(init.headers)

    expect(body.OperationNetUid).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(body.OperationNetUid).toBe(headers.get('Idempotency-Key'))
  })

  it('sends the update-file operation marker inside sale JSON and the same header', async () => {
    const operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{"Body":{"NetUid":"sale-1"}}'),
    })
    vi.stubGlobal('fetch', fetchMock)

    await updateSaleFromData({ NetUid: 'sale-1' }, null, { operationId })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const form = init.body as FormData
    const body = JSON.parse(String(form.get('sale'))) as { OperationNetUid?: string }

    expect(body.OperationNetUid).toBe(operationId)
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(operationId)
  })

  it('preserves a server mutation-ledger response marker on ApiError', async () => {
    const responseHeaders = new Headers({
      [SALES_MUTATION_LEDGER_STATE_HEADER]: SALES_MUTATION_LEDGER_NOT_ENTERED,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      headers: responseHeaders,
      ok: false,
      status: 409,
      text: vi.fn().mockResolvedValue('{"Message":"conflict"}'),
    }))

    const request = createSale(
      { NetUid: '00000000-0000-0000-0000-000000000000' },
      { operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    )

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await request.catch((error: unknown) => {
      expect((error as ApiError).headers.get(SALES_MUTATION_LEDGER_STATE_HEADER))
        .toBe(SALES_MUTATION_LEDGER_NOT_ENTERED)
    })
  })
})
