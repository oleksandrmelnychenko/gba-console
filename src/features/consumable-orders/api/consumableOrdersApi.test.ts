import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OUTCOME_OPERATION_TYPE } from '../../outgoing-cashflows/outgoingCreateTypes'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  calculateConsumableOrder,
  calculateConsumableOrderForPayment,
  createOutcomePaymentOrder,
  createPaymentMovement,
  getConsumableOrder,
  getConsumableOrderForPayment,
  getConsumableOrders,
  getUnpaidConsumableOrdersByOrganization,
  searchConsumableOrders,
  searchConsumableStorages,
  updateConsumableOrder,
} from './consumableOrdersApi'
import type { ConsumablesOrder, OutcomePaymentOrder } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('consumableOrdersApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }))
  })

  it('strips UI-only local NetUid values before calculating an order', async () => {
    const order = createOrderWithLocalNetUids()

    apiRequestMock.mockResolvedValueOnce({
      Collection: [order],
      Total: 120,
    })

    await calculateConsumableOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/orders/accounting/calculate', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/orders/accounting/upload/update', {
      body,
      dedupe: false,
      headers: {
        'Idempotency-Key': expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        'X-Consumables-Mutation-Owner': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      method: 'POST',
    })
    expect(body.getAll('documents')).toEqual([document])
    expect(payload.NetUid).toBe('2d11197c-d74e-4d15-b87a-4074750d79c9')
    expect(payload.ConsumablesOrderDocuments?.[0]).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[0]?.NetUid).toBe('2d11197c-d74e-4d15-b87a-4074750d79c9')
    expect(payload.ConsumablesOrderItems?.[1]).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[1]).not.toHaveProperty('Id')
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

  it('loads the full consumable storage directory before a search value is entered', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ConsumablesStorages: [
        { NetUid: 'storage-1', Name: 'Автомобілі компанії' },
        { NetUid: 'storage-2', Name: 'Ввід боргів з 1С' },
      ],
    })

    const result = await searchConsumableStorages('   ')

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/storages/all')
    expect(result).toHaveLength(2)
  })

  it('uses the consumable storage search endpoint for entered text', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ConsumablesStorages: [{ NetUid: 'storage-1', Name: 'Автомобілі компанії' }],
    })

    await searchConsumableStorages('  авто  ')

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/storages/search', {
      query: {
        value: 'авто',
      },
    })
  })

  it('sends an idempotency key for the JSON outcome payment mutation', async () => {
    const operationId = '88888888-8888-4888-8888-888888888888'
    const order: OutcomePaymentOrder = {
      Amount: 90,
      NetUid: 'outcome-1',
      OperationType: OUTCOME_OPERATION_TYPE.PaymentToSupplier,
    }
    apiRequestMock.mockResolvedValueOnce(order)

    await createOutcomePaymentOrder(order, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/consumable-orders/pay', {
      body: order,
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it('uses permission-scoped registry, detail and payment read routes', async () => {
    apiRequestMock.mockResolvedValue({ Items: [] })

    await getConsumableOrders({ from: '2026-08-01', limit: 25, offset: 0, to: '2026-08-18' })
    await searchConsumableOrders('invoice', { from: '2026-08-01', limit: 25, offset: 0, to: '2026-08-18' })
    await getConsumableOrder('order-1')
    await getConsumableOrderForPayment('order-1')
    await calculateConsumableOrderForPayment({ NetUid: 'order-1' })

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/consumables/orders/accounting/all',
      '/consumables/orders/accounting/search',
      '/consumables/orders/accounting/get',
      '/consumables/orders/accounting/pay/get',
      '/consumables/orders/accounting/pay/calculate',
    ])
  })

  it('creates cashflow articles through the already protected accounting route', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'movement-1', OperationName: 'Послуги' })

    await createPaymentMovement('Послуги')

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/movements/accounting/new', {
      body: { OperationName: 'Послуги' },
      method: 'POST',
    })
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
