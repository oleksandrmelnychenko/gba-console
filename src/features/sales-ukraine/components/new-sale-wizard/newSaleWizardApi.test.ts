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
  searchSaleProductsWithAvailability,
  shiftOrderItemFromSale,
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

  it('requests advanced product search with client agreement and default modes', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await expect(searchSaleProductsWithAvailability(' sem94 ', 'agreement-1')).resolves.toEqual([])

    expect(apiRequestMock).toHaveBeenCalledWith('/products/search/advanced', {
      query: {
        limit: 20,
        mode: '5',
        netId: 'agreement-1',
        offset: 0,
        sortMode: '2',
        value: 'sem94',
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
    const recipientOperation = '11111111-1111-4111-8111-111111111111'
    const addressOperation = '22222222-2222-4222-8222-222222222222'
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'recipient-1', FullName: 'Отримувач' })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'address-1', City: 'Київ' })

    await expect(updateSaleDeliveryRecipient(
      { FullName: 'Отримувач', MobilePhone: '+380501112233' },
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { operationId: recipientOperation },
    )).resolves.toEqual({
      NetUid: 'recipient-1',
      FullName: 'Отримувач',
    })
    await expect(updateSaleDeliveryRecipientAddress(
      { City: 'Київ', Department: '1' },
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { operationId: addressOperation },
    )).resolves.toEqual({
      NetUid: 'address-1',
      City: 'Київ',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/sales/update/recipient', {
      body: {
        FullName: 'Отримувач',
        MobilePhone: '+380501112233',
        OperationNetUid: recipientOperation,
      },
      headers: { 'Idempotency-Key': recipientOperation },
      method: 'POST',
      query: { netId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/sales/update/recipient/address', {
      body: {
        City: 'Київ',
        Department: '1',
        OperationNetUid: addressOperation,
      },
      headers: { 'Idempotency-Key': addressOperation },
      method: 'POST',
      query: { netId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    })
  })

  it('requests nearest supply order and creates future reservation', async () => {
    const productNetId = '11111111-1111-4111-8111-111111111111'
    const clientNetId = '22222222-2222-4222-8222-222222222222'
    const supplyOrderNetId = '33333333-3333-4333-8333-333333333333'
    const operationId = '44444444-4444-4444-8444-444444444444'
    const remindDate = '2026-08-01T12:00:00Z'
    apiRequestMock.mockResolvedValueOnce({ NetUID: supplyOrderNetId })
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getNearestSupplyOrder(productNetId)).resolves.toEqual({ NetUID: supplyOrderNetId })
    await createFutureReservation({
      ClientNetId: clientNetId,
      Count: 2,
      ProductNetId: productNetId,
      RemindDate: remindDate,
      SupplyOrderNetId: supplyOrderNetId,
    }, { operationId })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/orders/arrival/nearest/get', {
      query: { netId: productNetId },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/sales/reservations/new', {
      body: {
        ClientNetId: clientNetId,
        Count: 2,
        OperationNetUid: operationId,
        ProductNetId: productNetId,
        RemindDate: remindDate,
        SupplyOrderNetId: supplyOrderNetId,
      },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      signal: undefined,
    })
  })

  it('rejects an invalid future reservation before calling the API', async () => {
    await expect(createFutureReservation({
      ClientNetId: '00000000-0000-0000-0000-000000000000',
      Count: Number.NaN,
      ProductNetId: '11111111-1111-4111-8111-111111111111',
      RemindDate: '',
      SupplyOrderNetId: '33333333-3333-4333-8333-333333333333',
    }, {
      operationId: '44444444-4444-4444-8444-444444444444',
    })).rejects.toThrow()

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('normalizes sub-client list responses', async () => {
    apiRequestMock.mockResolvedValueOnce({ Collection: [{ NetUid: 'sub-client-1' }] })

    await expect(getSubClients('client-1')).resolves.toEqual([{ NetUid: 'sub-client-1' }])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/subclients/client', {
      query: { netId: 'client-1' },
    })
  })

  it('moves an order item without dropping discount or provenance metadata', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await shiftOrderItemFromSale('sale-from', 'sale-to', {
      Discount: 7,
      IsFromReSale: true,
      NetUid: 'current-item',
      OneTimeDiscount: 4,
      OneTimeDiscountComment: 'approved discount',
      Qty: 2,
      SourceOrderItemNetUid: 'original-item',
    }, { operationId: '11111111-1111-4111-8111-111111111111' })

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/items/shift/specific', {
      body: {
        Discount: 7,
        IsFromReSale: true,
        NetUid: 'current-item',
        OneTimeDiscount: 4,
        OneTimeDiscountComment: 'approved discount',
        OperationNetUid: '11111111-1111-4111-8111-111111111111',
        Qty: 2,
        SourceOrderItemNetUid: 'current-item',
      },
      headers: { 'Idempotency-Key': '11111111-1111-4111-8111-111111111111' },
      method: 'POST',
      query: { saleFromNetId: 'sale-from', saleToNetId: 'sale-to' },
    })
  })

  it('uses the moved row uid as provenance when the source uid is absent', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await shiftOrderItemFromSale(
      'sale-from',
      'sale-to',
      { NetUid: 'source-item', Qty: 1 },
      { operationId: '22222222-2222-4222-8222-222222222222' },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/items/shift/specific', {
      body: {
        NetUid: 'source-item',
        OperationNetUid: '22222222-2222-4222-8222-222222222222',
        Qty: 1,
        SourceOrderItemNetUid: 'source-item',
      },
      headers: { 'Idempotency-Key': '22222222-2222-4222-8222-222222222222' },
      method: 'POST',
      query: { saleFromNetId: 'sale-from', saleToNetId: 'sale-to' },
    })
  })

  it('rejects a shift without a persisted row uid before calling the server', async () => {
    await expect(
      shiftOrderItemFromSale('sale-from', 'sale-to', {
        NetUid: '00000000-0000-0000-0000-000000000000',
        Qty: 1,
        SourceOrderItemNetUid: 'stale-source',
      }, { operationId: '33333333-3333-4333-8333-333333333333' }),
    ).rejects.toThrow('Неможливо перемістити незбережену позицію')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
