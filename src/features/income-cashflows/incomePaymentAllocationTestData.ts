import type { IncomePaymentAllocationSummary, IncomePaymentOrder } from './types'

export const allocationGuid = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
export function allocationSummary(): IncomePaymentAllocationSummary {
  const paymentAmounts = [639.84, 3138.83, 3016.54, 1088.24, 482.98]
  return {
    Applicable: true, AccountingBaseCurrencyCode: 'EUR', PaymentCurrencyCode: 'UAH', PaymentAmount: 8400,
    AccountingBaseAmountsKnown: true, AllocatedAccountingBaseAmount: 160.5822,
    PaymentAmountsKnown: true, AllocatedPaymentAmount: 8366.43, UnallocatedPaymentAmount: 33.57, Reason: null,
    Rows: [...paymentAmounts.map((PaymentAmount, index) => ({ AllocationNetUid: allocationGuid(index + 1), SaleNetUid: allocationGuid(index + 101),
      Status: 'Allocated' as const, PaymentAmount, AccountingBaseAmount: [12.281, 60.2463, 57.8981, 20.8875, 9.2693][index] })),
    { AllocationNetUid: null, SaleNetUid: allocationGuid(106), Status: 'Unallocated', PaymentAmount: 33.57, AccountingBaseAmount: null }],
  }
}
export function allocationPayment(): IncomePaymentOrder {
  const summary = allocationSummary()
  return { NetUid: allocationGuid(1000), Number: '00000001507', OperationType: 0, Amount: 8400, Currency: { Code: 'UAH' },
    FromDate: '2026-11-02T12:00:00Z', AllocationSummary: summary,
    IncomePaymentOrderSales: summary.Rows.filter(row => row.Status === 'Allocated').map((row, index) => ({
      NetUid: row.AllocationNetUid!, Amount: row.AccountingBaseAmount!, Created: '2026-11-02T12:00:00Z',
      Sale: { NetUid: row.SaleNetUid!, SaleNumber: { Value: `SALE-${index + 1}` }, TotalAmount: 999999, TotalAmountLocal: 888888 },
    })),
  }
}
export function unknownAllocationSummary(): IncomePaymentAllocationSummary {
  return { ...allocationSummary(), AccountingBaseAmountsKnown: false, PaymentAmountsKnown: false,
    AllocatedAccountingBaseAmount: null, AllocatedPaymentAmount: null, UnallocatedPaymentAmount: null, Rows: [] }
}
