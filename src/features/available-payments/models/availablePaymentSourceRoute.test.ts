import { describe, expect, it } from 'vitest'
import { getAvailablePaymentSourceRoute } from './availablePaymentSourceRoute'
import type { AvailablePaymentTaskModel } from '../types'

describe('available payment source route', () => {
  it('routes consumable order tasks to the consumable order editor', () => {
    expect(getAvailablePaymentSourceRoute(createModel({ consumableOrderNetUid: 'order-1' }))).toBe(
      '/accounting/consumable-orders/edit/order-1',
    )
  })

  it('routes Ukraine supply order and delivery protocol tasks to migrated screens', () => {
    expect(getAvailablePaymentSourceRoute(createModel({ supplyOrderUkraineNetUid: 'ua-order-1' }))).toBe(
      '/orders/ukraine/view/ua-order-1',
    )
    expect(getAvailablePaymentSourceRoute(createModel({ deliveryProductProtocolNetUid: 'protocol-1' }))).toBe(
      '/product-delivery-protocols/protocol-1',
    )
  })

  it('does not create a route for deferred supply order links', () => {
    expect(getAvailablePaymentSourceRoute(createModel({ supplyOrderNetUid: 'deferred-order-1' }))).toBeNull()
  })
})

function createModel(overrides: Partial<AvailablePaymentTaskModel> = {}): AvailablePaymentTaskModel {
  return {
    columns: [],
    currencyCode: '',
    deliveryProductProtocolNetUid: '',
    documents: [],
    grossPrice: 0,
    id: 'task-1',
    organizationName: '',
    organizationNetUid: '',
    rows: [],
    serviceAgreementNetId: '',
    serviceName: '',
    serviceNumber: '',
    supplyOrderNetUid: '',
    supplyOrderUkraineNetUid: '',
    task: {},
    ...overrides,
  }
}
