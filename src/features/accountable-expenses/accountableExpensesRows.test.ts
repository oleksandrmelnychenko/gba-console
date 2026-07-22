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

  it('does not create payable placeholder rows for orders without items', () => {
    expect(buildExpenseRows([
      {
        ConsumablesOrderItems: [],
        TotalAmount: 250,
      } satisfies ConsumablesOrder,
    ])).toEqual([])
  })

  it('filters deleted items and exact identity duplicates from rows and payment totals', () => {
    const rows = buildExpenseRows([
      {
        ConsumablesOrderItems: [
          {
            NetUid: ' SERVICE-1 ',
            TotalPriceWithVAT: 100,
          },
          {
            NetUid: 'service-1',
            TotalPriceWithVAT: 100,
          },
          {
            Deleted: true,
            NetUid: 'service-deleted',
            TotalPriceWithVAT: 900,
          },
        ],
        NetUid: 'order-1',
        TotalPaidAmount: 100,
      } satisfies ConsumablesOrder,
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.amount).toBe(100)
    expect(rows[0]?.paymentStatus).toBe('paid')
  })

  it('keeps same-looking rows with distinct identities and every idless row', () => {
    const rows = buildExpenseRows([
      {
        ConsumablesOrderItems: [
          { ConsumableProduct: { Name: 'Доставка' }, Id: 7 },
          { ConsumableProduct: { Name: 'Доставка' }, Id: 7 },
          { ConsumableProduct: { Name: 'Доставка' }, Id: 8 },
          { ConsumableProduct: { Name: 'Доставка' } },
          { ConsumableProduct: { Name: 'Доставка' } },
        ],
        Id: 1,
      },
      {
        ConsumablesOrderItems: [
          { ConsumableProduct: { Name: 'Доставка' }, Id: 7 },
        ],
        Id: 2,
      },
      {
        ConsumablesOrderItems: [{ Id: 9 }],
        Deleted: true,
        Id: 3,
      },
    ] satisfies ConsumablesOrder[])

    expect(rows).toHaveLength(5)
    expect(new Set(rows.map((row) => row.id)).size).toBe(5)
  })

  it('falls back to total price plus VAT when a with-VAT total is absent', () => {
    const [row] = buildExpenseRows([
      {
        ConsumablesOrderItems: [
          {
            TotalPrice: 80,
            VAT: 16,
          },
        ],
      } satisfies ConsumablesOrder,
    ])

    expect(row.amount).toBe(96)
  })

  it('builds encoded advance-report links from linked outcome payment orders', () => {
    expect(getAdvanceReportLink({ NetUid: 'report/1 2' })).toBe('/accounting/outgoing-cashflow/report%2F1%202/advanced-report/view')
    expect(getAdvanceReportLink({ NetUid: '   ' })).toBeNull()
    expect(getAdvanceReportLink(null)).toBeNull()
  })
})
