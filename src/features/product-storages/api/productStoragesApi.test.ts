import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import type {
  ProductStorageSupplyReturnPayload,
  ProductStorageTransferPayload,
  ProductStorageWriteOffPayload,
} from '../types'
import {
  createProductStorageSupplyReturn,
  createProductStorageTransfer,
  createProductStorageWriteOff,
  exportProductStorageAvailability,
  getAvailableProductsByStorage,
} from './productStoragesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))
vi.mock('../../../shared/auth/session', () => ({
  readSession: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const readSessionMock = vi.mocked(readSession)
const firstOperationNetUid = '11111111-1111-4111-8111-111111111111'
const secondOperationNetUid = '22222222-2222-4222-8222-222222222222'
const randomUUIDMock = vi.fn<() => `${string}-${string}-${string}-${string}-${string}`>()
const digestMock = vi.fn<SubtleCrypto['digest']>()
const digestIdentities = new Map<string, number>()
let operationSequence = 0

type TestTransferPayload = ProductStorageTransferPayload & {
  productTransfer: ProductStorageTransferPayload['productTransfer'] & {
    Number?: string | null
    FromStorageId?: number
    ToStorageId?: number
    OrganizationId?: number
    ResponsibleId?: number
    Responsible?: { Id?: number } | null
    ProductTransferItems: Array<
      ProductStorageTransferPayload['productTransfer']['ProductTransferItems'][number] & {
        ProductId?: number
      }
    >
  }
}

type TestSupplyReturnPayload = ProductStorageSupplyReturnPayload & {
  ClientAgreementId?: number
  Number?: string | null
  OrganizationId?: number
  ResponsibleId?: number
  Responsible?: { Id?: number } | null
  StorageId?: number
  SupplierId?: number
  SupplyReturnItems: Array<
    ProductStorageSupplyReturnPayload['SupplyReturnItems'][number] & {
      ConsignmentItem?: { Id?: number } | null
      ProductId?: number
    }
  >
}

type TestWriteOffPayload = ProductStorageWriteOffPayload & {
  OrganizationId?: number
  ResponsibleId?: number
  Responsible?: { Id?: number } | null
  StorageId?: number
  DepreciatedOrderItems: Array<
    ProductStorageWriteOffPayload['DepreciatedOrderItems'][number] & {
      ProductId?: number
    }
  >
}

describe('productStoragesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    readSessionMock.mockReturnValue({
      userNetUid: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
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
    digestMock.mockImplementation(async (_, data) => {
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      const identity = new TextDecoder().decode(bytes)
      let digestIdentity = digestIdentities.get(identity)

      if (!digestIdentity) {
        digestIdentity = digestIdentities.size + 1
        digestIdentities.set(identity, digestIdentity)
      }

      const digest = new Uint8Array(32)
      new DataView(digest.buffer).setUint32(28, digestIdentity)
      return digest.buffer
    })
    localStorage.clear()
    vi.stubGlobal('crypto', {
      subtle: {
        digest: digestMock,
      },
      randomUUID: randomUUIDMock,
    } as unknown as Crypto)
  })

  it('loads storage availability with the same date filters as export', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Items: [
        {
          Amount: '4',
          Product: { VendorCode: 'PR-1' },
          TotalRowsQty: '12',
        },
      ],
      TotalRowsQty: '12',
    })

    await expect(getAvailableProductsByStorage({
      from: '2026-06-01',
      limit: 20,
      offset: 40,
      storageNetId: 'storage-net-id',
      to: '2026-06-30',
      value: ' PR-1 ',
    })).resolves.toEqual({
      items: [
        {
          Amount: 4,
          Product: { ProductPlacements: [], VendorCode: 'PR-1' },
          Placements: [],
          TotalRowsQty: 12,
        },
      ],
      totalQty: 12,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/storages/warehouse-accounting/available/filtered', {
      query: {
        from: '2026-06-01',
        limit: 20,
        netId: 'storage-net-id',
        offset: 40,
        to: '2026-06-30',
        value: 'PR-1',
      },
    })
  })

  it('exports storage availability through the permission-scoped facade', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocumentURL: '/storage.pdf',
      XlsxDocumentURL: '/storage.xlsx',
    })

    await expect(exportProductStorageAvailability({
      from: '2026-06-01',
      storageNetId: 'storage-net-id',
      to: '2026-06-30',
    })).resolves.toEqual({
      DocumentURL: '',
      PdfDocumentURL: '/storage.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/storages/warehouse-accounting/document/export', {
      query: {
        from: '2026-06-01',
        netId: 'storage-net-id',
        to: '2026-06-30',
      },
    })
  })

  it('deduplicates the same immutable transfer while its request is in flight', async () => {
    let resolveRequest: (() => void) | undefined
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = () => resolve(undefined)
        }),
    )
    const payload = createTransferPayload()

    const first = createProductStorageTransfer(payload)
    const duplicate = createProductStorageTransfer(structuredClone(payload))

    expect(duplicate).toBe(first)
    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)

    resolveRequest?.()
    await first
  })

  it('retains the operation key after a 504 and reuses it on retry', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(504))
      .mockResolvedValueOnce(undefined)
    const payload = createTransferPayload()

    await expect(createProductStorageTransfer(payload)).rejects.toMatchObject({
      status: 504,
    })
    expect(localStorage.length).toBe(1)

    await expect(createProductStorageTransfer(structuredClone(payload))).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
  })

  it('removes the operation key after a known 4xx response', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(400))
      .mockResolvedValueOnce(undefined)
    const payload = createTransferPayload()

    await expect(createProductStorageTransfer(payload)).rejects.toMatchObject({
      status: 400,
    })
    expect(localStorage.length).toBe(0)

    await expect(createProductStorageTransfer(structuredClone(payload))).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
  })

  it('separates every server-significant scalar and reference identity', async () => {
    apiRequestMock.mockRejectedValue(createHttpError(504))
    const base = createTransferPayload()
    const variants: Array<(payload: TestTransferPayload) => void> = [
      (payload) => {
        payload.productTransfer.Number = 'TR-2'
      },
      (payload) => {
        payload.productTransfer.FromStorageId = 101
      },
      (payload) => {
        payload.productTransfer.ToStorageId = 201
      },
      (payload) => {
        payload.productTransfer.OrganizationId = 301
      },
      (payload) => {
        payload.productTransfer.ResponsibleId = 401
      },
      (payload) => {
        payload.productTransfer.Responsible = { Id: 402 }
      },
      (payload) => {
        payload.productTransfer.ProductTransferItems[0].ProductId = 501
      },
    ]

    await expect(createProductStorageTransfer(base)).rejects.toMatchObject({
      status: 504,
    })
    for (const mutate of variants) {
      const variant = structuredClone(base)
      mutate(variant)
      await expect(createProductStorageTransfer(variant)).rejects.toMatchObject({
        status: 504,
      })
    }

    const operationKeys = apiRequestMock.mock.calls.map((_, index) => readIdempotencyKey(index))
    expect(new Set(operationKeys).size).toBe(variants.length + 1)
    expect(randomUUIDMock).toHaveBeenCalledTimes(variants.length + 1)
  })

  it('keeps null and empty request strings as distinct identities', async () => {
    apiRequestMock.mockRejectedValue(createHttpError(504))
    const emptyStrings = createTransferPayload()
    emptyStrings.productTransfer.Comment = ''
    emptyStrings.productTransfer.ProductTransferItems[0].Reason = ''
    const nullComment = structuredClone(emptyStrings)
    nullComment.productTransfer.Comment = null as unknown as string
    const nullReason = structuredClone(emptyStrings)
    nullReason.productTransfer.ProductTransferItems[0].Reason = null as unknown as string

    await expect(createProductStorageTransfer(emptyStrings)).rejects.toMatchObject({
      status: 504,
    })
    await expect(createProductStorageTransfer(nullComment)).rejects.toMatchObject({
      status: 504,
    })
    await expect(createProductStorageTransfer(nullReason)).rejects.toMatchObject({
      status: 504,
    })

    const operationKeys = apiRequestMock.mock.calls.map((_, index) => readIdempotencyKey(index))
    expect(new Set(operationKeys).size).toBe(3)
  })

  it('scopes persistence by the nested session user when the direct owner is absent', async () => {
    readSessionMock.mockReturnValue({
      user: {
        NetUid: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
      },
    })
    apiRequestMock.mockRejectedValue(createHttpError(504))

    await expect(createProductStorageTransfer(createTransferPayload())).rejects.toMatchObject({
      status: 504,
    })

    expect(localStorage.key(0)).toContain(
      ':bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:',
    )
  })

  it('fails closed before generating a key when the session has no owner identity', () => {
    readSessionMock.mockReturnValue({})

    expect(() => createProductStorageTransfer(createTransferPayload())).toThrow(
      'Authenticated product transfer owner identity is unavailable',
    )
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(randomUUIDMock).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('deduplicates an immutable write-off and sends its owner-bound operation identity', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    const payload = createWriteOffPayload()
    const duplicatePayload = structuredClone(payload)

    const first = createProductStorageWriteOff(payload)
    payload.Comment = 'mutated after dispatch'
    payload.DepreciatedOrderItems[0].Qty = 99
    const duplicate = createProductStorageWriteOff(duplicatePayload)

    expect(duplicate).toBe(first)
    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/orders/depreciated/warehouse-accounting/new',
      expect.objectContaining({
        method: 'POST',
        dedupe: false,
        headers: {
          'Idempotency-Key': firstOperationNetUid,
          'X-Depreciated-Order-Owner':
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        query: {
          operationNetUid: firstOperationNetUid,
        },
        body: duplicatePayload,
      }),
    )
    expect(localStorage.length).toBe(1)

    resolveRequest?.({ Id: 91 })
    await expect(first).resolves.toEqual({ Id: 91 })
    expect(localStorage.length).toBe(0)
  })

  it('retains the write-off operation and snapshot after a 504', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createDepreciatedOrderHttpError(504))
      .mockResolvedValueOnce({ Id: 92 })
    const payload = createWriteOffPayload()

    await expect(createProductStorageWriteOff(payload)).rejects.toMatchObject({
      status: 504,
    })
    expect(localStorage.length).toBe(1)

    const retryPayload = structuredClone(payload)
    await expect(createProductStorageWriteOff(retryPayload)).resolves.toEqual({
      Id: 92,
    })

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(firstOperationNetUid)
    expect(readOperationQueryKey(0)).toBe(firstOperationNetUid)
    expect(readOperationQueryKey(1)).toBe(firstOperationNetUid)
    expect(readRequestBody(1)).toEqual(payload)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
  })

  it('keeps an uncertain write-off scoped to its payload and allows a different write-off', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createDepreciatedOrderHttpError(409))
      .mockResolvedValueOnce({ Id: 93 })
      .mockResolvedValueOnce({ Id: 94 })
    const payload = createWriteOffPayload()

    await expect(createProductStorageWriteOff(payload)).rejects.toMatchObject({
      status: 409,
    })

    const differentPayload = structuredClone(payload)
    differentPayload.Comment = 'different request'
    await expect(
      createProductStorageWriteOff(differentPayload),
    ).resolves.toEqual({ Id: 93 })
    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    expect(localStorage.length).toBe(1)

    await expect(
      createProductStorageWriteOff(structuredClone(payload)),
    ).resolves.toEqual({ Id: 94 })
    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(readIdempotencyKey(2)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
    expect(localStorage.length).toBe(0)
  })

  it('migrates a matching legacy write-off retry without blocking a different payload', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createDepreciatedOrderHttpError(504))
      .mockResolvedValueOnce({ Id: 95 })
      .mockResolvedValueOnce({ Id: 96 })
    const payload = createWriteOffPayload()

    await expect(createProductStorageWriteOff(payload)).rejects.toMatchObject({
      status: 504,
    })

    const currentStorageKey = localStorage.key(0)
    expect(currentStorageKey).toContain(
      'gba_console:depreciated-order-operation:v2:',
    )
    const serializedRecord = localStorage.getItem(currentStorageKey || '')
    expect(serializedRecord).not.toBeNull()
    localStorage.removeItem(currentStorageKey || '')
    localStorage.setItem(
      'gba_console:depreciated-order-operation:v1:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      serializedRecord || '',
    )

    const differentPayload = structuredClone(payload)
    differentPayload.Comment = 'new write-off'
    await expect(
      createProductStorageWriteOff(differentPayload),
    ).resolves.toEqual({ Id: 95 })
    expect(localStorage.length).toBe(1)

    await expect(
      createProductStorageWriteOff(structuredClone(payload)),
    ).resolves.toEqual({ Id: 96 })
    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(readIdempotencyKey(2)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
    expect(localStorage.length).toBe(0)
  })

  it('clears a definitively marked write-off conflict before a new attempt', async () => {
    apiRequestMock
      .mockRejectedValueOnce(
        createDepreciatedOrderHttpError(409, 'not-entered'),
      )
      .mockResolvedValueOnce({ Id: 94 })
    const payload = createWriteOffPayload()

    await expect(createProductStorageWriteOff(payload)).rejects.toMatchObject({
      status: 409,
    })
    expect(localStorage.length).toBe(0)

    await expect(
      createProductStorageWriteOff(structuredClone(payload)),
    ).resolves.toEqual({ Id: 94 })
    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
  })

  it('retains a write-off key after a network error and reuses it', async () => {
    apiRequestMock
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ Id: 95 })
    const payload = createWriteOffPayload()

    await expect(createProductStorageWriteOff(payload)).rejects.toThrow(
      'network unavailable',
    )
    await expect(
      createProductStorageWriteOff(structuredClone(payload)),
    ).resolves.toEqual({ Id: 95 })

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed before write-off dispatch when its retry snapshot cannot be persisted', async () => {
    const originalStorage = globalThis.localStorage
    const unavailableStorage = {
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
    } as unknown as Storage
    vi.stubGlobal('localStorage', unavailableStorage)

    try {
      await expect(
        createProductStorageWriteOff(createWriteOffPayload()),
      ).rejects.toThrow(
        'Depreciated order retry identity could not be persisted',
      )
      expect(apiRequestMock).not.toHaveBeenCalled()
    } finally {
      vi.stubGlobal('localStorage', originalStorage)
    }
  })

  it('deduplicates the same supply return while its request is in flight', async () => {
    let resolveRequest: (() => void) | undefined
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = () => resolve(undefined)
        }),
    )
    const payload = createSupplyReturnPayload()

    const first = createProductStorageSupplyReturn(payload)
    const duplicate = createProductStorageSupplyReturn(structuredClone(payload))

    expect(duplicate).toBe(first)
    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)

    resolveRequest?.()
    await first
    expect(localStorage.length).toBe(0)
  })

  it('retains the supply return operation key after a 504 and reuses it', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(504))
      .mockResolvedValueOnce(undefined)
    const payload = createSupplyReturnPayload()

    await expect(createProductStorageSupplyReturn(payload)).rejects.toMatchObject({
      status: 504,
    })
    expect(localStorage.length).toBe(1)

    await expect(
      createProductStorageSupplyReturn(structuredClone(payload)),
    ).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
  })

  it('reuses the supply return key for canonically equivalent payloads', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(504))
      .mockResolvedValueOnce(undefined)
    const payload = createSupplyReturnPayload()
    payload.Comment = ''
    payload.SupplyReturnItems.push({
      ConsignmentItemId: 71,
      ConsignmentItem: { Id: 71 },
      ProductId: 81,
      Product: { Id: 81 },
      Qty: 3,
    })

    await expect(createProductStorageSupplyReturn(payload)).rejects.toMatchObject({
      status: 504,
    })

    const equivalent = structuredClone(payload)
    equivalent.Number = 'server-will-ignore-this-number'
    equivalent.FromDate = '2026-07-25T14:00:00.000+02:00'
    delete (equivalent as { Comment?: string }).Comment
    delete equivalent.ClientAgreement
    delete equivalent.Organization
    delete equivalent.Responsible
    delete (equivalent as { Storage?: { Id?: number } }).Storage
    delete equivalent.Supplier
    equivalent.SupplyReturnItems.forEach((item) => {
      const mutableItem = item as {
        ConsignmentItem?: { Id?: number } | null
        Product?: { Id?: number } | null
      }
      delete mutableItem.ConsignmentItem
      delete mutableItem.Product
    })
    equivalent.SupplyReturnItems.reverse()

    await expect(createProductStorageSupplyReturn(equivalent)).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
  })

  it('clears the supply return key after a marked rolled-back 4xx', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(400, 'rolled-back'))
      .mockResolvedValueOnce(undefined)
    const payload = createSupplyReturnPayload()

    await expect(createProductStorageSupplyReturn(payload)).rejects.toMatchObject({
      status: 400,
    })
    expect(localStorage.length).toBe(0)

    await expect(
      createProductStorageSupplyReturn(structuredClone(payload)),
    ).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
  })

  it('retains the supply return key after an unmarked 4xx with unknown ledger state', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(400))
      .mockResolvedValueOnce(undefined)
    const payload = createSupplyReturnPayload()

    await expect(createProductStorageSupplyReturn(payload)).rejects.toMatchObject({
      status: 400,
    })

    await expect(
      createProductStorageSupplyReturn(structuredClone(payload)),
    ).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(firstOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(1)
  })

  it('clears the supply return key after a conflict', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createHttpError(409))
      .mockResolvedValueOnce(undefined)
    const payload = createSupplyReturnPayload()

    await expect(createProductStorageSupplyReturn(payload)).rejects.toMatchObject({
      status: 409,
    })
    await expect(
      createProductStorageSupplyReturn(structuredClone(payload)),
    ).resolves.toBeUndefined()

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(randomUUIDMock).toHaveBeenCalledTimes(2)
  })

  it('isolates persisted supply return operations by authenticated owner', async () => {
    apiRequestMock.mockRejectedValue(createHttpError(504))
    const payload = createSupplyReturnPayload()

    await expect(createProductStorageSupplyReturn(payload)).rejects.toMatchObject({
      status: 504,
    })
    readSessionMock.mockReturnValue({
      userNetUid: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
    })
    await expect(
      createProductStorageSupplyReturn(structuredClone(payload)),
    ).rejects.toMatchObject({
      status: 504,
    })

    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(localStorage.length).toBe(2)
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)))
      .toEqual(expect.arrayContaining([
        expect.stringContaining(':aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:'),
        expect.stringContaining(':bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:'),
      ]))
  })

  it('does not let the shared api client merge concurrent cross-user returns', async () => {
    const resolveRequests: Array<() => void> = []
    apiRequestMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequests.push(() => resolve(undefined))
        }),
    )
    const payload = createSupplyReturnPayload()

    const first = createProductStorageSupplyReturn(payload)
    readSessionMock.mockReturnValue({
      userNetUid: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
    })
    const second = createProductStorageSupplyReturn(structuredClone(payload))

    expect(second).not.toBe(first)
    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(2))
    expect(readIdempotencyKey(0)).toBe(firstOperationNetUid)
    expect(readIdempotencyKey(1)).toBe(secondOperationNetUid)
    expect(apiRequestMock.mock.calls[0]?.[1]).toMatchObject({ dedupe: false })
    expect(apiRequestMock.mock.calls[1]?.[1]).toMatchObject({ dedupe: false })

    resolveRequests.forEach((resolve) => resolve())
    await Promise.all([first, second])
  })

  it('fails closed before supply return key generation when owner identity is absent', () => {
    readSessionMock.mockReturnValue({})

    expect(() => createProductStorageSupplyReturn(createSupplyReturnPayload())).toThrow(
      'Authenticated supply return owner identity is unavailable',
    )
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(randomUUIDMock).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('fails closed before the request when the retry key cannot be persisted', async () => {
    const originalStorage = globalThis.localStorage
    const unavailableStorage = {
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('storage denied')
      }),
    } as unknown as Storage
    vi.stubGlobal('localStorage', unavailableStorage)

    try {
      await expect(
        createProductStorageSupplyReturn(createSupplyReturnPayload()),
      ).rejects.toThrow('Supply return retry identity could not be persisted')
      expect(apiRequestMock).not.toHaveBeenCalled()
    } finally {
      vi.stubGlobal('localStorage', originalStorage)
    }
  })
})

