import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import {
  addResale,
  exportResaleAvailabilities,
  getResaleByNetId,
  getResaleAvailabilityFilterOptions,
  getResaleClientAgreements,
  recalculateResale,
  updateResale,
} from './resalesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))
vi.mock('../../../shared/auth/session', () => ({
  readSession: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const readSessionMock = vi.mocked(readSession)
const firstOwnerNetUid =
  'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
const secondOwnerNetUid =
  'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB'
const firstOperationNetUid =
  '11111111-1111-4111-8111-111111111111'
const secondOperationNetUid =
  '22222222-2222-4222-8222-222222222222'
const randomUUIDMock =
  vi.fn<
    () =>
      `${string}-${string}-${string}-${string}-${string}`
  >()
const digestMock =
  vi.fn<SubtleCrypto['digest']>()
const digestIdentities =
  new Map<string, number>()
let operationSequence = 0

describe('resales API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    readSessionMock.mockReturnValue({
      userNetUid: firstOwnerNetUid,
    })
    randomUUIDMock.mockReset()
    operationSequence = 0
    randomUUIDMock.mockImplementation(() => {
      operationSequence += 1
      if (operationSequence === 1) {
        return firstOperationNetUid
      }
      if (operationSequence === 2) {
        return secondOperationNetUid
      }

      return `00000000-0000-4000-8000-${String(operationSequence).padStart(12, '0')}`
    })
    digestIdentities.clear()
    digestMock.mockReset()
    digestMock.mockImplementation(
      async (_, data) => {
        const bytes =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new Uint8Array(
              data.buffer,
              data.byteOffset,
              data.byteLength,
            )
        const identity =
          new TextDecoder().decode(bytes)
        let digestIdentity =
          digestIdentities.get(identity)

        if (!digestIdentity) {
          digestIdentity =
            digestIdentities.size + 1
          digestIdentities.set(
            identity,
            digestIdentity,
          )
        }

        const digest = new Uint8Array(32)
        new DataView(digest.buffer)
          .setUint32(28, digestIdentity)
        return digest.buffer
      },
    )
    window.localStorage.clear()
    vi.stubGlobal('crypto', {
      subtle: {
        digest: digestMock,
      },
      randomUUID: randomUUIDMock,
    } as unknown as Crypto)
  })

  it('opens resale details without accepting an editable model payload', async () => {
    const netId = '41bb91ef-9828-420e-940c-aa25a5009b10'
    const detail = {
      ReSale: {
        NetUid: netId,
      },
      ReSaleItemModels: [],
    }

    apiRequestMock.mockResolvedValueOnce(detail)

    await expect(getResaleByNetId(netId)).resolves.toEqual({ data: detail })
    expect(apiRequestMock).toHaveBeenCalledWith('/resales/permissions/details', {
      method: 'POST',
      query: {
        netId,
      },
    })
  })

  it('preserves the populated model when recalculating resale details', async () => {
    const netId = '41bb91ef-9828-420e-940c-aa25a5009b10'
    const detail = {
      ReSale: {
        Comment: 'Updated comment',
        NetUid: netId,
      },
      ReSaleItemModels: [],
    }

    apiRequestMock.mockResolvedValueOnce(detail)

    await expect(recalculateResale(netId, detail)).resolves.toEqual({ data: detail })
    expect(apiRequestMock).toHaveBeenCalledWith('/resales/permissions/edit/recalculate', {
      body: detail,
      method: 'POST',
      query: {
        netId,
      },
    })
  })

  it('exports resale availability documents with PDF-first aliases preserved', async () => {
    const payload = {
      Amount: 0,
      ExtraChargePercent: 0,
      From: '2026-07-07T12:00:00',
      IncludedProductGroups: [1, 2],
      IncludedSpecificationCodes: ['3403199090'],
      IncludedStorages: [3],
      PossibleAmountDistinct: 0,
      Search: 'SEM',
      To: '2026-07-07T23:59:59',
    }

    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/resale.pdf',
      XlsxDocument: 'https://example.test/resale.xlsx',
    })

    await expect(exportResaleAvailabilities(payload)).resolves.toEqual({
      DocumentURL: 'https://example.test/resale.xlsx',
      PdfDocumentURL: 'https://example.test/resale.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/resales/permissions/create/export', {
      body: payload,
      method: 'POST',
    })
  })

  it('falls back to resale-enabled storages when availability filters return none', async () => {
    const resaleStorage = {
      AvailableForReSale: true,
      Id: 3,
      Name: 'СКЛАД -3',
      NetUid: 'storage-3',
    }
    const legacyResaleStorage = {
      Id: 4,
      IsResale: true,
      Name: 'Склад перепродажу',
      NetUid: 'storage-4',
    }

    apiRequestMock
      .mockResolvedValueOnce({
        ProductGroups: [],
        SpecificationCodes: ['8708999798'],
        Storages: [],
      })
      .mockResolvedValueOnce([
        {
          AvailableForReSale: false,
          Id: 1,
          Name: 'Автопарк',
          NetUid: 'storage-1',
        },
        resaleStorage,
        legacyResaleStorage,
        {
          AvailableForReSale: true,
          Deleted: true,
          Id: 5,
          Name: 'Видалений склад',
          NetUid: 'storage-5',
        },
      ])

    await expect(getResaleAvailabilityFilterOptions()).resolves.toEqual({
      ProductGroups: [],
      SpecificationCodes: ['8708999798'],
      Storages: [resaleStorage, legacyResaleStorage],
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/resales/permissions/create/filter/options')
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/storages/get/all')
  })

  it('loads selected client agreements without debt aggregates', async () => {
    const controller = new AbortController()
    const agreement = {
      Id: 361078,
      NetUid: 'bfb9f4ab-7868-45af-8cde-ab9ee74a68b1',
      Agreement: {
        ForReSale: true,
        IsActive: true,
        OrganizationId: 365,
      },
    }

    apiRequestMock.mockResolvedValueOnce({ Items: [agreement] })

    await expect(getResaleClientAgreements('client-net-id', controller.signal)).resolves.toEqual([agreement])
    expect(apiRequestMock).toHaveBeenCalledWith('/agreements/client/all', {
      query: {
        includeDebts: false,
        netId: 'client-net-id',
      },
      signal: controller.signal,
    })
  })

  it('preserves add validation details from a non-200 response', async () => {
    const warning = {
      Message: 'Unavailable products',
      Products: [{ ProductId: 42, AvailableQty: 3 }],
    }
    apiRequestMock.mockRejectedValueOnce({
      payload: { Body: warning },
      status: 400,
    })

    await expect(
      addResale({} as Parameters<typeof addResale>[0]),
    ).resolves.toEqual({ warning })
    expect(window.localStorage).toHaveLength(0)
  })

  it('deduplicates identical owner and payload calls while the request is in flight', async () => {
    let resolveRequest:
      ((value: unknown) => void) | undefined
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRequest = resolve
        }),
    )
    const payload = createResalePayload()

    const first = addResale(payload)
    const duplicate =
      addResale(structuredClone(payload))

    expect(duplicate).toBe(first)
    await vi.waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect(readIdempotencyKey(0))
      .toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(digestMock).toHaveBeenCalledTimes(1)

    resolveRequest?.({
      Id: 90,
      NetUid:
        '55555555-5555-4555-8555-555555555555',
    })
    await first
    expect(window.localStorage).toHaveLength(0)
  })

  it.each([0, 408, 500, 504])(
    'retains the durable add operation after unknown status %s',
    async (status) => {
      const requestError = {
        payload: null,
        status,
      }
      apiRequestMock.mockRejectedValueOnce(requestError)

      await expect(
        addResale(createResalePayload()),
      ).rejects.toBe(requestError)

      expect(window.localStorage).toHaveLength(1)
    },
  )

  it('retries an unknown add with the persisted key and immutable payload', async () => {
    const payload = createResalePayload()
    const originalPayload =
      structuredClone(payload)
    const timeout = {
      payload: null,
      status: 504,
    }
    apiRequestMock.mockRejectedValueOnce(timeout)

    const firstRequest = addResale(payload)
    payload.Comment = 'mutated while hashing'
    payload.ReSaleAvailabilityModels[0]
      .QtyToReSale = 999

    await expect(firstRequest).rejects.toBe(timeout)

    const firstOptions = apiRequestMock.mock.calls[0]?.[1]
    const firstKey = (
      firstOptions?.headers as Record<string, string>
    )['Idempotency-Key']
    expect(firstKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(firstOptions).toMatchObject({
      body: originalPayload,
      headers: {
        'Idempotency-Key': firstKey,
        'X-ReSale-Add-Owner':
          firstOwnerNetUid.toLowerCase(),
      },
      method: 'POST',
      query: {
        operationNetUid: firstKey,
      },
    })
    expect(window.localStorage).toHaveLength(1)

    apiRequestMock.mockResolvedValueOnce({
      Id: 91,
      NetUid: '656db5c3-f122-4d92-8d69-c1ecb1bcc94e',
    })

    await expect(
      addResale(structuredClone(originalPayload)),
    ).resolves.toEqual({
      data: {
        Id: 91,
        NetUid: '656db5c3-f122-4d92-8d69-c1ecb1bcc94e',
      },
    })

    const secondOptions = apiRequestMock.mock.calls[1]?.[1]
    expect(secondOptions).toMatchObject({
      body: originalPayload,
      headers: {
        'Idempotency-Key': firstKey,
        'X-ReSale-Add-Owner':
          firstOwnerNetUid.toLowerCase(),
      },
      method: 'POST',
      query: {
        operationNetUid: firstKey,
      },
    })
    expect(window.localStorage).toHaveLength(0)
  })

  it('clears a deterministic ledger conflict and uses a new key on recovery', async () => {
    const conflict = {
      headers: new Headers({
        'X-ReSale-Add-Ledger-State': 'unknown',
      }),
      payload: {
        Body: {
          Message: 'Idempotency key conflict',
        },
      },
      status: 409,
    }
    apiRequestMock
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({
        Id: 92,
        NetUid:
          '77777777-7777-4777-8777-777777777777',
      })
    const payload = createResalePayload()

    await expect(
      addResale(payload),
    ).rejects.toBe(conflict)
    expect(window.localStorage).toHaveLength(0)

    await expect(
      addResale(structuredClone(payload)),
    ).resolves.toMatchObject({
      data: {
        Id: 92,
      },
    })

    expect(readIdempotencyKey(0))
      .toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1))
      .toBe(secondOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
    expect(window.localStorage).toHaveLength(0)
  })

  it('isolates persisted operations by authenticated owner and payload', async () => {
    const firstPayload = createResalePayload()
    firstPayload.Comment = 'owner A payload'
    const secondPayload = createResalePayload()
    secondPayload.Comment = 'owner B payload'
    const timeout = {
      payload: null,
      status: 504,
    }
    apiRequestMock
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({
        Id: 93,
        NetUid:
          '88888888-8888-4888-8888-888888888888',
      })
      .mockResolvedValueOnce({
        Id: 94,
        NetUid:
          '99999999-9999-4999-8999-999999999999',
      })

    await expect(
      addResale(firstPayload),
    ).rejects.toBe(timeout)
    const firstKey = readIdempotencyKey(0)
    expect(window.localStorage).toHaveLength(1)
    expect(window.localStorage.key(0))
      .toContain(firstOwnerNetUid.toLowerCase())

    readSessionMock.mockReturnValue({
      user: {
        NetUid: secondOwnerNetUid,
      },
    })
    await expect(
      addResale(secondPayload),
    ).resolves.toMatchObject({
      data: {
        Id: 93,
      },
    })

    const secondOptions =
      apiRequestMock.mock.calls[1]?.[1]
    expect(secondOptions?.body)
      .toMatchObject({
        Comment: 'owner B payload',
      })
    expect(secondOptions?.headers)
      .toMatchObject({
        'X-ReSale-Add-Owner':
          secondOwnerNetUid.toLowerCase(),
      })
    expect(readIdempotencyKey(1))
      .not.toBe(firstKey)
    expect(window.localStorage).toHaveLength(1)
    expect(window.localStorage.key(0))
      .toContain(firstOwnerNetUid.toLowerCase())

    readSessionMock.mockReturnValue({
      userNetUid: firstOwnerNetUid,
    })
    await expect(
      addResale(structuredClone(firstPayload)),
    ).resolves.toMatchObject({
      data: {
        Id: 94,
      },
    })
    expect(readIdempotencyKey(2)).toBe(firstKey)
    expect(window.localStorage).toHaveLength(0)
  })

  it('does not send a snapshotted payload if the authenticated owner changes while hashing', async () => {
    let resolveDigest:
      ((value: ArrayBuffer) => void) | undefined
    digestMock.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveDigest = resolve
        }),
    )

    const request =
      addResale(createResalePayload())
    readSessionMock.mockReturnValue({
      userNetUid: secondOwnerNetUid,
    })
    resolveDigest?.(new Uint8Array(32).buffer)

    await expect(request).rejects.toThrow(
      'Authenticated resale owner changed before the request was sent.',
    )
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(window.localStorage).toHaveLength(0)
  })

  it('honors an explicit definitive-no-write ledger header', async () => {
    const failure = {
      headers: new Headers({
        'X-ReSale-Add-Ledger-State':
          'definitive-no-write',
      }),
      payload: null,
      status: 418,
    }
    apiRequestMock.mockRejectedValueOnce(failure)

    await expect(
      addResale(createResalePayload()),
    ).rejects.toBe(failure)

    expect(window.localStorage).toHaveLength(0)
  })

  it('retains the operation when an explicit unknown ledger state overrides a 400', async () => {
    const failure = {
      headers: new Headers({
        'X-ReSale-Add-Ledger-State': 'unknown',
      }),
      payload: null,
      status: 400,
    }
    apiRequestMock.mockRejectedValueOnce(failure)

    await expect(
      addResale(createResalePayload()),
    ).rejects.toBe(failure)

    expect(window.localStorage).toHaveLength(1)
  })

  it('fails closed before hashing or sending when the authenticated owner is missing', () => {
    readSessionMock.mockReturnValue({})

    expect(() =>
      addResale(createResalePayload()))
      .toThrow(
        'Authenticated resale owner identity is unavailable.',
      )
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(digestMock).not.toHaveBeenCalled()
    expect(randomUUIDMock).not.toHaveBeenCalled()
    expect(window.localStorage).toHaveLength(0)
  })

  it('does not turn update conflicts into successful action results', async () => {
    const conflict = {
      payload: { Body: { Message: 'ReSale is completed' } },
      status: 409,
    }
    apiRequestMock.mockRejectedValueOnce(conflict)

    await expect(
      updateResale({} as Parameters<typeof updateResale>[0]),
    ).rejects.toBe(conflict)
  })
})

function createResalePayload() {
  return {
    ClientAgreement: {
      Id: 31,
    },
    Comment: 'immutable',
    FromStorageId: 32,
    Organization: {
      Id: 33,
    },
    ReSaleAvailabilityModels: [
      {
        ExchangeRate: 1,
        FromStorageId: 32,
        OldValue: {
          Amount: 20,
          QtyToReSale: 2,
          SalePrice: 12,
        },
        Price: 10,
        ProductId: 34,
        QtyToReSale: 2,
        SalePrice: 12,
      },
    ],
  } as Parameters<typeof addResale>[0]
}

function readIdempotencyKey(
  callIndex: number,
): string | undefined {
  const options =
    apiRequestMock.mock.calls[callIndex]?.[1]
  const headers =
    options?.headers as
      | Record<string, string>
      | undefined
  return headers?.['Idempotency-Key']
}
