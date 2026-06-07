import { describe, expect, it } from 'vitest'
import { getAccountingCashFlowDrilldownRoute } from './cashFlowDrilldown'
import type { AccountingCashFlowHeadItem } from './types'

describe('cashFlowDrilldown', () => {
  it('routes Ukraine order rows to the order overview', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 16,
        SupplyOrderUkraine: { NetUid: 'order-1' },
      } as AccountingCashFlowHeadItem),
    ).toBe('/orders/ukraine/view/order-1')
  })

  it('routes Ukraine protocol rows to the payment protocols screen', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 18,
        SupplyOrderUkrainePaymentDeliveryProtocol: {
          SupplyOrderUkraine: { NetUid: 'order-2' },
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/orders/ukraine/protocols/order-2')
  })

  it('routes nested payment-task services to their connected screens', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 14,
        SupplyPaymentTask: {
          MergedServices: [
            {
              DeliveryProductProtocol: { NetUid: 'protocol-1' },
            },
          ],
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/product-delivery-protocols/protocol-1')
  })

  it('routes act providing services and resales', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 35,
        ActProvidingService: { NetUid: 'act-1' },
      } as AccountingCashFlowHeadItem),
    ).toBe('/act-providing-services/act-1')

    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 37,
        UpdatedReSaleModel: {
          ReSale: { NetUid: 'resale-1' },
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/resales/resale-1')
  })

  it('routes under-report outcome orders to advance reports', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 11,
        OutcomePaymentOrder: {
          IsUnderReport: true,
          NetUid: 'outcome-1',
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/accounting/outgoing-cashflow/outcome-1/advanced-report/view')
  })

  it('does not create routes for skipped or unsupported rows', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 19,
        ProductIncome: { NetUid: 'product-income-pl' },
      } as AccountingCashFlowHeadItem),
    ).toBeNull()

    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 13,
        Sale: { NetUid: 'sale-1' },
      } as AccountingCashFlowHeadItem),
    ).toBeNull()
  })
})
