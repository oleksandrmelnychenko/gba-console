import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createSupplyOrderUkrainePaymentProtocol,
  deleteSupplyOrderUkrainePaymentProtocol,
  getLogisticPaymentTaskResponsibleUsers,
  getResponsibleUsers,
  getSupplyOrderUkraineById,
  getSupplyOrderUkraineProtocolKeys,
} from './paymentProtocolsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const protocol = {
  Discount: 50,
  NetUid: 'protocol-1',
  SupplyOrderUkrainePaymentDeliveryProtocolKey: { NetUid: 'key-1' },
  Value: 500,
}

describe('payment protocols permission-scoped API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({})
  })

  it('uses page, key and permission-specific user read façades', async () => {
    await getSupplyOrderUkraineById('order-1')
    await getSupplyOrderUkraineProtocolKeys()
    await getResponsibleUsers()
    await getLogisticPaymentTaskResponsibleUsers()

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/order/payment-protocols/details', {
      query: { netId: 'order-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/order/payment-protocols/keys')
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/usermanagement/profiles/orders-ukraine/payment-protocols/users',
      { query: { types: 7 } },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      4,
      '/usermanagement/profiles/orders-ukraine/logistic-way/payment-task-users',
      { query: { types: 7 } },
    )
  })

  it('keeps create and delete on independent mutation routes', async () => {
    await createSupplyOrderUkrainePaymentProtocol('order-1', protocol)
    await deleteSupplyOrderUkrainePaymentProtocol('order-1', protocol)

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/order/payment-protocols/create', {
      method: 'POST',
      body: protocol,
      query: { netId: 'order-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/order/payment-protocols/delete', {
      method: 'POST',
      body: protocol,
      query: { netId: 'order-1' },
    })
  })
})
