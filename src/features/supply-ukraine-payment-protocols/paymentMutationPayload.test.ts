import { describe, expect, it } from 'vitest'
import { createUkrainePaymentMutationPayload } from './paymentMutationPayload'
import type { MergedService, SupplyOrderUkrainePaymentDeliveryProtocol } from './types'

describe('createUkrainePaymentMutationPayload', () => {
  it('submits only the targeted financial aggregate and preserves the required order graph', () => {
    const targetService: MergedService = {
      Id: 11,
      NetUid: 'ef95762c-dbf1-4822-be36-dd41db7b63d3',
    }
    const unrelatedService: MergedService = {
      Id: 12,
      NetUid: '0de76100-eb01-485e-a3ab-9c3c40e73869',
      SupplyPaymentTask: {
        Id: 50,
        NetUid: '366784b2-4362-413a-9731-800763597755',
      },
    }
    const unrelatedProtocol: SupplyOrderUkrainePaymentDeliveryProtocol = {
      Id: 21,
      NetUid: '28a56e58-ff3d-4c57-b17e-3efdc5c50f49',
    }
    const orderItems = [{ Id: 31 }]
    const order = {
      Id: 1,
      NetUid: '4de01ec4-2815-4fe1-84e9-f41fd3e361ff',
      MergedServices: [targetService, unrelatedService],
      SupplyOrderUkraineItems: orderItems,
      SupplyOrderUkrainePaymentDeliveryProtocols: [unrelatedProtocol],
    }

    const payload = createUkrainePaymentMutationPayload(order, {
      mergedServices: [targetService],
    })

    expect(payload.MergedServices).toEqual([targetService])
    expect(payload.SupplyOrderUkrainePaymentDeliveryProtocols).toEqual([])
    expect((payload as typeof order).SupplyOrderUkraineItems).toBe(orderItems)
  })
})
