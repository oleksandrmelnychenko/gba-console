import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiRequest,
} from '../../../shared/api/apiClient'
import {
  getTaxFreePackListById,
  getTaxFreePackLists,
  uploadTaxFreeDocuments,
} from './taxFreePackListsApi'
import {
  TAX_FREE_UPLOAD_IDEMPOTENCY_HEADER,
  TAX_FREE_UPLOAD_LEDGER_STATE_HEADER,
} from './taxFreeDocumentUploadOperation'

vi.mock(
  '../../../shared/api/apiClient',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../../shared/api/apiClient')
    >()
    return {
      ...actual,
      apiRequest: vi.fn(),
    }
  },
)

const apiRequestMock = vi.mocked(apiRequest)

describe('taxFreePackListsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gba_console_session',
      JSON.stringify({
        userNetUid:
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    )
  })

  it('loads pack lists from wrapped items payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Items: [
          {
            NetUid: 'pack-list-1',
            TaxFrees: null,
            TaxFreePackListOrderItems: null,
          },
        ],
        Total: 12,
      },
    })

    const result = await getTaxFreePackLists({
      from: '2025-01-01',
      limit: 20,
      offset: 0,
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/taxfree/all/filtered', {
      query: {
        from: '2025-01-01T00:00:00.000',
        limit: 20,
        offset: 0,
        to: '2026-06-08T23:59:59.999',
      },
    })
    expect(result.totalQty).toBe(12)
    expect(result.items).toEqual([
      expect.objectContaining({
        NetUid: 'pack-list-1',
        TaxFrees: [],
        TaxFreePackListOrderItems: [],
      }),
    ])
  })

  it('loads a pack-list detail from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'pack-list-2',
        TaxFrees: null,
      },
    })

    const result = await getTaxFreePackListById('pack-list-2')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/taxfree/get', {
      query: {
        netId: 'pack-list-2',
      },
    })
    expect(result).toEqual(expect.objectContaining({ NetUid: 'pack-list-2', TaxFrees: [] }))
  })

  it('retries an unknown TaxFree upload with the same operation id', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        new Error('connection closed after commit'),
      )
      .mockResolvedValueOnce({
        NetUid:
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      })
    const firstFile = createFile(
      'document.pdf',
      '%PDF-1.7\nsame',
    )

    await expect(
      uploadTaxFreeDocuments(
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        [firstFile],
      ),
    ).rejects.toThrow('connection closed')
    const firstOperationId =
      readOperationId(0)

    await expect(
      uploadTaxFreeDocuments(
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        [
          createFile(
            'document.pdf',
            '%PDF-1.7\nsame',
          ),
        ],
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        NetUid:
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    )

    expect(readOperationId(1))
      .toBe(firstOperationId)
    expect(apiRequestMock)
      .toHaveBeenNthCalledWith(
        2,
        '/supplies/ukraine/order/taxfree/documents/upload',
        expect.objectContaining({
          dedupe: false,
          headers: {
            [TAX_FREE_UPLOAD_IDEMPOTENCY_HEADER]:
              firstOperationId,
          },
          method: 'POST',
          query: {
            netId:
              'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          },
        }),
      )
  })

  it('blocks changed files while an unknown TaxFree upload is pending', async () => {
    apiRequestMock.mockRejectedValue(
      new Error('unknown outcome'),
    )
    const taxFreeNetUid =
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

    await expect(
      uploadTaxFreeDocuments(
        taxFreeNetUid,
        [
          createFile(
            'document.pdf',
            '%PDF-1.7\nfirst',
          ),
        ],
      ),
    ).rejects.toThrow('unknown outcome')

    await expect(
      uploadTaxFreeDocuments(
        taxFreeNetUid,
        [
          createFile(
            'document.pdf',
            '%PDF-1.7\nchanged',
          ),
        ],
      ),
    ).rejects.toThrow(
      'unknown outcome is pending',
    )
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
  })

  it('clears a rolled-back upload before accepting corrected files', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        new ApiError(
          'validation failed',
          400,
          null,
          {
            [TAX_FREE_UPLOAD_LEDGER_STATE_HEADER]:
              'rolled-back',
          },
        ),
      )
      .mockResolvedValueOnce({
        NetUid:
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
    const taxFreeNetUid =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

    await expect(
      uploadTaxFreeDocuments(
        taxFreeNetUid,
        [
          createFile(
            'invalid.pdf',
            '%PDF-1.7\ninvalid',
          ),
        ],
      ),
    ).rejects.toBeInstanceOf(ApiError)
    const firstOperationId =
      readOperationId(0)

    await uploadTaxFreeDocuments(
      taxFreeNetUid,
      [
        createFile(
          'corrected.pdf',
          '%PDF-1.7\ncorrected',
        ),
      ],
    )

    expect(readOperationId(1))
      .not.toBe(firstOperationId)
  })
})

function createFile(
  name: string,
  content: string,
): File {
  return new File(
    [content],
    name,
    { type: 'application/pdf' },
  )
}

function readOperationId(
  callIndex: number,
): string | null {
  return new Headers(
    apiRequestMock.mock.calls[callIndex]?.[1]
      ?.headers,
  ).get(TAX_FREE_UPLOAD_IDEMPOTENCY_HEADER)
}
