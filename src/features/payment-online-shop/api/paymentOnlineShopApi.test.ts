import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getPaymentShopItems, getPaymentShopItemsPage } from './paymentOnlineShopApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

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
})
