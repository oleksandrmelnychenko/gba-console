import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../../shared/api/apiClient'
import {
  createFutureReservation,
  getClientDeliveryRecipients,
  getNearestSupplyOrder,
  getProductCalculatedPricingsByAgreement,
  getProductCurrentPriceByAgreement,
  getProductReservationsByAgreement,
  getSubClients,
  newDeliveryRecipient,
  newDeliveryRecipientAddress,
  setSaleCarrier,
  updateSaleDeliveryRecipient,
  updateSaleDeliveryRecipientAddress,
} from './newSaleWizardApi'

vi.mock('../../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('new sale wizard pricing API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests product reservations by product and client agreement', async () => {
    apiRequestMock.mockResolvedValueOnce({ ProductNetUid: 'product-1' })

    await getProductReservationsByAgreement('agreement-1', 'product-1')

    expect(apiRequestMock).toHaveBeenCalledWith('/products/reservations/current/carousel/agreement', {
      query: {
        clientAgreementNetId: 'agreement-1',
        productNetId: 'product-1',
      },
    })
  })

  it('requests current product price by product and client agreement', async () => {
    apiRequestMock.mockResolvedValueOnce(42)

    const result = await getProductCurrentPriceByAgreement('product-1', 'agreement-1')

    expect(result).toBe(42)
    expect(apiRequestMock).toHaveBeenCalledWith('/products/pricings/current', {
      query: {
        clientAgreementNetId: 'agreement-1',
        productNetId: 'product-1',
      },
    })
  })

  it('requests calculated product pricings by product and client agreement', async () => {
    apiRequestMock.mockResolvedValueOnce({ DiscountRate: 10, ProductNetUid: 'product-1' })

    const result = await getProductCalculatedPricingsByAgreement('product-1', 'agreement-1')

    expect(result).toEqual([{ DiscountRate: 10, ProductNetUid: 'product-1' }])
    expect(apiRequestMock).toHaveBeenCalledWith('/products/pricings/all', {
      query: {
        clientAgreementNetId: 'agreement-1',
        productNetId: 'product-1',
      },
    })
  })

  it('sends sale carrier as multipart FormData and unwraps nested sale response', async () => {
    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'sale-1' } })

    const result = await setSaleCarrier({ NetUid: 'sale-1' }, null)
    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as FormData

    expect(result).toEqual({ NetUid: 'sale-1' })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/set/change', expect.objectContaining({ method: 'POST' }))
    expect(body).toBeInstanceOf(FormData)
    expect(JSON.parse(String(body.get('sale')))).toEqual({ NetUid: 'sale-1' })
    expect(body.has('file')).toBe(false)
  })

  it('requests and creates delivery recipients with legacy endpoint shapes', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [{ NetUid: 'recipient-1' }] })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'recipient-2' })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'address-1' })

    await expect(getClientDeliveryRecipients('client-1')).resolves.toEqual([{ NetUid: 'recipient-1' }])
    await expect(newDeliveryRecipient({ FullName: 'Buyer' })).resolves.toEqual({ NetUid: 'recipient-2' })
    await expect(newDeliveryRecipientAddress({ City: 'Kyiv', RecipientNetId: 'recipient-2' })).resolves.toEqual({
      NetUid: 'address-1',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/deliveries/recipients/all/client', {
      query: { netId: 'client-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/deliveries/recipients/new', {
      body: { FullName: 'Buyer' },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/deliveries/recipients/addresses/new', {
      body: { City: 'Kyiv', RecipientNetId: 'recipient-2' },
      method: 'POST',
    })
  })

  it('updates sale recipient and address by sale net id', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'sale-1', DeliveryRecipient: { NetUid: 'recipient-1' } })
    apiRequestMock.mockResolvedValueOnce({ Sale: { NetUid: 'sale-1', DeliveryRecipientAddress: { NetUid: 'address-1' } } })

    await expect(updateSaleDeliveryRecipient({ NetUid: 'sale-1' }, 'sale-1')).resolves.toEqual({
      NetUid: 'sale-1',
      DeliveryRecipient: { NetUid: 'recipient-1' },
    })
    await expect(updateSaleDeliveryRecipientAddress({ NetUid: 'sale-1' }, 'sale-1')).resolves.toEqual({
      NetUid: 'sale-1',
      DeliveryRecipientAddress: { NetUid: 'address-1' },
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/sales/update/recipient', {
      body: { NetUid: 'sale-1' },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/sales/update/recipient/address', {
      body: { NetUid: 'sale-1' },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })

  it('requests nearest supply order and creates future reservation', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUID: 'supply-1' })
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getNearestSupplyOrder('product-1')).resolves.toEqual({ NetUID: 'supply-1' })
    await createFutureReservation({ ClientNetId: 'client-1', Count: 2, ProductNetId: 'product-1' })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/orders/arrival/nearest/get', {
      query: { netId: 'product-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/sales/reservations/new', {
      body: { ClientNetId: 'client-1', Count: 2, ProductNetId: 'product-1' },
      method: 'POST',
    })
  })

  it('normalizes sub-client list responses', async () => {
    apiRequestMock.mockResolvedValueOnce({ Collection: [{ NetUid: 'sub-client-1' }] })

    await expect(getSubClients('client-1')).resolves.toEqual([{ NetUid: 'sub-client-1' }])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/subclients/client', {
      query: { netId: 'client-1' },
    })
  })
})