function createTransferPayload(): TestTransferPayload {
  return {
    cellNumber: 'C',
    rowNumber: 'R',
    storageNumber: 'S',
    productTransfer: {
      Number: 'TR-1',
      Comment: 'move stock',
      FromDate: '2026-07-25T12:00:00.000Z',
      FromStorageId: 10,
      FromStorage: { Id: 10 },
      IsManagement: false,
      OrganizationId: 30,
      Organization: { Id: 30 },
      ProductTransferItems: [
        {
          ProductId: 40,
          Product: { Id: 40 },
          Qty: 2,
          Reason: 'manual transfer',
        },
      ],
      ResponsibleId: 50,
      Responsible: { Id: 50 },
      ToStorageId: 20,
      ToStorage: { Id: 20 },
    },
  }
}

function createSupplyReturnPayload(): TestSupplyReturnPayload {
  return {
    Number: 'SR-1',
    ClientAgreementId: 20,
    ClientAgreement: { Id: 20 },
    Comment: 'return to supplier',
    FromDate: '2026-07-25T12:00:00.000Z',
    IsManagement: false,
    OrganizationId: 30,
    Organization: { Id: 30 },
    ResponsibleId: 40,
    Responsible: { Id: 40 },
    StorageId: 50,
    Storage: { Id: 50 },
    SupplierId: 60,
    Supplier: { Id: 60 },
    SupplyReturnItems: [
      {
        ConsignmentItemId: 70,
        ConsignmentItem: { Id: 70 },
        ProductId: 80,
        Product: { Id: 80 },
        Qty: 2,
      },
    ],
  }
}

