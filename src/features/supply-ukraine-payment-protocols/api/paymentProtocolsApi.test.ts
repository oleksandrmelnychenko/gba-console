import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createSupplyOrderUkrainePaymentProtocol,
  createUkraineMergedServicePaymentTask,
  deleteUkraineMergedService,
  deleteUkraineMergedServicePaymentTask,
  deleteSupplyOrderUkrainePaymentProtocol,
  getLogisticPaymentTaskResponsibleUsers,
  getResponsibleUsers,
  getSupplyOrderUkraineById,
  getSupplyOrderUkraineProtocolKeys,
  searchSupplyOrganizations,
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
    await searchSupplyOrganizations(' supplier ')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/order/payment-protocols/details', {
      query: { netId: 'order-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/ukraine/order/payment-protocols/keys')
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/usermanagement/profiles/orders-ukraine/payment-protocols/users',
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      4,
      '/usermanagement/profiles/orders-ukraine/logistic-way/payment-task-users',
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      5,
      '/supplies/organizations/orders-ukraine/payment-tasks/search',
      { query: { limit: 20, offset: 0, value: 'supplier' } },
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

  it('uses narrow merged-service and payment-task mutation façades', async () => {
    const service = { Id: 14, NetUid: 'service-1' }
    const task = { Id: 21, NetUid: 'task-1' }

    await createUkraineMergedServicePaymentTask('order-1', service, task, true)
    await deleteUkraineMergedServicePaymentTask('order-1', service, task, false)
    await deleteUkraineMergedService('order-1', service)

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/supplies/ukraine/order/merged-services/payment-tasks/create',
      {
        method: 'POST',
        body: {
          IsAccounting: true,
          OrderNetUid: 'order-1',
          PaymentTask: task,
          ServiceId: 14,
          ServiceNetUid: 'service-1',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/supplies/ukraine/order/merged-services/payment-tasks/delete',
      {
        method: 'POST',
        body: {
          IsAccounting: false,
          OrderNetUid: 'order-1',
          PaymentTask: { Id: 21, NetUid: 'task-1' },
          ServiceId: 14,
          ServiceNetUid: 'service-1',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/supplies/ukraine/order/merged-services/delete',
      {
        method: 'POST',
        body: {
          OrderNetUid: 'order-1',
          ServiceId: 14,
          ServiceNetUid: 'service-1',
        },
      },
    )
  })
})
