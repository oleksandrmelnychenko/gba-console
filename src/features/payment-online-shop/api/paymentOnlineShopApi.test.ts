import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  addPaymentImage,
  editPaymentImage,
  getPaymentShopItemForRefresh,
  getPaymentShopItems,
  getPaymentShopItemsPage,
} from './paymentOnlineShopApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const operationId = '22222222-2222-4222-8222-222222222222'

describe('paymentOnlineShopApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads the default payment register page even when filters are empty', async () => {
    const items = [{ Id: 1, NetUid: 'payment-image-1' }]

    apiRequestMock.mockResolvedValueOnce({ Collection: items })

    await expect(
      getPaymentShopItems({
        phoneNumber: '',
        saleDateFrom: '',
        saleDateTo: '',
        saleNumber: '',
      }),
    ).resolves.toEqual(items)

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/payment/images/get/filtered', {
      query: {
        limit: 100,
        offset: 0,
        phoneNumber: '',
        saleDateFrom: '',
        saleDateTo: '',
        saleNumber: '',
      },
    })
  })

  it('passes explicit pagination together with search filters', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await getPaymentShopItems({
      limit: 50,
      offset: 100,
      phoneNumber: '067',
      saleDateFrom: '2026-07-01',
      saleDateTo: '2026-07-08',
      saleNumber: 'КИн',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/payment/images/get/filtered', {
      query: {
        limit: 50,
        offset: 100,
        phoneNumber: '067',
        saleDateFrom: '2026-07-01',
        saleDateTo: '2026-07-08',
        saleNumber: 'КИн',
      },
    })
  })

  it('normalizes the backend total for the paginated payment register', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [{ Id: 2, NetUid: 'payment-image-2' }],
      TotalRowsQty: 141,
    })

    await expect(
      getPaymentShopItemsPage({
        limit: 20,
        offset: 40,
        phoneNumber: '',
        saleDateFrom: '',
        saleDateTo: '',
        saleNumber: '',
      }),
    ).resolves.toEqual({
      items: [{ Id: 2, NetUid: 'payment-image-2' }],
      totalRowsQty: 141,
    })
  })

  it('reloads one payment aggregate by its sale number and stable id', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        { Id: 4, Sale: { SaleNumber: { Value: 'OTHER' } } },
        { Id: 7, Sale: { SaleNumber: { Value: 'КАв00009639' } } },
      ],
    })

    await expect(
      getPaymentShopItemForRefresh(7, ' КАв00009639 '),
    ).resolves.toMatchObject({ Id: 7 })
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/sales/payment/images/get/filtered',
      {
        query: {
          limit: 200,
          offset: 0,
          phoneNumber: '',
          saleDateFrom: '',
          saleDateTo: '',
          saleNumber: 'КАв00009639',
        },
      },
    )
  })

  it('uploads an image with a durable idempotency key', async () => {
    const image = new File(['image'], 'payment.png', { type: 'image/png' })

    apiRequestMock.mockResolvedValueOnce({ Id: 10 })

    await addPaymentImage(
      {
        amount: 125.5,
        comment: 'paid',
        image,
        paymentImageId: 7,
        paymentType: 0,
        user: { Id: 3 },
      },
      { operationId },
    )

    const [, request] = apiRequestMock.mock.calls[0]
    const body = request?.body as FormData

    expect(request).toMatchObject({
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
    expect(body.get('image')).toBe(image)
    expect(JSON.parse(String(body.get('paymentImageItem')))).toEqual({
      Amount: 125.5,
      Comment: 'paid',
      PaymentType: 0,
      RetailClientPaymentImageId: 7,
      User: { Id: 3 },
    })
  })

  it('preserves RowVersion and sends the operation key on update', async () => {
    apiRequestMock.mockResolvedValueOnce({ Id: 7 })

    await editPaymentImage(
      {
        amount: 130,
        comment: 'corrected',
        item: {
          Id: 9,
          RowVersion: 'AQIDBAUGBwg=',
        },
        paymentImageId: 7,
        paymentType: 1,
        user: { Id: 3 },
      },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/retail/clients/update/payment/item',
      {
        body: {
          Amount: 130,
          Comment: 'corrected',
          Id: 9,
          PaymentType: 1,
          RetailClientPaymentImageId: 7,
          RowVersion: 'AQIDBAUGBwg=',
          User: { Id: 3 },
        },
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
      },
    )
  })
})