function createWriteOffPayload(): TestWriteOffPayload {
  return {
    Comment: 'damaged stock',
    DepreciatedOrderItems: [
      {
        ProductId: 40,
        Product: { Id: 40 },
        Qty: 2,
        Reason: 'damaged',
      },
    ],
    FromDate: '2026-07-25T12:00:00.000Z',
    IsManagement: false,
    OrganizationId: 30,
    Organization: { Id: 30 },
    ResponsibleId: 50,
    Responsible: { Id: 50 },
    StorageId: 10,
    Storage: { Id: 10 },
  }
}

function createHttpError(
  status: number,
  ledgerState?: string,
): Error & { headers: Headers; status: number } {
  const headers = new Headers()

  if (ledgerState) {
    headers.set('X-Mutation-Ledger-State', ledgerState)
  }

  return Object.assign(new Error(`HTTP ${status}`), { headers, status })
}

function createDepreciatedOrderHttpError(
  status: number,
  ledgerState?: string,
): Error & { headers: Headers; status: number } {
  const headers = new Headers()

  if (ledgerState) {
    headers.set('X-Depreciated-Order-Ledger-State', ledgerState)
  }

  return Object.assign(new Error(`HTTP ${status}`), { headers, status })
}

function readIdempotencyKey(callIndex: number): string | undefined {
  const options = apiRequestMock.mock.calls[callIndex]?.[1]
  const headers = options?.headers as Record<string, string> | undefined
  return headers?.['Idempotency-Key']
}

function readOperationQueryKey(callIndex: number): unknown {
  return apiRequestMock.mock.calls[callIndex]?.[1]?.query
    ?.operationNetUid
}

function readRequestBody(callIndex: number): unknown {
  return apiRequestMock.mock.calls[callIndex]?.[1]?.body
}
