import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { calculateConsumableOrder, getUnpaidConsumableOrdersByOrganization, updateConsumableOrder } from './consumableOrdersApi'
import type { ConsumablesOrder } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('consumableOrdersApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('strips UI-only local NetUid values before calculating an order', async () => {
    const order = createOrderWithLocalNetUids()

    apiRequestMock.mockResolvedValueOnce({
      Collection: [order],
      Total: 120,
    })

    await calculateConsumableOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/orders/calculate', {
      body: [
        expect.objectContaining({
          ConsumablesOrderItems: [
            expect.objectContaining({ NetUid: '2d11197c-d74e-4d15-b87a-4074750d79c9' }),
            expect.not.objectContaining({ NetUid: 'local-item' }),
          ],
          NetUid: '2d11197c-d74e-4d15-b87a-4074750d79c9',
        }),
      ],
      method: 'POST',
    })
    expect(order.ConsumablesOrderItems?.[1]?.NetUid).toBe('local-item')
  })

  it('strips UI-only local NetUid values from multipart update payloads', async () => {
    const order = createOrderWithLocalNetUids()
    const document = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })

    apiRequestMock.mockResolvedValueOnce(order)

    await updateConsumableOrder(order, [document])

    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as FormData
    const payload = JSON.parse(String(body.get('order'))) as ConsumablesOrder

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/orders/upload/update', {
      body,
      method: 'POST',
    })
    expect(body.getAll('documents')).toEqual([document])
    expect(payload.NetUid).toBe('2d11197c-d74e-4d15-b87a-4074750d79c9')
    expect(payload.ConsumablesOrderDocuments?.[0]).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[0]?.NetUid).toBe('2d11197c-d74e-4d15-b87a-4074750d79c9')
    expect(payload.ConsumablesOrderItems?.[1]).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[1]?.PaymentCostMovementOperation?.PaymentCostMovement).not.toHaveProperty('NetUid')
  })

  it('loads unpaid consumable orders for a supplier organization', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        {
          NetUid: 'order-1',
          ConsumablesOrderItems: null,
          OutcomePaymentOrderConsumablesOrders: null,
        },
      ],
    })

    const result = await getUnpaidConsumableOrdersByOrganization('supplier-1')

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/orders/all/unpaid', {
      query: {
        organizationNetId: 'supplier-1',
      },
    })
    expect(result).toEqual([
      expect.objectContaining({
        ConsumablesOrderItems: [],
        NetUid: 'order-1',
        OutcomePaymentOrderConsumablesOrders: [],
      }),
    ])
  })

  it('does not call the unpaid orders endpoint without supplier organization id', async () => {
    const result = await getUnpaidConsumableOrdersByOrganization('')

    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

function createOrderWithLocalNetUids(): ConsumablesOrder {
  const validNetUid = '2d11197c-d74e-4d15-b87a-4074750d79c9'

  return {
    NetUid: validNetUid,
    ConsumablesOrderDocuments: [
      {
        FileName: 'invoice.pdf',
        NetUid: 'local-document',
      },
    ],
    ConsumablesOrderItems: [
      {
        Id: 10,
        NetUid: validNetUid,
        PricePerItem: 100,
        Qty: 1,
      },
      {
        Id: -1,
        NetUid: 'local-item',
        PaymentCostMovementOperation: {
          PaymentCostMovement: {
            NetUid: 'local-movement',
            OperationName: 'Service',
          },
        },
        PricePerItem: 20,
        Qty: 1,
      },
    ],
  }
}
