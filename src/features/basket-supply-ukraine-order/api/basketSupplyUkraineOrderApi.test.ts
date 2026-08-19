import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  addOrUpdateSad,
  addOrUpdateSaleSad,
  getSalesForMovingToUkraine,
  getUkraineCartItems,
  updateUkraineCartItem,
  uploadPreviewUkraineCartItemsFromFile,
  uploadUkraineCartItemsFromFile,
} from './basketSupplyUkraineOrderApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('basketSupplyUkraineOrderApi SAD mutations', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gba_console_session',
      JSON.stringify({
        userNetUid:
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
    )
  })

  it('uses a durable create key for cart-backed SADs', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Id: 51,
      },
    })

    await addOrUpdateSad({
      Id: 0,
      SadItems: [],
    })

    const options = apiRequestMock.mock
      .calls[0]?.[1]
    const operationId =
      new Headers(options?.headers)
        .get('Idempotency-Key')

    expect(operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(options).toEqual({
      body: {
        Id: 0,
        SadItems: [],
      },
      dedupe: false,
      headers: {
        'Idempotency-Key': operationId,
      },
      method: 'POST',
    })
  })

  it('leaves the legacy sale mutation flow unchanged', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Id: 52,
      },
    })

    await addOrUpdateSaleSad({
      Id: 0,
      SadItems: [],
    })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/supplies/ukraine/order/packlists/sad/update/sale',
      {
        body: {
          Id: 0,
          SadItems: [],
        },
        method: 'POST',
      },
    )
  })
})

describe('basketSupplyUkraineOrderApi cart reservation mutations', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gba_console_session',
      JSON.stringify({
        userNetUid:
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
    )
  })

  it('reuses the reservation operation after an unknown outcome and sends a narrow target', async () => {
    const cartItem = {
      Id: 41,
      NetUid:
        '11111111-1111-4111-8111-111111111111',
      ProductId: 73,
      ReservedQty: 12,
      Comment: 'must not be writable',
    }
    apiRequestMock.mockRejectedValueOnce(
      Object.assign(new Error('network'), { status: 0 }),
    )

    await expect(updateUkraineCartItem(cartItem))
      .rejects.toThrow('network')

    const firstOptions = apiRequestMock.mock.calls[0]?.[1]
    const firstOperation = new Headers(firstOptions?.headers)
      .get('Idempotency-Key')

    apiRequestMock.mockResolvedValueOnce({ Body: cartItem })
    await updateUkraineCartItem(cartItem)

    const retryOptions = apiRequestMock.mock.calls[1]?.[1]

    expect(firstOperation).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(apiRequestMock.mock.calls[0]?.[0]).toBe(
      '/supplies/ukraine/order/cart/items/page/item/reservation',
    )
    expect(retryOptions).toEqual({
      body: {
        Id: 41,
        NetUid:
          '11111111-1111-4111-8111-111111111111',
        ProductId: 73,
        ReservedQty: 12,
      },
      dedupe: false,
      headers: {
        'Idempotency-Key': firstOperation,
      },
      method: 'POST',
      query: {
        operationNetUid: firstOperation,
      },
    })

    apiRequestMock.mockResolvedValueOnce({ Body: cartItem })
    await updateUkraineCartItem(cartItem)

    const nextOperation = new Headers(
      apiRequestMock.mock.calls[2]?.[1]?.headers,
    ).get('Idempotency-Key')

    expect(nextOperation).not.toBe(firstOperation)
  })

  it('sends one operation id for a cart workbook upload', async () => {
    const file = new File(
      ['workbook'],
      'cart.xlsx',
      {
        lastModified: 1_721_900_000_000,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    )
    const configuration = {
      EndRow: 10,
      QtyColumnNumber: 2,
      StartRow: 2,
      VendorCodeColumnNumber: 1,
    }
    apiRequestMock.mockResolvedValueOnce({ Body: [] })

    await uploadUkraineCartItemsFromFile(file, configuration)

    const options = apiRequestMock.mock.calls[0]?.[1]
    const operation = new Headers(options?.headers)
      .get('Idempotency-Key')

    expect(operation).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(options?.body).toBeInstanceOf(FormData)
    expect(apiRequestMock.mock.calls[0]?.[0]).toBe(
      '/supplies/ukraine/order/cart/items/page/file/upload',
    )
    expect(options).toMatchObject({
      dedupe: false,
      headers: {
        'Idempotency-Key': operation,
      },
      method: 'POST',
      query: {
        operationNetUid: operation,
      },
    })
  })

  it('uses only permission-scoped registry and preview routes', async () => {
    apiRequestMock.mockResolvedValue({ Body: [] })

    await getUkraineCartItems()
    await getSalesForMovingToUkraine({
      from: '2026-08-01',
      to: '2026-08-19',
      value: 'QA',
    })
    await uploadPreviewUkraineCartItemsFromFile(
      new File(['workbook'], 'cart.xlsx'),
      {
        EndRow: 10,
        QtyColumnNumber: 2,
        StartRow: 2,
        VendorCodeColumnNumber: 1,
      },
    )

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/supplies/ukraine/order/cart/items/page/all',
      '/sales/supply-ukraine/registry',
      '/supplies/ukraine/order/cart/items/page/file/select/preview',
    ])
  })
})
