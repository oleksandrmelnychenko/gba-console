import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  calculateAdvanceReportConsumableOrder,
  calculateAdvanceReportOrder,
  searchAdvanceReportSupplyOrganizations,
  updateAdvanceReportOrder,
} from './advanceReportApi'
import type { AdvanceReportConsumablesOrder, AdvanceReportOrder } from '../advanceReportTypes'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('advanceReportApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('strips UI-only local NetUid values before calculating an advance report', async () => {
    const order = createOrderWithLocalNetUids()

    apiRequestMock.mockResolvedValueOnce({ Amount: 120, NetUid: 'order-1' })

    await calculateAdvanceReportOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/calculate', {
      body: expect.objectContaining({
        CompanyCarFuelings: [
          expect.not.objectContaining({ NetUid: 'local-fueling' }),
        ],
        NetUid: 'order-1',
        OutcomePaymentOrderConsumablesOrders: [
          expect.objectContaining({
            ConsumablesOrder: expect.objectContaining({
              ConsumablesOrderItems: [
                expect.not.objectContaining({ NetUid: 'local-item' }),
              ],
              NetUid: 'consumable-order-1',
            }),
          }),
        ],
      }),
      method: 'POST',
    })
    expect(order.OutcomePaymentOrderConsumablesOrders?.[0]?.NetUid).toBe('local-entry')
    expect(order.CompanyCarFuelings?.[0]?.NetUid).toBe('local-fueling')
  })

  it('does not send deleted fuel rows to calculation but keeps them in the returned order state', async () => {
    const order: AdvanceReportOrder = {
      Amount: 100,
      CompanyCarFuelings: [
        { Id: 1, NetUid: 'active-fuel', TotalPriceWithVat: 100 },
        { Deleted: true, Id: 2, NetUid: 'deleted-fuel', TotalPriceWithVat: 50 },
      ],
      NetUid: 'order-1',
    }

    apiRequestMock.mockResolvedValueOnce({
      Amount: 100,
      CompanyCarFuelings: [{ Id: 1, NetUid: 'active-fuel', TotalPriceWithVat: 100 }],
      NetUid: 'order-1',
    })

    const result = await calculateAdvanceReportOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/calculate', {
      body: expect.objectContaining({
        CompanyCarFuelings: [
          expect.objectContaining({ NetUid: 'active-fuel' }),
        ],
      }),
      method: 'POST',
    })
    expect((apiRequestMock.mock.calls[0][1]?.body as AdvanceReportOrder).CompanyCarFuelings)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ NetUid: 'deleted-fuel' })]))
    expect(result?.CompanyCarFuelings).toEqual([
      expect.objectContaining({ NetUid: 'active-fuel' }),
      expect.objectContaining({ Deleted: true, NetUid: 'deleted-fuel' }),
    ])
  })

  it('strips UI-only local NetUid values from multipart update payloads', async () => {
    const order = createOrderWithLocalNetUids()
    const document = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })

    apiRequestMock.mockResolvedValueOnce({ NetUid: 'order-1' })

    await updateAdvanceReportOrder(true, order, [document])

    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as FormData
    const payload = JSON.parse(String(body.get('order'))) as AdvanceReportOrder

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/orders/outcome/upload/update',
      expect.objectContaining({
        method: 'POST',
        query: { auto: true },
      }),
    )
    expect(body.getAll('documents')).toEqual([document])
    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.NetUid).toBeUndefined()
    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.NetUid).toBe('consumable-order-1')
    expect(payload.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder?.ConsumablesOrderItems?.[0]?.NetUid)
      .toBeUndefined()
    expect(payload.CompanyCarFuelings?.[0]?.NetUid).toBeUndefined()
  })

  it('strips invalid local NetUid values before calculating a consumable order', async () => {
    const order: AdvanceReportConsumablesOrder = {
      ConsumablesOrderItems: [
        {
          NetUid: 'local-consumable-item',
          Qty: 2,
        },
      ],
      NetUid: 'local-consumable-order',
    }

    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        {
          ConsumablesOrderItems: [{ NetUid: '2d11197c-d74e-4d15-b87a-4074750d79c9', Qty: 2 }],
          NetUid: 'd19db17c-9829-439d-afd7-b30c1a7525c0',
        },
      ],
    })

    await calculateAdvanceReportConsumableOrder(order)

    expect(apiRequestMock).toHaveBeenCalledWith('/consumables/orders/calculate', {
      body: [
        {
          ConsumablesOrderItems: [{ Qty: 2 }],
        },
      ],
      method: 'POST',
    })
    expect(order.NetUid).toBe('local-consumable-order')
    expect(order.ConsumablesOrderItems?.[0]?.NetUid).toBe('local-consumable-item')
  })

  it('searches supply organizations with bounded trimmed lookup params', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])

    await expect(searchAdvanceReportSupplyOrganizations('  service  ', 'organization-1')).resolves.toEqual([
      { NetUid: 'supplier-1', SupplyOrganizationAgreements: [] },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        limit: 20,
        offset: 0,
        organizationNetId: 'organization-1',
        value: 'service',
      },
    })
  })

  it('does not search supply organizations for blank lookup values', async () => {
    await expect(searchAdvanceReportSupplyOrganizations('   ', 'organization-1')).resolves.toEqual([])

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})

function createOrderWithLocalNetUids(): AdvanceReportOrder {
  return {
    Amount: 100,
    CompanyCarFuelings: [
      {
        FuelAmount: 10,
        NetUid: 'local-fueling',
      },
    ],
    NetUid: 'order-1',
    OutcomePaymentOrderConsumablesOrders: [
      {
        ConsumablesOrder: {
          ConsumablesOrderItems: [
            {
              NetUid: 'local-item',
              Qty: 2,
            },
          ],
          NetUid: 'consumable-order-1',
        },
        NetUid: 'local-entry',
      },
    ],
  }
}
