import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  addProductTransferFromFile,
  exportProductTransferDocument,
  getProductTransferByNetId,
  getProductTransfers,
  getProductTransferStorages,
} from './productTransfersApi'
import type { ProductTransferCreateFromFilePayload } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productTransfersApi file import', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: '11111111-1111-4111-8111-111111111111',
    }))
  })

  it('sends the same durable operation id in the header and query', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await addProductTransferFromFile(createPayload())

    const [, request] = apiRequestMock.mock.calls[0]
    const operationNetUid = String(
      (request?.headers as Record<string, string>)['Idempotency-Key'],
    )

    expect(operationNetUid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(request).toEqual(expect.objectContaining({
      method: 'POST',
      query: {
        operationNetUid,
      },
    }))
    expect(apiRequestMock.mock.calls[0][0]).toBe(
      '/products/transfers/page/import/file',
    )
    expect(request?.body).toBeInstanceOf(FormData)
    const body = request?.body as FormData
    expect(JSON.parse(String(body.get('productTransfer')))).toEqual({
      Comment: 'warehouse move',
      FromDate: '2026-07-26T08:00:00.000Z',
      FromStorageNetUid: '22222222-2222-4222-8222-222222222222',
      IsManagement: false,
      ToStorageNetUid: '33333333-3333-4333-8333-333333333333',
    })
  })

  it('reuses the operation id after an unknown outcome', async () => {
    const payload = createPayload()
    apiRequestMock
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { status: 504 }))
      .mockResolvedValueOnce([])

    await expect(addProductTransferFromFile(payload)).rejects.toThrow('timeout')
    await addProductTransferFromFile(payload)

    const firstRequest = apiRequestMock.mock.calls[0][1]
    const secondRequest = apiRequestMock.mock.calls[1][1]
    expect(
      (firstRequest?.headers as Record<string, string>)['Idempotency-Key'],
    ).toBe(
      (secondRequest?.headers as Record<string, string>)['Idempotency-Key'],
    )
  })

  it('drops the operation id after a definitive client failure', async () => {
    const payload = createPayload()
    apiRequestMock
      .mockRejectedValueOnce(Object.assign(new Error('invalid'), { status: 400 }))
      .mockResolvedValueOnce([])

    await expect(addProductTransferFromFile(payload)).rejects.toThrow('invalid')
    await addProductTransferFromFile(payload)

    const firstRequest = apiRequestMock.mock.calls[0][1]
    const secondRequest = apiRequestMock.mock.calls[1][1]
    expect(
      (firstRequest?.headers as Record<string, string>)['Idempotency-Key'],
    ).not.toBe(
      (secondRequest?.headers as Record<string, string>)['Idempotency-Key'],
    )
  })
})

describe('productTransfersApi permission-scoped reads', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('uses only the reviewed page facade routes', async () => {
    await getProductTransfers({
      from: '2026-08-01',
      limit: 20,
      offset: 0,
      to: '2026-08-19',
    })
    await getProductTransferByNetId(
      '22222222-2222-4222-8222-222222222222',
    )
    await getProductTransferStorages()
    await exportProductTransferDocument(
      '22222222-2222-4222-8222-222222222222',
    )

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/products/transfers/page/registry',
      '/products/transfers/page/details',
      '/storages/product-transfers/page/all',
      '/products/transfers/page/document/export',
    ])
  })
})

function createPayload(): ProductTransferCreateFromFilePayload {
  return {
    file: new File(['SEM1,2'], 'transfer.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    parseConfiguration: {
      EndRow: 2,
      QtyColumnNumber: 2,
      StartRow: 1,
      VendorCodeColumnNumber: 1,
    },
    productTransfer: {
      Comment: 'warehouse move',
      FromDate: '2026-07-26T08:00:00.000Z',
      FromStorageNetUid: '22222222-2222-4222-8222-222222222222',
      IsManagement: false,
      ToStorageNetUid: '33333333-3333-4333-8333-333333333333',
    },
  }
}
