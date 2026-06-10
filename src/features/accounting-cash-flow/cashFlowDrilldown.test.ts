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

    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 14,
        SupplyPaymentTask: {
          ConsumablesOrder: {
            NetUid: 'consumable-order-1',
          },
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/accounting/consumable-orders/edit/consumable-order-1')
  })

  it('routes consumable orders from direct rows and related outcome orders', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 10,
        ConsumablesOrder: { NetUid: 'consumable-order-2' },
      } as AccountingCashFlowHeadItem),
    ).toBe('/accounting/consumable-orders/edit/consumable-order-2')

    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 11,
        OutcomePaymentOrder: {
          NetUid: 'outcome-2',
          OutcomePaymentOrderConsumablesOrders: [
            {
              Deleted: true,
              ConsumablesOrder: { NetUid: 'deleted-consumable-order' },
            },
            {
              ConsumablesOrder: { NetUid: 'consumable-order-3' },
            },
          ],
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/accounting/consumable-orders/edit/consumable-order-3')
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

  it('routes sale rows to the focused Ukraine sale drawer', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 13,
        Sale: { NetUid: 'sale-1' },
      } as AccountingCashFlowHeadItem),
    ).toBe('/sales/ukraine/all?saleNetId=sale-1')
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

  it('routes plain payment orders to their cashflow lists with focused order params', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 11,
        OutcomePaymentOrder: {
          FromDate: '2026-06-10T08:15:00Z',
          NetUid: 'outcome-plain-1',
        },
      } as AccountingCashFlowHeadItem),
    ).toBe('/accounting/outgoing-cashflow?orderNetId=outcome-plain-1&from=2026-06-10&to=2026-06-10')

    expect(
      getAccountingCashFlowDrilldownRoute({
        FromDate: '2026-06-09T10:00:00Z',
        IncomePaymentOrder: {
          NetUid: 'income-1',
        },
        Type: 12,
      } as AccountingCashFlowHeadItem),
    ).toBe('/accounting/income-cashflows?orderNetId=income-1&from=2026-06-09&to=2026-06-09')
  })

  it('keeps outcome rows with nested supply payment tasks in the cashflow detail drawer', () => {
    expect(
      getAccountingCashFlowDrilldownRoute({
        Type: 11,
        OutcomePaymentOrder: {
          NetUid: 'outcome-with-task',
          OutcomePaymentOrderSupplyPaymentTasks: [
            {
              SupplyPaymentTask: {
                NetUid: 'task-1',
              },
            },
          ],
        },
      } as AccountingCashFlowHeadItem),
    ).toBeNull()
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
        Type: 15,
        SaleReturn: { NetUid: 'sale-return-1' },
      } as AccountingCashFlowHeadItem),
    ).toBeNull()
  })
})
