import { describe, expect, it } from 'vitest'
import { buildExpenseRows, getAdvanceReportLink } from './accountableExpenseRows'
import type { ConsumablesOrder } from './types'

describe('accountable expense rows', () => {
  it('summarizes all active outcome-payment links instead of only the first one', () => {
    const [row] = buildExpenseRows([
      {
        ConsumablesOrderItems: [
          {
            ConsumableProduct: {
              Name: 'Папір',
              VendorCode: 'P-1',
            },
            TotalPriceWithVAT: 100,
          },
        ],
        OutcomePaymentOrderConsumablesOrders: [
          {
            OutcomePaymentOrder: {
              AdvanceNumber: 'ADV-1',
              Amount: 40,
              Colleague: { FirstName: 'Іван', LastName: 'Петренко' },
              IsUnderReport: true,
              IsUnderReportDone: true,
              Organization: { Name: 'ТОВ А' },
              PaymentCurrencyRegister: { Currency: { Code: 'UAH' } },
            },
          },
          {
            OutcomePaymentOrder: {
              AdvanceNumber: 'ADV-2',
              Amount: 30,
              Colleague: { FirstName: 'Олена', LastName: 'Шевченко' },
              IsUnderReport: true,
              IsUnderReportDone: false,
              Organization: { Name: 'ТОВ Б' },
              PaymentCurrencyRegister: { Currency: { Code: 'EUR' } },
            },
          },
        ],
        TotalAmount: 100,
      } satisfies ConsumablesOrder,
    ])

    expect(row.advanceNumber).toBe('ADV-1, ADV-2')
    expect(row.currency).toBe('UAH, EUR')
    expect(row.organization).toBe('ТОВ А, ТОВ Б')
    expect(row.payedTo).toBe('Петренко Іван, Шевченко Олена')
    expect(row.paidAmount).toBeUndefined()
    expect(row.paymentStatus).toBe('unpaid')
    expect(row.underReportStatus).toBe('mixed')
  })

  it('uses consumables-order paid total instead of full linked outcome totals for payment status', () => {
    const [row] = buildExpenseRows([
      {
        ConsumablesOrderItems: [
          {
            TotalPriceWithVAT: 100,
          },
        ],
        OutcomePaymentOrderConsumablesOrders: [
          {
            OutcomePaymentOrder: {
              Amount: 1_000,
            },
          },
        ],
        TotalAmount: 100,
        TotalPaidAmount: 30,
      } satisfies ConsumablesOrder,
    ])

    expect(row.paidAmount).toBe(30)
    expect(row.paymentStatus).toBe('partial')
  })

  it('builds encoded advance-report links from linked outcome payment orders', () => {
    expect(getAdvanceReportLink({ NetUid: 'report/1 2' })).toBe('/accounting/outgoing-cashflow/report%2F1%202/advanced-report/view')
    expect(getAdvanceReportLink({ NetUid: '   ' })).toBeNull()
    expect(getAdvanceReportLink(null)).toBeNull()
  })
})
